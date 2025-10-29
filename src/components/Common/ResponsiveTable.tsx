interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveTable({ children, className = '' }: ResponsiveTableProps) {
  return (
    <div className="w-full">
      <div className="hidden lg:block overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow-lg ring-1 ring-black ring-opacity-5 rounded-xl">
            <table className={`min-w-full divide-y divide-slate-200 ${className}`}>
              {children}
            </table>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}
