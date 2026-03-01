-- Extiende la configuración SLA de tickets con horas hombre estimadas por prioridad
-- para calcular automáticamente el campo estimated_hours.

INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'ticket_sla_settings',
  jsonb_build_object(
    'low_hours', 72,
    'medium_hours', 24,
    'high_hours', 8,
    'urgent_hours', 4,
    'low_estimated_hours', 2,
    'medium_estimated_hours', 4,
    'high_estimated_hours', 8,
    'urgent_estimated_hours', 12
  ),
  'general',
  'SLA de tickets por prioridad (horas de vencimiento + horas hombre estimadas)'
)
ON CONFLICT (setting_key)
DO UPDATE SET
  setting_value = COALESCE(system_settings.setting_value, '{}'::jsonb)
    || jsonb_build_object(
      'low_estimated_hours', COALESCE((system_settings.setting_value->>'low_estimated_hours')::numeric, 2),
      'medium_estimated_hours', COALESCE((system_settings.setting_value->>'medium_estimated_hours')::numeric, 4),
      'high_estimated_hours', COALESCE((system_settings.setting_value->>'high_estimated_hours')::numeric, 8),
      'urgent_estimated_hours', COALESCE((system_settings.setting_value->>'urgent_estimated_hours')::numeric, 12)
    ),
  setting_type = 'general',
  description = 'SLA de tickets por prioridad (horas de vencimiento + horas hombre estimadas)',
  updated_at = now();
