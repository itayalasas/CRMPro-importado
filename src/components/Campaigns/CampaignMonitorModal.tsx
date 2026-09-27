import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, CheckCircle, XCircle, Clock, Send, AlertTriangle,
  Mail, Loader, TrendingUp, Activity
} from 'lucide-react';

interface EmailLog {
  id: string;
  email: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'bounced';
  error_message?: string;
  sent_at?: string;
  created_at: string;
  metadata?: any;
}

interface CampaignProgress {
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
}

interface CampaignMonitorModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

export function CampaignMonitorModal({ campaignId, campaignName, onClose }: CampaignMonitorModalProps) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [progress, setProgress] = useState<CampaignProgress>({
    total_recipients: 0,
    sent_count: 0,
    failed_count: 0,
    status: 'draft'
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const statusRef = useRef(progress.status);

  useEffect(() => {
    loadLogs();
    loadProgress();

    // SendCraft has no outbound webhook for per-recipient events, so while the
    // campaign is in flight we poll it directly. We refresh local state ourselves
    // right after (don't rely solely on the Realtime subscriptions below — Postgres
    // changes replication may not be enabled for these tables in this project).
    const pollInterval = setInterval(async () => {
      if (statusRef.current !== 'sending') return;
      await supabase.functions.invoke('campaign-notify-status', { body: { campaign_id: campaignId } });
      loadProgress();
      loadLogs();
    }, 4000);

    // Subscribe to real-time updates for logs
    const logsChannel = supabase
      .channel(`campaign-logs-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_email_logs',
          filter: `campaign_id=eq.${campaignId}`
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    // Subscribe to campaign progress updates
    const campaignChannel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`
        },
        () => {
          loadProgress();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(campaignChannel);
    };
  }, [campaignId]);

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('campaign_email_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (error) {
    } else if (data) {
      setLogs(data);
    }
  };

  const loadProgress = async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('total_recipients, sent_count, failed_count, status')
      .eq('id', campaignId)
      .maybeSingle();

    if (error) {
    } else if (data) {
      setProgress(data);
      statusRef.current = data.status;
    }
  };

  const filteredLogs = filterStatus === 'all'
    ? logs
    : logs.filter(log => log.status === filterStatus);

  const progressPercentage = progress.total_recipients > 0
    ? ((progress.sent_count + progress.failed_count) / progress.total_recipients) * 100
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />;
      case 'sending':
        return <Loader className="w-4 h-4 text-brand-500 dark:text-brand-400 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      sent: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
      failed: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20',
      sending: 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/20',
      pending: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
      bounced: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const isComplete = progress.status === 'sent';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-accent-600 p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-1">{campaignName}</h2>
              <p className="text-brand-100">Monitoreo en Tiempo Real</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso de Envío</span>
              <span className="font-bold">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-brand-100">
              <span>{progress.sent_count + progress.failed_count} de {progress.total_recipients}</span>
              {isComplete && <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Completado</span>}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 dark:bg-slate-900/50">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="bg-brand-100 dark:bg-brand-500/15 p-2 rounded-lg">
                <Mail className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{progress.total_recipients}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-100 dark:bg-emerald-500/15 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{progress.sent_count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Enviados</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="bg-rose-100 dark:bg-rose-500/15 p-2 rounded-lg">
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{progress.failed_count}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fallidos</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="bg-accent-100 dark:bg-accent-500/15 p-2 rounded-lg">
                <Activity className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-accent-600 dark:text-accent-400">
                  {progress.total_recipients > 0
                    ? Math.round((progress.sent_count / progress.total_recipients) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Éxito</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === 'all'
                  ? 'bg-slate-900 dark:bg-slate-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              onClick={() => setFilterStatus('sent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === 'sent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
              }`}
            >
              Enviados ({logs.filter(l => l.status === 'sent').length})
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === 'failed'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/15'
              }`}
            >
              Fallidos ({logs.filter(l => l.status === 'failed').length})
            </button>
            <button
              onClick={() => setFilterStatus('sending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === 'sending'
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-500/15'
              }`}
            >
              Enviando ({logs.filter(l => l.status === 'sending').length})
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className="overflow-y-auto max-h-96 p-6 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay logs para mostrar</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{log.email}</p>
                        {getStatusBadge(log.status)}
                      </div>
                      {log.error_message && (
                        <p className="text-sm text-rose-600 dark:text-rose-400 mt-1 bg-rose-50 dark:bg-rose-500/10 p-2 rounded border border-rose-100 dark:border-rose-500/20">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          {log.error_message}
                        </p>
                      )}
                      {log.sent_at && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Enviado: {new Date(log.sent_at).toLocaleString('es-MX')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
