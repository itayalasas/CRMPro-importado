/*
  # Corregir numero_cfe eliminando sufijo

  1. Problema
    - Las facturas tienen numero_cfe con sufijo (ej: INV-1762108471039-5d579c88)
    - El sufijo se agregaba desde la respuesta del DGI
    - Queremos mostrar solo el numero limpio (INV-1762108471039)

  2. Solución
    - Actualizar todas las facturas que tienen numero_cfe con sufijo
    - Usar el invoice_number como numero_cfe (que no tiene sufijo)
    - Solo actualizar si el numero_cfe es diferente del invoice_number

  3. Notas
    - Esta migración es idempotente
    - No afecta facturas donde numero_cfe ya es correcto
    - Preserva el resto de los datos DGI (cae, qr_code, etc.)
*/

-- Actualizar facturas que tienen numero_cfe con sufijo
UPDATE invoices
SET numero_cfe = invoice_number
WHERE numero_cfe IS NOT NULL 
  AND numero_cfe != invoice_number
  AND LENGTH(numero_cfe) > LENGTH(invoice_number);

-- Log de las actualizaciones
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM invoices
  WHERE numero_cfe = invoice_number;
  
  RAISE NOTICE 'Facturas con numero_cfe corregido: %', v_count;
END $$;