/*
  # Arreglar Vista de Facturas Pendientes de Comisión

  1. Cambios en Vista
    - Incluir facturas con status: 'sent' y 'validated'
    - Estas son las facturas aprobadas que pueden generar comisión
    
  2. Limpieza de Datos
    - Corregir facturas que tienen commission_invoiced=true pero commission_invoice_id=NULL
    - Estas facturas quedaron en estado inconsistente después de cancelar facturas de comisión
    
  3. Problema Resuelto
    - Las facturas validadas y enviadas aparecerán en la lista de pendientes
    - Los datos inconsistentes se corrigen automáticamente
*/

-- Primero, corregir facturas en estado inconsistente
-- Si commission_invoiced=true pero no tienen commission_invoice_id, marcarlas como no facturadas
UPDATE invoices 
SET commission_invoiced = false
WHERE is_commission_invoice = false
  AND commission_invoiced = true
  AND commission_invoice_id IS NULL;

-- Actualizar la vista para incluir facturas con status 'validated' y 'sent'
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
WHERE i.status IN ('sent', 'validated')
  AND i.is_commission_invoice = false
  AND COALESCE(i.commission_invoiced, false) = false
  AND i.cancelled_at IS NULL
  AND o.commission_amount > 0
  AND p.id IS NOT NULL
ORDER BY i.issue_date DESC;

COMMENT ON VIEW invoices_pending_commission IS 
  'Vista de facturas enviadas o validadas pendientes de generar factura de comisión';

-- Verificar cuántas facturas quedan pendientes
SELECT COUNT(*) as facturas_disponibles FROM invoices_pending_commission;
