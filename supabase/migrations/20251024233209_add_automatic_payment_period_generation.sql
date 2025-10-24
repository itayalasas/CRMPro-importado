/*
  # Sistema Automático de Generación de Quincenas

  1. Funciones Principales
    - `last_day_of_month()` - Obtiene el último día de un mes
    - `auto_create_second_payment_period()` - Trigger que crea automáticamente la segunda quincena
    - `get_current_payment_period()` - Obtiene o crea la quincena actual
    
  2. Reglas de Negocio
    - Al crear una quincena con "Primera Quincena" en el nombre, se crea automáticamente la segunda
    - Primera quincena: días 1-15
    - Segunda quincena: días 16-fin de mes
    - Nomenclatura: "Octubre 2025 - Primera Quincena" / "Segunda Quincena"
    
  3. Validaciones
    - Las facturas de comisión deben tener una quincena asociada
    - No se pueden crear facturas para quincenas futuras
*/

-- Función para obtener el último día del mes
CREATE OR REPLACE FUNCTION last_day_of_month(p_date date)
RETURNS date AS $$
BEGIN
  RETURN (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para crear automáticamente la segunda quincena cuando se crea la primera
CREATE OR REPLACE FUNCTION auto_create_second_payment_period()
RETURNS TRIGGER AS $$
DECLARE
  v_year integer;
  v_month integer;
  v_month_name text;
  v_second_quinzena_name text;
  v_second_start_date date;
  v_second_end_date date;
  v_existing_count integer;
BEGIN
  -- Solo procesar si es la primera quincena y el nombre contiene "Primera Quincena"
  IF NEW.name ILIKE '%Primera Quincena%' OR NEW.name ILIKE '%First%' THEN
    
    -- Extraer año y mes de la fecha de inicio
    v_year := EXTRACT(YEAR FROM NEW.start_date);
    v_month := EXTRACT(MONTH FROM NEW.start_date);
    
    -- Obtener nombre del mes en español
    v_month_name := CASE v_month
      WHEN 1 THEN 'Enero'
      WHEN 2 THEN 'Febrero'
      WHEN 3 THEN 'Marzo'
      WHEN 4 THEN 'Abril'
      WHEN 5 THEN 'Mayo'
      WHEN 6 THEN 'Junio'
      WHEN 7 THEN 'Julio'
      WHEN 8 THEN 'Agosto'
      WHEN 9 THEN 'Septiembre'
      WHEN 10 THEN 'Octubre'
      WHEN 11 THEN 'Noviembre'
      WHEN 12 THEN 'Diciembre'
    END;
    
    -- Construir nombre de la segunda quincena
    v_second_quinzena_name := v_month_name || ' ' || v_year || ' - Segunda Quincena';
    
    -- Verificar si ya existe la segunda quincena
    SELECT COUNT(*) INTO v_existing_count
    FROM payment_periods
    WHERE name = v_second_quinzena_name;
    
    -- Si no existe, crearla
    IF v_existing_count = 0 THEN
      -- La segunda quincena va del día 16 al último día del mes
      v_second_start_date := make_date(v_year, v_month, 16);
      v_second_end_date := last_day_of_month(NEW.start_date);
      
      -- Insertar la segunda quincena
      INSERT INTO payment_periods (
        name,
        start_date,
        end_date,
        status,
        created_by,
        notes
      ) VALUES (
        v_second_quinzena_name,
        v_second_start_date,
        v_second_end_date,
        'pending',
        NEW.created_by,
        'Creada automáticamente al generar la primera quincena'
      );
      
      RAISE NOTICE 'Segunda quincena creada automáticamente: %', v_second_quinzena_name;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para crear automáticamente la segunda quincena
DROP TRIGGER IF EXISTS trigger_auto_create_second_payment_period ON payment_periods;
CREATE TRIGGER trigger_auto_create_second_payment_period
  AFTER INSERT ON payment_periods
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_second_payment_period();

-- Función para obtener o crear la quincena actual
CREATE OR REPLACE FUNCTION get_current_payment_period()
RETURNS uuid AS $$
DECLARE
  v_current_date date := CURRENT_DATE;
  v_year integer;
  v_month integer;
  v_month_name text;
  v_period_name text;
  v_start_date date;
  v_end_date date;
  v_period_id uuid;
  v_day integer;
BEGIN
  v_year := EXTRACT(YEAR FROM v_current_date);
  v_month := EXTRACT(MONTH FROM v_current_date);
  v_day := EXTRACT(DAY FROM v_current_date);
  
  -- Obtener nombre del mes
  v_month_name := CASE v_month
    WHEN 1 THEN 'Enero'
    WHEN 2 THEN 'Febrero'
    WHEN 3 THEN 'Marzo'
    WHEN 4 THEN 'Abril'
    WHEN 5 THEN 'Mayo'
    WHEN 6 THEN 'Junio'
    WHEN 7 THEN 'Julio'
    WHEN 8 THEN 'Agosto'
    WHEN 9 THEN 'Septiembre'
    WHEN 10 THEN 'Octubre'
    WHEN 11 THEN 'Noviembre'
    WHEN 12 THEN 'Diciembre'
  END;
  
  -- Determinar si es primera o segunda quincena
  IF v_day <= 15 THEN
    v_period_name := v_month_name || ' ' || v_year || ' - Primera Quincena';
    v_start_date := make_date(v_year, v_month, 1);
    v_end_date := make_date(v_year, v_month, 15);
  ELSE
    v_period_name := v_month_name || ' ' || v_year || ' - Segunda Quincena';
    v_start_date := make_date(v_year, v_month, 16);
    v_end_date := last_day_of_month(v_current_date);
  END IF;
  
  -- Buscar si existe la quincena
  SELECT id INTO v_period_id
  FROM payment_periods
  WHERE name = v_period_name;
  
  -- Si no existe, crearla
  IF v_period_id IS NULL THEN
    INSERT INTO payment_periods (
      name,
      start_date,
      end_date,
      status,
      notes
    ) VALUES (
      v_period_name,
      v_start_date,
      v_end_date,
      'pending',
      'Creada automáticamente'
    ) RETURNING id INTO v_period_id;
    
    RAISE NOTICE 'Quincena creada automáticamente: %', v_period_name;
  END IF;
  
  RETURN v_period_id;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON FUNCTION last_day_of_month IS 'Obtiene el último día del mes para una fecha dada';
COMMENT ON FUNCTION auto_create_second_payment_period IS 'Crea automáticamente la segunda quincena cuando se crea la primera';
COMMENT ON FUNCTION get_current_payment_period IS 'Obtiene o crea la quincena actual basada en la fecha del sistema';
