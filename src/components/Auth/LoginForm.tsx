import { useState } from 'react';
import { Shield, ArrowRight, CheckCircle, Calendar } from 'lucide-react';
import { getEnvVar, waitForConfig } from '../../lib/envLoader';

type AuthMode = 'login' | 'register';

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>('login');

  const handleAuth = async () => {
    await waitForConfig().catch(() => undefined);

    const redirectUri = `${window.location.origin}/callback`;
    const baseUrl = getEnvVar('VITE_AUTH_URL').trim();
    const appId = getEnvVar('VITE_AUTH_APP_ID');
    const apiKey = getEnvVar('VITE_AUTH_API_KEY');

    if (!baseUrl || !appId) {
      window.alert('No se pudo cargar la configuración de autenticación. Verifica get-env (VITE_AUTH_URL y VITE_AUTH_APP_ID).');
      return;
    }

    const page = mode === 'register' ? 'register' : 'login';
    const authUrl = `${baseUrl}/${page}?app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&api_key=${encodeURIComponent(apiKey)}`;

    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center p-4 sm:p-6 lg:p-0">
      {/* Left Panel - Desktop Only */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-12 flex-col justify-between min-h-screen">
        <div className="flex items-center space-x-3">
          <Calendar className="w-8 h-8 text-white" />
          <span className="text-2xl font-bold text-white">Calve CRM</span>
        </div>

        <div className="space-y-8">
          <h1 className="text-5xl font-bold text-white leading-tight">
            Bienvenido de vuelta
          </h1>
          <p className="text-xl text-blue-100">
            Accede a tu cuenta y gestiona tus clientes, ventas y operaciones de forma segura y eficiente.
          </p>

          <div className="space-y-4 mt-12">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 bg-opacity-30 p-3 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Seguridad Avanzada</h3>
                <p className="text-blue-100">Autenticación empresarial con los más altos estándares de seguridad</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 bg-opacity-30 p-3 rounded-xl">
                <ArrowRight className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Acceso Rápido</h3>
                <p className="text-blue-100">Inicia sesión en segundos con tu cuenta empresarial</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 bg-opacity-30 p-3 rounded-xl">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Gestión Unificada</h3>
                <p className="text-blue-100">Administra clientes, pedidos, campañas y tickets desde un solo lugar</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-blue-100 text-sm">
          © 2026 Calve CRM. Todos los derechos reservados.
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-2xl shadow-2xl">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Auth Card */}
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl shadow-lg">
                <Shield className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-slate-900">
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </h2>
            <p className="text-center text-slate-600 mb-8 text-sm sm:text-base">
              Usa tu sistema de autenticación empresarial para acceder de forma segura
            </p>

            <button
              onClick={handleAuth}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 sm:py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all shadow-lg flex items-center justify-center space-x-3 group"
            >
              <Shield className="w-5 h-5" />
              <span className="text-sm sm:text-base">{mode === 'login' ? 'Iniciar Sesión' : 'Registrarme'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-blue-800 font-medium mb-3">
                ¿Por qué usar autenticación empresarial?
              </p>
              <ul className="space-y-2 text-xs text-blue-700">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Máxima seguridad con encriptación avanzada</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Acceso unificado a todos tus servicios</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Gestión centralizada de permisos y roles</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Soporte técnico especializado 24/7</span>
                </li>
              </ul>
            </div>

            {/* Toggle Mode */}
            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-600">
                {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                {' '}
                <button
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
                </button>
              </p>
            </div>

            {/* Back to Home */}
            <div className="mt-4 text-center">
              <button className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                ← Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
