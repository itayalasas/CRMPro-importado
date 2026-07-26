import { ReactNode } from 'react';
import { Card } from './Card';

type StatColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  color?: StatColor;
}

const iconWrapClasses: Record<StatColor, string> = {
  brand: 'bg-gradient-to-br from-brand-500 to-brand-600',
  success: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  warning: 'bg-gradient-to-br from-amber-500 to-amber-600',
  danger: 'bg-gradient-to-br from-rose-500 to-rose-600',
  info: 'bg-gradient-to-br from-sky-500 to-sky-600',
  neutral: 'bg-gradient-to-br from-slate-500 to-slate-600',
};

export function StatCard({ icon, label, value, color = 'brand' }: StatCardProps) {
  return (
    <Card hover className="p-6">
      <div className={`inline-flex p-3 rounded-xl mb-4 ${iconWrapClasses[color]}`}>
        <span className="text-white [&>svg]:w-6 [&>svg]:h-6">{icon}</span>
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
    </Card>
  );
}
