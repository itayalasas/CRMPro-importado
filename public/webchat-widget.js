(function () {
  if (!window.__CRM_WEBCHAT_WIDGET_V2_LOADED) {
    window.__CRM_WEBCHAT_WIDGET_V2_LOADED = true;
    const currentScript = document.currentScript;
    const script = document.createElement('script');
    const config = window.CRM_WEBCHAT_CONFIG || {};
    const widgetVersion = config.widgetVersion || config.widget_version || '20260210-2';
    try {
      const baseUrl = currentScript?.src
        ? new URL('webchat-widget-v2.js', currentScript.src)
        : new URL('webchat-widget-v2.js', window.location.href);
      baseUrl.searchParams.set('v', String(widgetVersion));
      script.src = baseUrl.toString();
    } catch {
      script.src = `webchat-widget-v2.js?v=${encodeURIComponent(String(widgetVersion))}`;
    }
    script.async = true;
    document.head.appendChild(script);
    return;
  }
  const config = window.CRM_WEBCHAT_CONFIG || {};
  const endpoint = config.endpoint;
  const domain = config.domain || window.location.hostname;
  const title = config.title || 'Dotty';
  const themePrimary = config.primaryColor || '#0D9488';
  const themeSecondary = config.secondaryColor || '#14B8A6';
  const logoUrl = config.logoUrl || '';
  const statusText = config.statusText || 'En línea';
  const welcomeMessage = config.welcomeMessage || '¡Hola! Soy Dotty, tu asistente virtual de DogCatify. ¿En qué puedo ayudarte hoy?';
  const quickReplies = config.quickReplies || [
    '¿Qué servicios ofrecen?','¿Cómo reservar?','Horarios de atención','Contacto'
  ];
  const apiKey = config.apiKey || '';
  const integrationHeader = config.integrationHeader || 'x-api-key';
  const integrationKey = config.integrationKey || apiKey;

  if (!endpoint) {
    console.warn('[WebChat] Missing endpoint configuration');
    return;
  }

  const sessionKey = 'crm_webchat_session_id';
  const visitorKey = 'crm_webchat_visitor';
  const agentRequestKey = 'crm_webchat_agent_requested';
  const pollIntervalMs = 2000;
  const maxMessageLength = 2000;

  const getSessionId = () => {
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(sessionKey, sessionId);
    }
    return sessionId;
  };

  const getVisitor = () => {
    try {
      const raw = localStorage.getItem(visitorKey);
      return raw ? JSON.parse(raw) : { name: '', email: '', phone: '' };
    } catch (e) {
      return { name: '', email: '', phone: '' };
    }
  };

  const setVisitor = (visitor) => {
    localStorage.setItem(visitorKey, JSON.stringify(visitor));
  };

  const sessionId = getSessionId();
  let visitor = getVisitor();
  let isOpen = false;
  let pollTimer;
  let cachedMessages = [];
  let currentConversation = null;
  let agentRequested = localStorage.getItem(agentRequestKey) === '1';
  let agentConnected = false;

  const ensureFont = () => {
    if (document.getElementById('crm-webchat-font')) return;
    const link = document.createElement('link');
    link.id = 'crm-webchat-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  };

  const ensureBaseStyles = () => {
    if (document.getElementById('crm-webchat-styles')) return;
    const style = document.createElement('style');
    style.id = 'crm-webchat-styles';
    style.textContent = `
      #dotty-widget { position: fixed; right: 24px; bottom: 24px; z-index: 9999; font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .dotty-fab { width: 56px; height: 56px; border-radius: 999px; background: linear-gradient(90deg, ${themePrimary}, ${themeSecondary}); color: #fff; border: 0; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,.2); position: relative; transition: transform .2s, box-shadow .2s; }
      .dotty-fab:hover { transform: scale(1.08); box-shadow: 0 12px 30px rgba(0,0,0,.25); }
      .dotty-badge { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: #EF4444; border: 2px solid #fff; border-radius: 999px; animation: pulse 1.5s infinite; }
      @keyframes pulse { 0%{transform:scale(.9);} 70%{transform:scale(1);} 100%{transform:scale(.9);} }
      .dotty-window { position: fixed; right: 24px; bottom: 96px; width: 384px; max-width: calc(100vw - 48px); height: 600px; max-height: calc(100vh - 128px); background: #fff; border-radius: 16px; border: 1px solid #E5E7EB; box-shadow: 0 20px 50px rgba(0,0,0,.2); display: none; flex-direction: column; overflow: hidden; }
      .dotty-window.is-open { display: flex; }
      .dotty-header { background: linear-gradient(90deg, ${themePrimary}, ${themeSecondary}); color: #fff; padding: 16px; display: flex; align-items: center; justify-content: space-between; }
      .dotty-brand { display: flex; gap: 12px; align-items: center; }
      .dotty-logo { width: 40px; height: 40px; background: #fff; border-radius: 999px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
      .dotty-logo img { width: 100%; height: 100%; object-fit: cover; }
      .dotty-title { font-weight: 600; }
      .dotty-status { font-size: 12px; color: #CCFBF1; }
      .dotty-body { flex: 1; padding: 16px; background: #F9FAFB; overflow-y: auto; }
      .dotty-msg { display: flex; margin-bottom: 12px; }
      .dotty-msg.bot { justify-content: flex-start; }
      .dotty-msg.user { justify-content: flex-end; }
      .dotty-msg.system { justify-content: center; }
      .dotty-bubble { max-width: 75%; padding: 10px 14px; border-radius: 16px; background: #fff; color: #1F2937; border: 1px solid #E5E7EB; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
      .dotty-msg.user .dotty-bubble { background: ${themePrimary}; color: #fff; border: none; }
      .dotty-msg.system .dotty-bubble { background: #FFFBEB; color: #92400E; border: 1px solid #FCD34D; }
      .dotty-time { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
      .dotty-quick { padding: 8px 0; }
      .dotty-quick-title { font-size: 12px; color: #6B7280; margin-bottom: 8px; }
      .dotty-quick-list { display: flex; flex-wrap: wrap; gap: 8px; }
      .dotty-chip { font-size: 12px; padding: 6px 10px; border-radius: 999px; background: #ECFDF5; color: #0F766E; border: 1px solid #99F6E4; cursor: pointer; }
      .dotty-footer { padding: 12px 16px; background: #fff; border-top: 1px solid #E5E7EB; display: flex; gap: 8px; align-items: center; }
      .dotty-input { flex: 1; border: 1px solid #D1D5DB; border-radius: 999px; padding: 8px 12px; outline: none; }
      .dotty-input:focus { border-color: ${themeSecondary}; box-shadow: 0 0 0 2px rgba(20,184,166,.2); }
      .dotty-input:disabled { background: #F8FAFC; color: #94A3B8; }
      .dotty-send { width: 36px; height: 36px; border-radius: 999px; border: 0; cursor: pointer; background: ${themePrimary}; color: #fff; }
      .dotty-send:disabled { opacity: .5; cursor: not-allowed; }
      .dotty-icon-btn { width: 36px; height: 36px; border-radius: 999px; border: 0; background: rgba(255,255,255,.15); color: #fff; cursor: pointer; }
      .dotty-agent-btn { background: #F1F5F9; color: #0F172A; border: 1px solid #E2E8F0; }
      .dotty-waiting-banner { display: none; padding: 8px 16px; background: #FFFBEB; border-top: 1px solid #FCD34D; color: #92400E; font-size: 12px; }
    `;
    document.head.appendChild(style);
  };

  ensureFont();
  ensureBaseStyles();

  const root = document.createElement('div');
  root.id = 'dotty-widget';

  const windowEl = document.createElement('div');
  windowEl.className = 'dotty-window';
  windowEl.id = 'dotty-window';

  const header = document.createElement('div');
  header.className = 'dotty-header';

  const brand = document.createElement('div');
  brand.className = 'dotty-brand';

  const logoWrap = document.createElement('div');
  logoWrap.className = 'dotty-logo';
  if (logoUrl) {
    const logoImg = document.createElement('img');
    logoImg.src = logoUrl;
    logoImg.alt = title;
    logoWrap.appendChild(logoImg);
  } else {
    logoWrap.textContent = '🐾';
  }

  const titleWrap = document.createElement('div');
  const headerTitle = document.createElement('div');
  headerTitle.className = 'dotty-title';
  headerTitle.textContent = title;
  const headerStatus = document.createElement('div');
  headerStatus.className = 'dotty-status';
  headerStatus.textContent = statusText;
  titleWrap.appendChild(headerTitle);
  titleWrap.appendChild(headerStatus);

  brand.appendChild(logoWrap);
  brand.appendChild(titleWrap);

  const headerClose = document.createElement('button');
  headerClose.className = 'dotty-icon-btn';
  headerClose.id = 'dotty-close';
  headerClose.textContent = '✕';

  header.appendChild(brand);
  header.appendChild(headerClose);

  const body = document.createElement('div');
  body.className = 'dotty-body';

  const quickWrap = document.createElement('div');
  quickWrap.className = 'dotty-quick';
  const quickTitle = document.createElement('div');
  quickTitle.className = 'dotty-quick-title';
  quickTitle.textContent = 'Respuestas rápidas:';
  const quickList = document.createElement('div');
  quickList.className = 'dotty-quick-list';
  quickWrap.appendChild(quickTitle);
  quickWrap.appendChild(quickList);

  const waitingBanner = document.createElement('div');
  waitingBanner.className = 'dotty-waiting-banner';
  waitingBanner.textContent = 'Un agente se conectará contigo pronto. Gracias por tu paciencia.';

  const footer = document.createElement('form');
  footer.className = 'dotty-footer';

  const agentButton = document.createElement('button');
  agentButton.type = 'button';
  agentButton.className = 'dotty-icon-btn dotty-agent-btn';
  agentButton.title = 'Hablar con un agente';
  agentButton.textContent = '👤';

  const input = document.createElement('input');
  input.className = 'dotty-input';
  input.placeholder = 'Escribe tu mensaje...';

  const sendButton = document.createElement('button');
  sendButton.type = 'submit';
  sendButton.className = 'dotty-send';
  sendButton.textContent = '➤';

  footer.appendChild(agentButton);
  footer.appendChild(input);
  footer.appendChild(sendButton);

  windowEl.appendChild(header);
  windowEl.appendChild(body);
  windowEl.appendChild(quickWrap);
  windowEl.appendChild(waitingBanner);
  windowEl.appendChild(footer);

  const fab = document.createElement('button');
  fab.className = 'dotty-fab';
  fab.id = 'dotty-toggle';
  fab.textContent = '💬';
  const badge = document.createElement('span');
  badge.className = 'dotty-badge';
  fab.appendChild(badge);

  root.appendChild(windowEl);
  root.appendChild(fab);
  document.body.appendChild(root);

  const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const renderQuickReplies = () => {
    quickList.innerHTML = '';
    if (!quickReplies || quickReplies.length === 0) {
      quickWrap.style.display = 'none';
      return;
    }
    quickReplies.forEach((reply) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dotty-chip';
      btn.textContent = reply;
      btn.addEventListener('click', () => {
        input.value = reply;
        input.focus();
      });
      quickList.appendChild(btn);
    });
    quickWrap.style.display = 'block';
  };

  const isAgentConnected = (conversation) => {
    if (!conversation) return false;
    if (conversation.assigned_user_id) return true;
    return ['assigned', 'taken', 'resolved'].includes(conversation.status);
  };

  const updateAgentUI = () => {
    if (agentConnected) {
      headerStatus.textContent = 'En línea';
      input.disabled = false;
      sendButton.disabled = false;
      input.placeholder = 'Escribe tu mensaje...';
      waitingBanner.style.display = 'none';
    } else if (agentRequested) {
      headerStatus.textContent = 'Esperando agente...';
      input.disabled = true;
      sendButton.disabled = true;
      input.placeholder = 'Esperando agente...';
      waitingBanner.style.display = 'block';
    } else {
      headerStatus.textContent = statusText;
      input.disabled = false;
      sendButton.disabled = false;
      input.placeholder = 'Escribe tu mensaje...';
      waitingBanner.style.display = 'none';
    }
  };

  const renderMessages = (messages) => {
    cachedMessages = Array.isArray(messages) ? messages : [];
    body.innerHTML = '';

    const systemMessages = [];
    if (agentRequested && !agentConnected) {
      systemMessages.push({
        id: 'system-waiting',
        sender_type: 'system',
        message: 'He solicitado un agente para ti. Un miembro de nuestro equipo te atenderá en breve. Por favor, mantente en línea.'
      });
    }

    const renderList = [...cachedMessages, ...systemMessages];

    renderList.forEach((msg) => {
      const wrapper = document.createElement('div');
      const type = msg.sender_type === 'visitor' ? 'user' : (msg.sender_type === 'system' ? 'system' : 'bot');
      wrapper.className = `dotty-msg ${type}`;

      const bubble = document.createElement('div');
      bubble.className = 'dotty-bubble';

      const text = document.createElement('div');
      text.className = 'dotty-text';
      text.textContent = msg.message || '';
      bubble.appendChild(text);

      const time = document.createElement('div');
      time.className = 'dotty-time';
      time.textContent = formatTime(msg.created_at || new Date().toISOString());
      bubble.appendChild(time);

      wrapper.appendChild(bubble);
      body.appendChild(wrapper);
    });

    quickWrap.style.display = (cachedMessages.length <= 1 && !agentRequested) ? 'block' : 'none';
    body.scrollTop = body.scrollHeight;
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${endpoint}?session_id=${encodeURIComponent(sessionId)}`, {
        headers: integrationKey ? { [integrationHeader]: integrationKey } : {}
      });
      const result = await response.json();
      if (result && result.conversation) {
        currentConversation = result.conversation;
        agentConnected = isAgentConnected(currentConversation);
        if (agentConnected) {
          localStorage.removeItem(agentRequestKey);
          agentRequested = false;
        }
      } else {
        currentConversation = null;
        agentConnected = false;
      }
      updateAgentUI();
      if (Array.isArray(result.messages)) {
        renderMessages(result.messages);
      }
    } catch (e) {
      console.warn('[WebChat] Error fetching messages', e);
    }
  };

  const sendMessage = async (payload) => {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(integrationKey ? { [integrationHeader]: integrationKey } : {}),
      },
      body: JSON.stringify(payload),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (input.disabled) return;

    setVisitor(visitor);

    if (input.value.trim().length > maxMessageLength) {
      alert(`El mensaje supera ${maxMessageLength} caracteres`);
      return;
    }

    if (!input.value.trim()) return;

    await sendMessage({
      session_id: sessionId,
      message: input.value.trim(),
      visitor,
      page_url: window.location.href,
      source_domain: domain,
      attachments: [],
    });

    input.value = '';
    fetchMessages();
  };

  footer.addEventListener('submit', handleSubmit);

  agentButton.addEventListener('click', async () => {
    if (agentRequested || agentConnected) return;
    agentRequested = true;
    localStorage.setItem(agentRequestKey, '1');
    updateAgentUI();
    await sendMessage({
      session_id: sessionId,
      message: 'Solicitud de agente',
      message_type: 'request_agent',
      visitor,
      page_url: window.location.href,
      source_domain: domain,
      attachments: [],
    });
    fetchMessages();
  });

  headerClose.addEventListener('click', () => {
    isOpen = false;
    windowEl.classList.remove('is-open');
    badge.style.display = 'block';
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    windowEl.classList.toggle('is-open', isOpen);
    badge.style.display = isOpen ? 'none' : 'block';

    if (isOpen) {
      if (cachedMessages.length === 0) {
        renderMessages([
          {
            id: 'welcome',
            message: welcomeMessage,
            sender_type: 'bot',
            created_at: new Date().toISOString(),
          }
        ]);
      }
      renderQuickReplies();
      fetchMessages();
      pollTimer = setInterval(fetchMessages, pollIntervalMs);
    } else if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  updateAgentUI();
})();
/*
  const config = window.CRM_WEBCHAT_CONFIG || {};
  const endpoint = config.endpoint;
  const domain = config.domain || window.location.hostname;
  const title = config.title || 'Dotty';
  const themePrimary = config.primaryColor || '#0D9488';
  const themeSecondary = config.secondaryColor || '#14B8A6';
  const agentColor = config.agentColor || '#2563EB';
  const backgroundColor = config.backgroundColor || '#F3F4F6';
  const logoUrl = config.logoUrl || '';
  const statusText = config.statusText || 'En línea';
  const welcomeMessage = config.welcomeMessage || '¡Hola! Soy Dotty, tu asistente virtual de DogCatify. ¿En qué puedo ayudarte hoy?';
  const quickReplies = config.quickReplies || [
    (function () {
      const config = window.CRM_WEBCHAT_CONFIG || {};
      const endpoint = config.endpoint;
      const domain = config.domain || window.location.hostname;
      const title = config.title || 'Dotty';
      const themePrimary = config.primaryColor || '#0D9488';
      const themeSecondary = config.secondaryColor || '#14B8A6';
      const logoUrl = config.logoUrl || '';
      const statusText = config.statusText || 'En línea';
      const welcomeMessage = config.welcomeMessage || '¡Hola! Soy Dotty, tu asistente virtual de DogCatify. ¿En qué puedo ayudarte hoy?';
      const quickReplies = config.quickReplies || [
        '¿Qué servicios ofrecen?','¿Cómo reservar?','Horarios de atención','Contacto'
      ];
      const apiKey = config.apiKey || '';
      const integrationHeader = config.integrationHeader || 'x-api-key';
      const integrationKey = config.integrationKey || apiKey;

      if (!endpoint) {
        console.warn('[WebChat] Missing endpoint configuration');
        return;
      }

      const sessionKey = 'crm_webchat_session_id';
      const visitorKey = 'crm_webchat_visitor';
      const agentRequestKey = 'crm_webchat_agent_requested';
      const pollIntervalMs = 2000;
      const maxMessageLength = 2000;

      const getSessionId = () => {
        let sessionId = localStorage.getItem(sessionKey);
        if (!sessionId) {
          sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          localStorage.setItem(sessionKey, sessionId);
        }
        return sessionId;
      };

      const getVisitor = () => {
        try {
          const raw = localStorage.getItem(visitorKey);
          return raw ? JSON.parse(raw) : { name: '', email: '', phone: '' };
        } catch (e) {
          return { name: '', email: '', phone: '' };
        }
      };

      const setVisitor = (visitor) => {
        localStorage.setItem(visitorKey, JSON.stringify(visitor));
      };

      const sessionId = getSessionId();
      let visitor = getVisitor();
      let isOpen = false;
      let pollTimer;
      let cachedMessages = [];
      let currentConversation = null;
      let agentRequested = localStorage.getItem(agentRequestKey) === '1';
      let agentConnected = false;

      const ensureFont = () => {
        if (document.getElementById('crm-webchat-font')) return;
        const link = document.createElement('link');
        link.id = 'crm-webchat-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(link);
      };

      const ensureBaseStyles = () => {
        if (document.getElementById('crm-webchat-styles')) return;
        const style = document.createElement('style');
        style.id = 'crm-webchat-styles';
        style.textContent = `
          #dotty-widget { position: fixed; right: 24px; bottom: 24px; z-index: 9999; font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
          .dotty-fab { width: 56px; height: 56px; border-radius: 999px; background: linear-gradient(90deg, ${themePrimary}, ${themeSecondary}); color: #fff; border: 0; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,.2); position: relative; transition: transform .2s, box-shadow .2s; }
          .dotty-fab:hover { transform: scale(1.08); box-shadow: 0 12px 30px rgba(0,0,0,.25); }
          .dotty-badge { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: #EF4444; border: 2px solid #fff; border-radius: 999px; animation: pulse 1.5s infinite; }
          @keyframes pulse { 0%{transform:scale(.9);} 70%{transform:scale(1);} 100%{transform:scale(.9);} }
          .dotty-window { position: fixed; right: 24px; bottom: 96px; width: 384px; max-width: calc(100vw - 48px); height: 600px; max-height: calc(100vh - 128px); background: #fff; border-radius: 16px; border: 1px solid #E5E7EB; box-shadow: 0 20px 50px rgba(0,0,0,.2); display: none; flex-direction: column; overflow: hidden; }
          .dotty-window.is-open { display: flex; }
          .dotty-header { background: linear-gradient(90deg, ${themePrimary}, ${themeSecondary}); color: #fff; padding: 16px; display: flex; align-items: center; justify-content: space-between; }
          .dotty-brand { display: flex; gap: 12px; align-items: center; }
          .dotty-logo { width: 40px; height: 40px; background: #fff; border-radius: 999px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
          .dotty-logo img { width: 100%; height: 100%; object-fit: cover; }
          .dotty-title { font-weight: 600; }
          .dotty-status { font-size: 12px; color: #CCFBF1; }
          .dotty-body { flex: 1; padding: 16px; background: #F9FAFB; overflow-y: auto; }
          .dotty-msg { display: flex; margin-bottom: 12px; }
          .dotty-msg.bot { justify-content: flex-start; }
          .dotty-msg.user { justify-content: flex-end; }
          .dotty-msg.system { justify-content: center; }
          .dotty-bubble { max-width: 75%; padding: 10px 14px; border-radius: 16px; background: #fff; color: #1F2937; border: 1px solid #E5E7EB; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
          .dotty-msg.user .dotty-bubble { background: ${themePrimary}; color: #fff; border: none; }
          .dotty-msg.system .dotty-bubble { background: #FFFBEB; color: #92400E; border: 1px solid #FCD34D; }
          .dotty-time { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
          .dotty-quick { padding: 8px 0; }
          .dotty-quick-title { font-size: 12px; color: #6B7280; margin-bottom: 8px; }
          .dotty-quick-list { display: flex; flex-wrap: wrap; gap: 8px; }
          .dotty-chip { font-size: 12px; padding: 6px 10px; border-radius: 999px; background: #ECFDF5; color: #0F766E; border: 1px solid #99F6E4; cursor: pointer; }
          .dotty-footer { padding: 12px 16px; background: #fff; border-top: 1px solid #E5E7EB; display: flex; gap: 8px; align-items: center; }
          .dotty-input { flex: 1; border: 1px solid #D1D5DB; border-radius: 999px; padding: 8px 12px; outline: none; }
          .dotty-input:focus { border-color: ${themeSecondary}; box-shadow: 0 0 0 2px rgba(20,184,166,.2); }
          .dotty-input:disabled { background: #F8FAFC; color: #94A3B8; }
          .dotty-send { width: 36px; height: 36px; border-radius: 999px; border: 0; cursor: pointer; background: ${themePrimary}; color: #fff; }
          .dotty-send:disabled { opacity: .5; cursor: not-allowed; }
          .dotty-icon-btn { width: 36px; height: 36px; border-radius: 999px; border: 0; background: rgba(255,255,255,.15); color: #fff; cursor: pointer; }
          .dotty-agent-btn { background: #F1F5F9; color: #0F172A; border: 1px solid #E2E8F0; }
          .dotty-waiting-banner { display: none; padding: 8px 16px; background: #FFFBEB; border-top: 1px solid #FCD34D; color: #92400E; font-size: 12px; }
        `;
        document.head.appendChild(style);
      };

      ensureFont();
      ensureBaseStyles();

      const root = document.createElement('div');
      root.id = 'dotty-widget';

      const windowEl = document.createElement('div');
      windowEl.className = 'dotty-window';
      windowEl.id = 'dotty-window';

      const header = document.createElement('div');
      header.className = 'dotty-header';

      const brand = document.createElement('div');
      brand.className = 'dotty-brand';

      const logoWrap = document.createElement('div');
      logoWrap.className = 'dotty-logo';
      if (logoUrl) {
        const logoImg = document.createElement('img');
        logoImg.src = logoUrl;
        logoImg.alt = title;
        logoWrap.appendChild(logoImg);
      } else {
        logoWrap.textContent = '🐾';
      }

      const titleWrap = document.createElement('div');
      const headerTitle = document.createElement('div');
      headerTitle.className = 'dotty-title';
      headerTitle.textContent = title;
      const headerStatus = document.createElement('div');
      headerStatus.className = 'dotty-status';
      headerStatus.textContent = statusText;
      titleWrap.appendChild(headerTitle);
      titleWrap.appendChild(headerStatus);

      brand.appendChild(logoWrap);
      brand.appendChild(titleWrap);

      const headerClose = document.createElement('button');
      headerClose.className = 'dotty-icon-btn';
      headerClose.id = 'dotty-close';
      headerClose.textContent = '✕';

      header.appendChild(brand);
      header.appendChild(headerClose);

      const body = document.createElement('div');
      body.className = 'dotty-body';

      const quickWrap = document.createElement('div');
      quickWrap.className = 'dotty-quick';
      const quickTitle = document.createElement('div');
      quickTitle.className = 'dotty-quick-title';
      quickTitle.textContent = 'Respuestas rápidas:';
      const quickList = document.createElement('div');
      quickList.className = 'dotty-quick-list';
      quickWrap.appendChild(quickTitle);
      quickWrap.appendChild(quickList);

      const waitingBanner = document.createElement('div');
      waitingBanner.className = 'dotty-waiting-banner';
      waitingBanner.textContent = 'Un agente se conectará contigo pronto. Gracias por tu paciencia.';

      const footer = document.createElement('form');
      footer.className = 'dotty-footer';

      const agentButton = document.createElement('button');
      agentButton.type = 'button';
      agentButton.className = 'dotty-icon-btn dotty-agent-btn';
      agentButton.title = 'Hablar con un agente';
      agentButton.textContent = '👤';

      const input = document.createElement('input');
      input.className = 'dotty-input';
      input.placeholder = 'Escribe tu mensaje...';

      const sendButton = document.createElement('button');
      sendButton.type = 'submit';
      sendButton.className = 'dotty-send';
      sendButton.textContent = '➤';

      footer.appendChild(agentButton);
      footer.appendChild(input);
      footer.appendChild(sendButton);

      windowEl.appendChild(header);
      windowEl.appendChild(body);
      windowEl.appendChild(quickWrap);
      windowEl.appendChild(waitingBanner);
      windowEl.appendChild(footer);

      const fab = document.createElement('button');
      fab.className = 'dotty-fab';
      fab.id = 'dotty-toggle';
      fab.textContent = '💬';
      const badge = document.createElement('span');
      badge.className = 'dotty-badge';
      fab.appendChild(badge);

      root.appendChild(windowEl);
      root.appendChild(fab);
      document.body.appendChild(root);

      const formatTime = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      };

      const renderQuickReplies = () => {
        quickList.innerHTML = '';
        if (!quickReplies || quickReplies.length === 0) {
          quickWrap.style.display = 'none';
          return;
        }
        quickReplies.forEach((reply) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dotty-chip';
          btn.textContent = reply;
          btn.addEventListener('click', () => {
            input.value = reply;
            input.focus();
          });
          quickList.appendChild(btn);
        });
        quickWrap.style.display = 'block';
      };

      const isAgentConnected = (conversation) => {
        if (!conversation) return false;
        if (conversation.assigned_user_id) return true;
        return ['assigned', 'taken', 'resolved'].includes(conversation.status);
      };

      const updateAgentUI = () => {
        if (agentConnected) {
          headerStatus.textContent = 'En línea';
          input.disabled = false;
          sendButton.disabled = false;
          input.placeholder = 'Escribe tu mensaje...';
          waitingBanner.style.display = 'none';
        } else if (agentRequested) {
          headerStatus.textContent = 'Esperando agente...';
          input.disabled = true;
          sendButton.disabled = true;
          input.placeholder = 'Esperando agente...';
          waitingBanner.style.display = 'block';
        } else {
          headerStatus.textContent = statusText;
          input.disabled = false;
          sendButton.disabled = false;
          input.placeholder = 'Escribe tu mensaje...';
          waitingBanner.style.display = 'none';
        }
      };

      const renderMessages = (messages) => {
        cachedMessages = Array.isArray(messages) ? messages : [];
        body.innerHTML = '';

        const systemMessages = [];
        if (agentRequested && !agentConnected) {
          systemMessages.push({
            id: 'system-waiting',
            sender_type: 'system',
            message: 'He solicitado un agente para ti. Un miembro de nuestro equipo te atenderá en breve. Por favor, mantente en línea.'
          });
        }

        const renderList = [...cachedMessages, ...systemMessages];

        renderList.forEach((msg) => {
          const wrapper = document.createElement('div');
          const type = msg.sender_type === 'visitor' ? 'user' : (msg.sender_type === 'system' ? 'system' : 'bot');
          wrapper.className = `dotty-msg ${type}`;

          const bubble = document.createElement('div');
          bubble.className = 'dotty-bubble';

          const text = document.createElement('div');
          text.className = 'dotty-text';
          text.textContent = msg.message || '';
          bubble.appendChild(text);

          const time = document.createElement('div');
          time.className = 'dotty-time';
          time.textContent = formatTime(msg.created_at || new Date().toISOString());
          bubble.appendChild(time);

          wrapper.appendChild(bubble);
          body.appendChild(wrapper);
        });

        quickWrap.style.display = cachedMessages.length <= 1 ? 'block' : 'none';
        body.scrollTop = body.scrollHeight;
      };

      const fetchMessages = async () => {
        try {
          const response = await fetch(`${endpoint}?session_id=${encodeURIComponent(sessionId)}`, {
            headers: integrationKey ? { [integrationHeader]: integrationKey } : {}
          });
          const result = await response.json();
          if (result && result.conversation) {
            currentConversation = result.conversation;
            agentConnected = isAgentConnected(currentConversation);
            if (agentConnected) {
              localStorage.removeItem(agentRequestKey);
              agentRequested = false;
            }
          } else {
            currentConversation = null;
            agentConnected = false;
          }
          updateAgentUI();
          if (Array.isArray(result.messages)) {
            renderMessages(result.messages);
          }
        } catch (e) {
          console.warn('[WebChat] Error fetching messages', e);
        }
      };

      const sendMessage = async (payload) => {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(integrationKey ? { [integrationHeader]: integrationKey } : {}),
          },
          body: JSON.stringify(payload),
        });
      };

      const handleSubmit = async (event) => {
        event.preventDefault();
        if (input.disabled) return;

        setVisitor(visitor);

        if (input.value.trim().length > maxMessageLength) {
          alert(`El mensaje supera ${maxMessageLength} caracteres`);
          return;
        }

        if (!input.value.trim()) return;

        await sendMessage({
          session_id: sessionId,
          message: input.value.trim(),
          visitor,
          page_url: window.location.href,
          source_domain: domain,
          attachments: [],
        });

        input.value = '';
        fetchMessages();
      };

      footer.addEventListener('submit', handleSubmit);

      agentButton.addEventListener('click', async () => {
        if (agentRequested || agentConnected) return;
        agentRequested = true;
        localStorage.setItem(agentRequestKey, '1');
        updateAgentUI();
        await sendMessage({
          session_id: sessionId,
          message: 'Solicitud de agente',
          message_type: 'request_agent',
          visitor,
          page_url: window.location.href,
          source_domain: domain,
          attachments: [],
        });
        fetchMessages();
      });

      headerClose.addEventListener('click', () => {
        isOpen = false;
        windowEl.classList.remove('is-open');
        badge.style.display = 'block';
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      });

      fab.addEventListener('click', () => {
        isOpen = !isOpen;
        windowEl.classList.toggle('is-open', isOpen);
        badge.style.display = isOpen ? 'none' : 'block';

        if (isOpen) {
          if (cachedMessages.length === 0) {
            renderMessages([
              {
                id: 'welcome',
                message: welcomeMessage,
                sender_type: 'bot',
                created_at: new Date().toISOString(),
              }
            ]);
          }
          renderQuickReplies();
          fetchMessages();
          pollTimer = setInterval(fetchMessages, pollIntervalMs);
        } else if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      });

      updateAgentUI();
    })();
  */
