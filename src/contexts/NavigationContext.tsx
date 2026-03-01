import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavigationContextType {
  navigateToInbox: (
    recipientEmail?: string,
    context?: {
      webchatConversationId?: string;
      sourceChannel?: string;
      emailSubject?: string;
      emailBody?: string;
    }
  ) => void;
  inboxRecipient: string | null;
  inboxContext: {
    webchatConversationId?: string;
    sourceChannel?: string;
    emailSubject?: string;
    emailBody?: string;
  } | null;
  clearInboxRecipient: () => void;
  activeModule: string;
  setActiveModule: (module: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [inboxRecipient, setInboxRecipient] = useState<string | null>(null);
  const [inboxContext, setInboxContext] = useState<{
    webchatConversationId?: string;
    sourceChannel?: string;
    emailSubject?: string;
    emailBody?: string;
  } | null>(null);
  const [activeModule, setActiveModule] = useState('dashboard');

  const navigateToInbox = (
    recipientEmail?: string,
    context?: {
      webchatConversationId?: string;
      sourceChannel?: string;
      emailSubject?: string;
      emailBody?: string;
    }
  ) => {
    if (recipientEmail) {
      setInboxRecipient(recipientEmail);
    }
    setInboxContext(context || null);
    setActiveModule('inbox');
  };

  const clearInboxRecipient = () => {
    setInboxRecipient(null);
    setInboxContext(null);
  };

  return (
    <NavigationContext.Provider
      value={{
        navigateToInbox,
        inboxRecipient,
        inboxContext,
        clearInboxRecipient,
        activeModule,
        setActiveModule
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
