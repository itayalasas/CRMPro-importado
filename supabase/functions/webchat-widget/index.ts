import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Integration-Key',
};

const MAX_ATTACHMENT_MB = 10;
const MAX_ATTACHMENTS = 5;
const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_DOMAINS = ['dogcatify.com', 'www.dogcatify.com', 'localhost', '127.0.0.1'];
const ALLOWED_ATTACHMENT_TYPES = ['application/pdf'];

const isAllowedAttachmentType = (type: string | undefined | null) => {
  if (!type) return false;
  if (type.startsWith('image/')) return true;
  return ALLOWED_ATTACHMENT_TYPES.includes(type);
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const apiKeyHeader =
      req.headers.get('x-api-key') ||
      req.headers.get('X-API-KEY') ||
      req.headers.get('x-integration-key') ||
      req.headers.get('X-Integration-Key');
    const { data: settingsRow } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'webchat_settings')
      .maybeSingle();

    const expectedApiKey = settingsRow?.setting_value?.api_key as string | undefined;
    if (!expectedApiKey || !apiKeyHeader || apiKeyHeader !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedBody: any = {};
    try {
      const rawBody = await req.text();
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }

    const shouldHandleAsPost =
      req.method === 'POST' ||
      (req.method === 'GET' && (parsedBody?.message || (parsedBody?.attachments && parsedBody.attachments.length > 0)));

    if (!shouldHandleAsPost && req.method === 'GET') {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get('session_id');
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'session_id requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: conversation } = await supabase
        .from('webchat_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (!conversation) {
        const { data: queuedMessages } = await supabase
          .from('webchat_message_queue')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
        return new Response(
          JSON.stringify({ conversation: null, messages: [], queued_messages: queuedMessages || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: messages } = await supabase
        .from('webchat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      const { data: queuedMessages } = await supabase
        .from('webchat_message_queue')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      return new Response(
        JSON.stringify({ conversation, messages: messages || [], queued_messages: queuedMessages || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shouldHandleAsPost) {
      const {
        session_id,
        message,
        visitor,
        page_url,
        source_domain,
        source_channel,
        source_detail,
        sender_type,
        sender_name,
        created_at,
        message_type,
        queue_only,
        attachments = [],
      } = parsedBody || {};

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!message && (!attachments || attachments.length === 0)) {
        return new Response(
          JSON.stringify({ error: 'mensaje o adjunto requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (message && String(message).length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: `mensaje supera ${MAX_MESSAGE_LENGTH} caracteres` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (source_domain && !ALLOWED_DOMAINS.includes(source_domain)) {
        return new Response(
          JSON.stringify({ error: 'dominio no permitido' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
      const normalizeEnumText = (value: unknown) => normalizeText(value);

      const normalizeSenderTypeForQueue = (value: unknown): 'visitor' | 'bot' | 'system' => {
        const normalized = normalizeEnumText(value);
        if (normalized === 'agent') return 'bot';
        if (normalized === 'bot' || normalized === 'system' || normalized === 'visitor') return normalized;
        return 'visitor';
      };

      const inferLegacySenderType = (
        base: unknown,
        messageValue: unknown,
        senderNameValue: unknown,
        messageTypeValue: unknown
      ): 'visitor' | 'bot' | 'system' => {
        const normalizedBase = normalizeSenderTypeForQueue(base);

        // Treat agent request events as system messages (they are a workflow event,
        // not something the visitor "said" in the chat transcript).
        const messageType = normalizeEnumText(messageTypeValue);
        if (messageType === 'request_agent') return 'system';

        if (normalizedBase !== 'visitor') return normalizedBase;

        const senderName = normalizeText(senderNameValue);
        const visitorName = normalizeText(visitor?.name);

        // If a legacy widget sent sender_type incorrectly, we can often recover
        // from sender_name (e.g., "Dotty").
        if (senderName) {
          if (senderName === 'dotty' || senderName.includes('dotty')) return 'bot';
          if (visitorName && senderName !== visitorName) return 'bot';
        }

        const text = normalizeText(messageValue);
        if (!text) return normalizedBase;

        // Legacy widget versions sometimes sent bot/system messages as visitor.
        // Infer only for the fixed widget-generated phrases.
        if (
          text.startsWith('¡hola! soy dotty') ||
          text.includes('asistente automático') ||
          text.includes('respuesta automática')
        ) {
          return 'bot';
        }

        if (
          text.startsWith('estamos contactando a un agente disponible') ||
          text.startsWith('la conversación ha finalizado')
        ) {
          return 'system';
        }

        return normalizedBase;
      };

      const normalizeSenderTypeForMessages = (value: unknown): 'visitor' | 'agent' | 'system' => {
        const normalized = normalizeEnumText(value);
        if (normalized === 'bot') return 'agent';
        if (normalized === 'agent' || normalized === 'system' || normalized === 'visitor') return normalized;
        return 'visitor';
      };

      const allowedSenderTypes = ['visitor', 'bot', 'system', 'agent'] as const;
      const normalizedSenderTypeRaw = normalizeEnumText(sender_type);
      const normalizedSenderType = (allowedSenderTypes as readonly string[]).includes(normalizedSenderTypeRaw)
        ? normalizedSenderTypeRaw
        : 'visitor';
      const createdAtValue = created_at && !Number.isNaN(new Date(created_at).getTime()) ? created_at : undefined;

      if (queue_only) {
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          return new Response(
            JSON.stringify({ error: 'Adjuntos solo disponibles cuando un agente esté conectado.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const inferredSenderType = inferLegacySenderType(normalizedSenderType, message, sender_name, message_type);
        const queueSenderType = normalizeSenderTypeForQueue(inferredSenderType);
        const queueSenderName = queueSenderType === 'visitor'
          ? (sender_name || visitor?.name || null)
          : (sender_name || null);

        const { error: queueError } = await supabase
          .from('webchat_message_queue')
          .insert({
            session_id,
            sender_type: queueSenderType,
            sender_name: queueSenderName,
            message: message || null,
            created_at: createdAtValue || new Date().toISOString(),
            source_domain: source_domain || null,
            source_channel: source_channel || null,
            source_detail: source_detail || null,
            page_url: page_url || null,
          });

        if (queueError) {
          return new Response(
            JSON.stringify({ error: 'No se pudo encolar mensaje' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ queued: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let conversationId: string | null = null;
      let conversation: any = null;

      const { data: existingConversation } = await supabase
        .from('webchat_conversations')
        .select('*')
        .eq('session_id', session_id)
        .maybeSingle();

      if (existingConversation) {
        conversationId = existingConversation.id;
        conversation = existingConversation;
        if ((source_channel || source_detail) && (!existingConversation.source_channel || !existingConversation.source_detail)) {
          await supabase
            .from('webchat_conversations')
            .update({
              source_channel: existingConversation.source_channel || source_channel || null,
              source_detail: existingConversation.source_detail || source_detail || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingConversation.id);
        }
        if (!existingConversation.visitor_name && !visitor?.name) {
          const { data: nextNumber } = await supabase.rpc('next_webchat_visitor_number');
          const generatedName = nextNumber ? `Visitante #${nextNumber}` : 'Visitante';
          await supabase
            .from('webchat_conversations')
            .update({ visitor_name: generatedName, updated_at: new Date().toISOString() })
            .eq('id', existingConversation.id);
          conversation = { ...existingConversation, visitor_name: generatedName };
        }
      } else {
        let generatedVisitorName: string | null = visitor?.name || null;
        if (!generatedVisitorName) {
          const { data: nextNumber } = await supabase.rpc('next_webchat_visitor_number');
          generatedVisitorName = nextNumber ? `Visitante #${nextNumber}` : 'Visitante';
        }
        const { data: newConversation, error: insertError } = await supabase
          .from('webchat_conversations')
          .insert({
            session_id,
            source_domain: source_domain || null,
            source_channel: source_channel || null,
            source_detail: source_detail || null,
            page_url: page_url || null,
            visitor_id: visitor?.id || null,
            visitor_name: generatedVisitorName,
            visitor_email: visitor?.email || null,
            visitor_phone: visitor?.phone || null,
            status: 'open',
            last_message_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (insertError || !newConversation) {
          return new Response(
            JSON.stringify({ error: 'No se pudo crear conversación' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        conversationId = newConversation.id;
        conversation = newConversation;
      }

      const agentConnected = !!(
        conversation &&
        (conversation.assigned_user_id || ['assigned', 'taken', 'resolved'].includes(conversation.status))
      );

      if (attachments && Array.isArray(attachments) && attachments.length > 0 && !agentConnected) {
        return new Response(
          JSON.stringify({ error: 'Adjuntos solo disponibles cuando un agente esté conectado.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const uploadedAttachments: Array<{ filename: string; size: number; type: string; path?: string; url?: string }> = [];

      if (attachments && Array.isArray(attachments)) {
        if (attachments.length > MAX_ATTACHMENTS) {
          return new Response(
            JSON.stringify({ error: `máximo ${MAX_ATTACHMENTS} adjuntos` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        for (const att of attachments) {
          const filename = att.filename || `archivo-${Date.now()}`;
          const type = att.type || '';
          if (!isAllowedAttachmentType(type)) {
            return new Response(
              JSON.stringify({ error: 'Tipo de archivo no permitido. Solo imágenes y PDF.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const rawContent = typeof att.content === 'string' ? att.content : '';
          const base64 = rawContent.includes(',') ? rawContent.split(',')[1] : rawContent;
          if (!base64) {
            return new Response(
              JSON.stringify({ error: 'Adjunto inválido: falta contenido base64.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
            return new Response(
              JSON.stringify({ error: 'Adjunto inválido: base64 malformado.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          let buffer: Uint8Array;
          try {
            buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          } catch {
            return new Response(
              JSON.stringify({ error: 'Adjunto inválido: no se pudo decodificar base64.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (buffer.length / (1024 * 1024) > MAX_ATTACHMENT_MB) {
            return new Response(
              JSON.stringify({ error: `Adjunto supera ${MAX_ATTACHMENT_MB}MB` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const path = `conversations/${conversationId}/${Date.now()}-${filename}`;
          const { error: uploadError } = await supabase
            .storage
            .from('webchat-attachments')
            .upload(path, buffer, { contentType: type });

          if (uploadError) {
            return new Response(
              JSON.stringify({ error: `Error subiendo ${filename}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: publicData } = supabase.storage.from('webchat-attachments').getPublicUrl(path);

          uploadedAttachments.push({
            filename,
            size: buffer.length,
            type,
            path,
            url: publicData.publicUrl,
          });
        }
      }

      // NOTE: We intentionally keep queued transcript messages in webchat_message_queue.
      // They will be synced into webchat_messages when an agent takes the conversation.

      const messageSenderType = normalizeSenderTypeForMessages(
        inferLegacySenderType(normalizedSenderType, message, sender_name, message_type)
      );

      const messageSenderName = messageSenderType === 'visitor'
        ? (sender_name || visitor?.name || null)
        : (sender_name || null);

      const { error: messageError } = await supabase
        .from('webchat_messages')
        .insert({
          conversation_id: conversationId,
          sender_type: messageSenderType,
          sender_id: session_id,
          sender_name: messageSenderName,
          message: message || null,
          attachments: uploadedAttachments,
          ...(createdAtValue ? { created_at: createdAtValue } : {}),
        });

      if (messageError) {
        return new Response(
          JSON.stringify({ error: 'No se pudo guardar mensaje' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('webchat_conversations')
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return new Response(
        JSON.stringify({ success: true, conversation_id: conversationId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
