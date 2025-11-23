import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Mail,
  ShoppingCart,
  FileText,
  Phone,
  Ticket,
  Inbox,
  Settings,
  LogOut,
  DollarSign,
  Menu,
  X,
  User,
  Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions, ModuleKey } from '../../hooks/usePermissions';

interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' as ModuleKey },
  { id: 'clients', label: 'Clientes', icon: Users, moduleKey: 'clientes' as ModuleKey },
  { id: 'campaigns', label: 'Campañas', icon: Mail, moduleKey: 'campanas' as ModuleKey },
  { id: 'orders', label: 'Órdenes', icon: ShoppingCart, moduleKey: 'ordenes' as ModuleKey },
  { id: 'calls', label: 'Llamadas', icon: Phone, moduleKey: 'llamadas' as ModuleKey },
  { id: 'tickets', label: 'Tickets', icon: Ticket, moduleKey: 'tickets' as ModuleKey },
  { id: 'inbox', label: 'Buzón', icon: Inbox, moduleKey: 'buzon' as ModuleKey },
  { id: 'validation', label: 'Validación Ext.', icon: Shield, moduleKey: 'validacion_ext' as ModuleKey },
  { id: 'parameters', label: 'Parámetros', icon: Settings, moduleKey: 'parametros' as ModuleKey },
  { id: 'settings', label: 'Configuración', icon: Settings, moduleKey: 'configuracion' as ModuleKey },
];

export function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const { signOut, user } = useAuth();
  const { hasModuleAccess } = usePermissions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const accessibleMenuItems = menuItems.filter(item => hasModuleAccess(item.moduleKey));

  const handleModuleChange = (module: string) => {
    onModuleChange(module);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 active:scale-95 transition-all"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 lg:w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white
        h-screen flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center space-x-3">
          <img
            src="/logo.svg"
            alt="CRM Pro Logo"
            className="w-12 h-12 rounded-xl shadow-lg"
          />
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">CRM Pro</h1>
            <p className="text-xs text-slate-400">Sistema Integral</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {accessibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleModuleChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-[1.02]'
                  : 'text-slate-300 hover:bg-slate-700/70 hover:text-white active:scale-95'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${
                isActive ? '' : 'group-hover:scale-110'
              }`} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700/50 space-y-3">
        {user && (
          <div className="px-4 py-3 bg-slate-700/50 rounded-xl border border-slate-600/50">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full p-2 shadow-lg">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-300 hover:bg-red-600/20 hover:text-red-400 rounded-xl transition-all active:scale-95 group"
        >
          <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
    </>
  );
}
