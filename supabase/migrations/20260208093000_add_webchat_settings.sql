/*
  # Add WebChat Settings
*/

INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'webchat_settings',
  '{
    "domain": "dogcatify.com",
    "title": "Dogcatify Chat",
    "theme": "#2563eb",
    "endpoint": "",
    "widget_script_url": "",
    "api_key": "",
    "max_message_length": 2000,
    "max_attachments": 5,
    "max_attachment_mb": 10
  }'::jsonb,
  'integration',
  'Configuración del chat web (widget y API)'
)
ON CONFLICT (setting_key) DO NOTHING;
