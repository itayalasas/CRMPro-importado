/*
  # Prevenir Envíos Duplicados de PDF
  
  1. Problema Identificado
    - Se están enviando múltiples PDFs para la misma factura
    - Cada envío genera un external_reference diferente
    - Esto impide que el sistema destino vincule el email con el PDF
    
  2. Causa
    - invoice_pdf_queue no tiene constraint UNIQUE en (invoice_id, config_id)
    - Múltiples inserciones crean múltiples entradas
    - Cada entrada se procesa generando múltiples llamadas al API
    
  3. Solución
    - Agregar UNIQUE constraint en (invoice_id, config_id)
    - Esto previene múltiples entradas para la misma factura+config
    - El trigger ya usa ON CONFLICT DO NOTHING, funcionará correctamente
    
  4. Beneficios
    - Solo una entrada por factura+config en la cola
    - Solo un PDF se genera y se envía
    - order_id consistente entre email y PDF
*/

-- Primero, limpiar duplicados existentes (mantener el más reciente)
WITH duplicates AS (
  SELECT 
    id,
    invoice_id,
    config_id,
    ROW_NUMBER() OVER (
      PARTITION BY invoice_id, config_id 
      ORDER BY created_at DESC
    ) as rn
  FROM invoice_pdf_queue
)
DELETE FROM invoice_pdf_queue
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Agregar unique constraint para prevenir duplicados futuros
ALTER TABLE invoice_pdf_queue
ADD CONSTRAINT invoice_pdf_queue_invoice_config_unique 
UNIQUE (invoice_id, config_id);

-- Comentario
COMMENT ON CONSTRAINT invoice_pdf_queue_invoice_config_unique ON invoice_pdf_queue IS 
  'Previene múltiples entradas para la misma factura y configuración, evitando envíos duplicados de PDF';

-- Log
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Constraint UNIQUE agregado a invoice_pdf_queue';
  RAISE NOTICE '✅ Duplicados limpiados';
  RAISE NOTICE '✅ Ahora solo se enviará 1 PDF por factura+config';
  RAISE NOTICE '========================================';
END $$;
