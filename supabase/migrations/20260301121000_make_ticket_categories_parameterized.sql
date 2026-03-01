-- Convierte ticket_categories en catálogo parametrizable desde el módulo de Parámetros
-- y asegura categorías por defecto.

ALTER TABLE ticket_categories
ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE ticket_categories
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

ALTER TABLE ticket_categories
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE ticket_categories
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill básico para instalaciones existentes
UPDATE ticket_categories
SET is_active = true
WHERE is_active IS NULL;

UPDATE ticket_categories
SET sort_order = 0
WHERE sort_order IS NULL;

UPDATE ticket_categories
SET updated_at = now()
WHERE updated_at IS NULL;

-- Genera code si no existe (slug simple desde el nombre)
UPDATE ticket_categories
SET code = regexp_replace(
  regexp_replace(
    lower(translate(name,
      'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñ',
      'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'
    )),
    '[^a-z0-9]+', '_', 'g'
  ),
  '^_+|_+$', '', 'g'
)
WHERE code IS NULL OR btrim(code) = '';

-- Si existen códigos duplicados previos, conserva el más antiguo
WITH ranked AS (
  SELECT id, code,
         row_number() OVER (PARTITION BY code ORDER BY created_at, id) AS rn
  FROM ticket_categories
  WHERE code IS NOT NULL AND btrim(code) <> ''
)
DELETE FROM ticket_categories tc
USING ranked r
WHERE tc.id = r.id
  AND r.rn > 1;

-- Fija orden inicial si estaba en cero
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, name, id) AS rn
  FROM ticket_categories
  WHERE sort_order = 0
)
UPDATE ticket_categories t
SET sort_order = ordered.rn
FROM ordered
WHERE t.id = ordered.id;

-- Asegura unicidad de code para operar desde Parámetros
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_categories_code_unique
  ON ticket_categories(code);

-- Inserta/actualiza categorías por defecto
INSERT INTO ticket_categories (code, name, description, color, icon, sort_order, is_active, updated_at)
VALUES
  ('soporte_tecnico', 'Soporte Técnico', 'Problemas técnicos y errores del sistema', '#ef4444', 'AlertCircle', 1, true, now()),
  ('consulta', 'Consulta', 'Preguntas y consultas generales', '#3b82f6', 'HelpCircle', 2, true, now()),
  ('solicitud_cambio', 'Solicitud de Cambio', 'Solicitudes de cambios o mejoras', '#8b5cf6', 'GitPullRequest', 3, true, now()),
  ('bug_error', 'Bug/Error', 'Reportes de bugs y errores', '#f59e0b', 'Bug', 4, true, now()),
  ('capacitacion', 'Capacitación', 'Solicitudes de capacitación o documentación', '#10b981', 'BookOpen', 5, true, now()),
  ('incidente', 'Incidente', 'Incidentes críticos que requieren atención inmediata', '#dc2626', 'AlertTriangle', 6, true, now())
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();
