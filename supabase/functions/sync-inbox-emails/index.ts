import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { ImapFlow } from 'npm:imapflow@1.0.162';
import { simpleParser } from 'npm:mailparser@3.7.2';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-User-Token, X-User-Id',
};

interface EmailAccount {
  id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password: string;
  use_ssl: boolean;
  is_active: boolean;
}

interface NormalizedImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useSsl: boolean;
  isGoDaddy: boolean;
}

interface ImapAttemptResult {
  name: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  success: boolean;
  error?: string;
  code?: string;
}

interface ImapConnectOption {
  host: string;
  auth: {
    user: string;
    pass: string;
  };
  logger: {
    debug: (obj: any) => void;
    info: (obj: any) => void;
    warn: (obj: any) => void;
    error: (obj: any) => void;
  };
  port: number;
  secure: boolean;
  doSTARTTLS?: boolean;
  requireTLS?: boolean;
  tls?: {
    rejectUnauthorized: boolean;
    servername?: string;
    minVersion?: string;
  };
  greetingTimeout: number;
  socketTimeout: number;
  connectionTimeout: number;
  disableAutoIdle: boolean;
  name: string;
}

const chatTokenRegex = /\[CRM-CHAT:([0-9a-fA-F-]{36})\]/;

type RecipientItem = { email: string; name?: string };

const toRecipientList = (value: any): RecipientItem[] => {
  const list = value?.value || [];
  return list
    .map((entry: any) => ({
      email: String(entry?.address || '').trim(),
      name: entry?.name ? String(entry.name).trim() : undefined,
    }))
    .filter((entry: RecipientItem) => !!entry.email);
};

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const looksLikeRawMimeSource = (value: string): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return (
    normalized.includes('return-path:') &&
    normalized.includes('content-type:') &&
    normalized.includes('mime-version:')
  );
};

const looksLikeHtmlContent = (value: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    (normalized.includes('<body') && normalized.includes('</body>')) ||
    /<\/?[a-z][\s\S]*>/i.test(normalized)
  );
};

const toRawUtf8 = (source: unknown): string => {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (source instanceof Uint8Array) {
    try {
      return new TextDecoder('utf-8').decode(source);
    } catch {
      return '';
    }
  }
  return String(source);
};

const decodeQuotedPrintable = (input: string): string => {
  if (!input) return '';
  const normalized = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === '=' && /^[A-Fa-f0-9]{2}$/.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    bytes.push(normalized.charCodeAt(index));
  }

  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return normalized;
  }
};

const extractMimePart = (raw: string, mimeType: 'text/plain' | 'text/html'): string => {
  const regex = new RegExp(`Content-Type:\\s*${mimeType}[^\\n]*[\\s\\S]*?\\r?\\n\\r?\\n([\\s\\S]*?)(?:\\r?\\n--[^\\r\\n]+|$)`, 'i');
  const match = raw.match(regex);
  if (!match?.[1]) return '';

  const transferEncodingMatch = match[0].match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
  const encoding = transferEncodingMatch?.[1]?.trim().toLowerCase() || '';
  const part = match[1].trim();

  if (encoding.includes('quoted-printable')) {
    return decodeQuotedPrintable(part);
  }

  return part;
};

const parseMimeContent = async (source: any) => {
  if (!source) {
    return {
      subject: null,
      fromEmail: null,
      fromName: null,
      toList: [] as RecipientItem[],
      ccList: [] as RecipientItem[],
      bodyText: '',
      bodyHtml: '',
      attachments: [] as Array<{ filename: string; size: number; type: string }>,
    };
  }

  const rawSourceText = toRawUtf8(source);
  const parsed = await simpleParser(source);
  const from = parsed?.from?.value?.[0];

  let parsedBodyHtml = typeof parsed?.html === 'string'
    ? parsed.html
    : (parsed?.html ? String(parsed.html) : '');
  let parsedBodyText = String(parsed?.text || '').trim();

  if (!parsedBodyHtml && looksLikeHtmlContent(parsedBodyText)) {
    parsedBodyHtml = parsedBodyText;
    parsedBodyText = stripHtml(parsedBodyText);
  }

  if (!parsedBodyHtml && looksLikeRawMimeSource(rawSourceText)) {
    const extractedHtml = extractMimePart(rawSourceText, 'text/html');
    const extractedText = extractMimePart(rawSourceText, 'text/plain');
    if (extractedHtml) {
      parsedBodyHtml = extractedHtml;
      parsedBodyText = extractedText || stripHtml(extractedHtml);
    } else if (extractedText && !parsedBodyText) {
      parsedBodyText = extractedText;
    }
  }

  if (!parsedBodyText && parsedBodyHtml) {
    parsedBodyText = stripHtml(parsedBodyHtml);
  }

  if (!parsedBodyHtml && rawSourceText && looksLikeHtmlContent(rawSourceText) && !looksLikeRawMimeSource(rawSourceText)) {
    parsedBodyHtml = rawSourceText;
    parsedBodyText = parsedBodyText || stripHtml(rawSourceText);
  }

  return {
    subject: parsed?.subject || null,
    fromEmail: from?.address ? String(from.address).trim() : null,
    fromName: from?.name ? String(from.name).trim() : null,
    toList: toRecipientList(parsed?.to),
    ccList: toRecipientList(parsed?.cc),
    bodyText: parsedBodyText || (parsedBodyHtml ? stripHtml(parsedBodyHtml) : ''),
    bodyHtml: parsedBodyHtml,
    attachments: (parsed?.attachments || []).map((attachment: any) => ({
      filename: attachment?.filename || 'adjunto',
      size: Number(attachment?.size || 0),
      type: String(attachment?.contentType || 'application/octet-stream'),
    })),
  };
};

async function tryImapConnection(config: any): Promise<ImapFlow> {
  const client = new ImapFlow(config);
  await client.connect();
  return client;
}

function normalizeImapConfig(account: EmailAccount): NormalizedImapConfig {
  const host = String(account.imap_host || '').trim().toLowerCase();
  const username = String(account.imap_username || '').trim();
  const password = String(account.imap_password || '');
  const requestedPort = Number(account.imap_port) || 0;
  const useSsl = Boolean(account.use_ssl || requestedPort === 993);
  const isGoDaddy = host.includes('secureserver.net') || host.includes('godaddy.com');

  const port = requestedPort > 0
    ? requestedPort
    : (useSsl ? 993 : 143);

  return {
    host,
    port,
    username,
    password,
    useSsl,
    isGoDaddy,
  };
}

async function connectImapWithFallback(
  account: EmailAccount,
  options?: { fastDiagnostic?: boolean }
): Promise<{
  client: ImapFlow;
  usedConfigName: string;
  attempts: ImapAttemptResult[];
}> {
  const normalized = normalizeImapConfig(account);
  const fastDiagnostic = !!options?.fastDiagnostic;
  const timeoutMain = fastDiagnostic ? 12000 : 90000;
  const timeoutStartTls = fastDiagnostic ? 10000 : 60000;
  const timeoutPlain = fastDiagnostic ? 8000 : 45000;

  const baseConfig = {
    host: normalized.host,
    auth: {
      user: normalized.username,
      pass: normalized.password,
    },
    logger: {
      debug: (obj: any) => console.log('[IMAP-DEBUG]', obj.msg || obj),
      info: (obj: any) => console.log('[IMAP-INFO]', obj.msg || obj),
      warn: (obj: any) => console.warn('[IMAP-WARN]', obj.msg || obj),
      error: (obj: any) => console.error('[IMAP-ERROR]', obj.msg || obj),
    },
  };

  const configs: ImapConnectOption[] = [
    {
      ...baseConfig,
      port: normalized.port,
      secure: normalized.useSsl,
      ...(normalized.useSsl ? { doSTARTTLS: false } : { requireTLS: true, doSTARTTLS: true }),
      tls: {
        rejectUnauthorized: false,
        servername: normalized.host,
        minVersion: 'TLSv1.2',
      },
      greetingTimeout: timeoutMain,
      socketTimeout: timeoutMain,
      connectionTimeout: timeoutMain,
      disableAutoIdle: true,
      name: `Configuración guardada (${normalized.port}/${normalized.useSsl ? 'SSL' : 'STARTTLS'})`
    },
    {
      ...baseConfig,
      port: 993,
      secure: true,
      doSTARTTLS: false,
      greetingTimeout: timeoutMain,
      socketTimeout: timeoutMain,
      connectionTimeout: timeoutMain,
      disableAutoIdle: true,
      name: 'SSL/TLS 993 (sin opciones TLS)'
    },
    {
      ...baseConfig,
      port: 993,
      secure: true,
      doSTARTTLS: false,
      tls: {
        rejectUnauthorized: false,
        servername: normalized.host,
      },
      greetingTimeout: timeoutMain,
      socketTimeout: timeoutMain,
      connectionTimeout: timeoutMain,
      disableAutoIdle: true,
      name: 'SSL/TLS 993 (sin minVersion forzada)'
    },
    {
      ...baseConfig,
      port: 993,
      secure: true,
      doSTARTTLS: false,
      tls: {
        rejectUnauthorized: false,
        servername: normalized.host,
        minVersion: 'TLSv1.2',
      },
      greetingTimeout: timeoutMain,
      socketTimeout: timeoutMain,
      connectionTimeout: timeoutMain,
      disableAutoIdle: true,
      name: normalized.isGoDaddy
        ? 'GoDaddy SSL/TLS directo 993'
        : 'SSL/TLS directo 993'
    },
    {
      ...baseConfig,
      port: 993,
      secure: true,
      doSTARTTLS: false,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        servername: normalized.host,
      },
      greetingTimeout: timeoutMain,
      socketTimeout: timeoutMain,
      connectionTimeout: timeoutMain,
      disableAutoIdle: true,
      name: 'SSL/TLS 993 (compatibilidad TLSv1+)'
    },
    {
      ...baseConfig,
      port: 143,
      secure: false,
      requireTLS: true,
      doSTARTTLS: true,
      greetingTimeout: timeoutStartTls,
      socketTimeout: timeoutStartTls,
      connectionTimeout: timeoutStartTls,
      disableAutoIdle: true,
      name: 'STARTTLS 143 (sin opciones TLS)'
    },
    {
      ...baseConfig,
      port: 143,
      secure: false,
      requireTLS: true,
      doSTARTTLS: true,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        servername: normalized.host,
      },
      greetingTimeout: timeoutStartTls,
      socketTimeout: timeoutStartTls,
      connectionTimeout: timeoutStartTls,
      disableAutoIdle: true,
      name: 'STARTTLS puerto 143'
    },
    {
      ...baseConfig,
      port: 143,
      secure: false,
      doSTARTTLS: false,
      tls: {
        rejectUnauthorized: false,
        servername: normalized.host,
      },
      greetingTimeout: timeoutPlain,
      socketTimeout: timeoutPlain,
      connectionTimeout: timeoutPlain,
      disableAutoIdle: true,
      name: 'Plano 143 (solo diagnóstico)'
    },
  ];

  const configsToUse = fastDiagnostic
    ? configs.filter((config) =>
        config.name.startsWith('Configuración guardada') ||
        config.name === 'SSL/TLS 993 (sin opciones TLS)' ||
        config.name === 'STARTTLS 143 (sin opciones TLS)'
      )
    : configs;

  const attempts: ImapAttemptResult[] = [];
  let lastError: any = null;

  for (const config of configsToUse) {
    try {
      console.log(`[SYNC-INBOX] Intentando: ${config.name}`);
      console.log(`[SYNC-INBOX] Puerto: ${config.port}, Secure: ${config.secure}, RequireTLS: ${config.requireTLS || false}`);
      console.log(`[SYNC-INBOX] Timeouts - Greeting: ${config.greetingTimeout || 'default'}, Socket: ${config.socketTimeout || 'default'}`);

      const client = await tryImapConnection(config);
      attempts.push({
        name: config.name,
        port: config.port,
        secure: !!config.secure,
        requireTLS: !!config.requireTLS,
        success: true,
      });

      console.log(`[SYNC-INBOX] Conexion exitosa con: ${config.name}`);
      return {
        client,
        usedConfigName: config.name,
        attempts,
      };
    } catch (error: any) {
      console.error(`[SYNC-INBOX] Fallo ${config.name}:`, error?.message);
      console.error(`[SYNC-INBOX] Error code:`, error?.code);
      lastError = error;
      attempts.push({
        name: config.name,
        port: config.port,
        secure: !!config.secure,
        requireTLS: !!config.requireTLS,
        success: false,
        error: error?.message,
        code: error?.code,
      });
      if (!fastDiagnostic) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw Object.assign(
    new Error(`No se pudo conectar con ninguna configuracion. Ultimo error: ${lastError?.message}`),
    {
      code: lastError?.code,
      attempts,
    }
  );
}

async function fetchEmailsFromIMAP(account: EmailAccount, userId: string, supabase: any): Promise<number> {
  const normalized = normalizeImapConfig(account);

  console.log(`[SYNC-INBOX] Connecting to IMAP: ${normalized.host}:${normalized.port}`);
  console.log(`[SYNC-INBOX] SSL/TLS enabled: ${normalized.useSsl}`);
  console.log(`[SYNC-INBOX] GoDaddy profile: ${normalized.isGoDaddy}`);
  console.log(`[SYNC-INBOX] Username: ${normalized.username}`);
  console.log(`[SYNC-INBOX] Password length: ${normalized.password?.length || 0}`);

  const { client, usedConfigName } = await connectImapWithFallback(account);
  console.log(`[SYNC-INBOX] Configuración IMAP usada: ${usedConfigName}`);

  let syncedCount = 0;

  try {
    console.log('[SYNC-INBOX] Connection state:', client.authenticated ? 'authenticated' : 'not authenticated');

    const lock = await client.getMailboxLock('INBOX');
    console.log(`[SYNC-INBOX] INBOX opened. Total messages: ${client.mailbox.exists}`);

    try {
      if (client.mailbox.exists === 0) {
        console.log('[SYNC-INBOX] No messages in INBOX');
        return 0;
      }

      const fetchCount = Math.min(50, client.mailbox.exists);
      const startSeq = Math.max(1, client.mailbox.exists - fetchCount + 1);
      console.log(`[SYNC-INBOX] Fetching last ${fetchCount} messages (${startSeq}:${client.mailbox.exists})`);

      for await (const message of client.fetch(`${startSeq}:*`, {
        envelope: true,
        bodyStructure: true,
        source: true,
        uid: true,
      })) {
        try {
          const envelopeMessageId = String(message.envelope?.messageId || '').trim();
          const messageId = envelopeMessageId || `imap-${account.id}-${message.uid}`;

          const { data: existingEmail } = await supabase
            .from('inbox_emails')
            .select('id, body_html')
            .eq('message_id', messageId)
            .eq('account_id', account.id)
            .maybeSingle();

          const existingHasHtml = !!String(existingEmail?.body_html || '').trim();
          if (existingEmail && existingHasHtml) {
            console.log(`[SYNC-INBOX] Message ${messageId} already exists, skipping`);
            continue;
          }

          const from = message.envelope?.from?.[0];
          const toList = (message.envelope?.to || []).map((entry: any) => ({
            email: entry?.address || '',
            name: entry?.name || undefined,
          })).filter((entry: any) => !!entry.email);

          const sourceContent = message.source || null;
          const mime = await parseMimeContent(sourceContent);
          const normalizedToList = mime.toList.length > 0
            ? mime.toList
            : (toList.length > 0 ? toList : [{ email: account.email_address }]);
          const subject = mime.subject || message.envelope?.subject || '(Sin asunto)';
          const fromEmail = mime.fromEmail || from?.address || 'unknown';
          const fromName = mime.fromName || from?.name || fromEmail || 'Unknown';
          const bodyText = mime.bodyText || '';
          const bodyHtml = mime.bodyHtml || '';

          const emailData = {
            account_id: account.id,
            user_id: userId,
            message_id: messageId,
            thread_id: message.envelope?.inReplyTo || null,
            subject,
            from_email: fromEmail,
            from_name: fromName,
            to_emails: normalizedToList,
            cc_emails: mime.ccList,
            bcc_emails: [],
            received_at: message.envelope?.date || new Date().toISOString(),
            email_date: message.envelope?.date || new Date().toISOString(),
            body_text: bodyText,
            body_html: bodyHtml,
            attachments: mime.attachments,
            is_read: message.flags?.has('\\Seen') || false,
            is_starred: message.flags?.has('\\Flagged') || false,
            is_archived: false,
            is_deleted: false,
            folder: 'inbox',
            labels: [],
          };

          const { error: insertError } = await supabase
            .from('inbox_emails')
            .upsert(emailData, { onConflict: 'account_id,message_id', ignoreDuplicates: true });

          if (insertError) {
            console.error(`[SYNC-INBOX] Error inserting email ${messageId}:`, insertError);
          } else {
            syncedCount++;
            console.log(`[SYNC-INBOX] Synced email: ${emailData.subject}`);

            const subject = emailData.subject || '';
            const tokenMatch = subject.match(chatTokenRegex);
            const conversationId = tokenMatch?.[1] || null;

            if (conversationId) {
              const senderName = emailData.from_name || 'Visitante';
              const bodyPreview = (emailData.body_text || '').slice(0, 4000);

              const { error: webchatMessageError } = await supabase
                .from('webchat_messages')
                .insert({
                  conversation_id: conversationId,
                  sender_type: 'visitor',
                  sender_id: `email:${messageId}`,
                  sender_name: senderName,
                  message: bodyPreview || `(Respuesta por email) ${subject}`,
                  attachments: emailData.attachments || [],
                });

              if (webchatMessageError) {
                console.error(`[SYNC-INBOX] Error mirroring inbound email to webchat ${conversationId}:`, webchatMessageError);
              } else {
                await supabase
                  .from('webchat_conversations')
                  .update({
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', conversationId);
              }
            }
          }
        } catch (msgError) {
          console.error('[SYNC-INBOX] Error processing message:', msgError);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log(`[SYNC-INBOX] Logged out. Total emails synced: ${syncedCount}`);

  } catch (error: any) {
    console.error('[SYNC-INBOX] IMAP error:', error?.message);

    try {
      if (client && client.usable) {
        await client.logout();
      }
    } catch (e: any) {
      console.error('[SYNC-INBOX] Error during logout:', e?.message);
    }

    throw new Error(`IMAP error: ${error?.message}`);
  }

  return syncedCount;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode = String(requestBody?.mode || 'sync').toLowerCase();
    const accountId = typeof requestBody?.accountId === 'string' ? requestBody.accountId : null;

    const userId = req.headers.get('X-User-Id');
    if (!userId) {
      throw new Error('Missing user ID header');
    }

    console.log(`[SYNC-INBOX] Syncing emails for user: ${userId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: accounts, error: accountsError } = await supabase
      .from('email_accounts')
      .select('*')
      .or(`created_by.eq.${userId},user_id.eq.${userId}`)
      .eq('is_active', true);

    if (accountsError) {
      throw accountsError;
    }

    console.log(`[SYNC-INBOX] Accounts found: ${accounts?.length || 0}`);

    if (mode === 'diagnostic') {
      if (!accounts || accounts.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No hay cuentas activas para diagnosticar',
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const selected = accountId
        ? accounts.find((acc: any) => acc.id === accountId)
        : [...accounts].sort((a, b) => {
            const aUpdated = new Date(a.updated_at || a.created_at || 0).getTime();
            const bUpdated = new Date(b.updated_at || b.created_at || 0).getTime();
            return bUpdated - aUpdated;
          })[0];

      if (!selected) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No se encontró la cuenta solicitada para diagnóstico',
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const normalized = normalizeImapConfig(selected as EmailAccount);

      try {
        const { client, usedConfigName, attempts } = await connectImapWithFallback(selected as EmailAccount, {
          fastDiagnostic: true,
        });
        const mailboxExists = client.mailbox?.exists ?? null;
        await client.logout();

        return new Response(
          JSON.stringify({
            success: true,
            mode: 'diagnostic',
            account: {
              id: selected.id,
              email_address: selected.email_address,
              host: normalized.host,
              port: normalized.port,
              use_ssl: normalized.useSsl,
              is_godaddy: normalized.isGoDaddy,
            },
            connection: {
              authenticated: true,
              usedConfigName,
              mailboxExists,
            },
            attempts,
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (diagError: any) {
        const attempts = Array.isArray(diagError?.attempts) ? diagError.attempts : [];
        const timeoutAttempts = attempts.filter((attempt: ImapAttemptResult) => attempt.code === 'CONNECT_TIMEOUT').length;
        const networkBlocked =
          diagError?.code === 'CONNECT_TIMEOUT' ||
          (timeoutAttempts > 0 && timeoutAttempts === attempts.length);

        return new Response(
          JSON.stringify({
            success: false,
            mode: 'diagnostic',
            account: {
              id: selected.id,
              email_address: selected.email_address,
              host: normalized.host,
              port: normalized.port,
              use_ssl: normalized.useSsl,
              is_godaddy: normalized.isGoDaddy,
            },
            error: diagError?.message || 'Error de diagnóstico IMAP',
            code: diagError?.code,
            attempts,
            diagnosis: networkBlocked
              ? 'No se pudo abrir conexión TCP al servidor IMAP desde la Edge Function (timeout en todos los intentos).'
              : 'La conexión IMAP falló por configuración/protocolo en algunos intentos.',
            recommendation: networkBlocked
              ? 'Verifica con GoDaddy si bloquea conexiones desde datacenters de terceros y prueba un relay/worker externo para IMAP.'
              : 'Revisa host/puerto/tipo de seguridad y vuelve a ejecutar el diagnóstico para identificar el intento correcto.',
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    let totalSynced = 0;
    const errors: string[] = [];

    if (accounts && accounts.length > 0) {
      const selectedAccounts = accountId
        ? accounts.filter((acc: any) => acc.id === accountId)
        : accounts;

      if (accountId && selectedAccounts.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No se encontró la cuenta solicitada para sincronización',
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const sortedAccounts = [...selectedAccounts].sort((a, b) => {
        const aUpdated = new Date(a.updated_at || a.created_at || 0).getTime();
        const bUpdated = new Date(b.updated_at || b.created_at || 0).getTime();
        return bUpdated - aUpdated;
      });

      for (const account of sortedAccounts) {
        try {
          console.log(`[SYNC-INBOX] Processing account: ${account.email_address}`);
          const synced = await fetchEmailsFromIMAP(account, userId, supabase);
          totalSynced += synced;
        } catch (error: any) {
          const errorMsg = `Error syncing account ${account.email_address}: ${error?.message}`;
          console.error(`[SYNC-INBOX] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`[SYNC-INBOX] ========== SYNC COMPLETED ==========`);
    console.log(`[SYNC-INBOX] Total emails synced: ${totalSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalSynced,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('[SYNC-INBOX] IMAP error:', error?.message);
    console.error('[SYNC-INBOX] Full error:', JSON.stringify(error, null, 2));
    console.error('[SYNC-INBOX] Error name:', error?.name);
    console.error('[SYNC-INBOX] Error code:', error?.code);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message,
        details: {
          name: error?.name,
          code: error?.code,
        },
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
