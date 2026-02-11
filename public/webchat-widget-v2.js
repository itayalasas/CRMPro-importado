(function () {
    // --- Ticket notification logic ---
    let ticketNotifyTimer = null;
    let lastTicketNotify = null;
    // Simulación: polling a endpoint de ticket para cambios/comentarios
    const ticketPollIntervalMs = 6000;
    const ticketIdKey = 'crm_webchat_ticket_id';
    let ticketId = localStorage.getItem(ticketIdKey);
    // Notifica al usuario en el widget
    const notifyTicketUpdate = (type, data) => {
      badge.style.display = 'block';
      badge.style.background = '#F59E42';
      badge.title = 'Nuevo comentario o cambio en ticket';
      // Mensaje system en chat
      const msg = {
        id: `ticket-notify-${Date.now()}`,
        sender_type: 'system',
        message: type === 'comment' ? 'Nuevo comentario en tu ticket.' : 'El estado de tu ticket ha cambiado.',
        created_at: new Date().toISOString(),
      };
      localSystemMessages.push(msg);
      renderMessages(cachedMessages);
    };

    // Polling para ticket updates
    const pollTicketUpdates = async () => {
      if (!ticketId) return;
      try {
        const resp = await fetch(`${endpoint}/ticket_notify?ticket_id=${ticketId}`);
        if (!resp.ok) return;
        const result = await resp.json();
        if (!result) return;
        // Si hay update
        if (result.last_update && result.last_update !== lastTicketNotify) {
          lastTicketNotify = result.last_update;
          if (result.type === 'comment' || result.type === 'status') {
            notifyTicketUpdate(result.type, result.data);
          }
        }
      } catch {}
    };

    if (ticketId) {
      ticketNotifyTimer = setInterval(pollTicketUpdates, ticketPollIntervalMs);
    }
  const config = window.CRM_WEBCHAT_CONFIG || {};
  const endpoint = config.endpoint;
  const getEndpoint = config.getEndpoint || config.get_endpoint || endpoint;
  const domain = config.domain || window.location.hostname;
  const botName = config.botName || config.bot_name || 'Dotty';
  const title = config.title || botName;
  const themePrimary = config.primaryColor || '#0D9488';
  const themeSecondary = config.secondaryColor || '#14B8A6';
  const logoUrl = config.logoUrl || '';
  const statusText = config.statusText || 'En línea';
  const welcomeMessage = config.welcomeMessage || '¡Hola! Soy Dotty, tu asistente virtual de DogCatify. ¿En qué puedo ayudarte hoy?';
  let quickReplies = config.quickReplies || [
    '¿Qué servicios ofrecen?','¿Cómo reservar?','Horarios de atención','Contacto'
  ];
  const apiKey = config.apiKey || '';
  const integrationHeader = config.integrationHeader || config.integration_header || 'X-Integration-Key';
  const integrationKey = config.integrationKey || config.integration_key || apiKey;
  const getIntegrationHeader = config.getIntegrationHeader || config.get_integration_header || integrationHeader;
  const getIntegrationKey = config.getIntegrationKey || config.get_integration_key || integrationKey;

  if (!endpoint) {
    console.warn('[WebChat] Missing endpoint configuration');
    return;
  }

  const sessionKey = 'crm_webchat_session_id';
  const visitorKey = 'crm_webchat_visitor';
  const agentRequestKey = 'crm_webchat_agent_requested';
  const startedKey = 'crm_webchat_conversation_started';
  const welcomeSentKey = 'crm_webchat_welcome_sent';
  const queuedKey = 'crm_webchat_queued_messages';
  const pollIntervalMs = 2000;
  const maxMessageLength = 2000;

  const getCfg = (key) => {
    // Allow pages to set CRM_WEBCHAT_CONFIG after the widget script loads.
    const liveConfig = (window && window.CRM_WEBCHAT_CONFIG) ? window.CRM_WEBCHAT_CONFIG : config;
    if (liveConfig && Object.prototype.hasOwnProperty.call(liveConfig, key)) return liveConfig[key];
    if (liveConfig?.variables && Object.prototype.hasOwnProperty.call(liveConfig.variables, key)) return liveConfig.variables[key];
    if (liveConfig?.env && Object.prototype.hasOwnProperty.call(liveConfig.env, key)) return liveConfig.env[key];
    return undefined;
  };

  const getBotApiUrl = () =>
    getCfg('VITE_WIDGET_URL') ||
    getCfg('vite_widget_url') ||
    getCfg('widgetUrl') ||
    getCfg('widget_url') ||
    getCfg('botApiUrl') ||
    getCfg('bot_api_url') ||
    getCfg('dogcatifyBotApiUrl') ||
    getCfg('dogcatify_bot_api_url') ||
    null;

  const getBotProxyUrl = () =>
    getCfg('botProxyUrl') ||
    getCfg('bot_proxy_url') ||
    getCfg('VITE_WIDGET_BOT_PROXY_URL') ||
    getCfg('vite_widget_bot_proxy_url') ||
    getCfg('VITE_WIDGET_PROXY_URL') ||
    getCfg('vite_widget_proxy_url') ||
    null;

  const getBotIntegrationKey = () =>
    getCfg('VITE_WIDGET_APIKEY') ||
    getCfg('vite_widget_apikey') ||
    getCfg('widgetApiKey') ||
    getCfg('widget_api_key') ||
    getCfg('botIntegrationKey') ||
    getCfg('bot_integration_key') ||
    getCfg('dogcatifyIntegrationKey') ||
    getCfg('dogcatify_integration_key') ||
    null;
  const botIntegrationHeader = 'X-Integration-Key';

  const fetchBotReply = async (messageText) => {
    const botProxyUrl = getBotProxyUrl();
    const botApiUrl = getBotApiUrl();
    const botIntegrationKey = getBotIntegrationKey();
    const proxyAuthKey = (typeof getIntegrationKey === 'function')
      ? getIntegrationKey()
      : (typeof getIntegrationKey === 'string' && getIntegrationKey.trim().length > 0)
        ? getIntegrationKey
        : integrationKey;
    const finalBotUrl = botProxyUrl || botApiUrl;
    if (!finalBotUrl) {
      console.warn('[WebChat] Missing VITE_WIDGET_URL in CRM_WEBCHAT_CONFIG (expected at CRM_WEBCHAT_CONFIG.VITE_WIDGET_URL or CRM_WEBCHAT_CONFIG.variables.VITE_WIDGET_URL), and no botProxyUrl provided.');
      return {
        reply: 'No pude conectar con el asistente automático. ¿Quieres que te contacte un agente?',
        handoff: false,
        quickReplies,
      };
    }

    if (!botProxyUrl && !botIntegrationKey) {
      console.warn('[WebChat] Missing VITE_WIDGET_APIKEY in CRM_WEBCHAT_CONFIG (expected at CRM_WEBCHAT_CONFIG.VITE_WIDGET_APIKEY or CRM_WEBCHAT_CONFIG.variables.VITE_WIDGET_APIKEY).');
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
    try {
      console.info('[WebChat] Bot request', {
        url: finalBotUrl,
        mode: botProxyUrl ? 'proxy' : 'direct',
        hasIntegrationKey: botProxyUrl ? !!proxyAuthKey : !!botIntegrationKey,
      });

      const response = await fetch(finalBotUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(botProxyUrl
            ? (proxyAuthKey ? { [botIntegrationHeader]: proxyAuthKey } : {})
            : (botIntegrationKey ? { [botIntegrationHeader]: botIntegrationKey } : {})),
        },
        body: JSON.stringify({ message: messageText }),
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        reply: typeof data?.reply === 'string' ? data.reply : '',
        handoff: !!data?.handoff,
        quickReplies: Array.isArray(data?.quickReplies) ? data.quickReplies : quickReplies,
      };
    } catch (e) {
      const maybeMessage = (e && typeof e === 'object' && 'message' in e) ? String(e.message) : String(e);
      const hint = /failed to fetch|networkerror/i.test(maybeMessage)
        ? 'Suele ser CORS, mixed-content (https->http), DNS o bloqueo de red.'
        : undefined;
      console.warn('[WebChat] Error fetching bot reply', { url: finalBotUrl, hint, error: e });
      return {
        reply: 'No pude obtener una respuesta automática. ¿Quieres que te contacte un agente?',
        handoff: false,
        quickReplies,
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

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

  const loadQueuedMessages = () => {
    try {
      const raw = localStorage.getItem(queuedKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // Never persist/render the synthetic welcome message as a queued message.
      return parsed.filter((msg) => msg && msg.id !== 'welcome');
    } catch {
      return [];
    }
  };

  const saveQueuedMessages = (list) => {
    localStorage.setItem(queuedKey, JSON.stringify(list));
  };

  let sessionId = getSessionId();
  let visitor = getVisitor();
  let isOpen = false;
  let pollTimer;
  let cachedMessages = [];
  let currentConversation = null;
  let agentRequested = localStorage.getItem(agentRequestKey) === '1';
  let agentConnected = false;
  let conversationStarted = localStorage.getItem(startedKey) === '1';
  let errorCount = 0;
  let isPollingPaused = false;
  let pendingMessages = [];
  let showWelcomeOnOpen = false;
  let typingActive = false;
  let localSystemMessages = [];
  let localClientMessages = [];
  let queuedMessages = loadQueuedMessages();

  let lastClientCreatedAtMs = 0;
  const nextCreatedAtIso = (preferredIso) => {
    const preferredMs = (() => {
      if (!preferredIso) return null;
      const date = new Date(preferredIso);
      const ms = date.getTime();
      return Number.isNaN(ms) ? null : ms;
    })();
    const nowMs = Date.now();
    const baseMs = preferredMs != null ? preferredMs : nowMs;
    const nextMs = Math.max(baseMs, lastClientCreatedAtMs + 1);
    lastClientCreatedAtMs = nextMs;
    return new Date(nextMs).toISOString();
  };

  let outboundChain = Promise.resolve();
  const sentOnce = new Set();
  const sendMessageOrdered = (payload) => {
    const withCreatedAt = {
      ...payload,
      created_at: nextCreatedAtIso(payload?.created_at),
    };

    const dedupeKey = `${withCreatedAt.sender_type || ''}|${withCreatedAt.created_at || ''}|${withCreatedAt.message || ''}|${withCreatedAt.message_type || ''}`;
    if (sentOnce.has(dedupeKey)) return Promise.resolve({ skipped: true });
    sentOnce.add(dedupeKey);

    const sendPromise = outboundChain.then(() => sendMessage(withCreatedAt));
    outboundChain = sendPromise.catch(() => {});
    return sendPromise;
  };

  const markConversationStarted = () => {
    localStorage.setItem(startedKey, '1');
    conversationStarted = true;
  };

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
      #dotty-widget, #dotty-widget * { box-sizing: border-box; }
      #dotty-widget button { font: inherit; letter-spacing: normal; text-transform: none; }

      .dotty-fab { width: 56px; height: 56px; border-radius: 999px; background: linear-gradient(90deg, ${themePrimary}, ${themeSecondary}); color: #fff; border: 0; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,.2); position: relative; transition: transform .2s, box-shadow .2s; display: inline-flex; align-items: center; justify-content: center; padding: 0; line-height: 0; }
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
      .dotty-send { width: 36px; height: 36px; border-radius: 999px; border: 0; cursor: pointer; background: ${themePrimary}; color: #fff; display: inline-flex; align-items: center; justify-content: center; padding: 0; line-height: 0; }
      .dotty-send:disabled { opacity: .5; cursor: not-allowed; }
      .dotty-icon-btn { width: 36px; height: 36px; border-radius: 999px; border: 0; background: rgba(255,255,255,.15); color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
      .dotty-fab svg, .dotty-send svg, .dotty-icon-btn svg { display: block; }
      #dotty-close { font-size: 18px; line-height: 1; }
      .dotty-agent-btn { width: 44px; height: 44px; background: #F1F5F9; color: ${themePrimary}; border: 1px solid #E2E8F0; box-shadow: 0 8px 16px rgba(15, 118, 110, 0.18); display: inline-flex; align-items: center; justify-content: center; }
      .dotty-agent-btn svg { width: 22px; height: 22px; display: block; }
      .dotty-agent-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 18px rgba(15, 118, 110, 0.22); }
      .dotty-waiting-banner { display: none; padding: 8px 16px; background: #FFFBEB; border-top: 1px solid #FCD34D; color: #92400E; font-size: 12px; }
      .dotty-typing { display: inline-flex; gap: 6px; align-items: center; }
      .dotty-typing span { width: 6px; height: 6px; border-radius: 999px; background: #94A3B8; display: inline-block; animation: dotty-bounce 1.1s infinite ease-in-out; }
      .dotty-typing span:nth-child(2) { animation-delay: 0.15s; }
      .dotty-typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes dotty-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .6; } 40% { transform: translateY(-4px); opacity: 1; } }
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
  const setLogoContent = (label) => {
    logoWrap.innerHTML = '';
    if (label && label.type === 'image' && label.src) {
      const logoImg = document.createElement('img');
      logoImg.src = label.src;
      logoImg.alt = label.alt || title;
      logoWrap.appendChild(logoImg);
      return;
    }
    const letter = typeof label === 'string' && label.trim().length > 0 ? label.trim().charAt(0).toUpperCase() : '🐾';
    const span = document.createElement('span');
    span.textContent = letter;
    span.style.fontWeight = '600';
    span.style.color = '#0F766E';
    logoWrap.appendChild(span);
  };

  if (logoUrl) {
    setLogoContent({ type: 'image', src: logoUrl, alt: title });
  } else {
    setLogoContent('🐾');
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

  const errorBanner = document.createElement('div');
  errorBanner.className = 'dotty-waiting-banner';
  errorBanner.style.background = '#FEF2F2';
  errorBanner.style.borderTop = '1px solid #FECACA';
  errorBanner.style.color = '#991B1B';
  errorBanner.style.display = 'none';
  errorBanner.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.';

  const footer = document.createElement('form');
  footer.className = 'dotty-footer';

  const agentButton = document.createElement('button');
  agentButton.type = 'button';
  agentButton.className = 'dotty-icon-btn dotty-agent-btn';
  agentButton.title = 'Solicitar agente';
  agentButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 12a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <rect x="3" y="12" width="4" height="7" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
    <rect x="17" y="12" width="4" height="7" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="M9 20h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  const input = document.createElement('input');
  input.className = 'dotty-input';
  input.placeholder = 'Escribe tu mensaje...';

  const sendButton = document.createElement('button');
  sendButton.type = 'submit';
  sendButton.className = 'dotty-send';
  sendButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

  footer.appendChild(agentButton);
  footer.appendChild(input);
  footer.appendChild(sendButton);

  windowEl.appendChild(header);
  windowEl.appendChild(body);
  windowEl.appendChild(quickWrap);
  windowEl.appendChild(waitingBanner);
  windowEl.appendChild(errorBanner);
  windowEl.appendChild(footer);

  const fab = document.createElement('button');
  fab.className = 'dotty-fab';
  fab.id = 'dotty-toggle';
  const chatIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.406 20 8.898 19.6735 7.56 19.0866L3 21L4.41333 16.5733C3.53706 15.2855 3 13.7536 3 12C3 7.30558 7.02944 3.5 12 3.5C16.9706 3.5 21 7.30558 21 11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const closeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  fab.innerHTML = chatIcon;
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

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  const renderQuickReplies = () => {
    quickList.innerHTML = '';
    if (!quickReplies || quickReplies.length === 0 || agentRequested) {
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

  const updateHeaderIdentity = () => {
    if (agentConnected && currentConversation?.assigned_user_name) {
      headerTitle.textContent = currentConversation.assigned_user_name;
      const avatarUrl = currentConversation.assigned_user_avatar || currentConversation.assigned_user_avatar_url;
      if (avatarUrl) {
        setLogoContent({ type: 'image', src: avatarUrl, alt: currentConversation.assigned_user_name });
      } else {
        setLogoContent(currentConversation.assigned_user_name);
      }
    } else {
      headerTitle.textContent = botName;
      if (logoUrl) {
        setLogoContent({ type: 'image', src: logoUrl, alt: title });
      } else {
        setLogoContent('🐾');
      }
    }
  };

  const updateAgentUI = () => {
    if (currentConversation?.status === 'closed') {
      headerStatus.textContent = 'Conversación finalizada';
      input.disabled = false;
      sendButton.disabled = false;
      input.placeholder = 'Escribe tu mensaje...';
      waitingBanner.style.display = 'none';
      agentButton.style.display = 'inline-flex';
    } else if (agentConnected) {
      headerStatus.textContent = 'En línea';
      input.disabled = false;
      sendButton.disabled = false;
      input.placeholder = 'Escribe tu mensaje...';
      waitingBanner.style.display = 'none';
      agentButton.style.display = 'none';
    } else if (agentRequested) {
      headerStatus.textContent = 'Esperando agente...';
      input.disabled = false;
      sendButton.disabled = false;
      input.placeholder = 'Escribe tu mensaje...';
      // Keep a single notice inside the message list; avoid duplicating via a banner.
      waitingBanner.style.display = 'none';
      quickWrap.style.display = 'none';
      agentButton.style.display = 'none';
    } else {
      headerStatus.textContent = statusText;
      input.disabled = false;
      sendButton.disabled = false;
      input.placeholder = 'Escribe tu mensaje...';
      waitingBanner.style.display = 'none';
      agentButton.style.display = 'inline-flex';
    }
    updateHeaderIdentity();
  };

  const resetSession = () => {
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(agentRequestKey);
    localStorage.removeItem(startedKey);
    localStorage.removeItem(welcomeSentKey);
    localStorage.removeItem(queuedKey);
    sessionId = getSessionId();
    agentRequested = false;
    agentConnected = false;
    conversationStarted = false;
    currentConversation = null;
    cachedMessages = [];
    pendingMessages = [];
    localClientMessages = [];
    queuedMessages = [];
    updateAgentUI();
  };

  const ensurePolling = () => {
    if (!isOpen) return;
    // Before an agent is requested, keep the widget fully local.
    if (!agentRequested && !agentConnected) return;
    if (pollTimer) return;
    pollTimer = setInterval(fetchMessages, pollIntervalMs);
  };

  const addLocalClientMessage = (messageText, createdAt) => {
    localClientMessages.push({
      id: `local-client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender_type: 'visitor',
      sender_name: visitor?.name || null,
      message: messageText,
      created_at: createdAt || new Date().toISOString(),
    });
  };

  const reconcileLocalClientMessages = (serverMessages) => {
    if (!Array.isArray(serverMessages) || serverMessages.length === 0 || localClientMessages.length === 0) return;
    const toTime = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };
    localClientMessages = localClientMessages.filter((localMsg) => {
      const localTime = toTime(localMsg.created_at);
      const found = serverMessages.some((msg) =>
        msg.sender_type === 'visitor' &&
        msg.message === localMsg.message &&
        Math.abs(toTime(msg.created_at) - localTime) < 60000
      );
      return !found;
    });
  };

  const reconcileLocalBotMessages = (serverMessages) => {
    if (!Array.isArray(serverMessages) || serverMessages.length === 0 || localSystemMessages.length === 0) return;

    const botNameNormalized = normalizeText(botName);
    const toTime = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    localSystemMessages = localSystemMessages.filter((localMsg) => {
      if (!localMsg || !localMsg.message) return true;
      if (normalizeText(localMsg.sender_name) !== botNameNormalized) return true;

      const localTime = toTime(localMsg.created_at);
      const found = serverMessages.some((msg) =>
        normalizeText(msg?.message) === normalizeText(localMsg.message) &&
        normalizeText(msg?.sender_name) === botNameNormalized &&
        Math.abs(toTime(msg?.created_at) - localTime) < 60000
      );

      return !found;
    });
  };

  const mergeMessages = (serverMessages) => {
    const list = Array.isArray(serverMessages) ? serverMessages : [];
    const now = Date.now();
    const toTime = (value) => {
      const date = new Date(value || 0);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    pendingMessages = pendingMessages.filter((pending) => {
      const pendingTime = toTime(pending.created_at);
      const isStale = now - pendingTime > 60000;
      if (isStale) return false;
      const found = list.some((msg) =>
        msg.sender_type === 'visitor' &&
        msg.message === pending.message &&
        Math.abs(toTime(msg.created_at) - pendingTime) < 60000
      );
      return !found;
    });

    return [...list, ...pendingMessages].sort((a, b) => toTime(a.created_at) - toTime(b.created_at));
  };

  const queueMessageToServer = async (queued) => {
    if (!queued || !queued.message) return;
    try {
      await sendMessageOrdered({
        session_id: sessionId,
        message: queued.message,
        sender_type: queued.sender_type,
        sender_name: queued.sender_name || null,
        created_at: queued.created_at,
        queue_only: true,
        visitor,
        page_url: window.location.href,
        source_domain: domain,
        source_channel: 'widget',
        source_detail: 'webchat-widget-v2',
        attachments: [],
      });
    } catch (e) {
      console.warn('[WebChat] Error queueing message', e);
    }
  };

  const upsertWelcomeMessage = () => {
    const now = nextCreatedAtIso();
    // Clean up any queued welcome left by older widget versions.
    if (queuedMessages.length) {
      const cleaned = queuedMessages.filter((msg) => msg && msg.id !== 'welcome');
      if (cleaned.length !== queuedMessages.length) {
        queuedMessages = cleaned;
        saveQueuedMessages(queuedMessages);
      }
    }
    const existingIndex = localSystemMessages.findIndex((msg) => msg.id === 'welcome');
    const welcome = {
      id: 'welcome',
      sender_type: 'bot',
      sender_name: botName,
      message: welcomeMessage,
      created_at: now,
    };
    if (existingIndex >= 0) {
      localSystemMessages[existingIndex] = welcome;
    } else {
      localSystemMessages.push(welcome);
    }

    const alreadySent = localStorage.getItem(welcomeSentKey) === '1';
    if (!alreadySent) {
      markConversationStarted();
      localStorage.setItem(welcomeSentKey, '1');
      // Intentionally do NOT send to CRM until the user requests an agent.
    }
  };

  const upsertConversationClosedMessage = (closedAt) => {
    const timestamp = closedAt || new Date().toISOString();
    const existingIndex = localSystemMessages.findIndex((msg) => msg.id === 'conversation-closed');
    const closedMessage = {
      id: 'conversation-closed',
      sender_type: 'system',
      message: 'La conversación ha finalizado. Si necesitas más ayuda, inicia un nuevo mensaje y te contactaremos.',
      created_at: timestamp,
    };
    if (existingIndex >= 0) {
      localSystemMessages[existingIndex] = closedMessage;
    } else {
      localSystemMessages.push(closedMessage);
    }
  };

  const upsertQueuedMessage = (id, senderType, message, createdAt, senderName) => {
    const existingIndex = queuedMessages.findIndex((msg) => msg.id === id);
    const next = {
      id,
      sender_type: senderType,
      sender_name: senderName || null,
      message,
      created_at: createdAt || new Date().toISOString(),
    };
    let isNew = false;
    if (existingIndex >= 0) {
      queuedMessages[existingIndex] = next;
    } else {
      queuedMessages.push(next);
      isNew = true;
    }
    saveQueuedMessages(queuedMessages);
    if (isNew) {
      queueMessageToServer(next);
    }
  };

  const enqueueMessage = (senderType, message, senderName) => {
    const createdAt = new Date().toISOString();
    const queued = {
      id: `queued-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender_type: senderType,
      sender_name: senderName || null,
      message,
      created_at: createdAt,
    };
    queuedMessages.push(queued);
    saveQueuedMessages(queuedMessages);
    queueMessageToServer(queued);
    return queued;
  };

  const mergeQueuedFromServer = (serverQueued) => {
    if (!Array.isArray(serverQueued)) return;
    if (serverQueued.length === 0) {
      return;
    }
    queuedMessages = serverQueued
      // Ignore synthetic welcome if a previous version queued it.
      .filter((msg) => msg && msg.id !== 'welcome')
      .map((msg) => ({
      id: msg.id || `queued-${msg.created_at}-${Math.random().toString(36).slice(2)}`,
      sender_type: msg.sender_type,
      sender_name: msg.sender_name || null,
      message: msg.message,
      created_at: msg.created_at || new Date().toISOString(),
    }));
    saveQueuedMessages(queuedMessages);
  };

  const reconcileQueuedMessages = (serverMessages) => {
    if (!Array.isArray(serverMessages) || serverMessages.length === 0 || queuedMessages.length === 0) return;
    const toTime = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };
    queuedMessages = queuedMessages.filter((queued) => {
      const queuedTime = toTime(queued.created_at);
      const found = serverMessages.some((msg) =>
        msg.sender_type === queued.sender_type &&
        msg.message === queued.message &&
        Math.abs(toTime(msg.created_at) - queuedTime) < 60000
      );
      return !found;
    });
    saveQueuedMessages(queuedMessages);
  };

  const renderMessages = (messages) => {
    const shouldStickToBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= 120;
    body.innerHTML = '';

    const systemMessages = [];
    if (showWelcomeOnOpen) {
      showWelcomeOnOpen = false;
    }

    const baseList = [...messages, ...queuedMessages, ...localClientMessages, ...localSystemMessages, ...systemMessages];
    cachedMessages = mergeMessages(baseList);

    // Deduplicate consecutive identical messages (commonly caused by race/echo).
    const toTime = (value) => {
      const date = new Date(value || 0);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };
    const deduped = [];
    for (const msg of cachedMessages) {
      const prev = deduped[deduped.length - 1];
      if (
        prev &&
        prev.sender_type === msg.sender_type &&
        normalizeText(prev.message) === normalizeText(msg.message) &&
        Math.abs(toTime(prev.created_at) - toTime(msg.created_at)) < 2000
      ) {
        continue;
      }
      deduped.push(msg);
    }
    cachedMessages = deduped;

    const botNameNormalized = normalizeText(botName);
    const visitorNameNormalized = normalizeText(visitor?.name);

    cachedMessages.forEach((msg) => {
      const wrapper = document.createElement('div');
      const senderNameNormalized = normalizeText(msg?.sender_name);

      const isBotByName = !!(senderNameNormalized && senderNameNormalized === botNameNormalized);
      const isVisitorByName = !!(
        senderNameNormalized &&
        visitorNameNormalized &&
        senderNameNormalized === visitorNameNormalized
      );

      // Primary rule: system messages are centered.
      // Fallback rule: if sender_type comes back wrong from the backend,
      // classify by sender_name (Dotty vs the visitor) to keep sides stable.
      let type = 'bot';
      if (msg.sender_type === 'system') {
        type = 'system';
      } else if (isBotByName) {
        type = 'bot';
      } else if (msg.sender_type === 'visitor') {
        if (visitorNameNormalized) {
          type = isVisitorByName ? 'user' : 'bot';
        } else {
          // No visitor identity: keep visitor-type messages on the user side.
          type = 'user';
        }
      } else {
        type = 'bot';
      }

      wrapper.className = `dotty-msg ${type}`;

      const bubble = document.createElement('div');
      bubble.className = 'dotty-bubble';

      const text = document.createElement('div');
      text.className = 'dotty-text';
      text.textContent = msg.message || '';
      bubble.appendChild(text);

      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        const attList = document.createElement('div');
        attList.style.marginTop = '8px';
        attList.style.display = 'flex';
        attList.style.flexDirection = 'column';
        attList.style.gap = '6px';
        msg.attachments.forEach((att) => {
          if (!att || !att.url) return;
          const link = document.createElement('a');
          link.href = att.url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.textContent = att.filename || 'Adjunto';
          link.style.fontSize = '12px';
          link.style.color = msg.sender_type === 'visitor' ? '#E0F2FE' : '#2563EB';
          link.style.textDecoration = 'underline';
          attList.appendChild(link);
        });
        bubble.appendChild(attList);
      }

      const time = document.createElement('div');
      time.className = 'dotty-time';
      time.textContent = msg.pending ? 'Enviando...' : formatTime(msg.created_at || new Date().toISOString());
      bubble.appendChild(time);

      wrapper.appendChild(bubble);
      body.appendChild(wrapper);
    });

    if (typingActive) {
      const wrapper = document.createElement('div');
      wrapper.className = 'dotty-msg bot';
      const bubble = document.createElement('div');
      bubble.className = 'dotty-bubble';
      const typing = document.createElement('div');
      typing.className = 'dotty-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      bubble.appendChild(typing);
      wrapper.appendChild(bubble);
      body.appendChild(wrapper);
    }

    quickWrap.style.display = (cachedMessages.length <= 1 && !agentRequested) ? 'block' : 'none';
    if (shouldStickToBottom) {
      body.scrollTop = body.scrollHeight;
    }
  };

  const withSessionId = (baseUrl) => {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('session_id', sessionId);
      return url.toString();
    } catch {
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}session_id=${encodeURIComponent(sessionId)}`;
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(withSessionId(getEndpoint), {
        headers: getIntegrationKey ? { [getIntegrationHeader]: getIntegrationKey } : {}
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[WebChat] Error fetching messages', response.status, errorText);
        errorBanner.style.display = 'block';
        errorCount += 1;
        if (errorCount >= 3 && !isPollingPaused) {
          isPollingPaused = true;
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          setTimeout(() => {
            errorCount = 0;
            isPollingPaused = false;
            if (isOpen && !pollTimer) {
              pollTimer = setInterval(fetchMessages, pollIntervalMs);
              fetchMessages();
            }
          }, 10000);
        }
        return;
      }
      errorBanner.style.display = 'none';
      errorCount = 0;
      const result = await response.json();
      let isClosedConversation = false;
      if (result && result.conversation) {
        currentConversation = result.conversation;
        isClosedConversation = currentConversation.status === 'closed';
        agentConnected = !isClosedConversation && isAgentConnected(currentConversation);
        if (agentConnected) {
          localStorage.removeItem(agentRequestKey);
          agentRequested = false;
          localSystemMessages = localSystemMessages.filter(
            (msg) => msg.id !== 'conversation-closed' && msg.id !== 'system-waiting' && msg.id !== 'auto-agent'
          );
        } else if (isClosedConversation) {
          localStorage.removeItem(agentRequestKey);
          agentRequested = false;
          localSystemMessages = localSystemMessages.filter(
            (msg) => msg.id !== 'welcome' && msg.id !== 'system-waiting' && msg.id !== 'auto-agent'
          );
          upsertConversationClosedMessage(currentConversation.closed_at);
        }
      } else {
        currentConversation = null;
        agentConnected = false;
      }
      updateAgentUI();
      if (Array.isArray(result.messages)) {
        const normalizedAgentRequestText = normalizeText('Solicitud de agente');
        const filteredServerMessages = result.messages.filter((msg) => {
          if (normalizeText(msg?.message_type) === 'request_agent') return false;
          const messageText = normalizeText(msg?.message);
          if (messageText === normalizedAgentRequestText) return false;
          return true;
        });

        reconcileLocalClientMessages(filteredServerMessages);
        reconcileLocalBotMessages(filteredServerMessages);
        if (Array.isArray(result.queued_messages) && result.queued_messages.length > 0) {
          mergeQueuedFromServer(result.queued_messages);
        }
        reconcileQueuedMessages(filteredServerMessages);
        const isClosedConversation = currentConversation?.status === 'closed';
        if (!isClosedConversation && !agentConnected && filteredServerMessages.length === 0) {
          upsertWelcomeMessage();
        } else {
          localSystemMessages = localSystemMessages.filter((msg) => msg.id !== 'welcome');
        }
        renderMessages(filteredServerMessages);
      }
    } catch (e) {
      console.warn('[WebChat] Error fetching messages', e);
    }
  };

  const setTyping = (value) => {
    typingActive = value;
    renderMessages(cachedMessages);
  };

  const flushQueuedMessages = async () => {
    if (!queuedMessages.length) return;
    const remaining = [];
    for (const queued of queuedMessages) {
      try {
        await sendMessage({
          session_id: sessionId,
          message: queued.message,
          sender_type: queued.sender_type,
          sender_name: queued.sender_name || null,
          created_at: queued.created_at,
          visitor,
          page_url: window.location.href,
          source_domain: domain,
          source_channel: 'widget',
          source_detail: 'webchat-widget-v2',
          attachments: [],
        });
      } catch (e) {
        console.warn('[WebChat] Error sending queued message', e);
        remaining.push(queued);
      }
    }
    queuedMessages = remaining;
    saveQueuedMessages(queuedMessages);
  };

  const queueOrSendBotMessage = async (messageText, createdAt) => {
    if (agentRequested || agentConnected) {
      try {
        localStorage.setItem(startedKey, '1');
        conversationStarted = true;
        await sendMessage({
          session_id: sessionId,
          message: messageText,
          sender_type: 'bot',
          sender_name: title,
          created_at: createdAt || new Date().toISOString(),
          visitor,
          page_url: window.location.href,
          source_domain: domain,
          source_channel: 'widget',
          source_detail: 'webchat-widget-v2',
          attachments: [],
        });
      } catch (e) {
        console.warn('[WebChat] Error sending bot message', e);
      }
      return;
    }
    // If there's no agent requested/connected, keep bot responses local only.
  };

  const requestAgent = async (afterCreatedAt) => {
    if (agentRequested || agentConnected) return;

    // Use a fresh session when escalating to an agent to avoid attaching to an
    // old server-side conversation (since we keep the pre-agent chat local).
    sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(sessionKey, sessionId);

    agentRequested = true;
    localStorage.setItem(agentRequestKey, '1');
    markConversationStarted();
    updateAgentUI();

    // Single in-chat system notice (stable id + timestamp).
    // If triggered by a user message, make sure this comes AFTER it.
    const afterTime = (() => {
      if (!afterCreatedAt) return null;
      const date = new Date(afterCreatedAt);
      const ms = date.getTime();
      return Number.isNaN(ms) ? null : ms;
    })();
    const waitingCreatedAt = nextCreatedAtIso(afterTime ? new Date(afterTime + 1).toISOString() : null);

    localSystemMessages = localSystemMessages.filter((msg) => msg.id !== 'auto-agent' && msg.id !== 'system-waiting');
    localSystemMessages.push({
      id: 'system-waiting',
      sender_type: 'system',
      message: 'Estamos contactando a un agente disponible. Gracias por tu paciencia.',
      created_at: waitingCreatedAt,
    });

    renderMessages(cachedMessages);

    try {
      // First, send the local transcript to the queue (still no conversation created).
      const transcript = [...localClientMessages, ...localSystemMessages]
        .filter((msg) => msg && msg.message)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

      for (const msg of transcript) {
        const safeSenderType = msg?.sender_type === 'bot'
          ? 'bot'
          : (msg?.sender_type === 'system' ? 'system' : 'visitor');
        const safeSenderName = safeSenderType === 'bot'
          ? (msg?.sender_name || botName || null)
          : (safeSenderType === 'visitor' ? (msg?.sender_name || visitor?.name || null) : null);

        await sendMessageOrdered({
          session_id: sessionId,
          message: msg.message,
          sender_type: safeSenderType,
          sender_name: safeSenderName,
          created_at: msg.created_at,
          queue_only: true,
          visitor,
          page_url: window.location.href,
          source_domain: domain,
          source_channel: 'widget',
          source_detail: 'webchat-widget-v2',
          attachments: [],
        });
      }

      await sendMessageOrdered({
        session_id: sessionId,
        message: 'Solicitud de agente',
        sender_type: 'visitor',
        sender_name: visitor?.name || null,
        created_at: nextCreatedAtIso(afterTime ? new Date(afterTime + 2).toISOString() : null),
        message_type: 'request_agent',
        visitor,
        page_url: window.location.href,
        source_domain: domain,
        source_channel: 'widget',
        source_detail: 'webchat-widget-v2',
        attachments: [],
      });
      fetchMessages();
      ensurePolling();
    } catch (e) {
      console.warn('[WebChat] Error sending agent request', e);
      agentRequested = false;
      localStorage.removeItem(agentRequestKey);
      errorBanner.textContent = 'No se pudo solicitar un agente. Intenta nuevamente.';
      errorBanner.style.display = 'block';
      updateAgentUI();
    }
  };

  const sendMessage = async (payload) => {
    const response = await fetch(withSessionId(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(integrationKey ? { [integrationHeader]: integrationKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error enviando mensaje');
    }
    try {
      const result = await response.json();
      if (result && result.error) {
        throw new Error(result.error);
      }
      return result;
    } catch {
      return {};
    }
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

    const messageText = input.value.trim();
    const localCreatedAt = nextCreatedAtIso();

    // Pre-agent path: keep local, call DogCatify Q&A API for reply.
    if (!agentRequested && !agentConnected) {
      markConversationStarted();
      addLocalClientMessage(messageText, localCreatedAt);
      renderMessages(cachedMessages);
      input.value = '';
      errorBanner.style.display = 'none';

      setTyping(true);
      const botResult = await fetchBotReply(messageText);
      setTyping(false);

      if (Array.isArray(botResult?.quickReplies) && botResult.quickReplies.length > 0) {
        quickReplies = botResult.quickReplies;
        renderQuickReplies();
      }

      const replyText = String(botResult?.reply || '').trim();
      if (replyText) {
        const replyCreatedAt = nextCreatedAtIso();
        localSystemMessages.push({
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          sender_type: 'bot',
          sender_name: botName,
          message: replyText,
          created_at: replyCreatedAt,
        });
        renderMessages(cachedMessages);

        if (botResult?.handoff) {
          await requestAgent(replyCreatedAt);
        }
      } else if (botResult?.handoff) {
        await requestAgent(localCreatedAt);
      }

      return;
    }

    markConversationStarted();
    const optimisticId = `local-${Date.now()}`;
    pendingMessages.push({
      id: optimisticId,
      sender_type: 'visitor',
      message: messageText,
      created_at: localCreatedAt,
      pending: true,
    });
    renderMessages(cachedMessages);
    input.value = '';

    try {
      await sendMessageOrdered({
        session_id: sessionId,
        message: messageText,
        sender_type: 'visitor',
        sender_name: visitor?.name || null,
        created_at: localCreatedAt,
        visitor,
        page_url: window.location.href,
        source_domain: domain,
        source_channel: 'widget',
        source_detail: 'webchat-widget-v2',
        attachments: [],
      });
      errorBanner.style.display = 'none';

      setTimeout(fetchMessages, 250);
      ensurePolling();
    } catch (e) {
      console.warn('[WebChat] Error sending message', e);
      pendingMessages = pendingMessages.filter((msg) => msg.id !== optimisticId);
      renderMessages(cachedMessages);
      errorBanner.textContent = 'No se pudo enviar el mensaje. Intenta nuevamente.';
      errorBanner.style.display = 'block';
    }
  };

  footer.addEventListener('submit', handleSubmit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (typeof footer.requestSubmit === 'function') {
        footer.requestSubmit();
      } else {
        handleSubmit(event);
      }
    }
  });

  agentButton.addEventListener('click', () => {
    requestAgent();
  });

  headerClose.addEventListener('click', () => {
    isOpen = false;
    windowEl.classList.remove('is-open');
    badge.style.display = 'block';
    fab.innerHTML = chatIcon;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    windowEl.classList.toggle('is-open', isOpen);
    badge.style.display = isOpen ? 'none' : 'block';
    fab.innerHTML = isOpen ? closeIcon : chatIcon;

    if (isOpen) {
      showWelcomeOnOpen = true;
      renderMessages(cachedMessages);
      renderQuickReplies();
      if (!conversationStarted && !agentRequested && !agentConnected && cachedMessages.length === 0) {
        upsertWelcomeMessage();
        renderMessages(cachedMessages);
      }
      if (agentRequested || agentConnected) {
        fetchMessages();
        ensurePolling();
      }
      badge.style.background = '#EF4444'; // reset badge color
    } else {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      badge.style.background = '#EF4444';
    }
  });

  updateAgentUI();
})();
