import { createContext, useContext, useRef } from 'react';

export interface DialerContactInfo {
  id?: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

interface DialerContextType {
  openDialerWithNumber: (phoneNumber: string, contact?: DialerContactInfo | null) => void;
  registerDialer: (handler: (phoneNumber: string, contact?: DialerContactInfo | null) => void) => void;
  initiateCall: (phoneNumber: string, contact?: DialerContactInfo | null) => void;
}

const DialerContext = createContext<DialerContextType | undefined>(undefined);

export function DialerProvider({ children }: { children: React.ReactNode }) {
  const dialerHandlerRef = useRef<((phoneNumber: string, contact?: DialerContactInfo | null) => void) | null>(null);

  const registerDialer = (handler: (phoneNumber: string, contact?: DialerContactInfo | null) => void) => {
    dialerHandlerRef.current = handler;
  };

  const openDialerWithNumber = (phoneNumber: string, contact?: DialerContactInfo | null) => {
    if (dialerHandlerRef.current) {
      dialerHandlerRef.current(phoneNumber, contact);
    }
  };

  const initiateCall = (phoneNumber: string, contact?: DialerContactInfo | null) => {
    if (dialerHandlerRef.current) {
      dialerHandlerRef.current(phoneNumber, contact);
    }
  };

  return (
    <DialerContext.Provider value={{ openDialerWithNumber, registerDialer, initiateCall }}>
      {children}
    </DialerContext.Provider>
  );
}

export function useDialer() {
  const context = useContext(DialerContext);
  if (context === undefined) {
    throw new Error('useDialer must be used within a DialerProvider');
  }
  return context;
}
