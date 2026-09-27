/*
  Backfill pipeline opportunities for historical quotes.

  - Reuses the latest open opportunity for the same client when possible.
  - Creates a new opportunity when a quote had none linked.
  - Aligns opportunity stage/status/probability with the quote state.
  - Re-links quote timeline events when available.

  Ajustado al esquema actual de sales_opportunities:
  - No existe stage_id
  - No existen contact_name/contact_email/contact_phone
  - No existe amount
  - Se utiliza stage (text)
  - Se utiliza expected_amount
*/

DO $$
DECLARE
  quote_rec record;
  resolved_opportunity_id uuid;
  opportunity_stage text;
  opportunity_status text;
  opportunity_probability integer;
  activity_timestamp timestamptz;
  client_label text;
BEGIN

  FOR quote_rec IN
    SELECT
      q.id,
      q.quote_number,
      q.client_id,
      q.status,
      q.total_amount,
      q.currency,
      q.expiry_date,
      q.sent_at,
      q.accepted_at,
      q.converted_at,
      q.updated_at,
      q.created_at,
      q.created_by,
      c.company_name,
      c.contact_name,
      c.email,
      c.phone
    FROM public.sales_quotes q
    LEFT JOIN public.clients c
      ON c.id = q.client_id
    WHERE q.client_id IS NOT NULL
      AND q.opportunity_id IS NULL
      AND q.status IN (
        'sent',
        'accepted',
        'rejected',
        'expired',
        'converted'
      )
    ORDER BY
      COALESCE(
        q.sent_at,
        q.accepted_at,
        q.converted_at,
        q.updated_at,
        q.created_at
      ) ASC,
      q.created_at ASC

  LOOP

    /*
      Resolver stage/status/probability de la oportunidad
      según el estado de la cotización.
    */
    IF quote_rec.status = 'sent' THEN

      opportunity_stage := 'quote';
      opportunity_status := 'open';
      opportunity_probability := 65;

    ELSIF quote_rec.status = 'accepted' THEN

      opportunity_stage := 'negotiation';
      opportunity_status := 'open';
      opportunity_probability := 80;

    ELSIF quote_rec.status IN ('rejected', 'expired') THEN

      opportunity_stage := 'lost';
      opportunity_status := 'lost';
      opportunity_probability := 0;

    ELSIF quote_rec.status = 'converted' THEN

      opportunity_stage := 'won';
      opportunity_status := 'won';
      opportunity_probability := 100;

    ELSE
      CONTINUE;
    END IF;


    activity_timestamp := COALESCE(
      quote_rec.sent_at,
      quote_rec.accepted_at,
      quote_rec.converted_at,
      quote_rec.updated_at,
      quote_rec.created_at,
      now()
    );


    /*
      Buscar una oportunidad abierta existente
      para el mismo cliente.
    */
    SELECT so.id
      INTO resolved_opportunity_id
    FROM public.sales_opportunities so
    WHERE so.client_id = quote_rec.client_id
      AND so.status = 'open'
      AND so.stage IN (
        'prospect',
        'contacted',
        'meeting',
        'quote',
        'negotiation'
      )
    ORDER BY
      so.updated_at DESC NULLS LAST,
      so.created_at DESC
    LIMIT 1;


    client_label := COALESCE(
      NULLIF(
        trim(
          COALESCE(
            quote_rec.company_name,
            quote_rec.contact_name,
            'Cliente'
          )
        ),
        ''
      ),
      'Cliente'
    );


    /*
      Si no existe una oportunidad reutilizable,
      crear una nueva.
    */
    IF resolved_opportunity_id IS NULL THEN

      INSERT INTO public.sales_opportunities (
        client_id,
        title,
        stage,
        status,
        expected_amount,
        currency,
        probability,
        expected_close_date,
        source_channel,
        source_detail,
        assigned_to,
        created_by,
        metadata,
        last_activity_at,
        created_at,
        updated_at
      )
      VALUES (
        quote_rec.client_id,

        'Cotizacion '
          || quote_rec.quote_number
          || ' - '
          || client_label,

        opportunity_stage,
        opportunity_status,

        COALESCE(
          quote_rec.total_amount,
          0
        ),

        COALESCE(
          NULLIF(
            trim(quote_rec.currency),
            ''
          ),
          'USD'
        ),

        opportunity_probability,
        quote_rec.expiry_date,

        'sales_quote_backfill',

        'Cotizacion migrada desde el historial de ventas',

        quote_rec.created_by,
        quote_rec.created_by,

        jsonb_build_object(
          'source',
          'sales_migration',

          'origin',
          'quote_backfill',

          'quote_id',
          quote_rec.id,

          'quote_number',
          quote_rec.quote_number,

          'quote_status',
          quote_rec.status,

          'backfilled_at',
          now()
        ),

        activity_timestamp,
        activity_timestamp,
        activity_timestamp
      )
      RETURNING id
      INTO resolved_opportunity_id;


    /*
      Si encontramos una oportunidad abierta,
      actualizarla.
    */
    ELSE

      UPDATE public.sales_opportunities
      SET
        stage = opportunity_stage,

        status = opportunity_status,

        probability = opportunity_probability,

        expected_amount = COALESCE(
          quote_rec.total_amount,
          expected_amount,
          0
        ),

        currency = COALESCE(
          NULLIF(
            trim(quote_rec.currency),
            ''
          ),
          currency,
          'USD'
        ),

        expected_close_date = COALESCE(
          quote_rec.expiry_date,
          expected_close_date
        ),

        last_activity_at = activity_timestamp,
        updated_at = activity_timestamp

      WHERE id = resolved_opportunity_id;

    END IF;


    /*
      Vincular cotización con oportunidad.
    */
    UPDATE public.sales_quotes
    SET
      opportunity_id = resolved_opportunity_id,

      updated_at = GREATEST(
        COALESCE(
          updated_at,
          activity_timestamp
        ),
        activity_timestamp
      )

    WHERE id = quote_rec.id;


    /*
      Vincular interacciones históricas si existe
      la estructura necesaria.
    */
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'client_interactions'
        AND column_name = 'quote_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'client_interactions'
        AND column_name = 'opportunity_id'
    )
    THEN

      UPDATE public.client_interactions
      SET opportunity_id = resolved_opportunity_id
      WHERE quote_id = quote_rec.id
        AND opportunity_id IS NULL;

    END IF;

  END LOOP;

END
$$;