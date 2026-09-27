import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Send, MessageCircle, Paperclip, FileText, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ViewState = 'loading' | 'not_found' | 'ready' | 'error';

interface ConversationInfo {
  id: string;
  visitor_name: string | null;
  status: string;
}

interface MessageAttachment {
  filename: string;
  size: number;
  type: string;
  path?: string;
  url?: string;
}

interface ChatMessage {
  id: string;
  sender_type: 'visitor' | 'agent' | 'bot' | 'system';
  sender_name: string | null;
  message: string | null;
  attachments: MessageAttachment[] | null;
  created_at: string;
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_MB = 10;

export function PublicChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [state, setState] = useState<ViewState>('loading');
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || state !== 'ready') return;

    const channel = supabase
      .channel(`public-chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webchat_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'webchat_conversations', filter: `id=eq.${conversationId}` },
        (payload) => {
          const next = payload.new as ConversationInfo;
          setConversation((prev) => (prev ? { ...prev, status: next.status } : prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadConversation = async () => {
    if (!conversationId) {
      setState('not_found');
      return;
    }

    setState('loading');

    const { data: conversationData, error: conversationError } = await supabase
      .from('webchat_conversations')
      .select('id, visitor_name, status')
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError || !conversationData) {
      setState('not_found');
      return;
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('webchat_messages')
      .select('id, sender_type, sender_name, message, attachments, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      setState('error');
      return;
    }

    setConversation(conversationData as ConversationInfo);
    setMessages((messagesData || []) as ChatMessage[]);
    setState('ready');
  };

  const handlePickFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files);
    setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!conversationId) return;
    if (!messageText.trim() && attachments.length === 0) return;

    const invalidAttachment = attachments.find(
      (file) => !(file.type && (file.type.startsWith('image/') || file.type === 'application/pdf'))
    );
    if (invalidAttachment) {
      return;
    }

    const oversizedAttachment = attachments.find((file) => file.size > MAX_ATTACHMENT_MB * 1024 * 1024);
    if (oversizedAttachment) {
      return;
    }

    setSending(true);

    const wasClosed = conversation?.status === 'closed';
    if (wasClosed) {
      const { error: reopenError } = await supabase
        .from('webchat_conversations')
        .update({ status: 'open', closed_at: null, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (reopenError) {
        setSending(false);
        return;
      }

      setConversation((prev) => (prev ? { ...prev, status: 'open' } : prev));

      await supabase.from('webchat_messages').insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_id: conversationId,
        sender_name: null,
        message: 'El cliente reabrió esta conversación.',
        attachments: [],
      });
    }

    const uploadedAttachments: MessageAttachment[] = [];
    for (const file of attachments) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `conversations/${conversationId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase
        .storage
        .from('webchat-attachments')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setSending(false);
        return;
      }

      const { data: publicData } = supabase.storage.from('webchat-attachments').getPublicUrl(path);
      uploadedAttachments.push({
        filename: file.name,
        size: file.size,
        type: file.type,
        path,
        url: publicData.publicUrl,
      });
    }

    const { error } = await supabase.from('webchat_messages').insert({
      conversation_id: conversationId,
      sender_type: 'visitor',
      sender_id: conversationId,
      sender_name: conversation?.visitor_name || 'Cliente',
      message: messageText.trim() || null,
      attachments: uploadedAttachments,
    });
    setSending(false);

    if (error) {
      return;
    }

    await supabase
      .from('webchat_conversations')
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    setMessageText('');
    setAttachments([]);
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (state === 'not_found' || state === 'error') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Enlace no válido</h1>
          <p className="text-slate-600">
            No pudimos encontrar esta conversación. El enlace puede haber expirado o ya no ser válido.
          </p>
        </div>
      </div>
    );
  }

  const isClosed = conversation?.status === 'closed';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full flex flex-col h-[80vh]">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          <div className="rounded-full bg-teal-100 p-2">
            <MessageCircle className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Chat con nuestro equipo</h1>
            <p className="text-xs text-slate-500">{conversation?.visitor_name || 'Vos'}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400">Todavía no hay mensajes.</p>
          )}
          {messages.map((msg) => {
            const isVisitor = msg.sender_type === 'visitor';
            const isSystem = msg.sender_type === 'system';
            if (isSystem) {
              return (
                <p key={msg.id} className="text-center text-xs text-slate-400">
                  {msg.message}
                </p>
              );
            }
            return (
              <div key={msg.id} className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isVisitor
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  {!isVisitor && msg.sender_name && (
                    <p className="text-[11px] font-semibold text-teal-700 mb-0.5">{msg.sender_name}</p>
                  )}
                  {msg.message && <p className="whitespace-pre-wrap">{msg.message}</p>}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className={`space-y-2 ${msg.message ? 'mt-2' : ''}`}>
                      {msg.attachments.map((att, index) =>
                        att.type?.startsWith('image/') ? (
                          <a key={`${msg.id}-att-${index}`} href={att.url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={att.url}
                              alt={att.filename}
                              className="max-h-48 rounded-lg border border-white/20 object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={`${msg.id}-att-${index}`}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium ${
                              isVisitor ? 'bg-white/15 text-white' : 'bg-white text-teal-700 border border-slate-200'
                            }`}
                          >
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{att.filename}</span>
                          </a>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-200 p-4">
          {isClosed && (
            <p className="mb-2 text-center text-xs text-slate-500">
              Esta conversación fue cerrada. Escribí un mensaje para reabrirla.
            </p>
          )}
          <>
              {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 pl-2.5 pr-1.5 py-1 text-xs text-slate-700"
                    >
                      <span className="max-w-[140px] truncate">{file.name}</span>
                      <button onClick={() => removeAttachment(index)} className="rounded-full p-0.5 hover:bg-slate-200">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => handlePickFiles(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= MAX_ATTACHMENTS}
                  className="flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={2}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 px-4 py-3 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || (!messageText.trim() && attachments.length === 0)}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-3 text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Imágenes o PDF, hasta {MAX_ATTACHMENT_MB}MB, máx. {MAX_ATTACHMENTS} archivos.</p>
          </>
        </div>
      </div>
    </div>
  );
}
