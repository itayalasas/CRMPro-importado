/*
  # Add sales quotes and product catalog

  1. New Tables
    - `sales_products`: catalog of products and services
    - `sales_quotes`: commercial quotations linked to clients and opportunities
    - `sales_quote_items`: line items inside each quotation

  2. Changes
    - Link quotes back to orders and timeline events
    - Add quote-aware timeline entries to client_interactions
    - Keep the schema tolerant if a partial deployment already exists
*/

-- Product catalog
CREATE TABLE IF NOT EXISTS public.sales_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text,
  name text NOT NULL,
  description text,
  category text,
  product_type text NOT NULL DEFAULT 'product' CHECK (product_type IN ('product', 'service')),
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS cost_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.sales_products
  ALTER COLUMN product_type SET DEFAULT 'product',
  ALTER COLUMN unit_price SET DEFAULT 0,
  ALTER COLUMN cost_price SET DEFAULT 0,
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.sales_products
SET
  sku = NULLIF(trim(sku), ''),
  name = COALESCE(NULLIF(trim(name), ''), 'Producto sin nombre'),
  description = NULLIF(trim(description), ''),
  category = NULLIF(trim(category), ''),
  product_type = CASE
    WHEN product_type IN ('product', 'service') THEN product_type
    ELSE 'product'
  END,
  unit_price = COALESCE(unit_price, 0),
  cost_price = COALESCE(cost_price, 0),
  currency = COALESCE(NULLIF(trim(currency), ''), 'USD'),
  is_active = COALESCE(is_active, true),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE
  name IS NULL
  OR trim(name) = ''
  OR product_type IS NULL
  OR product_type NOT IN ('product', 'service')
  OR unit_price IS NULL
  OR cost_price IS NULL
  OR currency IS NULL
  OR trim(currency) = ''
  OR is_active IS NULL
  OR metadata IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.sales_products
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN product_type SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL,
  ALTER COLUMN cost_price SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_products'
      AND constraint_name = 'sales_products_product_type_check'
  ) THEN
    ALTER TABLE public.sales_products
      ADD CONSTRAINT sales_products_product_type_check
      CHECK (product_type IN ('product', 'service'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_products'
      AND constraint_name = 'sales_products_unit_price_check'
  ) THEN
    ALTER TABLE public.sales_products
      ADD CONSTRAINT sales_products_unit_price_check
      CHECK (unit_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_products'
      AND constraint_name = 'sales_products_cost_price_check'
  ) THEN
    ALTER TABLE public.sales_products
      ADD CONSTRAINT sales_products_cost_price_check
      CHECK (cost_price >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_products_sku ON public.sales_products(sku);
CREATE INDEX IF NOT EXISTS idx_sales_products_name ON public.sales_products(name);
CREATE INDEX IF NOT EXISTS idx_sales_products_category ON public.sales_products(category);
CREATE INDEX IF NOT EXISTS idx_sales_products_product_type ON public.sales_products(product_type);
CREATE INDEX IF NOT EXISTS idx_sales_products_is_active ON public.sales_products(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_products_created_at ON public.sales_products(created_at);

ALTER TABLE public.sales_products DISABLE ROW LEVEL SECURITY;

-- Quotations
CREATE TABLE IF NOT EXISTS public.sales_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text NOT NULL UNIQUE DEFAULT (
    'Q-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')
  ),
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  tax_rate numeric(5, 2) NOT NULL DEFAULT 22,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  terms text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  accepted_at timestamptz,
  converted_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_quotes
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS quote_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS total_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.sales_quotes
  ALTER COLUMN quote_number SET DEFAULT (
    'Q-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN quote_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN tax_rate SET DEFAULT 22,
  ALTER COLUMN tax_amount SET DEFAULT 0,
  ALTER COLUMN total_amount SET DEFAULT 0,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.sales_quotes
SET
  quote_number = COALESCE(
    NULLIF(trim(quote_number), ''),
    'Q-' || to_char(COALESCE(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(replace(COALESCE(id::text, gen_random_uuid()::text), '-', ''), 1, 8))
  ),
  status = CASE
    WHEN status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted') THEN status
    ELSE 'draft'
  END,
  quote_date = COALESCE(quote_date, CURRENT_DATE),
  currency = COALESCE(NULLIF(trim(currency), ''), 'USD'),
  subtotal = COALESCE(subtotal, 0),
  discount_amount = COALESCE(discount_amount, 0),
  tax_rate = COALESCE(tax_rate, 22),
  tax_amount = COALESCE(tax_amount, 0),
  total_amount = COALESCE(total_amount, 0),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE
  quote_number IS NULL
  OR trim(quote_number) = ''
  OR status IS NULL
  OR status NOT IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')
  OR quote_date IS NULL
  OR currency IS NULL
  OR trim(currency) = ''
  OR subtotal IS NULL
  OR discount_amount IS NULL
  OR tax_rate IS NULL
  OR tax_amount IS NULL
  OR total_amount IS NULL
  OR metadata IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.sales_quotes
  ALTER COLUMN quote_number SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN quote_date SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN tax_rate SET NOT NULL,
  ALTER COLUMN tax_amount SET NOT NULL,
  ALTER COLUMN total_amount SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotes'
      AND constraint_name = 'sales_quotes_status_check'
  ) THEN
    ALTER TABLE public.sales_quotes
      ADD CONSTRAINT sales_quotes_status_check
      CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotes'
      AND constraint_name = 'sales_quotes_tax_rate_check'
  ) THEN
    ALTER TABLE public.sales_quotes
      ADD CONSTRAINT sales_quotes_tax_rate_check
      CHECK (tax_rate >= 0 AND tax_rate <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotes'
      AND constraint_name = 'sales_quotes_client_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quotes
      ADD CONSTRAINT sales_quotes_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotes'
      AND constraint_name = 'sales_quotes_opportunity_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quotes
      ADD CONSTRAINT sales_quotes_opportunity_id_fkey
      FOREIGN KEY (opportunity_id) REFERENCES public.sales_opportunities(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotes'
      AND constraint_name = 'sales_quotes_order_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quotes
      ADD CONSTRAINT sales_quotes_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_quotes_client_id ON public.sales_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_opportunity_id ON public.sales_quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_order_id ON public.sales_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_status ON public.sales_quotes(status);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_quote_date ON public.sales_quotes(quote_date);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_created_at ON public.sales_quotes(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_quotes_order_id_unique
  ON public.sales_quotes(order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.sales_quotes DISABLE ROW LEVEL SECURITY;

-- Quote line items
CREATE TABLE IF NOT EXISTS public.sales_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.sales_quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.sales_products(id) ON DELETE SET NULL,
  product_name text,
  description text NOT NULL,
  item_type text NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service')),
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  line_total numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_quote_items
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS quantity numeric(12, 2),
  ADD COLUMN IF NOT EXISTS unit_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS line_total numeric(12, 2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.sales_quote_items
  ALTER COLUMN item_type SET DEFAULT 'product',
  ALTER COLUMN quantity SET DEFAULT 1,
  ALTER COLUMN unit_price SET DEFAULT 0,
  ALTER COLUMN discount_percent SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN line_total SET DEFAULT 0,
  ALTER COLUMN currency SET DEFAULT 'USD',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT now();

UPDATE public.sales_quote_items
SET
  product_name = COALESCE(NULLIF(trim(product_name), ''), NULLIF(trim(description), ''), 'Item'),
  description = COALESCE(NULLIF(trim(description), ''), NULLIF(trim(product_name), ''), 'Item'),
  item_type = CASE
    WHEN item_type IN ('product', 'service') THEN item_type
    ELSE 'product'
  END,
  quantity = COALESCE(quantity, 1),
  unit_price = COALESCE(unit_price, 0),
  discount_percent = COALESCE(discount_percent, 0),
  discount_amount = COALESCE(discount_amount, 0),
  line_total = COALESCE(line_total, COALESCE(quantity, 1) * COALESCE(unit_price, 0) - COALESCE(discount_amount, 0)),
  currency = COALESCE(NULLIF(trim(currency), ''), 'USD'),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, now())
WHERE
  quote_id IS NULL
  OR description IS NULL
  OR trim(description) = ''
  OR item_type IS NULL
  OR item_type NOT IN ('product', 'service')
  OR quantity IS NULL
  OR unit_price IS NULL
  OR discount_percent IS NULL
  OR discount_amount IS NULL
  OR line_total IS NULL
  OR currency IS NULL
  OR trim(currency) = ''
  OR metadata IS NULL
  OR created_at IS NULL;

ALTER TABLE public.sales_quote_items
  ALTER COLUMN quote_id SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN item_type SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL,
  ALTER COLUMN discount_percent SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN line_total SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quote_items'
      AND constraint_name = 'sales_quote_items_item_type_check'
  ) THEN
    ALTER TABLE public.sales_quote_items
      ADD CONSTRAINT sales_quote_items_item_type_check
      CHECK (item_type IN ('product', 'service'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quote_items'
      AND constraint_name = 'sales_quote_items_quantity_check'
  ) THEN
    ALTER TABLE public.sales_quote_items
      ADD CONSTRAINT sales_quote_items_quantity_check
      CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quote_items'
      AND constraint_name = 'sales_quote_items_discount_percent_check'
  ) THEN
    ALTER TABLE public.sales_quote_items
      ADD CONSTRAINT sales_quote_items_discount_percent_check
      CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quote_items'
      AND constraint_name = 'sales_quote_items_quote_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quote_items
      ADD CONSTRAINT sales_quote_items_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_quote_items'
      AND constraint_name = 'sales_quote_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quote_items
      ADD CONSTRAINT sales_quote_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.sales_products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_quote_items_quote_id ON public.sales_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_quote_items_product_id ON public.sales_quote_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_quote_items_created_at ON public.sales_quote_items(created_at);

ALTER TABLE public.sales_quote_items DISABLE ROW LEVEL SECURITY;

-- Link quotes to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quote_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND constraint_name = 'orders_quote_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON public.orders(quote_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_quote_id_unique
  ON public.orders(quote_id)
  WHERE quote_id IS NOT NULL;

-- Quote timeline integration
ALTER TABLE public.client_interactions
  ADD COLUMN IF NOT EXISTS quote_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'client_interactions'
      AND constraint_name = 'client_interactions_quote_id_fkey'
  ) THEN
    ALTER TABLE public.client_interactions
      ADD CONSTRAINT client_interactions_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.sales_quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_interactions_quote_id ON public.client_interactions(quote_id);

