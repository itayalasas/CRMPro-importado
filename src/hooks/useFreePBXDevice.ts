import { useEffect, useRef, useState } from 'react';
import JsSIP from 'jssip';
import type { RTCSession } from 'jssip/lib/RTCSession';
import type { RTCSessionEvent } from 'jssip/lib/UA';
import { freepbxService } from '../lib/freepbxService';
import { startCallRecording, stopCallRecording } from '../lib/callRecorder';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export interface FreePBXCallAdapter {
  on(event: 'accept' | 'disconnect', handler: (...args: unknown[]) => void): void;
  removeListener(event: 'accept' | 'disconnect', handler: (...args: unknown[]) => void): void;
  disconnect(): void;
  parameters: { CallSid: string };
}

function normalizeOutboundNumber(rawNumber: string, defaultCountryCode: string): string {
  const digitsOnly = rawNumber.replace(/[^\d+]/g, '');
  if (digitsOnly.startsWith('+')) {
    return digitsOnly.slice(1);
  }
  if (defaultCountryCode && !digitsOnly.startsWith(defaultCountryCode)) {
    return `${defaultCountryCode}${digitsOnly}`;
  }
  return digitsOnly;
}

// Enlaza el audio remoto (RTP entrante) del WebRTC de la sesion a un <audio>
// oculto. Sin esto la llamada se conecta pero no se escucha nada.
// Se arma el MediaStream a mano (en vez de confiar en event.streams[0]) porque
// algunos backends SIP no asocian el track a un stream, y se deja diagnostico
// del estado ICE para poder distinguir "no llega el track" de "llega el track
// pero el candidato ICE nunca conecta" (esto ultimo generalmente significa que
// hace falta un servidor TURN, no solo STUN).
function attachRemoteAudio(session: RTCSession, audioEl: HTMLAudioElement): MediaStream {
  const remoteStream = new MediaStream();

  const bindTrack = (pc: RTCPeerConnection) => {
    pc.addEventListener('track', (event) => {
      console.log('[FreePBX] Track remoto recibido:', event.track.kind, event.track.readyState);
      remoteStream.addTrack(event.track);
      audioEl.srcObject = remoteStream;
      audioEl.muted = false;
      audioEl.play().catch((error) => console.error('[FreePBX] No se pudo reproducir audio remoto:', error));
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('[FreePBX] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('[FreePBX] ICE no pudo conectar. Si el track llegó pero no se escucha nada, probablemente haga falta un servidor TURN (STUN no alcanza cuando hay NAT/firewall restrictivo).');
      }
    });
  };

  if (session.connection) {
    bindTrack(session.connection);
  } else {
    session.on('peerconnection', ({ peerconnection }) => bindTrack(peerconnection));
  }

  return remoteStream;
}

// Genera un tono de "ring" local via Web Audio (sin depender de un archivo de
// audio) para el que llama, por si el troncal no manda early media/audio con
// el 180 Ringing.
function createRingbackPlayer() {
  let audioContext: AudioContext | null = null;
  let intervalId: number | null = null;

  const playTone = () => {
    if (!audioContext) return;
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.12;
    gainNode.connect(audioContext.destination);

    [440, 480].forEach((freq) => {
      const osc = audioContext!.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start();
      osc.stop(audioContext!.currentTime + 2);
    });
  };

  const start = () => {
    if (audioContext) return;
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    playTone();
    intervalId = window.setInterval(playTone, 6000);
  };

  const stop = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => undefined);
      audioContext = null;
    }
  };

  return { start, stop };
}

function wrapSession(session: RTCSession): FreePBXCallAdapter {
  const listeners: Record<'accept' | 'disconnect', Set<(...args: unknown[]) => void>> = {
    accept: new Set(),
    disconnect: new Set(),
  };

  session.on('accepted', (...args: unknown[]) => {
    listeners.accept.forEach((fn) => fn(...args));
  });
  session.on('ended', (...args: unknown[]) => {
    listeners.disconnect.forEach((fn) => fn(...args));
  });
  session.on('failed', (...args: unknown[]) => {
    listeners.disconnect.forEach((fn) => fn(...args));
  });

  return {
    on(event, handler) {
      listeners[event].add(handler);
    },
    removeListener(event, handler) {
      listeners[event].delete(handler);
    },
    disconnect() {
      if (!session.isEnded()) {
        session.terminate();
      }
    },
    parameters: { CallSid: session.id },
  };
}

export function useFreePBXDevice(enabled: boolean) {
  const { user } = useAuth();
  const toast = useToast();
  const [isReady, setIsReady] = useState(false);
  const [activeCall, setActiveCall] = useState<FreePBXCallAdapter | null>(null);
  const uaRef = useRef<JsSIP.UA | null>(null);
  const sessionRef = useRef<RTCSession | null>(null);
  const stunServerRef = useRef<string | undefined>(undefined);
  const toastRef = useRef(toast);
  const hasShownErrorRef = useRef(false);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const ringbackRef = useRef(createRingbackPlayer());

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    let mounted = true;

    const audioEl = document.createElement('audio');
    audioEl.id = 'freepbx-remote-audio';
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    document.body.appendChild(audioEl);
    remoteAudioElRef.current = audioEl;

    const setup = async () => {
      const config = await freepbxService.loadConfig(true);
      if (!config || !mounted) return;

      const extension = await freepbxService.loadUserExtension(user.id, true);
      if (!extension || !mounted) {
        toastRef.current?.error('No tenés una extensión SIP asignada. Pedile a un administrador que te asigne una en Configuración.');
        return;
      }

      stunServerRef.current = config.stun_server || undefined;

      try {
        const socket = new JsSIP.WebSocketInterface(config.websocket_url);
        const ua = new JsSIP.UA({
          sockets: [socket],
          uri: `sip:${extension.sip_extension}@${config.sip_domain}`,
          authorization_user: extension.sip_auth_user || extension.sip_extension,
          password: extension.sip_password,
          display_name: extension.display_name || user.name,
          register: true,
          session_timers: false,
        });

        ua.on('registered', () => {
          hasShownErrorRef.current = false;
          if (mounted) setIsReady(true);
        });

        ua.on('registrationFailed', (event) => {
          if (mounted) setIsReady(false);
          console.error('Registro SIP fallido:', event.cause, event.response?.status_code, event.response?.reason_phrase);
          if (!hasShownErrorRef.current) {
            hasShownErrorRef.current = true;
            toastRef.current?.error(`No se pudo registrar la extensión SIP (${event.cause || 'error desconocido'}). Verificá la configuración de FreePBX.`);
          }
        });

        ua.on('disconnected', () => {
          if (mounted) setIsReady(false);
        });

        ua.on('newRTCSession', ({ originator, session }: RTCSessionEvent) => {
          if (originator !== 'remote') return;

          sessionRef.current = session;
          session.answer({
            mediaConstraints: { audio: true, video: false },
            pcConfig: stunServerRef.current
              ? { iceServers: [{ urls: stunServerRef.current }] }
              : undefined,
          });

          if (remoteAudioElRef.current) {
            const remoteStream = attachRemoteAudio(session, remoteAudioElRef.current);
            startCallRecording(remoteStream, session.id);
          }

          const adapter = wrapSession(session);
          setActiveCall(adapter);

          session.on('ended', () => {
            sessionRef.current = null;
            setActiveCall(null);
            stopCallRecording();
          });
          session.on('failed', () => {
            sessionRef.current = null;
            setActiveCall(null);
            stopCallRecording();
          });
        });

        ua.start();
        uaRef.current = ua;
      } catch (error) {
        if (!hasShownErrorRef.current) {
          hasShownErrorRef.current = true;
          toastRef.current?.error('Error al conectar con el servidor FreePBX');
        }
      }
    };

    setup();

    return () => {
      mounted = false;
      ringbackRef.current.stop();
      if (uaRef.current) {
        uaRef.current.stop();
        uaRef.current = null;
      }
      audioEl.remove();
      remoteAudioElRef.current = null;
      setIsReady(false);
    };
  }, [enabled, user?.id]);

  const makeCall = async (phoneNumber: string): Promise<FreePBXCallAdapter | null> => {
    const ua = uaRef.current;
    if (!ua || !isReady) {
      toast.error('Dispositivo FreePBX no está listo');
      return null;
    }

    const config = freepbxService.getConfig();
    const normalized = normalizeOutboundNumber(phoneNumber, config?.default_country_code || '');
    const target = `sip:${normalized}@${config?.sip_domain}`;

    try {
      // La identidad saliente (From) usa la extensión registrada, no el
      // Caller ID saliente: la presentacion de CID hacia la PSTN la resuelve
      // el troncal de FreePBX del lado del servidor, no el cliente SIP.
      const session = ua.call(target, {
        mediaConstraints: { audio: true, video: false },
        pcConfig: stunServerRef.current
          ? { iceServers: [{ urls: stunServerRef.current }] }
          : undefined,
      });

      sessionRef.current = session;

      const remoteStream = remoteAudioElRef.current
        ? attachRemoteAudio(session, remoteAudioElRef.current)
        : null;

      const ringback = ringbackRef.current;
      session.on('progress', () => ringback.start());
      session.on('accepted', () => {
        ringback.stop();
        if (remoteStream) startCallRecording(remoteStream, session.id);
      });
      session.on('failed', () => ringback.stop());
      session.on('ended', () => ringback.stop());

      const adapter = wrapSession(session);
      setActiveCall(adapter);

      session.on('ended', () => {
        sessionRef.current = null;
        setActiveCall(null);
        stopCallRecording();
      });
      session.on('failed', () => {
        sessionRef.current = null;
        setActiveCall(null);
        stopCallRecording();
      });

      return adapter;
    } catch (error) {
      toast.error('Error al realizar la llamada por FreePBX');
      return null;
    }
  };

  const hangup = () => {
    if (sessionRef.current && !sessionRef.current.isEnded()) {
      sessionRef.current.terminate();
    }
    sessionRef.current = null;
    setActiveCall(null);
  };

  return { activeCall, isReady, hangup, makeCall };
}
