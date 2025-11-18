/*
  # Create branches (sucursales) table

  1. New Tables
    - `branches` (sucursales)
      - `id` (integer, primary key) - Manual ID to match external system
      - `code` (text) - Branch code
      - `name` (text) - Branch name
      - `city` (text) - City where branch is located
      - `address` (text) - Branch address
      - `phone` (text) - Branch phone number
      - `email` (text) - Branch email
      - `registration_date` (date) - Date when branch was registered
      - `deregistration_date` (date, nullable) - Date when branch was deregistered
      - `is_active` (boolean) - Whether branch is currently active
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp
      - `created_by` (text) - User who created the record

  2. Security
    - Enable RLS on `branches` table
    - Add policy for authenticated users to read branches
    - Add policy for authenticated users to create/update branches
*/

CREATE TABLE IF NOT EXISTS branches (
  id integer PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  city text,
  address text,
  phone text,
  email text,
  registration_date date,
  deregistration_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read branches"
  ON branches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert branches"
  ON branches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update branches"
  ON branches
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete branches"
  ON branches
  FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branches_updated_at();