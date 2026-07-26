/*
  # Create FreePBX Configuration Table

  1. New Tables
    - `freepbx_config`
      - `id` (uuid, primary key) - Unique identifier
      - `provider` (text) - Fixed identifier, 'freepbx'
      - `sip_domain` (text) - SIP domain of the FreePBX server (e.g. pbx.sendcraft.net)
      - `websocket_url` (text) - WebSocket URL for SIP over WSS (e.g. wss://pbx.sendcraft.net:8089/ws)
      - `default_country_code` (text) - Default dialing country code (e.g. 598) used to normalize numbers without a leading +
      - `outbound_caller_id` (text) - Caller ID presented on outbound calls
      - `stun_server` (text) - STUN server used for ICE candidate gathering
      - `is_active` (boolean) - Whether this configuration is the active one
      - `is_default_provider` (boolean) - Whether FreePBX (instead of Twilio) should be used as the calling provider
      - `created_at` / `updated_at` (timestamptz)
      - `created_by` / `updated_by` (text) - User who created/updated the configuration

  2. Security
    - Disable RLS for external auth compatibility (same as twilio_config)
    - Only store one active configuration at a time
*/

CREATE TABLE IF NOT EXISTS freepbx_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'freepbx',
  sip_domain text NOT NULL,
  websocket_url text NOT NULL,
  default_country_code text NOT NULL DEFAULT '',
  outbound_caller_id text,
  stun_server text,
  is_active boolean DEFAULT true,
  is_default_provider boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text
);

CREATE INDEX IF NOT EXISTS idx_freepbx_config_active ON freepbx_config(is_active) WHERE is_active = true;

ALTER TABLE freepbx_config DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_freepbx_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_freepbx_config_updated_at
  BEFORE UPDATE ON freepbx_config
  FOR EACH ROW
  EXECUTE FUNCTION update_freepbx_config_updated_at();

CREATE OR REPLACE FUNCTION ensure_single_active_freepbx_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE freepbx_config
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_active_freepbx_config
  BEFORE INSERT OR UPDATE ON freepbx_config
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_freepbx_config();
