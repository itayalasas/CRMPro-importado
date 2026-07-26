import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-6 h-6" />,
    error: <XCircle className="w-6 h-6" />,
    warning: <AlertCircle className="w-6 h-6" />,
    info: <Info className="w-6 h-6" />
  };

  const colors = {
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
    error: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white',
    warning: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white',
    info: 'bg-gradient-to-r from-brand-500 to-accent-500 text-white'
  };

  return (
    <div className={`${colors[type]} rounded-xl shadow-2xl p-4 min-w-[320px] max-w-md flex items-center gap-3 animate-slide-in`}>
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:bg-white/20 p-1 rounded-lg transition"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
