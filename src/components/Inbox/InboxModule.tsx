import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getEnvVar } from '../../lib/envLoader';
import {
  Mail, Send, Inbox as InboxIcon, Plus, Ticket, Star, Archive, Trash2,
  Reply, Forward, RefreshCw, Search, Paperclip,
  X, Clock, Download, AlertCircle, Settings, Save
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { externalAuth } from '../../lib/externalAuth';
import { saveTicketCreateDraft } from '../../lib/ticketDraft';
import { recordClientInteractionSafely } from '../../lib/clientInteractionLogger';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface InboxEmail {
  id: string;
  account_id: string;
  user_id?: string;
  message_id: string;
  thread_id: string | null;
  from_email: string;
  from_name: string;
  to_emails: Array<{ email: string; name?: string }>;
  cc_emails: Array<{ email: string; name?: string }>;
  subject: string;
  body_text: string;
  body_html: string;
  attachments: Array<{ filename: string; size: number; type: string; url?: string }>;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  folder: string;
  labels: string[];
  email_date: string;
  created_at: string;
}

interface EmailDraft {
  id?: string;
  client_id?: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_html: string;
  original_quoted_html?: string;
  reply_to_id?: string;
  forward_from_id?: string;
  webchat_conversation_id?: string;
  webchat_source_channel?: string;
}

type InboxFolder = 'inbox' | 'outbox' | 'sent' | 'drafts' | 'starred' | 'archived' | 'trash';

type InboxCache = {
  activeFolder: InboxFolder;
  emailsByFolder: Partial<Record<InboxFolder, InboxEmail[]>>;
  latestEmailDateByFolder: Partial<Record<InboxFolder, string>>;
};

const inboxCacheByUser = new Map<string, InboxCache>();

const getOrCreateUserInboxCache = (userId: string): InboxCache => {
  const cached = inboxCacheByUser.get(userId);
  if (cached) return cached;

  const initialCache: InboxCache = {
    activeFolder: 'inbox',
    emailsByFolder: {},
    latestEmailDateByFolder: {},
  };

  inboxCacheByUser.set(userId, initialCache);
  return initialCache;
};

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

const decodeQuotedPrintable = (input: string): string => {
  if (!input) return '';
  const normalized = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index++) {
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

const getReadableEmailBody = (email: InboxEmail): { text: string; html: string } => {
  const bodyText = email.body_text || '';
  const bodyHtml = email.body_html || '';

  if (!looksLikeRawMimeSource(bodyText)) {
    if (!bodyHtml && looksLikeHtmlContent(bodyText)) {
      return {
        text: htmlToPlainText(bodyText),
        html: bodyText,
      };
    }

    return {
      text: bodyText,
      html: bodyHtml,
    };
  }

  const rawSource = bodyText || bodyHtml || '';
  const extractedHtml = extractMimePart(rawSource, 'text/html');
  const extractedText = extractMimePart(rawSource, 'text/plain');

  if (extractedHtml) {
    return {
      text: extractedText || htmlToPlainText(extractedHtml),
      html: extractedHtml,
    };
  }

  if (looksLikeHtmlContent(rawSource)) {
    return {
      text: htmlToPlainText(rawSource),
      html: rawSource,
    };
  }

  return {
    text: extractedText || email.subject || '(Sin contenido legible)',
    html: '',
  };
};

const htmlToPlainText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const textToHtml = (value: string): string =>
  escapeHtml(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());

const parseRecipientInput = (value: string): string[] => {
  if (!value) return [];

  const uniqueRecipients = new Set<string>();

  value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      uniqueRecipients.add(entry);
    });

  return Array.from(uniqueRecipients);
};

const getInvalidRecipients = (value: string): string[] =>
  parseRecipientInput(value).filter((email) => !isValidEmail(email));

const composeFontFamilyOptions = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

const composeFontSizeOptions = [12, 14, 16, 18];

const getComposePreferencesKey = (userId: string) => `inbox_compose_preferences_${userId}`;

const buildQuotedOriginalHtml = (email: InboxEmail): string => {
  const readable = getReadableEmailBody(email);
  const originalHtml = (readable.html || '').trim()
    ? readable.html
    : `<pre style="white-space:pre-wrap; margin:0;">${escapeHtml(readable.text || '(Sin contenido)')}</pre>`;

  return [
    '<div style="border-left:3px solid #d1d5db; padding-left:12px; margin-top:20px;">',
    `<p><strong>De:</strong> ${escapeHtml(email.from_name || email.from_email)}</p>`,
    `<p><strong>Fecha:</strong> ${escapeHtml(new Date(email.email_date).toLocaleString())}</p>`,
    `<p><strong>Asunto:</strong> ${escapeHtml(email.subject || '(Sin asunto)')}</p>`,
    '<br>',
    originalHtml,
    '</div>'
  ].join('');
};

const getTicketDescriptionFromEmail = (email: InboxEmail): string => {
  const readable = getReadableEmailBody(email);
  const plainText = (readable.text || '').trim();
  if (plainText) return plainText;
  if (readable.html) return htmlToPlainText(readable.html);
  return '(Sin contenido legible)';
};

const dedupeEmails = (emailList: InboxEmail[]): InboxEmail[] => {
  const seen = new Set<string>();

  return emailList.filter((email) => {
    const key = (email.message_id || '').trim() || email.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mapDraftToInboxEmail = (
  draft: {
    id: string;
    account_id?: string | null;
    to_emails?: string[] | Array<{ email: string; name?: string }>;
    cc_emails?: string[] | Array<{ email: string; name?: string }>;
    subject?: string | null;
    body_html?: string | null;
    created_at?: string | null;
  },
  currentUser: { email?: string; name?: string }
): InboxEmail => {
  const normalizeRecipients = (value: string[] | Array<{ email: string; name?: string }> | undefined) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (typeof entry === 'string') return { email: entry };
        return { email: entry?.email || '', name: entry?.name };
      })
      .filter((entry) => !!entry.email);
  };

  const createdAt = draft.created_at || new Date().toISOString();

  return {
    id: draft.id,
    account_id: draft.account_id || '',
    message_id: `draft-${draft.id}`,
    thread_id: null,
    from_email: currentUser.email || '',
    from_name: currentUser.name || currentUser.email || 'Borrador',
    to_emails: normalizeRecipients(draft.to_emails),
    cc_emails: normalizeRecipients(draft.cc_emails),
    subject: draft.subject || '(Sin asunto)',
    body_text: htmlToPlainText(draft.body_html || ''),
    body_html: draft.body_html || '',
    attachments: [],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_deleted: false,
    folder: 'drafts',
    labels: [],
    email_date: createdAt,
    created_at: createdAt,
  };
};

const buildTemporaryOutboxEmail = (args: {
  accountId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyHtml: string;
}): Omit<InboxEmail, 'id'> => {
  const now = new Date().toISOString();
  return {
    account_id: args.accountId,
    user_id: args.userId,
    message_id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    thread_id: null,
    from_email: args.userEmail || '',
    from_name: args.userName || args.userEmail || 'Usuario',
    to_emails: args.toEmails.map((email) => ({ email })),
    cc_emails: args.ccEmails.map((email) => ({ email })),
    subject: args.subject || '(Sin asunto)',
    body_text: htmlToPlainText(args.bodyHtml || ''),
    body_html: args.bodyHtml || '',
    attachments: [],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_deleted: false,
    folder: 'outbox',
    labels: ['sending'],
    email_date: now,
    created_at: now,
  };
};

export function InboxModule() {
  const { user } = useAuth();
  const toast = useToast();
  const { inboxRecipient, inboxContext, clearInboxRecipient, setActiveModule } = useNavigation();
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [activeFolder, setActiveFolder] = useState<InboxFolder>('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasEmailAccount, setHasEmailAccount] = useState(false);
  const [checkingEmailAccount, setCheckingEmailAccount] = useState(true);
  const [emailAccountId, setEmailAccountId] = useState<string | null>(null);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [outboxCount, setOutboxCount] = useState(0);
  const [draftsCount, setDraftsCount] = useState(0);

  const [composeData, setComposeData] = useState<EmailDraft>({
    client_id: null,
    to_emails: [],
    cc_emails: [],
    bcc_emails: [],
    subject: '',
    body_html: '',
    original_quoted_html: undefined,
  });

  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [showEmailViewer, setShowEmailViewer] = useState(false);
  const [composeFontFamily, setComposeFontFamily] = useState('Inter, system-ui, sans-serif');
  const [composeFontSize, setComposeFontSize] = useState(14);
  const [composeTextColor, setComposeTextColor] = useState('#0f172a');

  useEffect(() => {
    if (!user?.id) {
      setHasEmailAccount(false);
      setCheckingEmailAccount(false);
      return;
    }

    const cache = getOrCreateUserInboxCache(user.id);
    setActiveFolder(cache.activeFolder);
    setEmails(dedupeEmails(cache.emailsByFolder[cache.activeFolder] || []));
    setSelectedEmail(null);

    checkEmailAccount();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      const rawPreferences = localStorage.getItem(getComposePreferencesKey(user.id));
      if (!rawPreferences) return;

      const preferences = JSON.parse(rawPreferences);

      if (typeof preferences.fontFamily === 'string' && preferences.fontFamily.trim()) {
        setComposeFontFamily(preferences.fontFamily);
      }
      if (typeof preferences.fontSize === 'number' && composeFontSizeOptions.includes(preferences.fontSize)) {
        setComposeFontSize(preferences.fontSize);
      }
      if (typeof preferences.textColor === 'string' && preferences.textColor.trim()) {
        setComposeTextColor(preferences.textColor);
      }
    } catch (error) {
      console.warn('[INBOX] No se pudieron cargar preferencias del compositor:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      localStorage.setItem(
        getComposePreferencesKey(user.id),
        JSON.stringify({
          fontFamily: composeFontFamily,
          fontSize: composeFontSize,
          textColor: composeTextColor,
        })
      );
    } catch (error) {
      console.warn('[INBOX] No se pudieron guardar preferencias del compositor:', error);
    }
  }, [user?.id, composeFontFamily, composeFontSize, composeTextColor]);

  useEffect(() => {
    if (!user?.id || !hasEmailAccount) return;

    const cache = getOrCreateUserInboxCache(user.id);
    const cachedEmails = dedupeEmails(cache.emailsByFolder[activeFolder] || []);

    if (cachedEmails.length > 0) {
      setEmails(cachedEmails);
      loadEmails({ incrementalOnly: true });
      return;
    }

    loadEmails();
  }, [activeFolder, hasEmailAccount, user?.id]);

  useEffect(() => {
    if (selectedEmail && !emails.some((email) => email.id === selectedEmail.id)) {
      setSelectedEmail(null);
    }
  }, [emails, selectedEmail]);

  useEffect(() => {
    if (inboxRecipient) {
      setShowCompose(true);
      setComposeData({
        client_id: inboxContext?.clientId || null,
        to_emails: [inboxRecipient],
        cc_emails: [],
        bcc_emails: [],
        subject: inboxContext?.emailSubject || '',
        body_html: inboxContext?.emailBody || '',
        original_quoted_html: undefined,
        webchat_conversation_id: inboxContext?.webchatConversationId,
        webchat_source_channel: inboxContext?.sourceChannel,
      });
      setToInput(inboxRecipient);
      setComposeMode('new');
      clearInboxRecipient();
    }
  }, [inboxRecipient, inboxContext, clearInboxRecipient]);

  const checkEmailAccount = async () => {
    if (!user?.id) return;

    console.log('[INBOX] Checking email account for user:', user.id);
    setCheckingEmailAccount(true);

    const { data, error } = await supabase
      .from('email_accounts')
      .select('id')
      .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[INBOX] Error checking email account:', error);
      setEmailAccountId(null);
    } else {
      console.log('[INBOX] Email account found:', !!data);
      setEmailAccountId(data?.id || null);
    }

    setHasEmailAccount(!!data);
    setCheckingEmailAccount(false);
  };

  const refreshUnreadInboxCount = async (accountIdParam?: string | null) => {
    const accountId = accountIdParam || emailAccountId;
    if (!accountId) {
      setUnreadInboxCount(0);
      return;
    }

    const { data, error } = await supabase
      .from('inbox_emails')
      .select('id, message_id')
      .eq('account_id', accountId)
      .eq('folder', 'inbox')
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .eq('is_read', false);

    if (error) {
      console.error('[INBOX] Error loading unread inbox count:', error);
      return;
    }

    const uniqueUnread = new Set(
      (data || [])
        .map((row: { id?: string; message_id?: string }) => String(row?.message_id || row?.id || '').trim())
        .filter(Boolean)
    );

    setUnreadInboxCount(uniqueUnread.size);
  };

  const refreshDraftsCount = async () => {
    if (!user?.id) {
      setDraftsCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('email_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error) {
      console.error('[INBOX] Error loading drafts count:', error);
      return;
    }

    setDraftsCount(count || 0);
  };

  const refreshOutboxCount = async (accountIdParam?: string | null) => {
    const accountId = accountIdParam || emailAccountId;
    if (!accountId) {
      setOutboxCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('inbox_emails')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('folder', 'outbox')
      .eq('is_deleted', false);

    if (error) {
      console.error('[INBOX] Error loading outbox count:', error);
      return;
    }

    setOutboxCount(count || 0);
  };

  const processQueuedEmail = async (args: {
    outboxEmailId: string;
    toEmails: string[];
    ccEmails: string[];
    bccEmails: string[];
    subject: string;
    bodyHtml: string;
    bodyText: string;
    replyToId?: string;
    forwardFromId?: string;
    webchatConversationId?: string;
    webchatSourceChannel?: string;
    clientId?: string | null;
  }) => {
    if (!user?.id) return;

    try {
      const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
      const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

      const response = await fetch(`${supabaseUrl}/functions/v1/send-inbox-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          outbox_email_id: args.outboxEmailId,
          to_emails: args.toEmails,
          cc_emails: args.ccEmails,
          bcc_emails: args.bccEmails,
          subject: args.subject,
          body_html: args.bodyHtml,
          body_text: args.bodyText,
          reply_to_id: args.replyToId,
          forward_from_id: args.forwardFromId,
          webchat_conversation_id: args.webchatConversationId,
          webchat_source_channel: args.webchatSourceChannel,
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar email');
      }

      await recordClientInteractionSafely({
        client_id: args.clientId || null,
        type: 'email',
        description: `Email enviado a ${args.toEmails.join(', ')}`,
        metadata: {
          subject: args.subject,
          to_emails: args.toEmails,
          cc_emails: args.ccEmails,
          bcc_emails: args.bccEmails,
          reply_to_id: args.replyToId || null,
          forward_from_id: args.forwardFromId || null,
          webchat_conversation_id: args.webchatConversationId || null,
          webchat_source_channel: args.webchatSourceChannel || null,
        },
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      await refreshOutboxCount();
      if (activeFolder === 'outbox' || activeFolder === 'sent') {
        await loadEmails();
      }
      toast.success(result.message || 'Email enviado correctamente');
    } catch (error: any) {
      console.error('[INBOX] Queued send error:', error);
      await supabase
        .from('inbox_emails')
        .update({ labels: ['failed'] })
        .eq('id', args.outboxEmailId);
      await refreshOutboxCount();
      if (activeFolder === 'outbox') {
        await loadEmails();
      }
      toast.error(`Error al enviar desde bandeja de salida: ${error.message}`);
    }
  };

  const loadEmails = async ({ incrementalOnly = false }: { incrementalOnly?: boolean } = {}) => {
    if (!user?.id) return;

    console.log('[INBOX] Loading emails for folder:', activeFolder);
    setLoading(true);
    try {
      const cache = getOrCreateUserInboxCache(user.id);

      if (activeFolder === 'drafts') {
        const { data: drafts, error: draftsError } = await supabase
          .from('email_drafts')
          .select('id, account_id, to_emails, cc_emails, subject, body_html, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (draftsError) {
          console.error('[INBOX] Error loading drafts:', draftsError);
          throw draftsError;
        }

        const mappedDrafts = (drafts || []).map((draft) => mapDraftToInboxEmail(draft, {
          email: user.email,
          name: user.name,
        }));

        cache.emailsByFolder[activeFolder] = mappedDrafts;
        cache.latestEmailDateByFolder[activeFolder] = mappedDrafts[0]?.email_date;
        cache.activeFolder = activeFolder;
        setEmails(mappedDrafts);
        await refreshDraftsCount();
        return;
      }

      const { data: account } = await supabase
        .from('email_accounts')
        .select('id')
        .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
        .eq('is_active', true)
        .maybeSingle();

      if (!account) {
        console.log('[INBOX] No email account found');
        setEmails([]);
        setEmailAccountId(null);
        await refreshDraftsCount();
        setLoading(false);
        return;
      }

      console.log('[INBOX] Using account ID:', account.id);
      setEmailAccountId(account.id);

      let query = supabase
        .from('inbox_emails')
        .select('*')
        .eq('account_id', account.id)
        .order('email_date', { ascending: false });

      if (activeFolder === 'inbox') {
        query = query.eq('folder', 'inbox').eq('is_deleted', false).eq('is_archived', false);
      } else if (activeFolder === 'outbox') {
        query = query.eq('folder', 'outbox').eq('is_deleted', false);
      } else if (activeFolder === 'sent') {
        query = query.eq('folder', 'sent').eq('is_deleted', false);
      } else if (activeFolder === 'starred') {
        query = query.eq('is_starred', true).eq('is_deleted', false);
      } else if (activeFolder === 'archived') {
        query = query.eq('is_archived', true).eq('is_deleted', false);
      } else if (activeFolder === 'trash') {
        query = query.eq('is_deleted', true);
      }

      const latestCachedDate = cache.latestEmailDateByFolder[activeFolder];

      if (incrementalOnly && latestCachedDate) {
        query = query.gt('email_date', latestCachedDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[INBOX] Error loading emails:', error);
        throw error;
      }

      console.log(`[INBOX] Loaded ${data?.length || 0} emails for folder ${activeFolder}`);

      if (incrementalOnly) {
        if (!data || data.length === 0) return;

        setEmails((previousEmails) => {
          const merged = [...data, ...previousEmails];
          const deduped = dedupeEmails(merged);
          cache.emailsByFolder[activeFolder] = deduped;
          cache.latestEmailDateByFolder[activeFolder] = deduped[0]?.email_date || latestCachedDate;
          return deduped;
        });
        return;
      }

      const folderEmails = dedupeEmails(data || []);
      cache.emailsByFolder[activeFolder] = folderEmails;
      cache.latestEmailDateByFolder[activeFolder] = folderEmails[0]?.email_date;
      cache.activeFolder = activeFolder;
      setEmails(folderEmails);
      await refreshUnreadInboxCount(account.id);
      await refreshOutboxCount(account.id);
      await refreshDraftsCount();
    } catch (error: any) {
      toast.error(`Error al cargar emails: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderChange = (folder: InboxFolder) => {
    if (user?.id) {
      const cache = getOrCreateUserInboxCache(user.id);
      cache.activeFolder = folder;
    }
    setActiveFolder(folder);
    setSelectedEmail(null);
  };

  const handleOpenDraft = async (draftId: string) => {
    if (!user?.id) return;

    const { data: draft, error } = await supabase
      .from('email_drafts')
      .select('id, to_emails, cc_emails, bcc_emails, subject, body_html, reply_to_id, forward_from_id')
      .eq('id', draftId)
        .eq('user_id', user.id)
      .maybeSingle();

    if (error || !draft) {
      toast.error('No se pudo abrir el borrador');
      return;
    }

    const toList = Array.isArray(draft.to_emails)
      ? draft.to_emails.map((entry: unknown) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object' && 'email' in entry) {
            return String((entry as { email?: string }).email || '');
          }
          return '';
        }).filter(Boolean)
      : [];

    const ccList = Array.isArray(draft.cc_emails)
      ? draft.cc_emails.map((entry: unknown) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object' && 'email' in entry) {
            return String((entry as { email?: string }).email || '');
          }
          return '';
        }).filter(Boolean)
      : [];

    const bccList = Array.isArray(draft.bcc_emails)
      ? draft.bcc_emails.map((entry: unknown) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object' && 'email' in entry) {
            return String((entry as { email?: string }).email || '');
          }
          return '';
        }).filter(Boolean)
      : [];

    setComposeMode('new');
    setComposeData({
      id: draft.id,
      to_emails: toList,
      cc_emails: ccList,
      bcc_emails: bccList,
      subject: draft.subject || '',
      body_html: draft.body_html || '',
      original_quoted_html: undefined,
      reply_to_id: draft.reply_to_id || undefined,
      forward_from_id: draft.forward_from_id || undefined,
    });
    setToInput(toList.join(', '));
    setCcInput(ccList.join(', '));
    setBccInput(bccList.join(', '));
    setShowCc(ccList.length > 0);
    setShowBcc(bccList.length > 0);
    setSelectedEmail(null);
    setShowCompose(true);
  };

  const handleSyncEmails = async () => {
    if (!user?.id) return;

    console.log('[INBOX] Starting email sync');
    toast.info('Sincronizando emails...');
    setLoading(true);

    try {
      const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
      const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

      const externalToken = externalAuth.getStoredToken();
      if (!externalToken) {
        throw new Error('No hay sesión activa');
      }

      console.log('[INBOX] Calling sync-inbox-emails function with external auth token');

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-inbox-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'X-User-Token': externalToken,
          'X-User-Id': user.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: emailAccountId,
        }),
      });

      const result = await response.json();
      console.log('[INBOX] Sync result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar');
      }

      if ((result.totalSynced || 0) > 0) {
        await loadEmails();
      } else {
        await loadEmails({ incrementalOnly: true });
      }
      await refreshUnreadInboxCount();
      await refreshOutboxCount();
      await refreshDraftsCount();
      toast.success(`${result.totalSynced || 0} emails sincronizados correctamente`);
    } catch (error: any) {
      console.error('[INBOX] Sync error:', error);
      toast.error(`Error al sincronizar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (emailId: string, isRead: boolean) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_read: isRead })
      .eq('id', emailId);

    if (!error) {
      setEmails((prevEmails) => prevEmails.map((email) => (
        email.id === emailId ? { ...email, is_read: isRead } : email
      )));
      await refreshUnreadInboxCount();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, is_read: isRead });
      }
    }
  };

  const handleToggleStar = async (emailId: string, isStarred: boolean) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_starred: !isStarred })
      .eq('id', emailId);

    if (!error) {
      const nextStarValue = !isStarred;
      setEmails((prevEmails) => {
        const updated = prevEmails.map((email) => (
          email.id === emailId ? { ...email, is_starred: nextStarValue } : email
        ));

        if (activeFolder === 'starred') {
          return updated.filter((email) => email.is_starred);
        }

        return updated;
      });
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, is_starred: nextStarValue });
      }
    }
  };

  const handleArchive = async (emailId: string) => {
    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_archived: true })
      .eq('id', emailId);

    if (!error) {
      toast.success('Email archivado');
      setEmails((prevEmails) => prevEmails.filter((email) => email.id !== emailId));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    }
  };

  const handleDelete = async (emailId: string) => {
    if (activeFolder === 'drafts') {
      const { error: draftDeleteError } = await supabase
        .from('email_drafts')
        .delete()
        .eq('id', emailId);

      if (draftDeleteError) {
        toast.error(`Error al eliminar borrador: ${draftDeleteError.message}`);
        return;
      }

      setEmails((prevEmails) => prevEmails.filter((email) => email.id !== emailId));
      setSelectedEmail((prevSelected) => (prevSelected?.id === emailId ? null : prevSelected));
      await refreshDraftsCount();
      toast.success('Borrador eliminado');
      return;
    }

    const { error } = await supabase
      .from('inbox_emails')
      .update({ is_deleted: true })
      .eq('id', emailId);

    if (error) {
      toast.error(`Error al mover a papelera: ${error.message}`);
      return;
    }

    setEmails((prevEmails) => prevEmails.filter((email) => email.id !== emailId));
    setSelectedEmail((prevSelected) => (prevSelected?.id === emailId ? null : prevSelected));
    await refreshUnreadInboxCount();
    toast.success('Email movido a papelera');
  };

  const handleReply = (email: InboxEmail) => {
    const greetingName = email.from_name || email.from_email;
    setComposeMode('reply');
    setComposeData({
      client_id: composeData.client_id || inboxContext?.clientId || null,
      to_emails: [email.from_email],
      cc_emails: [],
      bcc_emails: [],
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body_html: `Hola ${greetingName},\n\n`,
      original_quoted_html: buildQuotedOriginalHtml(email),
      reply_to_id: email.id
    });
    setToInput(email.from_email);
    setShowCompose(true);
  };

  const handleForward = (email: InboxEmail) => {
    const toList = email.to_emails.map((recipient) => recipient.email).join(', ');
    setComposeMode('forward');
    setComposeData({
      client_id: composeData.client_id || inboxContext?.clientId || null,
      to_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body_html: [
        '---------- Mensaje reenviado ----------',
        `De: ${email.from_name || email.from_email}`,
        `Fecha: ${new Date(email.email_date).toLocaleString()}`,
        `Asunto: ${email.subject || '(Sin asunto)'}`,
        `Para: ${toList || '(Sin destinatarios)'}`,
        '',
      ].join('\n'),
      original_quoted_html: buildQuotedOriginalHtml(email),
      forward_from_id: email.id
    });
    setToInput('');
    setShowCompose(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) return;

    const normalizedToEmails = parseRecipientInput(toInput);
    const normalizedCcEmails = parseRecipientInput(ccInput);
    const normalizedBccEmails = parseRecipientInput(bccInput);
    const invalidToRecipients = normalizedToEmails.filter((email) => !isValidEmail(email));
    const invalidCcRecipients = normalizedCcEmails.filter((email) => !isValidEmail(email));
    const invalidBccRecipients = normalizedBccEmails.filter((email) => !isValidEmail(email));

    if (normalizedToEmails.length === 0) {
      toast.error('Debes ingresar al menos un destinatario');
      return;
    }

    if (invalidToRecipients.length > 0 || invalidCcRecipients.length > 0 || invalidBccRecipients.length > 0) {
      toast.error('Hay correos inválidos en Para/Cc/Bcc. Corrígelos antes de enviar.');
      return;
    }

    console.log('[INBOX] Sending email:', {
      to: normalizedToEmails,
      subject: composeData.subject
    });

    toast.info('Moviendo a bandeja de salida...');

    try {
      const { data: account } = await supabase
        .from('email_accounts')
        .select('id')
        .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
        .eq('is_active', true)
        .maybeSingle();

      if (!account) {
        toast.error('No tienes una cuenta de correo configurada');
        return;
      }

      const composerBodyRaw = composeData.body_html || '';
      const composerBodyHtml = /<[^>]+>/.test(composerBodyRaw)
        ? composerBodyRaw
        : textToHtml(composerBodyRaw);
      const styleWrappedBodyHtml = `<div style="font-family:${composeFontFamily}; font-size:${composeFontSize}px; color:${composeTextColor};">${composerBodyHtml}</div>`;
      const finalBodyHtml = composeData.original_quoted_html
        ? `${styleWrappedBodyHtml}<br><br>${composeData.original_quoted_html}`
        : styleWrappedBodyHtml;

      const queuedOutbox = buildTemporaryOutboxEmail({
        accountId: account.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        toEmails: normalizedToEmails,
        ccEmails: normalizedCcEmails,
        subject: composeData.subject,
        bodyHtml: finalBodyHtml,
      });

      const { data: outboxEmail, error: outboxError } = await supabase
        .from('inbox_emails')
        .insert(queuedOutbox)
        .select('id')
        .single();

      if (outboxError || !outboxEmail?.id) {
        throw new Error(outboxError?.message || 'No se pudo encolar en bandeja de salida');
      }

      const queuedPayload = {
        outboxEmailId: outboxEmail.id,
        toEmails: normalizedToEmails,
        ccEmails: normalizedCcEmails,
        bccEmails: normalizedBccEmails,
        subject: composeData.subject,
        bodyHtml: finalBodyHtml,
        bodyText: composerBodyRaw,
        replyToId: composeData.reply_to_id,
        forwardFromId: composeData.forward_from_id,
        webchatConversationId: composeData.webchat_conversation_id,
        webchatSourceChannel: composeData.webchat_source_channel,
        clientId: composeData.client_id || null,
      };

      if (composeData.id) {
        await supabase
          .from('email_drafts')
          .delete()
          .eq('id', composeData.id)
          .eq('user_id', user.id);
      }

      setShowCompose(false);
      resetCompose();
      setActiveFolder('outbox');
      setSelectedEmail(null);
      await refreshDraftsCount();
      await refreshOutboxCount(account.id);
      await loadEmails();
      toast.success('Email en cola en bandeja de salida');

      void processQueuedEmail(queuedPayload);
    } catch (error: any) {
      console.error('[INBOX] Send error:', error);
      toast.error(`Error al enviar: ${error.message}`);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id) return;

    try {
      const { data: account } = await supabase
        .from('email_accounts')
        .select('id')
        .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
        .eq('is_active', true)
        .maybeSingle();

      if (!account) {
        toast.error('No tienes una cuenta de correo configurada');
        return;
      }

      console.log('[INBOX] Saving draft');

      const draftData = {
        account_id: account.id,
        user_id: user.id,
        to_emails: parseRecipientInput(toInput),
        cc_emails: parseRecipientInput(ccInput),
        bcc_emails: parseRecipientInput(bccInput),
        subject: composeData.subject,
        body_html: composeData.body_html,
        reply_to_id: composeData.reply_to_id,
        forward_from_id: composeData.forward_from_id,
      };

      const { error } = composeData.id
        ? await supabase
            .from('email_drafts')
            .update({ ...draftData, updated_at: new Date().toISOString() })
            .eq('id', composeData.id)
          .eq('user_id', user.id)
        : await supabase
            .from('email_drafts')
            .insert(draftData);

      if (error) {
        console.error('[INBOX] Error saving draft:', error);
        throw error;
      }

      console.log('[INBOX] Draft saved successfully');
      toast.success(composeData.id ? 'Borrador actualizado' : 'Borrador guardado');
      setShowCompose(false);
      resetCompose();
      await refreshDraftsCount();
    } catch (error: any) {
      toast.error(`Error al guardar borrador: ${error.message}`);
    }
  };

  const resetCompose = () => {
    setComposeData({
      client_id: null,
      to_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject: '',
      body_html: '',
      original_quoted_html: undefined,
    });
    setToInput('');
    setCcInput('');
    setBccInput('');
    setShowCc(false);
    setShowBcc(false);
    setComposeMode('new');
  };

  const handleOpenCreateTicketModal = () => {
    if (!selectedEmail) return;

    const senderEmail = String(selectedEmail.from_email || '').trim();
    const readableBody = getReadableEmailBody(selectedEmail);
    const plainDescription = (readableBody.text || '').trim() || getTicketDescriptionFromEmail(selectedEmail).trim();
    const richDescription = (readableBody.html || '').trim()
      ? readableBody.html
      : `<pre style="white-space:pre-wrap; margin:0;">${escapeHtml(plainDescription || '(Sin contenido legible)')}</pre>`;

    saveTicketCreateDraft({
      subject: selectedEmail.subject || '(Sin asunto)',
      description: plainDescription || '(Sin contenido)',
      description_html: richDescription,
      priority: 'medium',
      status: 'open',
      client_id: composeData.client_id || undefined,
      source_module: 'email',
      source_name: selectedEmail.from_name || undefined,
      source_email: senderEmail || undefined,
    });

    setShowEmailViewer(false);
    setActiveModule('tickets');
  };

  const handleSelectEmailFromList = (email: InboxEmail) => {
    if (activeFolder === 'drafts') {
      handleOpenDraft(email.id);
      return;
    }

    setSelectedEmail(email);
    if (!email.is_read) {
      handleMarkAsRead(email.id, true);
    }
  };

  const handleOpenEmailViewerFromList = (email: InboxEmail) => {
    if (activeFolder === 'drafts') return;
    handleSelectEmailFromList(email);
    setShowEmailViewer(true);
  };

  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(search) ||
      email.from_email.toLowerCase().includes(search) ||
      email.from_name.toLowerCase().includes(search) ||
      email.body_text.toLowerCase().includes(search)
    );
  });

  const getEmailPreview = (email: InboxEmail) => {
    const readableBody = getReadableEmailBody(email);
    return (readableBody.text || '').replace(/\s+/g, ' ').trim();
  };

  const invalidToRecipients = getInvalidRecipients(toInput);
  const invalidCcRecipients = getInvalidRecipients(ccInput);
  const invalidBccRecipients = getInvalidRecipients(bccInput);

  useEffect(() => {
    if (!hasEmailAccount) {
      setUnreadInboxCount(0);
      setOutboxCount(0);
      setDraftsCount(0);
      return;
    }
    refreshUnreadInboxCount();
    refreshOutboxCount();
    refreshDraftsCount();
  }, [emailAccountId, hasEmailAccount]);

  useEffect(() => {
    if (!user?.id) return;

    const cache = getOrCreateUserInboxCache(user.id);
    cache.emailsByFolder[activeFolder] = emails;
    cache.latestEmailDateByFolder[activeFolder] = emails[0]?.email_date;
    cache.activeFolder = activeFolder;
  }, [activeFolder, emails, user?.id]);

  if (checkingEmailAccount) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700" />
        <div className="flex-1 p-8">
          <Card className="p-8 max-w-3xl mx-auto text-center">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-brand-600 dark:text-brand-400" />
            <p className="text-slate-900 dark:text-white font-medium">Cargando buzón...</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Validando configuración de correo</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasEmailAccount) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center">
            <div className="bg-amber-100 dark:bg-amber-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Configura tu Buzón de Correo</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Para usar el buzón de correos, primero debes configurar tu cuenta de email en la sección de Configuración.
            </p>
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-sky-800 dark:text-sky-300 text-left">
                  <p className="font-semibold mb-1">Pasos para configurar:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sky-700 dark:text-sky-300">
                    <li>Ve a la sección "Configuración"</li>
                    <li>Selecciona la pestaña "Buzón Personal"</li>
                    <li>Ingresa los datos de tu cuenta de correo (IMAP/SMTP)</li>
                    <li>Guarda la configuración</li>
                    <li>Regresa aquí para gestionar tus emails</li>
                  </ol>
                </div>
              </div>
            </div>
            <Button onClick={() => window.location.hash = '#settings'}>
              Ir a Configuración
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <Button
            className="w-full"
            icon={<Plus className="w-5 h-5" />}
            onClick={() => {
              setShowCompose(true);
              setComposeMode('new');
              resetCompose();
            }}
          >
            Nuevo Email
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => handleFolderChange('inbox')}
            className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'inbox'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <InboxIcon className="w-5 h-5" />
              <span className="whitespace-nowrap">Bandeja de entrada</span>
            </div>
            {unreadInboxCount > 0 && (
              <Badge variant="brand">{unreadInboxCount}</Badge>
            )}
          </button>

          <button
            onClick={() => handleFolderChange('starred')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'starred'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Star className="w-5 h-5" />
            <span>Destacados</span>
          </button>

          <button
            onClick={() => handleFolderChange('outbox')}
            className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'outbox'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className="w-5 h-5" />
              <span>Bandeja de salida</span>
            </div>
            {outboxCount > 0 && (
              <Badge variant="warning">{outboxCount}</Badge>
            )}
          </button>

          <button
            onClick={() => handleFolderChange('sent')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'sent'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Send className="w-5 h-5" />
            <span>Enviados</span>
          </button>

          <button
            onClick={() => handleFolderChange('drafts')}
            className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'drafts'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5" />
              <span>Borradores</span>
            </div>
            {draftsCount > 0 && (
              <Badge variant="neutral">{draftsCount}</Badge>
            )}
          </button>

          <button
            onClick={() => handleFolderChange('archived')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'archived'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Archive className="w-5 h-5" />
            <span>Archivados</span>
          </button>

          <button
            onClick={() => handleFolderChange('trash')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeFolder === 'trash'
                ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Trash2 className="w-5 h-5" />
            <span>Papelera</span>
          </button>
        </nav>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Buscar en el buzón..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <Button
              variant="ghost"
              onClick={handleSyncEmails}
              disabled={loading}
              icon={<RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />}
            >
              Sincronizar
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[30rem] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            {loading && emails.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-brand-600 dark:text-brand-400" />
                  <p>Cargando emails...</p>
                </div>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <div className="text-center p-8">
                  <InboxIcon className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                  <p className="text-lg font-medium mb-2">No hay emails</p>
                  <p className="text-sm">Esta carpeta está vacía</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmailFromList(email)}
                    onDoubleClick={() => handleOpenEmailViewerFromList(email)}
                    className={`p-4 cursor-pointer transition ${
                      selectedEmail?.id === email.id
                        ? 'bg-brand-50 dark:bg-brand-500/10 border-l-4 border-brand-600 dark:border-brand-400'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'
                    } ${!email.is_read ? 'bg-brand-50/30 dark:bg-brand-500/5' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(email.id, email.is_starred);
                          }}
                          className="flex-shrink-0"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              email.is_starred
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                            }`}
                          />
                        </button>
                        <p
                          className={`text-sm truncate ${
                            !email.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {email.from_name || email.from_email}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 flex-shrink-0">
                        {new Date(email.email_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p
                      className={`text-sm mb-1 truncate ${
                        !email.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {email.subject || '(Sin asunto)'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{getEmailPreview(email)}</p>
                    {email.attachments && email.attachments.length > 0 && (
                      <div className="flex items-center space-x-1 mt-2">
                        <Paperclip className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {email.attachments.length} adjunto(s)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-y-auto min-w-0">
            {selectedEmail ? (
              <div className="h-full p-6 overflow-y-auto">
                {(() => {
                  const readableBody = getReadableEmailBody(selectedEmail);
                  return (
                <Card className="max-w-6xl mx-auto min-h-full flex flex-col">
                  <div className="border-b border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex-1 break-words pr-4">
                        {selectedEmail.subject || '(Sin asunto)'}
                      </h2>
                      <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReply(selectedEmail)}
                          icon={<Reply className="w-4 h-4" />}
                          title="Responder"
                        >
                          Responder
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleForward(selectedEmail)}
                          icon={<Forward className="w-4 h-4" />}
                          title="Reenviar"
                        >
                          Reenviar
                        </Button>
                        <button
                          onClick={() => handleArchive(selectedEmail.id)}
                          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          title="Archivar"
                        >
                          <Archive className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(selectedEmail.id)}
                          className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                          title={activeFolder === 'drafts' ? 'Eliminar borrador' : 'Eliminar'}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="!bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100 dark:!bg-emerald-500/10 dark:!text-emerald-400 dark:!border-emerald-500/30"
                          onClick={handleOpenCreateTicketModal}
                          icon={<Ticket className="w-4 h-4" />}
                        >
                          Crear Ticket
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="font-medium text-slate-700 dark:text-slate-300">De:</span>
                        <span className="text-slate-900 dark:text-white break-all">
                          {selectedEmail.from_name ? `${selectedEmail.from_name} <${selectedEmail.from_email}>` : selectedEmail.from_email}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Para:</span>
                        <span className="text-slate-900 dark:text-white break-all">
                          {selectedEmail.to_emails.map((t: { email?: string } | string) => (typeof t === 'string' ? t : t.email || '')).join(', ')}
                        </span>
                      </div>
                      {selectedEmail.cc_emails && selectedEmail.cc_emails.length > 0 && (
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="font-medium text-slate-700 dark:text-slate-300">CC:</span>
                          <span className="text-slate-900 dark:text-white break-all">
                            {selectedEmail.cc_emails.map((t: { email?: string } | string) => (typeof t === 'string' ? t : t.email || '')).join(', ')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(selectedEmail.email_date).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto">
                    {readableBody.html ? (
                      <div
                        className="prose dark:prose-invert max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: readableBody.html }}
                      />
                    ) : (
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{readableBody.text}</p>
                    )}

                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center space-x-2">
                          <Paperclip className="w-4 h-4" />
                          <span>Adjuntos ({selectedEmail.attachments.length})</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedEmail.attachments.map((attachment: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Paperclip className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {attachment.filename}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {(attachment.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <button className="p-1 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
                  );
                })()}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                <Card className="text-center px-10 py-12">
                  <Mail className="w-20 h-20 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                  <p className="text-lg font-medium mb-2 text-slate-700 dark:text-slate-200">Selecciona un email</p>
                  <p className="text-sm">Elige un mensaje para ver su contenido</p>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {composeMode === 'reply' ? 'Responder' : composeMode === 'forward' ? 'Reenviar' : 'Nuevo Mensaje'}
              </h2>
              <button
                onClick={() => {
                  setShowCompose(false);
                  resetCompose();
                }}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-16">Para:</label>
                    <input
                      type="text"
                      value={toInput}
                      onChange={(e) => setToInput(e.target.value)}
                      placeholder="destinatario@ejemplo.com"
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCc(!showCc)}
                      className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 px-2"
                    >
                      Cc
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBcc(!showBcc)}
                      className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 px-2"
                    >
                      Bcc
                    </button>
                  </div>
                  {invalidToRecipients.length > 0 && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 ml-[4.5rem] mb-2 break-words">
                      Correos inválidos en Para: {invalidToRecipients.join(', ')}
                    </p>
                  )}
                  {showCc && (
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-16">Cc:</label>
                      <input
                        type="text"
                        value={ccInput}
                        onChange={(e) => setCcInput(e.target.value)}
                        placeholder="copia@ejemplo.com"
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                  )}
                  {showCc && invalidCcRecipients.length > 0 && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 ml-[4.5rem] mb-2 break-words">
                      Correos inválidos en Cc: {invalidCcRecipients.join(', ')}
                    </p>
                  )}
                  {showBcc && (
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-16">Bcc:</label>
                      <input
                        type="text"
                        value={bccInput}
                        onChange={(e) => setBccInput(e.target.value)}
                        placeholder="copia-oculta@ejemplo.com"
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                  )}
                  {showBcc && invalidBccRecipients.length > 0 && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 ml-[4.5rem] mb-2 break-words">
                      Correos inválidos en Bcc: {invalidBccRecipients.join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-16">Asunto:</label>
                  <input
                    type="text"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                    placeholder="Asunto del mensaje"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fuente</label>
                        <select
                          value={composeFontFamily}
                          onChange={(e) => setComposeFontFamily(e.target.value)}
                          className="w-full px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                        >
                          {composeFontFamilyOptions.map((option) => (
                            <option key={option.label} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tamaño</label>
                        <select
                          value={composeFontSize}
                          onChange={(e) => setComposeFontSize(Number(e.target.value))}
                          className="w-full px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                        >
                          {composeFontSizeOptions.map((size) => (
                            <option key={size} value={size}>{size}px</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Color</label>
                        <input
                          type="color"
                          value={composeTextColor}
                          onChange={(e) => setComposeTextColor(e.target.value)}
                          className="w-full h-10 px-1 py-1 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <textarea
                    value={composeData.body_html}
                    onChange={(e) => setComposeData({ ...composeData, body_html: e.target.value })}
                    rows={10}
                    placeholder="Escribe tu mensaje aquí..."
                    className="w-full min-h-[220px] max-h-[320px] px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y"
                    required
                  />
                </div>

                {composeMode !== 'new' && composeData.original_quoted_html && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Mensaje recibido
                    </div>
                    <div className="p-4 max-h-72 overflow-y-auto">
                      <div
                        className="prose dark:prose-invert max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: composeData.original_quoted_html }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSaveDraft}
                  icon={<Save className="w-4 h-4" />}
                >
                  Guardar Borrador
                </Button>
                <div className="flex items-center space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCompose(false);
                      resetCompose();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" icon={<Send className="w-4 h-4" />}>
                    Enviar
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmailViewer && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white break-words">{selectedEmail.subject || '(Sin asunto)'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 break-all">
                  {selectedEmail.from_name ? `${selectedEmail.from_name} <${selectedEmail.from_email}>` : selectedEmail.from_email}
                </p>
              </div>
              <button
                onClick={() => setShowEmailViewer(false)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                title="Cerrar visor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 space-y-1">
              <p className="break-all"><strong>Para:</strong> {selectedEmail.to_emails.map((t: { email?: string } | string) => (typeof t === 'string' ? t : t.email || '')).join(', ')}</p>
              {selectedEmail.cc_emails && selectedEmail.cc_emails.length > 0 && (
                <p className="break-all"><strong>CC:</strong> {selectedEmail.cc_emails.map((t: { email?: string } | string) => (typeof t === 'string' ? t : t.email || '')).join(', ')}</p>
              )}
              <p><strong>Fecha:</strong> {new Date(selectedEmail.email_date).toLocaleString()}</p>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 min-h-full">
                {(() => {
                  const readableBody = getReadableEmailBody(selectedEmail);
                  if ((readableBody.html || '').trim()) {
                    return (
                      <div
                        className="prose dark:prose-invert max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: readableBody.html }}
                      />
                    );
                  }

                  return (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                      {readableBody.text || '(Sin contenido)'}
                    </p>
                  );
                })()}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3 bg-white dark:bg-slate-900">
              <Button variant="secondary" onClick={() => setShowEmailViewer(false)}>
                Cerrar
              </Button>
              <Button
                className="!bg-gradient-to-r !from-emerald-600 !to-emerald-500 hover:!from-emerald-700 hover:!to-emerald-600"
                onClick={handleOpenCreateTicketModal}
                icon={<Ticket className="w-5 h-5" />}
              >
                Crear Ticket
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
