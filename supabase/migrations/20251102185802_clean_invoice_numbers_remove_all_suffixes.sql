/*
  # Limpiar números de factura eliminando sufijos

  1. Problema
    - Los invoice_number tienen sufijos como -5d579c88, -8dfe492a
    - Queremos solo el número base: INV-1762108471039

  2. Solución
    - Usar REGEXP_REPLACE para eliminar el sufijo (-[a-f0-9]{8})
    - Actualizar tanto invoice_number como numero_cfe
    - Solo afecta facturas con sufijo de 8 caracteres hexadecimales

  3. Ejemplos
    - INV-1762108471039-5d579c88 → INV-1762108471039
    - INV-1762107792207-5d579c88 → INV-1762107792207
    - INV-1762109585 → INV-1762109585 (sin cambios)
*/

-- Actualizar invoice_number removiendo sufijo
UPDATE invoices
SET 
  invoice_number = REGEXP_REPLACE(invoice_number, '-[a-f0-9]{8}$', ''),
  numero_cfe = REGEXP_REPLACE(COALESCE(numero_cfe, invoice_number), '-[a-f0-9]{8}$', '')
WHERE invoice_number ~ '-[a-f0-9]{8}$';

-- Verificar resultados
DO $$
DECLARE
  v_updated int;
  v_total int;
BEGIN
  SELECT COUNT(*) INTO v_updated
  FROM invoices
  WHERE invoice_number = numero_cfe 
    AND LENGTH(invoice_number) < 20;
  
  SELECT COUNT(*) INTO v_total
  FROM invoices
  WHERE numero_cfe IS NOT NULL;
  
  RAISE NOTICE 'Facturas con números limpios: % de %', v_updated, v_total;
END $$;