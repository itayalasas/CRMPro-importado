/*
  # Arreglar Consistencia de commission_invoiced

  1. Cambios en Vista
    - Actualizar `invoices_pending_commission` para usar `commission_invoiced` en lugar de `commission_billed`
    
  2. Sincronización de Datos
    - Copiar valores de `commission_billed` a `commission_invoiced` si existen diferencias
    - Establecer `commission_invoiced` como la columna principal
    
  3. Problema Resuelto
    - Las facturas canceladas ahora aparecerán correctamente en la lista de pendientes
    - Se usa consistentemente `commission_invoiced` en toda la aplicación
*/

-- Sincronizar datos: copiar commission_billed a commission_invoiced si hay diferencias
UPDATE invoices 
SET commission_invoiced = COALESCE(commission_billed, false)
WHERE commission_invoiced IS NULL 
   OR commission_invoiced != COALESCE(commission_billed, false);

-- Actualizar la vista para usar commission_invoiced
CREATE OR REPLACE VIEW invoices_pending_commission AS
SELECT 
  i.id as invoice_id,
  i.invoice_number,
  i.total_amount as invoice_total,
  i.issue_date,
  i.status,
  o.commission_amount,
  o.commission_rate,
  p.id as partner_id,
  p.name as partner_name,
  c.contact_name as client_name,
  c.company_name as client_company
FROM invoices i
JOIN orders o ON o.id = i.order_id
LEFT JOIN partners p ON p.id = i.partner_id
LEFT JOIN clients c ON c.id = i.client_id
WHERE i.status = 'sent'
  AND i.is_commission_invoice = false
  AND COALESCE(i.commission_invoiced, false) = false
  AND i.cancelled_at IS NULL
  AND o.commission_amount > 0
ORDER BY i.issue_date DESC;

COMMENT ON VIEW invoices_pending_commission IS 
  'Vista de facturas enviadas pendientes de generar factura de comisión - usa commission_invoiced';

-- Actualizar el código del frontend para usar commission_invoiced
-- Esto se manejará en el código TypeScript
