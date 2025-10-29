/*
  # Arreglar lógica del trigger de generación de facturas

  1. Problema
    - auto_confirm_order_on_payment (BEFORE) cambia status a 'confirmed'
    - generate_invoice_from_order (AFTER) verifica OLD.status != 'confirmed'
    - Pero como el cambio se hizo en BEFORE, OLD ya tiene el nuevo valor
    - Resultado: No se genera la factura

  2. Solución
    - Cambiar auto_confirm_order_on_payment a AFTER en lugar de BEFORE
    - Hacer el UPDATE del status dentro de la función
    - Esto permite que OLD.status mantenga el valor original

  3. Notas
    - Esto asegura que generate_invoice_from_order detecte correctamente el cambio
    - El flujo será: payment_status cambia → trigger AFTER actualiza status → otro trigger genera factura
*/

-- Primero eliminar el trigger BEFORE
DROP TRIGGER IF EXISTS trigger_auto_confirm_order_on_payment ON orders;

-- Crear nueva función que hace UPDATE en lugar de modificar NEW
CREATE OR REPLACE FUNCTION auto_confirm_order_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el payment_status cambió a 'paid' o 'confirmed' y el status no es 'confirmed'
  IF (NEW.payment_status IN ('paid', 'confirmed'))
     AND (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'confirmed'))
     AND (NEW.status NOT IN ('confirmed', 'completed', 'cancelled')) THEN
    
    -- Hacer UPDATE del status (esto disparará generate_invoice_from_order)
    UPDATE orders 
    SET status = 'confirmed'
    WHERE id = NEW.id;
    
    RAISE NOTICE 'Orden % será confirmada automáticamente por pago confirmado', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger como AFTER para que se ejecute después del UPDATE
CREATE TRIGGER trigger_auto_confirm_order_on_payment
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_order_on_payment();

COMMENT ON FUNCTION auto_confirm_order_on_payment() IS 
  'Automatically confirms order when payment_status changes to paid or confirmed (AFTER trigger)';
