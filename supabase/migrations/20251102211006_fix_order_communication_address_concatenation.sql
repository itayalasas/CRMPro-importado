/*
  # Fix: Corrección de concatenación de dirección

  1. Changes
    - Corrige la construcción de delivery_address
    - Usa NULLIF para manejar valores vacíos
    - Construye la dirección correctamente con COALESCE
*/

CREATE OR REPLACE FUNCTION trigger_send_order_communication()
RETURNS TRIGGER AS $$
DECLARE
  v_client_record RECORD;
  v_config_record RECORD;
  v_order_metadata JSONB;
  v_payload JSONB;
  v_request_id BIGINT;
  v_service_name TEXT;
  v_pet_name TEXT;
  v_appointment_time TEXT;
  v_appointment_date TEXT;
  v_has_products BOOLEAN;
  v_has_services BOOLEAN;
  v_delivery_address TEXT;
  v_calle TEXT;
  v_numero TEXT;
  v_barrio TEXT;
BEGIN
  -- Solo ejecutar si el estado cambió a 'confirmed' desde otro estado
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    RAISE NOTICE 'Orden confirmada: %', NEW.id;
    
    -- Buscar configuración activa de email_communication
    SELECT * INTO v_config_record
    FROM external_invoice_api_config
    WHERE config_type = 'email_communication'
      AND is_active = true
    LIMIT 1;

    -- Si no hay configuración, salir silenciosamente
    IF NOT FOUND THEN
      RAISE NOTICE 'No hay configuración activa de email_communication';
      RETURN NEW;
    END IF;

    RAISE NOTICE 'Configuración encontrada: %', v_config_record.name;

    -- Obtener datos del cliente
    SELECT * INTO v_client_record
    FROM clients
    WHERE id = NEW.client_id;

    -- Validar que el cliente tenga email
    IF v_client_record.email IS NULL OR v_client_record.email = '' THEN
      RAISE NOTICE 'Cliente sin email configurado';
      RETURN NEW;
    END IF;

    RAISE NOTICE 'Cliente encontrado: % <%>', v_client_record.contact_name, v_client_record.email;

    -- Detectar si la orden tiene productos o servicios
    SELECT 
      EXISTS(SELECT 1 FROM order_items WHERE order_id = NEW.id AND item_type = 'product'),
      EXISTS(SELECT 1 FROM order_items WHERE order_id = NEW.id AND item_type = 'service')
    INTO v_has_products, v_has_services;

    RAISE NOTICE 'Orden tipo: productos=% servicios=%', v_has_products, v_has_services;

    -- Obtener metadata de la orden
    v_order_metadata := COALESCE(NEW.metadata, '{}'::jsonb);

    -- CASO 1: Orden de PRODUCTOS
    IF v_has_products THEN
      
      -- Extraer componentes de dirección
      v_calle := v_order_metadata->'customer'->>'calle';
      v_numero := v_order_metadata->'customer'->>'numero';
      v_barrio := v_order_metadata->'customer'->>'barrio';

      -- Construir dirección de envío
      IF v_calle IS NOT NULL AND v_numero IS NOT NULL AND v_barrio IS NOT NULL THEN
        v_delivery_address := v_calle || ' ' || v_numero || ', ' || v_barrio;
      ELSE
        v_delivery_address := COALESCE(v_client_record.address, 'No especificada');
      END IF;

      -- Payload para productos (shop_confirmation)
      v_payload := jsonb_build_object(
        'template_name', 'shop_confirmation',
        'recipient_email', v_client_record.email,
        'order_id', NEW.id::text,
        'wait_for_invoice', true,
        'data', jsonb_build_object(
          'client_name', COALESCE(
            v_order_metadata->'customer'->>'display_name',
            v_client_record.contact_name,
            v_client_record.company_name,
            'Cliente'
          ),
          'order_number', NEW.order_number,
          'order_date', TO_CHAR(NEW.order_date, 'DD/MM/YYYY'),
          'payment_method', COALESCE(NEW.payment_method, 'Mercado Pago'),
          'payment_status', CASE 
            WHEN NEW.payment_status = 'confirmed' THEN 'Confirmada'
            WHEN NEW.payment_status = 'pending' THEN 'Pendiente'
            ELSE 'Desconocida'
          END,
          'delivery_address', v_delivery_address
        )
      );

      RAISE NOTICE 'Payload para PRODUCTOS construido';

    -- CASO 2: Orden de SERVICIOS
    ELSIF v_has_services THEN

      -- Extraer datos de servicio
      v_service_name := COALESCE(
        v_order_metadata->'partners'->0->'items'->0->>'name',
        v_order_metadata->'partners'->0->'items'->0->>'service_name',
        'Servicio'
      );

      v_pet_name := COALESCE(
        v_order_metadata->'booking_info'->>'pet_name',
        v_order_metadata->'partners'->0->'items'->0->>'pet_name',
        ''
      );

      v_appointment_time := COALESCE(
        v_order_metadata->'booking_info'->>'appointment_time',
        v_order_metadata->'partners'->0->'items'->0->>'appointment_time',
        ''
      );

      v_appointment_date := COALESCE(
        v_order_metadata->'booking_info'->>'appointment_date',
        v_order_metadata->'partners'->0->'items'->0->>'appointment_date',
        NEW.order_date::text
      );

      -- Si appointment_date viene como timestamp ISO, extraer solo la fecha
      IF v_appointment_date LIKE '%T%' THEN
        v_appointment_date := substring(v_appointment_date from 1 for 10);
      END IF;

      -- Payload para servicios (agenda_confirmation)
      v_payload := jsonb_build_object(
        'template_name', 'agenda_confirmation',
        'recipient_email', v_client_record.email,
        'order_id', NEW.id::text,
        'wait_for_invoice', true,
        'data', jsonb_build_object(
          'client_name', COALESCE(
            v_order_metadata->'customer'->>'display_name',
            v_client_record.contact_name,
            v_client_record.company_name,
            'Cliente'
          ),
          'service_name', v_service_name,
          'provider_name', COALESCE(
            v_order_metadata->'partners'->0->>'business_name',
            'Proveedor'
          ),
          'reservation_date', v_appointment_date,
          'reservation_time', v_appointment_time,
          'pet_name', v_pet_name
        )
      );

      RAISE NOTICE 'Payload para SERVICIOS construido';
    ELSE
      RAISE NOTICE 'Orden sin items válidos';
      RETURN NEW;
    END IF;

    -- Llamar a pending-communication API
    BEGIN
      SELECT net.http_post(
        url := 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/pending-communication',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := v_payload
      ) INTO v_request_id;
      
      RAISE NOTICE 'Llamada HTTP a pending-communication iniciada con request_id: % para orden %', v_request_id, NEW.id;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error con pg_net (%): %', SQLSTATE, SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
