/*
  # Baja pública de comunicaciones (unsubscribe)

  ## Why
  Se necesita una página pública (sin login) donde un contacto pueda darse de baja
  de las comunicaciones de campañas. `contacts` tiene RLS habilitado con políticas
  restringidas a `authenticated` + `auth.uid() = created_by` — no hay ninguna policy
  para `anon`, y agregar un `USING (true)` para anon expondría toda la tabla (emails,
  teléfonos, empresas de TODOS los contactos) a cualquiera con el anon key público del
  bundle del frontend.

  En vez de abrir RLS, se exponen dos funciones `SECURITY DEFINER` bien acotadas:
  - `get_contact_for_unsubscribe(uuid)`: devuelve solo email/status/nombre de grupo
    de UN contacto puntual (el id ya funciona como token no adivinable, viene del link
    del email).
  - `unsubscribe_contact(uuid)`: marca ese contacto como 'unsubscribed'. El flujo de
    envío de campañas (supabase/functions/send-campaign-emails) ya filtra
    `contacts.status = 'active'` al resolver destinatarios por grupo, así que un
    contacto dado de baja queda excluido automáticamente de futuros envíos de ese
    grupo sin perder su historial de pertenencia.

  Ninguna de las dos funciones expone más que exactamente lo necesario, y ninguna
  permite listar ni buscar contactos por email/nombre — solo lookup exacto por id.
*/

CREATE OR REPLACE FUNCTION public.get_contact_for_unsubscribe(p_contact_id uuid)
RETURNS TABLE(email text, status text, group_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.email, c.status, cg.name
  FROM contacts c
  LEFT JOIN contact_groups cg ON cg.id = c.group_id
  WHERE c.id = p_contact_id;
$$;

CREATE OR REPLACE FUNCTION public.unsubscribe_contact(p_contact_id uuid)
RETURNS TABLE(email text, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE contacts
  SET status = 'unsubscribed', updated_at = now()
  WHERE id = p_contact_id
  RETURNING contacts.email, contacts.status;
$$;

REVOKE ALL ON FUNCTION public.get_contact_for_unsubscribe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unsubscribe_contact(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_contact_for_unsubscribe(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_contact(uuid) TO anon, authenticated;

INSERT INTO template_variables (name, key, description, default_value, example) VALUES
  ('Link de Baja', 'unsubscribe_url', 'URL pública para que el contacto se dé de baja de las comunicaciones', '#', 'https://tuapp.com/desuscribir/uuid-del-contacto')
ON CONFLICT (key) DO NOTHING;
