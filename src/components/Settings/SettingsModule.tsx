import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getEnvVar } from '../../lib/envLoader';
import {
  Settings, Mail, Server, Globe, Shield, Save, CheckCircle, AlertCircle, Phone, TestTube, Inbox, Eye, EyeOff, Building2, MessageCircle, Radio, Users, Trash2, Plus
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { twilioService } from '../../lib/twilioService';
import { freepbxService } from '../../lib/freepbxService';
import { BranchesModule } from './BranchesModule';
import { PageHeader } from '../ui/PageHeader';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function SettingsModule() {
  const toast = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'smtp' | 'email' | 'general' | 'twilio' | 'inbox' | 'branches' | 'webchat' | 'freepbx' | 'extensions'>('smtp');
  const isAdmin = user?.role === 'admin';
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: ''
  });

  const [emailSettings, setEmailSettings] = useState({
    daily_limit: 1000,
    rate_limit: 50,
    retry_attempts: 3,
    bounce_handling: true
  });

  const [generalSettings, setGeneralSettings] = useState({
    company_name: '',
    company_rut: '',
    company_address: '',
    company_city: '',
    company_country: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    company_logo_url: '',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    date_format: 'DD/MM/YYYY'
  });

  const [ticketSlaSettings, setTicketSlaSettings] = useState({
    low_hours: 72,
    medium_hours: 24,
    high_hours: 8,
    urgent_hours: 4,
    low_estimated_hours: 2,
    medium_estimated_hours: 4,
    high_estimated_hours: 8,
    urgent_estimated_hours: 12
  });

  const [twilioConfig, setTwilioConfig] = useState({
    id: '',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    agent_number: '',
    twiml_app_sid: '',
    api_key_sid: '',
    api_key_secret: '',
    voice_url: '',
    status_callback_url: '',
    is_active: true,
    is_test_mode: false
  });

  const [freepbxConfig, setFreepbxConfig] = useState({
    id: '',
    sip_domain: '',
    websocket_url: '',
    default_country_code: '',
    outbound_caller_id: '',
    stun_server: '',
    is_default_provider: false,
  });

  interface SystemUserOption {
    id: string;
    full_name: string;
    email: string;
  }

  interface SipExtensionRow {
    id: string;
    user_id: string;
    sip_extension: string;
    sip_auth_user: string;
    sip_password: string;
    display_name: string | null;
  }

  const [systemUsersList, setSystemUsersList] = useState<SystemUserOption[]>([]);
  const [sipExtensions, setSipExtensions] = useState<SipExtensionRow[]>([]);
  const [extensionForm, setExtensionForm] = useState({
    user_id: '',
    sip_extension: '',
    sip_auth_user: '',
    sip_password: '',
    display_name: '',
  });
  const [editingExtensionId, setEditingExtensionId] = useState<string | null>(null);

  const [inboxConfig, setInboxConfig] = useState({
    id: '',
    email_address: '',
    display_name: '',
    imap_host: '',
    imap_port: 993,
    imap_username: '',
    imap_password: '',
    smtp_host: '',
    smtp_port: 465,
    smtp_username: '',
    smtp_password: '',
    use_ssl: true,
    is_active: true
  });

  const appUrl = getEnvVar('VITE_APP_URL') || window.location.origin;
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const botProxyUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/webchat-bot-proxy` : '';
  const widgetUrl = getEnvVar('VITE_WIDGET_URL');
  const widgetApiKey = getEnvVar('VITE_WIDGET_APIKEY');
  const [webchatSettings, setWebchatSettings] = useState({
    domain: 'dogcatify.com',
    title: 'Dogcatify Chat',
    theme: '#2563eb',
    endpoint: 'https://api.flowbridge.site/functions/v1/api-gateway/dcd7ec42-e7fb-46fa-93d3-ccdf3e053795',
    get_endpoint: 'https://api.flowbridge.site/functions/v1/api-gateway/3d05a848-9614-40f8-9502-83222d0aff43',
    widget_script_url: `${appUrl}/webchat-widget-v2.js`,
    api_key: '',
    integration_header: 'X-Integration-Key',
    integration_key: 'pub_5bc238047db11edae7d4ecb2805f0057a2505c706e625c9a243b6e95bf33cd67',
    get_integration_header: 'X-Integration-Key',
    get_integration_key: '',
    max_message_length: 2000,
    max_attachments: 5,
    max_attachment_mb: 10
  });

  const [showPasswords, setShowPasswords] = useState({
    imap: false,
    smtp: false
  });

  const [currencies, setCurrencies] = useState<Array<{
    id: string;
    code: string;
    name: string;
    symbol: string;
  }>>([]);

  const webchatSnippet = `<div id="crm-webchat"></div>\n<script>\n  window.CRM_WEBCHAT_CONFIG = {\n    endpoint: '${webchatSettings.endpoint}',\n    getEndpoint: '${webchatSettings.get_endpoint}',\n    domain: '${webchatSettings.domain}',\n    title: '${webchatSettings.title}',\n    logoUrl: '/logo-dogcatify.jpg',\n    primaryColor: '#0D9488',\n    secondaryColor: '#14B8A6',\n    agentColor: '#2563EB',\n    backgroundColor: '#F3F4F6',\n    statusText: 'En línea',\n    welcomeMessage: '¡Hola! Soy Dotty, tu asistente virtual de DogCatify. ¿En qué puedo ayudarte hoy?',\n    quickReplies: ['¿Qué servicios ofrecen?','¿Cómo reservar?','Horarios de atención','Contacto'],\n    integrationHeader: '${webchatSettings.integration_header}',\n    integrationKey: '${webchatSettings.integration_key}',\n    getIntegrationHeader: '${webchatSettings.get_integration_header}',\n    getIntegrationKey: '${webchatSettings.get_integration_key}',\n    apiKey: '${webchatSettings.api_key}',\n\n    // Bot/assistant configuration (read by webchat-widget-v2.js)\n    botProxyUrl: '${botProxyUrl}',\n    VITE_WIDGET_URL: '${widgetUrl}',\n    VITE_WIDGET_APIKEY: '${widgetApiKey}',\n    variables: {\n      botProxyUrl: '${botProxyUrl}',\n      VITE_WIDGET_URL: '${widgetUrl}',\n      VITE_WIDGET_APIKEY: '${widgetApiKey}'\n    }\n  };\n</script>\n<script src="${webchatSettings.widget_script_url}"></script>`;

  const webchatApiExample = `POST ${webchatSettings.endpoint}\nHeaders:\n  Content-Type: application/json\n  ${webchatSettings.integration_header || 'X-Integration-Key'}: ${webchatSettings.integration_key || '<INTEGRATION_KEY>'}\n\n{\n  "session_id": "sess_123",\n  "message": "Hola, necesito ayuda",\n  "visitor": {\n    "name": "Carlos",\n    "email": "carlos@dominio.com",\n    "phone": "+18001234567"\n  },\n  "page_url": "https://dogcatify.com/precios",\n  "source_domain": "dogcatify.com",\n  "attachments": [\n    {\n      "filename": "pixel.png",\n      "type": "image/png",\n      "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y6p7dEAAAAASUVORK5CYII="\n    }\n  ]\n}`;

  useEffect(() => {
    loadSettings();
    loadTwilioConfig();
    loadCurrencies();
    if (isAdmin) {
      loadFreepbxConfig();
      loadSystemUsersList();
      loadSipExtensions();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (user?.id) {
      loadInboxConfig();
    }
  }, [user?.id]);

  const loadCurrencies = async () => {
    const { data, error } = await supabase
      .from('currencies')
      .select('id, code, name, symbol')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading currencies:', error);
      return;
    }

    if (data) {
      setCurrencies(data);
    }
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*');

    if (data) {
      data.forEach((setting) => {
        if (setting.setting_key === 'smtp_config') {
          setSmtpConfig(setting.setting_value as any);
        } else if (setting.setting_key === 'email_settings') {
          setEmailSettings(setting.setting_value as any);
        } else if (setting.setting_key === 'general_settings') {
          setGeneralSettings(setting.setting_value as any);
        } else if (setting.setting_key === 'ticket_sla_settings') {
          setTicketSlaSettings((prev) => ({
            ...prev,
            ...(setting.setting_value as any)
          }));
        } else if (setting.setting_key === 'webchat_settings') {
          setWebchatSettings((prev) => {
            const next = {
              ...prev,
              ...(setting.setting_value as any)
            };
            if (!next.endpoint) {
              next.endpoint = 'https://api.flowbridge.site/functions/v1/api-gateway/dcd7ec42-e7fb-46fa-93d3-ccdf3e053795';
            }
            if (!next.get_endpoint) {
              next.get_endpoint = 'https://api.flowbridge.site/functions/v1/api-gateway/3d05a848-9614-40f8-9502-83222d0aff43';
            }
            if (!next.integration_header) {
              next.integration_header = 'X-Integration-Key';
            }
            if (!next.integration_key) {
              next.integration_key = 'pub_5bc238047db11edae7d4ecb2805f0057a2505c706e625c9a243b6e95bf33cd67';
            }
            if (!next.get_integration_header) {
              next.get_integration_header = 'X-Integration-Key';
            }
            if (!next.get_integration_key) {
              next.get_integration_key = next.integration_key || '';
            }
            if (!next.widget_script_url) {
              next.widget_script_url = `${appUrl}/webchat-widget-v2.js`;
            }
            return next;
          });
        }
      });
    }
  };

  const loadTwilioConfig = async () => {
    const { data } = await supabase
      .from('twilio_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (data) {
      setTwilioConfig(data);
    }
  };

  const loadFreepbxConfig = async () => {
    const config = await freepbxService.loadConfig(true);
    if (config) {
      setFreepbxConfig({
        id: config.id,
        sip_domain: config.sip_domain || '',
        websocket_url: config.websocket_url || '',
        default_country_code: config.default_country_code || '',
        outbound_caller_id: config.outbound_caller_id || '',
        stun_server: config.stun_server || '',
        is_default_provider: config.is_default_provider,
      });
    }
  };

  const loadSystemUsersList = async () => {
    const { data } = await supabase
      .from('system_users')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (data) {
      setSystemUsersList(data);
    }
  };

  const loadSipExtensions = async () => {
    const { data } = await supabase
      .from('user_sip_extensions')
      .select('id, user_id, sip_extension, sip_auth_user, sip_password, display_name')
      .order('sip_extension', { ascending: true });

    if (data) {
      setSipExtensions(data);
    }
  };

  const loadInboxConfig = async () => {
    if (!user?.id) {
      console.log('[SETTINGS] No user ID available for loading inbox config');
      return;
    }

    console.log('[SETTINGS] Loading inbox config for user:', user.id);

    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[SETTINGS] Error loading inbox config:', error);
    }

    console.log('[SETTINGS] Inbox config loaded:', data);

    if (data) {
      setInboxConfig({
        id: data.id || '',
        email_address: data.email_address || '',
        display_name: data.display_name || '',
        imap_host: data.imap_host || '',
        imap_port: data.imap_port || 993,
        imap_username: data.imap_username || '',
        imap_password: data.imap_password || '',
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 465,
        smtp_username: data.smtp_username || '',
        smtp_password: data.smtp_password || '',
        use_ssl: data.use_ssl ?? true,
        is_active: data.is_active ?? true
      });
    }
  };

  const saveSettings = async (key: string, value: any) => {
    setSaveStatus('saving');

    try {
      const metadataByKey: Record<string, { setting_type: 'smtp' | 'email' | 'general' | 'integration'; description: string }> = {
        smtp_config: {
          setting_type: 'smtp',
          description: 'SMTP server configuration for sending emails'
        },
        email_settings: {
          setting_type: 'email',
          description: 'Email sending limits and settings'
        },
        general_settings: {
          setting_type: 'general',
          description: 'General system settings'
        },
        ticket_sla_settings: {
          setting_type: 'general',
          description: 'SLA de tickets por prioridad (horas de vencimiento + horas hombre estimadas)'
        },
        webchat_settings: {
          setting_type: 'integration',
          description: 'Webchat integration settings'
        },
        integration_settings: {
          setting_type: 'integration',
          description: 'Integration and API settings'
        }
      };

      const metadata = metadataByKey[key] || {
        setting_type: 'general' as const,
        description: 'System setting'
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          setting_type: metadata.setting_type,
          description: metadata.description,
          updated_by: user?.id || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) {
        setSaveStatus('error');
        toast.error(`Error al guardar: ${error.message}`);
      } else {
        setSaveStatus('success');
        toast.success('Configuración guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        await loadSettings();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar');
    }
  };

  const handleSaveSMTP = () => {
    saveSettings('smtp_config', smtpConfig);
  };

  const handleSaveEmail = () => {
    saveSettings('email_settings', emailSettings);
  };

  const handleSaveGeneral = () => {
    saveSettings('general_settings', generalSettings);
  };

  const handleSaveTicketSla = () => {
    saveSettings('ticket_sla_settings', ticketSlaSettings);
  };

  const handleSaveWebchat = () => {
    saveSettings('webchat_settings', webchatSettings);
  };

  const handleTestTwilio = async () => {
    if (!twilioConfig.account_sid || !twilioConfig.auth_token) {
      toast.error('Por favor ingresa Account SID y Auth Token');
      return;
    }

    setSaveStatus('saving');
    toast.info('Probando conexión con Twilio...');

    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.account_sid}.json`;
      const authString = btoa(`${twilioConfig.account_sid}:${twilioConfig.auth_token}`);

      const response = await fetch(twilioUrl, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSaveStatus('success');
        toast.success(`✅ Conexión exitosa! Cuenta: ${data.friendly_name || 'N/A'}`);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const errorData = await response.json();
        setSaveStatus('error');
        toast.error(`❌ Error de autenticación: ${errorData.message || 'Credenciales inválidas'}`);
        setTimeout(() => setSaveStatus('idle'), 5000);
      }
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(`Error al conectar: ${error.message}`);
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const handleSaveTwilio = async () => {
    setSaveStatus('saving');

    try {
      const twilioData = {
        account_sid: twilioConfig.account_sid,
        auth_token: twilioConfig.auth_token,
        phone_number: twilioConfig.phone_number,
        twiml_app_sid: twilioConfig.twiml_app_sid || null,
        api_key_sid: twilioConfig.api_key_sid || null,
        api_key_secret: twilioConfig.api_key_secret || null,
        voice_url: twilioConfig.voice_url || null,
        status_callback_url: twilioConfig.status_callback_url || null,
        is_active: twilioConfig.is_active,
        is_test_mode: twilioConfig.is_test_mode,
        created_by: user?.id,
        updated_by: user?.id
      };

      let error;

      if (twilioConfig.id) {
        ({ error } = await supabase
          .from('twilio_config')
          .update({ ...twilioData, updated_by: user?.id })
          .eq('id', twilioConfig.id));
      } else {
        ({ error } = await supabase
          .from('twilio_config')
          .insert(twilioData));
      }

      if (error) {
        setSaveStatus('error');
        toast.error(`Error al guardar: ${error.message}`);
      } else {
        twilioService.clearConfig();

        setSaveStatus('success');
        toast.success('Configuración de Twilio guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        await loadTwilioConfig();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar');
    }
  };

  const handleSaveFreepbx = async () => {
    if (!isAdmin) {
      toast.error('Solo un administrador puede configurar FreePBX');
      return;
    }

    if (!freepbxConfig.sip_domain || !freepbxConfig.websocket_url) {
      toast.error('Dominio SIP y Servidor WebSocket son obligatorios');
      return;
    }

    setSaveStatus('saving');

    try {
      const freepbxData = {
        provider: 'freepbx',
        sip_domain: freepbxConfig.sip_domain,
        websocket_url: freepbxConfig.websocket_url,
        default_country_code: freepbxConfig.default_country_code || '',
        outbound_caller_id: freepbxConfig.outbound_caller_id || null,
        stun_server: freepbxConfig.stun_server || null,
        is_active: true,
        is_default_provider: freepbxConfig.is_default_provider,
        updated_by: user?.id,
      };

      let error;

      if (freepbxConfig.id) {
        ({ error } = await supabase
          .from('freepbx_config')
          .update(freepbxData)
          .eq('id', freepbxConfig.id));
      } else {
        ({ error } = await supabase
          .from('freepbx_config')
          .insert({ ...freepbxData, created_by: user?.id }));
      }

      if (error) {
        setSaveStatus('error');
        toast.error(`Error al guardar: ${error.message}`);
      } else {
        freepbxService.clearConfig();
        setSaveStatus('success');
        toast.success('Configuración de FreePBX guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        await loadFreepbxConfig();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar');
    }
  };

  const resetExtensionForm = () => {
    setExtensionForm({ user_id: '', sip_extension: '', sip_auth_user: '', sip_password: '', display_name: '' });
    setEditingExtensionId(null);
  };

  const handleEditExtension = (extension: SipExtensionRow) => {
    setExtensionForm({
      user_id: extension.user_id,
      sip_extension: extension.sip_extension,
      sip_auth_user: extension.sip_auth_user,
      sip_password: extension.sip_password,
      display_name: extension.display_name || '',
    });
    setEditingExtensionId(extension.id);
  };

  const handleSaveExtension = async () => {
    if (!isAdmin) {
      toast.error('Solo un administrador puede asignar extensiones');
      return;
    }

    if (!extensionForm.user_id || !extensionForm.sip_extension || !extensionForm.sip_password) {
      toast.error('Usuario, extensión y contraseña SIP son obligatorios');
      return;
    }

    setSaveStatus('saving');

    try {
      const extensionData = {
        user_id: extensionForm.user_id,
        sip_extension: extensionForm.sip_extension,
        sip_auth_user: extensionForm.sip_auth_user || extensionForm.sip_extension,
        sip_password: extensionForm.sip_password,
        display_name: extensionForm.display_name || null,
        is_active: true,
      };

      let error;

      if (editingExtensionId) {
        ({ error } = await supabase
          .from('user_sip_extensions')
          .update(extensionData)
          .eq('id', editingExtensionId));
      } else {
        ({ error } = await supabase
          .from('user_sip_extensions')
          .insert({ ...extensionData, created_by: user?.id }));
      }

      if (error) {
        setSaveStatus('error');
        toast.error(`Error al guardar la extensión: ${error.message}`);
      } else {
        setSaveStatus('success');
        toast.success('Extensión guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        resetExtensionForm();
        await loadSipExtensions();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar la extensión');
    }
  };

  const handleDeleteExtension = async (id: string) => {
    if (!isAdmin) {
      toast.error('Solo un administrador puede eliminar extensiones');
      return;
    }

    const { error } = await supabase.from('user_sip_extensions').delete().eq('id', id);
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    } else {
      toast.success('Extensión eliminada');
      if (editingExtensionId === id) resetExtensionForm();
      await loadSipExtensions();
    }
  };

  const handleSaveInbox = async () => {
    setSaveStatus('saving');

    try {
      if (!user?.id) {
        toast.error('Usuario no autenticado');
        return;
      }

      const inboxData = {
        user_id: user.id,
        email_address: inboxConfig.email_address.trim(),
        display_name: inboxConfig.display_name.trim(),
        imap_host: inboxConfig.imap_host.trim(),
        imap_port: Number(inboxConfig.imap_port) || (inboxConfig.use_ssl ? 993 : 143),
        imap_username: inboxConfig.imap_username.trim(),
        imap_password: inboxConfig.imap_password,
        smtp_host: inboxConfig.smtp_host.trim(),
        smtp_port: Number(inboxConfig.smtp_port) || (inboxConfig.use_ssl ? 465 : 587),
        smtp_username: inboxConfig.smtp_username.trim(),
        smtp_password: inboxConfig.smtp_password,
        use_ssl: inboxConfig.use_ssl,
        is_active: inboxConfig.is_active,
        created_by: user.id
      };

      if (!inboxData.email_address || !inboxData.imap_host || !inboxData.imap_username || !inboxData.imap_password) {
        setSaveStatus('error');
        toast.error('Completa la configuración IMAP obligatoria antes de guardar');
        return;
      }

      if (!inboxData.smtp_host || !inboxData.smtp_username || !inboxData.smtp_password) {
        setSaveStatus('error');
        toast.error('Completa la configuración SMTP obligatoria antes de guardar');
        return;
      }

      let error;

      if (inboxConfig.id) {
        ({ error } = await supabase
          .from('email_accounts')
          .update(inboxData)
          .eq('id', inboxConfig.id));
      } else {
        ({ error } = await supabase
          .from('email_accounts')
          .insert(inboxData));
      }

      if (error) {
        setSaveStatus('error');
        if (error.code === '23505') {
          toast.error('Esta dirección de email ya está registrada en el sistema');
        } else {
          toast.error(`Error al guardar: ${error.message}`);
        }
      } else {
        setSaveStatus('success');
        toast.success('Configuración de buzón guardada correctamente');
        setTimeout(() => setSaveStatus('idle'), 2000);
        await loadInboxConfig();
      }
    } catch (err) {
      setSaveStatus('error');
      toast.error('Error inesperado al guardar');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <PageHeader
        title="Configuración del Sistema"
        subtitle="Administra la configuración general del CRM"
      />

      {saveStatus !== 'idle' && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 border ${
          saveStatus === 'success' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' :
          saveStatus === 'error' ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' :
          'bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30'
        }`}>
          {saveStatus === 'success' ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Configuración guardada exitosamente</span>
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span className="text-rose-700 dark:text-rose-400 font-medium">Error al guardar la configuración</span>
            </>
          ) : (
            <span className="text-sky-700 dark:text-sky-400 font-medium">Guardando...</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto">
        {([
          { key: 'smtp', label: 'Servidor SMTP', icon: Server },
          { key: 'email', label: 'Email', icon: Mail },
          { key: 'inbox', label: 'Buzón Personal', icon: Inbox },
          { key: 'webchat', label: 'Chat Web', icon: MessageCircle },
          { key: 'twilio', label: 'Twilio', icon: Phone },
          ...(isAdmin ? [{ key: 'freepbx' as const, label: 'FreePBX', icon: Radio }] : []),
          ...(isAdmin ? [{ key: 'extensions' as const, label: 'Extensiones', icon: Users }] : []),
          { key: 'general', label: 'General', icon: Settings },
          { key: 'branches', label: 'Sucursales', icon: Building2 },
        ] as const).map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
              }`}
            >
              <TabIcon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'smtp' && (
        <Card className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración SMTP</h2>
              <p className="text-slate-600 dark:text-slate-400">Configura el servidor para envío de emails</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Host SMTP</label>
                <input
                  type="text"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Puerto</label>
                <input
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Usuario</label>
                <input
                  type="text"
                  value={smtpConfig.username}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="tu-email@gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Contraseña</label>
                <input
                  type="password"
                  value={smtpConfig.password}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email de Origen</label>
                <input
                  type="email"
                  value={smtpConfig.from_email}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="noreply@tuempresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre de Origen</label>
                <input
                  type="text"
                  value={smtpConfig.from_name}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Mi Empresa CRM"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="secure"
                checked={smtpConfig.secure}
                onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                className="rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="secure" className="text-sm text-slate-700 dark:text-slate-300">Usar conexión segura (SSL/TLS)</label>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveSMTP} icon={<Save className="w-5 h-5" />}>
                Guardar Configuración SMTP
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'email' && (
        <Card className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración de Email</h2>
              <p className="text-slate-600 dark:text-slate-400">Límites y políticas de envío</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Límite Diario</label>
                <input
                  type="number"
                  value={emailSettings.daily_limit}
                  onChange={(e) => setEmailSettings({ ...emailSettings, daily_limit: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Número máximo de emails por día</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Límite por Hora</label>
                <input
                  type="number"
                  value={emailSettings.rate_limit}
                  onChange={(e) => setEmailSettings({ ...emailSettings, rate_limit: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Emails por hora</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Intentos de Reenvío</label>
                <input
                  type="number"
                  value={emailSettings.retry_attempts}
                  onChange={(e) => setEmailSettings({ ...emailSettings, retry_attempts: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Número de reintentos si falla</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="bounce"
                checked={emailSettings.bounce_handling}
                onChange={(e) => setEmailSettings({ ...emailSettings, bounce_handling: e.target.checked })}
                className="rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="bounce" className="text-sm text-slate-700 dark:text-slate-300">Activar manejo de rebotes automático</label>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveEmail} icon={<Save className="w-5 h-5" />}>
                Guardar Configuración de Email
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'general' && (
        <Card className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración General</h2>
              <p className="text-slate-600 dark:text-slate-400">Configuración de la empresa y sistema</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre de la Empresa</label>
                <input
                  type="text"
                  value={generalSettings.company_name}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Mi Empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">RUT / NIT / RFC</label>
                <input
                  type="text"
                  value={generalSettings.company_rut}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_rut: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="000000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dirección</label>
                <input
                  type="text"
                  value={generalSettings.company_address}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Calle Principal 123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ciudad</label>
                <input
                  type="text"
                  value={generalSettings.company_city}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_city: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Montevideo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">País</label>
                <input
                  type="text"
                  value={generalSettings.company_country}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_country: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Uruguay"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={generalSettings.company_phone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="+598 00 000 000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={generalSettings.company_email}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="contacto@miempresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sitio Web</label>
                <input
                  type="url"
                  value={generalSettings.company_website}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_website: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="https://ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logo URL</label>
                <input
                  type="url"
                  value={generalSettings.company_logo_url}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, company_logo_url: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="https://ejemplo.com/logo.png"
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">URL pública del logo de tu empresa (PNG, JPG, SVG)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Zona Horaria</label>
                <select
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                  <option value="America/Bogota">Bogotá (GMT-5)</option>
                  <option value="America/Lima">Lima (GMT-5)</option>
                  <option value="America/Santiago">Santiago (GMT-3)</option>
                  <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                  <option value="Europe/Madrid">Madrid (GMT+1)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Moneda</label>
                <select
                  value={generalSettings.currency}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  {currencies.length === 0 ? (
                    <option value="">Cargando monedas...</option>
                  ) : (
                    currencies.map(currency => (
                      <option key={currency.id} value={currency.code}>
                        {currency.code} - {currency.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Formato de Fecha</label>
                <select
                  value={generalSettings.date_format}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, date_format: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">SLA de Tickets por Prioridad</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Define por prioridad el vencimiento (SLA) y las horas hombre para cálculo automático.</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Baja (horas)</label>
                  <input
                    type="number"
                    min={1}
                    value={ticketSlaSettings.low_hours}
                    onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, low_hours: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Media (horas)</label>
                  <input
                    type="number"
                    min={1}
                    value={ticketSlaSettings.medium_hours}
                    onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, medium_hours: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Alta (horas)</label>
                  <input
                    type="number"
                    min={1}
                    value={ticketSlaSettings.high_hours}
                    onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, high_hours: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Urgente (horas)</label>
                  <input
                    type="number"
                    min={1}
                    value={ticketSlaSettings.urgent_hours}
                    onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, urgent_hours: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Horas hombre estimadas por prioridad</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Se usan para completar automáticamente "Horas estimadas" al crear tickets.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Baja (hh)</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={ticketSlaSettings.low_estimated_hours}
                      onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, low_estimated_hours: Math.max(0.5, Number(e.target.value) || 0.5) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Media (hh)</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={ticketSlaSettings.medium_estimated_hours}
                      onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, medium_estimated_hours: Math.max(0.5, Number(e.target.value) || 0.5) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Alta (hh)</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={ticketSlaSettings.high_estimated_hours}
                      onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, high_estimated_hours: Math.max(0.5, Number(e.target.value) || 0.5) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Urgente (hh)</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={ticketSlaSettings.urgent_estimated_hours}
                      onChange={(e) => setTicketSlaSettings({ ...ticketSlaSettings, urgent_estimated_hours: Math.max(0.5, Number(e.target.value) || 0.5) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button size="sm" onClick={handleSaveTicketSla} icon={<Save className="w-4 h-4" />}>
                  Guardar SLA de Tickets
                </Button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveGeneral} icon={<Save className="w-5 h-5" />}>
                Guardar Configuración General
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'inbox' && (
        <Card className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
              <Inbox className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración del Buzón Personal</h2>
              <p className="text-slate-600 dark:text-slate-400">Conecta tu cuenta de correo para recibir y enviar emails</p>
            </div>
          </div>

          <div className="space-y-6 mb-6">
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-sky-800 dark:text-sky-300">
                  <p className="font-semibold mb-1">Información importante:</p>
                  <ul className="list-disc list-inside space-y-1 text-sky-700 dark:text-sky-400">
                    <li>Esta configuración es independiente del SMTP de campañas</li>
                    <li>Permite gestionar tu buzón personal dentro del CRM</li>
                    <li>Soporta protocolos IMAP y SMTP estándar</li>
                    <li>Las credenciales se almacenan de forma segura</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Proveedores populares:</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-amber-700 dark:text-amber-400">
                    <div>
                      <p className="font-medium">Gmail:</p>
                      <p className="text-xs">IMAP: imap.gmail.com:993</p>
                      <p className="text-xs">SMTP: smtp.gmail.com:465</p>
                    </div>
                    <div>
                      <p className="font-medium">Outlook:</p>
                      <p className="text-xs">IMAP: outlook.office365.com:993</p>
                      <p className="text-xs">SMTP: smtp.office365.com:587</p>
                    </div>
                    <div>
                      <p className="font-medium">GoDaddy:</p>
                      <p className="text-xs">IMAP: imap.secureserver.net:993</p>
                      <p className="text-xs">SMTP: smtpout.secureserver.net:465</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Información de la Cuenta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Dirección de Email *
                  </label>
                  <input
                    type="email"
                    value={inboxConfig.email_address}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, email_address: e.target.value })}
                    placeholder="tu-email@ejemplo.com"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Nombre para Mostrar
                  </label>
                  <input
                    type="text"
                    value={inboxConfig.display_name}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, display_name: e.target.value })}
                    placeholder="Tu Nombre"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Configuración IMAP (Recepción)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Servidor IMAP *
                  </label>
                  <input
                    type="text"
                    value={inboxConfig.imap_host}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap_host: e.target.value })}
                    placeholder="imap.gmail.com"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Puerto IMAP *
                  </label>
                  <input
                    type="number"
                    value={inboxConfig.imap_port}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap_port: parseInt(e.target.value) })}
                    placeholder="993"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Usuario IMAP *
                  </label>
                  <input
                    type="text"
                    value={inboxConfig.imap_username}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, imap_username: e.target.value })}
                    placeholder="tu-email@ejemplo.com"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Contraseña IMAP *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.imap ? "text" : "password"}
                      value={inboxConfig.imap_password}
                      onChange={(e) => setInboxConfig({ ...inboxConfig, imap_password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 pr-12 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, imap: !showPasswords.imap })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPasswords.imap ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Configuración SMTP (Envío)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Servidor SMTP *
                  </label>
                  <input
                    type="text"
                    value={inboxConfig.smtp_host}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, smtp_host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Puerto SMTP *
                  </label>
                  <input
                    type="number"
                    value={inboxConfig.smtp_port}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, smtp_port: parseInt(e.target.value) })}
                    placeholder="465"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Usuario SMTP *
                  </label>
                  <input
                    type="text"
                    value={inboxConfig.smtp_username}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, smtp_username: e.target.value })}
                    placeholder="tu-email@ejemplo.com"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Contraseña SMTP *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.smtp ? "text" : "password"}
                      value={inboxConfig.smtp_password}
                      onChange={(e) => setInboxConfig({ ...inboxConfig, smtp_password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 pr-12 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, smtp: !showPasswords.smtp })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPasswords.smtp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Opciones</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inboxConfig.use_ssl}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, use_ssl: e.target.checked })}
                    className="w-5 h-5 text-brand-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Usar SSL/TLS</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Conexión segura cifrada (recomendado)</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inboxConfig.is_active}
                    onChange={(e) => setInboxConfig({ ...inboxConfig, is_active: e.target.checked })}
                    className="w-5 h-5 text-brand-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta Activa</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Habilita esta cuenta para usar en el buzón</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveInbox} disabled={saveStatus === 'saving'} icon={<Save className="w-5 h-5" />}>
                Guardar Configuración
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'webchat' && (
        <Card className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración de Chat Web</h2>
              <p className="text-slate-600 dark:text-slate-400">Comparte el widget o consume la API desde dogcatify.com</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dominio permitido</label>
                <input
                  type="text"
                  value={webchatSettings.domain}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, domain: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="dogcatify.com"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Debe coincidir con el dominio enviado en `source_domain`.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Título del widget</label>
                <input
                  type="text"
                  value={webchatSettings.title}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color del widget</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={webchatSettings.theme}
                    onChange={(e) => setWebchatSettings({ ...webchatSettings, theme: e.target.value })}
                    className="h-10 w-14 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    value={webchatSettings.theme}
                    onChange={(e) => setWebchatSettings({ ...webchatSettings, theme: e.target.value })}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Endpoint API (POST)</label>
                <input
                  type="text"
                  value={webchatSettings.endpoint}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, endpoint: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Endpoint API (GET)</label>
                <input
                  type="text"
                  value={webchatSettings.get_endpoint}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, get_endpoint: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Se usa para obtener mensajes con el param `session_id`.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Header de integración</label>
                <input
                  type="text"
                  value={webchatSettings.integration_header}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, integration_header: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="X-Integration-Key"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Header que exige el API Gateway.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Integration Key (Gateway)</label>
                <input
                  type="text"
                  value={webchatSettings.integration_key}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, integration_key: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="pub_..."
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Se envía en el header configurado arriba.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Header de integración (GET)</label>
                <input
                  type="text"
                  value={webchatSettings.get_integration_header}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, get_integration_header: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="X-Integration-Key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Integration Key (GET)</label>
                <input
                  type="text"
                  value={webchatSettings.get_integration_key}
                  onChange={(e) => setWebchatSettings({ ...webchatSettings, get_integration_key: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="pub_..."
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Se envía en el header del endpoint GET.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Script del widget</label>
                <input
                  type="text"
                  value={webchatSettings.widget_script_url}
                  readOnly
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">API Key (Supabase directo)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={webchatSettings.api_key}
                    onChange={(e) => setWebchatSettings({ ...webchatSettings, api_key: e.target.value })}
                    placeholder="Genera una API Key"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const key = `wc_${crypto.randomUUID()}`;
                      setWebchatSettings({ ...webchatSettings, api_key: key });
                    }}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition text-sm"
                  >
                    Generar
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Úsala solo si consumes el endpoint directo de Supabase.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Límites activos</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    value={webchatSettings.max_message_length}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  />
                  <input
                    type="number"
                    value={webchatSettings.max_attachments}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  />
                  <input
                    type="number"
                    value={webchatSettings.max_attachment_mb}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Estos límites se aplican en el endpoint y el widget.</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Snippet del Widget</p>
              <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-auto">
                {webchatSnippet}
              </pre>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Copia este código en dogcatify.com para habilitar el chat flotante.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cómo consumir la API</p>
              <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-auto">
                {webchatApiExample}
              </pre>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Para consultar una conversación: GET {webchatSettings.endpoint}?session_id=&lt;id&gt; (con header `x-api-key`). El campo `content` debe ser base64 válido (con o sin prefijo data:).
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveWebchat} disabled={saveStatus === 'saving'} icon={<Save className="w-5 h-5" />}>
                Guardar Configuración
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'twilio' && (
        <Card className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración de Twilio</h2>
              <p className="text-slate-600 dark:text-slate-400">Configura la integración con Twilio para realizar y recibir llamadas</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-sky-800 dark:text-sky-300">
                  <p className="font-semibold mb-1">Información importante:</p>
                  <ul className="list-disc list-inside space-y-1 text-sky-700 dark:text-sky-400">
                    <li>Obtén tus credenciales en <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.twilio.com</a></li>
                    <li>El Account SID comienza con "AC" seguido de 32 caracteres</li>
                    <li>El número de teléfono debe estar en formato E.164 (ej: +15551234567)</li>
                    <li>Los datos sensibles se almacenan de forma segura</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Permisos Internacionales:</p>
                  <p className="text-amber-700 dark:text-amber-400 mb-2">
                    Para realizar llamadas internacionales, debes habilitar los permisos geográficos en tu cuenta de Twilio.
                  </p>
                  <a
                    href="https://www.twilio.com/console/voice/calls/geo-permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 font-medium underline hover:text-amber-900 dark:hover:text-amber-200"
                  >
                    Configurar permisos geográficos →
                  </a>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Necesitarás habilitar los países a los que deseas llamar (ej: Uruguay, México, Argentina)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Credenciales Principales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Account SID *
                  </label>
                  <input
                    type="text"
                    value={twilioConfig.account_sid}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, account_sid: e.target.value })}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Identificador único de tu cuenta Twilio</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Auth Token *
                  </label>
                  <input
                    type="password"
                    value={twilioConfig.auth_token}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, auth_token: e.target.value })}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Token secreto para autenticación</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Número de Teléfono Twilio *
                  </label>
                  <input
                    type="tel"
                    value={twilioConfig.phone_number}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, phone_number: e.target.value })}
                    placeholder="+15551234567"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Número de Twilio para llamadas salientes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Número del Agente *
                  </label>
                  <input
                    type="tel"
                    value={twilioConfig.agent_number}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, agent_number: e.target.value })}
                    placeholder="+525512345678"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tu número donde recibirás las llamadas entrantes</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Configuración Avanzada (Opcional)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    TwiML Application SID
                  </label>
                  <input
                    type="text"
                    value={twilioConfig.twiml_app_sid}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, twiml_app_sid: e.target.value })}
                    placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Para funciones de voz programables avanzadas</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      API Key SID
                    </label>
                    <input
                      type="text"
                      value={twilioConfig.api_key_sid}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, api_key_sid: e.target.value })}
                      placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Alternativa más segura al Auth Token</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      API Key Secret
                    </label>
                    <input
                      type="password"
                      value={twilioConfig.api_key_secret}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, api_key_secret: e.target.value })}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Secreto de la API Key</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Voice URL
                  </label>
                  <input
                    type="url"
                    value={twilioConfig.voice_url}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, voice_url: e.target.value })}
                    placeholder="https://tu-dominio.com/voice"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">URL webhook para manejar llamadas entrantes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Status Callback URL
                  </label>
                  <input
                    type="url"
                    value={twilioConfig.status_callback_url}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, status_callback_url: e.target.value })}
                    placeholder="https://tu-dominio.com/status"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">URL para recibir actualizaciones de estado de llamadas</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Opciones</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twilioConfig.is_active}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, is_active: e.target.checked })}
                    className="w-5 h-5 text-brand-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-brand-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Configuración Activa</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Habilita esta configuración para usar Twilio</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twilioConfig.is_test_mode}
                    onChange={(e) => setTwilioConfig({ ...twilioConfig, is_test_mode: e.target.checked })}
                    className="w-5 h-5 text-amber-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Modo de Prueba</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Usa credenciales de prueba (no se realizarán llamadas reales)</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                onClick={handleTestTwilio}
                disabled={saveStatus === 'saving'}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TestTube className="w-5 h-5" />
                <span>Probar Conexión</span>
              </button>
              <button
                onClick={handleSaveTwilio}
                disabled={saveStatus === 'saving'}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-green-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                <span>Guardar Configuración</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'freepbx' && (
        <Card className="p-8">
          {!isAdmin ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6">
              <Shield className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Solo un administrador puede configurar la conexión con FreePBX.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
                  <Radio className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración de FreePBX</h2>
                  <p className="text-slate-600 dark:text-slate-400">Conexión SIP/WebRTC alternativa a Twilio para hacer y recibir llamadas</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Dominio SIP *</label>
                  <input
                    type="text"
                    value={freepbxConfig.sip_domain}
                    onChange={(e) => setFreepbxConfig({ ...freepbxConfig, sip_domain: e.target.value })}
                    placeholder="pbx.sendcraft.net"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Servidor WebSocket *</label>
                  <input
                    type="text"
                    value={freepbxConfig.websocket_url}
                    onChange={(e) => setFreepbxConfig({ ...freepbxConfig, websocket_url: e.target.value })}
                    placeholder="wss://pbx.sendcraft.net:8089/ws"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Código de país por defecto</label>
                  <input
                    type="text"
                    value={freepbxConfig.default_country_code}
                    onChange={(e) => setFreepbxConfig({ ...freepbxConfig, default_country_code: e.target.value })}
                    placeholder="598"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se antepone a los números marcados que no empiecen con +</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Caller ID saliente</label>
                  <input
                    type="text"
                    value={freepbxConfig.outbound_caller_id}
                    onChange={(e) => setFreepbxConfig({ ...freepbxConfig, outbound_caller_id: e.target.value })}
                    placeholder="+13214858662"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Servidor STUN</label>
                  <input
                    type="text"
                    value={freepbxConfig.stun_server}
                    onChange={(e) => setFreepbxConfig({ ...freepbxConfig, stun_server: e.target.value })}
                    placeholder="stun:stun.l.google.com:19302"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <label className="mt-6 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freepbxConfig.is_default_provider}
                  onChange={(e) => setFreepbxConfig({ ...freepbxConfig, is_default_provider: e.target.checked })}
                  className="w-5 h-5 text-brand-600 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Usar como proveedor de llamadas por defecto</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Si está activo, el marcador se conecta a FreePBX en vez de Twilio para hacer y recibir llamadas.
                  </p>
                </div>
              </label>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveFreepbx} disabled={saveStatus === 'saving'} icon={<Save className="w-5 h-5" />}>
                  Guardar Configuración
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {activeTab === 'extensions' && (
        <Card className="p-8">
          {!isAdmin ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6">
              <Shield className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Solo un administrador puede asignar extensiones SIP.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-gradient-to-br from-brand-500 to-accent-500 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Extensiones SIP por usuario</h2>
                  <p className="text-slate-600 dark:text-slate-400">Asigná una extensión de FreePBX a cada usuario para que pueda llamar desde el CRM</p>
                </div>
              </div>

              {freepbxConfig.sip_domain && (
                <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Dominio SIP:</span> {freepbxConfig.sip_domain}
                  <span className="mx-2">·</span>
                  <span className="font-semibold">WebSocket:</span> {freepbxConfig.websocket_url}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900/40">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Usuario *</label>
                  <select
                    value={extensionForm.user_id}
                    onChange={(e) => setExtensionForm({ ...extensionForm, user_id: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar usuario...</option>
                    {systemUsersList.map((sysUser) => (
                      <option key={sysUser.id} value={sysUser.id}>{sysUser.full_name} ({sysUser.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Extensión SIP *</label>
                  <input
                    type="text"
                    value={extensionForm.sip_extension}
                    onChange={(e) => setExtensionForm({ ...extensionForm, sip_extension: e.target.value })}
                    placeholder="200"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Usuario de autenticación</label>
                  <input
                    type="text"
                    value={extensionForm.sip_auth_user}
                    onChange={(e) => setExtensionForm({ ...extensionForm, sip_auth_user: e.target.value })}
                    placeholder="Igual a la extensión si se deja vacío"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Contraseña SIP *</label>
                  <input
                    type="password"
                    value={extensionForm.sip_password}
                    onChange={(e) => setExtensionForm({ ...extensionForm, sip_password: e.target.value })}
                    placeholder="Secreto configurado en FreePBX"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Nombre visible</label>
                  <input
                    type="text"
                    value={extensionForm.display_name}
                    onChange={(e) => setExtensionForm({ ...extensionForm, display_name: e.target.value })}
                    placeholder="Nombre del agente"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                {editingExtensionId && (
                  <Button variant="secondary" onClick={resetExtensionForm}>
                    Cancelar
                  </Button>
                )}
                <Button onClick={handleSaveExtension} disabled={saveStatus === 'saving'} icon={editingExtensionId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
                  {editingExtensionId ? 'Guardar cambios' : 'Agregar extensión'}
                </Button>
              </div>

              <div className="mt-8 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="pb-3 font-medium">Usuario</th>
                      <th className="pb-3 font-medium">Extensión</th>
                      <th className="pb-3 font-medium">Usuario auth</th>
                      <th className="pb-3 font-medium">Nombre visible</th>
                      <th className="pb-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sipExtensions.map((extension) => {
                      const owner = systemUsersList.find((u) => u.id === extension.user_id);
                      return (
                        <tr key={extension.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                          <td className="py-3 text-slate-900 dark:text-white font-medium">{owner?.full_name || 'Usuario desconocido'}</td>
                          <td className="py-3 text-slate-700 dark:text-slate-300">{extension.sip_extension}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">{extension.sip_auth_user}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">{extension.display_name || '—'}</td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => handleEditExtension(extension)}>
                                Editar
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteExtension(extension.id)}
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {sipExtensions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          Todavía no hay extensiones asignadas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {activeTab === 'branches' && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <BranchesModule />
        </div>
      )}
    </div>
  );
}
