/*
  # Actualizar notas de facturas de comisión con enlaces a facturas

  1. Objetivo
    - Agregar los números de factura a las notas de las facturas de comisión existentes
    - Permitir navegación entre facturas de comisión y facturas originales

  2. Cambios
    - Actualiza el campo `notes` de todas las facturas de comisión (COM-*)
    - Agrega los números de factura separados por comas
    - Formato: "Factura de comisiones - X facturas procesadas: INV-XXX, INV-YYY"

  3. Notas
    - Solo actualiza facturas que tienen el formato antiguo sin números
    - Las nuevas facturas ya se crean con el formato correcto
*/

-- Actualizar las notas de las facturas de comisión para incluir los números de factura
UPDATE invoices AS commission_invoice
SET notes = (
  SELECT 
    'Factura de comisiones - ' || 
    COUNT(related.id)::text || 
    ' facturas procesadas: ' || 
    STRING_AGG(related.invoice_number, ', ' ORDER BY related.created_at)
  FROM invoices AS related
  WHERE related.commission_invoice_id = commission_invoice.id
)
WHERE commission_invoice.invoice_number LIKE 'COM-%'
  AND commission_invoice.notes NOT LIKE '%: %'; -- Solo actualizar las que no tienen ya los números
