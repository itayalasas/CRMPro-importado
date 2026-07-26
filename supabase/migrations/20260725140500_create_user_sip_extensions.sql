/*
  # Create User SIP Extensions Table

  1. New Tables
    - `user_sip_extensions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references system_users) - Owner of this extension
      - `sip_extension` (text) - SIP extension number, e.g. 200
      - `sip_auth_user` (text) - SIP authentication username (usually equal to the extension)
      - `sip_password` (text) - SIP secret configured in FreePBX
      - `display_name` (text) - Agent display name shown to the far end
      - `is_active` (boolean)
      - `created_at` / `updated_at` (timestamptz)
      - `created_by` (text)

  2. Security
    - Disable RLS for external auth compatibility (same as twilio_config / freepbx_config)
    - One extension per user (unique user_id)

  3. Notes
    - The SIP domain and WebSocket server are not duplicated here; they come from the
      single active row in `freepbx_config`.
*/

CREATE TABLE IF NOT EXISTS user_sip_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  sip_extension text NOT NULL,
  sip_auth_user text NOT NULL,
  sip_password text NOT NULL,
  display_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sip_extensions_user_id ON user_sip_extensions(user_id);

ALTER TABLE user_sip_extensions DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_user_sip_extensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_sip_extensions_updated_at
  BEFORE UPDATE ON user_sip_extensions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sip_extensions_updated_at();
