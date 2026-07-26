import { supabase } from './supabase';

// Graba la llamada del lado del navegador (mic local + audio remoto mezclados
// con Web Audio) y la sube a Storage cuando termina. No depende de nada del
// lado de FreePBX/Asterisk - sirve igual para Twilio o FreePBX.
interface ActiveRecording {
  recorder: MediaRecorder;
  chunks: Blob[];
  audioContext: AudioContext;
  micStream: MediaStream;
  mimeType: string;
  callSid: string;
}

let active: ActiveRecording | null = null;

export async function startCallRecording(remoteStream: MediaStream, callSid: string): Promise<void> {
  if (active) return;

  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const destination = audioContext.createMediaStreamDestination();

    audioContext.createMediaStreamSource(micStream).connect(destination);
    audioContext.createMediaStreamSource(remoteStream).connect(destination);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(destination.stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.start(1000);

    active = { recorder, chunks, audioContext, micStream, mimeType, callSid };
    console.log('[Grabación] Iniciada para la llamada', callSid);
  } catch (error) {
    console.error('[Grabación] No se pudo iniciar la grabación local:', error);
  }
}

export async function stopCallRecording(): Promise<void> {
  const current = active;
  active = null;
  if (!current) return;

  const { recorder, chunks, audioContext, micStream, mimeType, callSid } = current;

  await new Promise<void>((resolve) => {
    if (recorder.state === 'inactive') {
      resolve();
      return;
    }
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  micStream.getTracks().forEach((track) => track.stop());
  await audioContext.close().catch(() => undefined);

  if (chunks.length === 0) {
    console.warn('[Grabación] No se capturó audio, se descarta.');
    return;
  }

  const blob = new Blob(chunks, { type: mimeType });
  const extension = mimeType.includes('webm') ? 'webm' : 'audio';
  const filePath = `call-recordings/${callSid}.${extension}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('webchat-attachments')
      .upload(filePath, blob, { upsert: true, contentType: mimeType });

    if (uploadError) {
      console.error('[Grabación] Error subiendo la grabación:', uploadError);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('webchat-attachments').getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('calls')
      .update({ recording_url: publicUrlData.publicUrl, recording_sid: callSid })
      .eq('call_sid', callSid);

    if (updateError) {
      console.error('[Grabación] Error guardando el enlace de la grabación:', updateError);
    } else {
      console.log('[Grabación] Guardada y enlazada a la llamada', callSid, publicUrlData.publicUrl);
    }
  } catch (error) {
    console.error('[Grabación] Error inesperado guardando la grabación:', error);
  }
}
