/*
  # Confirmar orden automáticamente cuando el pago es confirmado

  1. Problema
    - Cuando DogCatify notifica que un pago fue confirmado (payment_status = 'paid' o 'confirmed')
    - La orden no cambia automáticamente a status = 'confirmed'
    - Esto impide que se genere la factura automáticamente

  2. Solución
    - Crear trigger que detecte cambios en payment_status
    - Cuando payment_status cambia a 'paid' o 'confirmed'
    - Cambiar automáticamente el status de la orden a 'confirmed'

  3. Flujo
    - Webhook actualiza payment_status → 'paid'
    - Trigger detecta el cambio
    - Actualiza status → 'confirmed'
    - Otro trigger genera la factura automáticamente
*/

CREATE OR REPLACE FUNCTION auto_confirm_order_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el payment_status cambia a 'paid' o 'confirmed' y el status no es 'confirmed'
  IF (NEW.payment_status IN ('paid', 'confirmed'))
     AND (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'confirmed'))
     AND (NEW.status NOT IN ('confirmed', 'completed', 'cancelled')) THEN
    
    -- Cambiar el status a 'confirmed'
    NEW.status := 'confirmed';
    
    RAISE NOTICE 'Orden % confirmada automáticamente por pago confirmado', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger si no existe
DROP TRIGGER IF EXISTS trigger_auto_confirm_order_on_payment ON orders;

CREATE TRIGGER trigger_auto_confirm_order_on_payment
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_order_on_payment();

COMMENT ON FUNCTION auto_confirm_order_on_payment() IS 
  'Automatically confirms order when payment_status changes to paid or confirmed';

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Trigger creado correctamente';
  RAISE NOTICE '✅ Las órdenes se confirmarán automáticamente cuando el pago sea confirmado';
  RAISE NOTICE '✅ Esto activará la generación automática de facturas';
  RAISE NOTICE '========================================';
END $$;
