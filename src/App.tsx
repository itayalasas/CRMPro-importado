import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { DialerProvider } from './contexts/DialerContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { LoginForm } from './components/Auth/LoginForm';
import { CallbackHandler } from './components/Auth/CallbackHandler';
import { Sidebar } from './components/Layout/Sidebar';
import { PhoneDialer } from './components/Common/PhoneDialer';
import { IncomingCallNotification } from './components/Common/IncomingCallNotification';
import { CallModal } from './components/Common/CallModal';
import { DashboardModule } from './components/Dashboard/DashboardModule';
import { ClientsModule } from './components/Clients/ClientsModule';
import { CampaignsModule } from './components/Campaigns/CampaignsModule';
import { CallsModule } from './components/Calls/CallsModule';
import { TicketsModule } from './components/Tickets/TicketsModule';
import { InboxModule } from './components/Inbox/InboxModule';
import { SettingsModule } from './components/Settings/SettingsModule';
import ParametersModule from './components/Settings/ParametersModule';
import { WebChatModule } from './components/WebChat/WebChatModule';
import { SalesPipelineModule } from './components/SalesPipeline/SalesPipelineModule';
import { SalesModule } from './components/Sales/SalesModule';
import { useTwilioDevice } from './hooks/useTwilioDevice';
import { useInvoiceAutoValidation } from './hooks/useInvoiceAutoValidation';
import { useInvoicePdfQueue } from './hooks/useInvoicePdfQueue';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-600 font-medium">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function MainApp() {
  const { activeModule, setActiveModule } = useNavigation();
  const [incomingCallModalOpen, setIncomingCallModalOpen] = useState(false);
  const [currentIncomingCall, setCurrentIncomingCall] = useState<any>(null);
  const { isReady, device, activeCall, makeCall } = useTwilioDevice();

  useInvoiceAutoValidation();
  useInvoicePdfQueue();


  const handleAcceptIncomingCall = (call: any) => {
    setCurrentIncomingCall(call);
    setIncomingCallModalOpen(true);
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'clients':
        return <ClientsModule />;
      case 'campaigns':
        return <CampaignsModule />;
      case 'calls':
        return <CallsModule />;
      case 'tickets':
        return <TicketsModule />;
      case 'inbox':
        return <InboxModule />;
      case 'webchat':
        return <WebChatModule />;
      case 'pipeline':
        return <SalesPipelineModule />;
      case 'ventas':
        return <SalesModule />;
      case 'settings':
        return <SettingsModule />;
      case 'parameters':
        return <ParametersModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden">
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      <main className="flex-1 overflow-y-auto">{renderModule()}</main>

      <PhoneDialer makeCall={makeCall} isDeviceReady={isReady} activeCall={activeCall} />

      <IncomingCallNotification onAccept={handleAcceptIncomingCall} />

      {incomingCallModalOpen && currentIncomingCall && (
        <CallModal
          isOpen={incomingCallModalOpen}
          onClose={() => {
            setIncomingCallModalOpen(false);
            setCurrentIncomingCall(null);
          }}
          phoneNumber={currentIncomingCall.from_number}
          isIncoming
          callSid={currentIncomingCall.call_sid}
        />
      )}
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/callback" element={<CallbackHandler />} />
      <Route path="/auth/callback" element={<CallbackHandler />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DialerProvider>
          <NavigationProvider>
            <AppRoutes />
          </NavigationProvider>
        </DialerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
