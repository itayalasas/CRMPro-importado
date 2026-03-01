-- Añade columna para identificar el origen del ticket (email, chat_web, llamadas, etc.)
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS source_module text;

-- Índice opcional para filtros/reportes por origen
CREATE INDEX IF NOT EXISTS idx_tickets_source_module ON tickets(source_module);
