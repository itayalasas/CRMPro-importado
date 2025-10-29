/*
  # Arreglar confirmación automática de orden al pagar

  1. Problema Original
    - Trigger BEFORE modifica NEW.status pero eso afecta la detección en trigger AFTER
    - Trigger AFTER que hace UPDATE causa potencial recursión

  2. Nueva Solución
    - Volver a BEFORE trigger pero más simple
    - Solo modificar NEW.status cuando corresponda
    - Asegurar que generate_invoice_from_order() detecte correctamente el cambio
    - La clave es que OLD.status será diferente de NEW.status

  3. Lógica
    - payment_status cambia a 'paid' → Trigger BEFORE modifica NEW.status a 'confirmed'
    - Trigger AFTER (generate_invoice) ve OLD.status='pending' y NEW.status='confirmed'
    - Se genera la factura correctamente
*/

-- Eliminar trigger AFTER anterior
DROP TRIGGER IF EXISTS trigger_auto_confirm_order_on_payment ON orders;

-- Recrear función BEFORE más simple
CREATE OR REPLACE FUNCTION auto_confirm_order_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el payment_status está cambiando a 'paid' o 'confirmed'
  -- Y el status actual NO es 'confirmed', 'completed' o 'cancelled'
  IF (NEW.payment_status IN ('paid', 'confirmed'))
     AND (OLD IS NULL OR OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'confirmed'))
     AND (NEW.status NOT IN ('confirmed', 'completed', 'cancelled')) THEN
    
    -- Cambiar el status a 'confirmed'
    NEW.status := 'confirmed';
    
    RAISE NOTICE 'Orden % auto-confirmada por pago (% -> %)', 
                 NEW.order_number, 
                 COALESCE(OLD.status, 'null'), 
                 NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger BEFORE con prioridad alta (nombre alfabético primero)
-- Para que se ejecute antes que otros triggers BEFORE
CREATE TRIGGER a_trigger_auto_confirm_order_on_payment
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_order_on_payment();

COMMENT ON FUNCTION auto_confirm_order_on_payment() IS 
  'Automatically sets status to confirmed when payment_status becomes paid (BEFORE trigger)';

-- Verificar que generate_invoice_from_order detecte cambios correctamente
COMMENT ON TRIGGER trigger_generate_invoice_on_order_confirm ON orders IS
  'Generates invoice when status changes to confirmed (runs after a_trigger_auto_confirm)';

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Trigger de auto-confirmación actualizado';
  RAISE NOTICE '✅ Se ejecuta como BEFORE con nombre alfabético prioritario';
  RAISE NOTICE '✅ Debería funcionar correctamente ahora';
  RAISE NOTICE '========================================';
END $$;
