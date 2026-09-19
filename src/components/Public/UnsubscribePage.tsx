import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MailX, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ViewState = 'loading' | 'not_found' | 'confirm' | 'already_unsubscribed' | 'done' | 'error';

interface ContactInfo {
  email: string;
  status: string;
  group_name: string | null;
}

export function UnsubscribePage() {
  const { contactId } = useParams<{ contactId: string }>();
  const [state, setState] = useState<ViewState>('loading');
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const loadContact = async () => {
    if (!contactId) {
      setState('not_found');
      return;
    }

    setState('loading');
    const { data, error } = await supabase
      .rpc('get_contact_for_unsubscribe', { p_contact_id: contactId })
      .maybeSingle();

    if (error || !data) {
      setState('not_found');
      return;
    }

    const contactInfo = data as ContactInfo;
    setContact(contactInfo);
    setState(contactInfo.status === 'unsubscribed' ? 'already_unsubscribed' : 'confirm');
  };

  const handleUnsubscribe = async () => {
    if (!contactId) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .rpc('unsubscribe_contact', { p_contact_id: contactId })
      .maybeSingle();
    setSubmitting(false);

    if (error || !data) {
      setState('error');
      return;
    }

    setState('done');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-slate-400 mx-auto mb-4 animate-spin" />
            <p className="text-slate-600">Buscando tu información...</p>
          </>
        )}

        {state === 'not_found' && (
          <>
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Enlace no válido</h1>
            <p className="text-slate-600">
              No pudimos encontrar tu registro. El enlace puede haber expirado o ya no ser válido.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Ocurrió un error</h1>
            <p className="text-slate-600 mb-4">
              No pudimos procesar tu solicitud. Por favor intenta nuevamente en unos minutos.
            </p>
            <button
              onClick={handleUnsubscribe}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Reintentar
            </button>
          </>
        )}

        {state === 'already_unsubscribed' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Ya estás dado de baja</h1>
            <p className="text-slate-600">
              {contact?.email} ya no recibirá comunicaciones de nuestras campañas.
            </p>
          </>
        )}

        {state === 'confirm' && contact && (
          <>
            <MailX className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Darte de baja</h1>
            <p className="text-slate-600 mb-1">
              Estás por dejar de recibir comunicaciones de marketing en:
            </p>
            <p className="font-semibold text-slate-900 mb-6">{contact.email}</p>
            <button
              onClick={handleUnsubscribe}
              disabled={submitting}
              className="w-full px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition disabled:opacity-50 font-medium"
            >
              {submitting ? 'Procesando...' : 'Sí, darme de baja'}
            </button>
            <p className="text-xs text-slate-400 mt-4">
              Si esto fue un error, simplemente cierra esta página — no se hará ningún cambio.
            </p>
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Listo, te diste de baja</h1>
            <p className="text-slate-600">
              {contact?.email} no recibirá más comunicaciones de nuestras campañas.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
