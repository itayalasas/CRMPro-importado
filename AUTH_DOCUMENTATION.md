# Documentacion del sistema de autenticacion externa

## Resumen

El CRM usa un flujo de autenticacion externo y no depende de Supabase Auth para iniciar sesion.
La base del proveedor se toma desde `VITE_AUTH_URL` y el frontend solo hace estas tareas:

1. Redirige al usuario al login o registro externo.
2. Recibe un `code` temporal en `/callback`.
3. Intercambia ese `code` por `access_token` y `refresh_token`.
4. Guarda la sesion en `localStorage`.
5. Refresca el token cuando expira.

> Nota: el callback valida `state=authenticated` antes de intercambiar el `code`.

---

## Variables de entorno

Estas son las variables que el flujo actual consume o carga por compatibilidad:

```env
VITE_AUTH_URL=https://tu-base-auth-actual
VITE_AUTH_APP_ID=app_xxxxxxxxxxxx
VITE_AUTH_API_KEY=ak_xxxxxxxxxxxx
VITE_APP_URL=https://tuapp.com
VITE_AUTH_CODE_EXCHANGE_URL=https://tu-base-auth-actual/functions/v1/auth-exchange-code
```

### Observaciones

- `VITE_AUTH_URL` es la base real del sistema de auth que ya usas hoy.
- `VITE_APP_URL` se usa para construir el `redirect_uri` del CRM.
- `VITE_AUTH_CODE_EXCHANGE_URL` debe apuntar al endpoint que intercambia el `code` por tokens.
- `VITE_AUTH_SYSTEM_URL` sigue cargandose por `envLoader`, pero hoy no participa en el flujo principal del CRM.

---

## Flujo web recomendado

### 1. Redirigir al usuario a AuthSystem

El CRM construye la URL de auth a partir de la base actual y redirige al usuario.

```ts
// Login
window.location.href = `${AUTH_URL}/login` +
  `?app_id=${encodeURIComponent(APP_ID)}` +
  `&redirect_uri=${encodeURIComponent(`${APP_URL}/callback`)}` +
  `&api_key=${encodeURIComponent(API_KEY)}`;

// Registro
window.location.href = `${AUTH_URL}/register` +
  `?app_id=${encodeURIComponent(APP_ID)}` +
  `&redirect_uri=${encodeURIComponent(`${APP_URL}/callback`)}` +
  `&api_key=${encodeURIComponent(API_KEY)}`;
```

### 2. El usuario completa el formulario

AuthSystem valida credenciales, aplica reglas de acceso y, si corresponde, resuelve MFA antes de volver al CRM.

### 3. AuthSystem redirige al callback del CRM

La respuesta exitosa llega al CRM con un `code` temporal y `state=authenticated`:

```txt
https://tuapp.com/callback?code=AUTH_CODE_UUID&state=authenticated
```

El frontend rechaza cualquier callback que no llegue con `state=authenticated`.

### 4. El CRM intercambia el code por tokens

El handler de callback toma el `code` y lo canjea por tokens contra el endpoint configurado en `VITE_AUTH_CODE_EXCHANGE_URL`.

```ts
const params = new URLSearchParams(window.location.search);
const code = params.get('code');

if (!code) {
  window.location.href = '/login';
  return;
}

const response = await fetch(VITE_AUTH_CODE_EXCHANGE_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code,
    application_id: VITE_AUTH_APP_ID
  })
});
```

### 5. Reconstruir la sesion local

Cuando el intercambio es exitoso, el CRM guarda la sesion local y sincroniza el usuario con Supabase.

```ts
localStorage.setItem('auth_token', data.data.access_token);
localStorage.setItem('refresh_token', data.data.refresh_token);
localStorage.setItem('user_id', data.data.user.id);
localStorage.setItem('auth_user', JSON.stringify(user));
```

Despues, el flujo actual hace un `upsert` en `profiles` y redirige a `/`.

### 6. Validar y refrescar

La validez del token se decide en frontend con la fecha `exp` del JWT.
Si expiro y existe `refresh_token`, se llama a:

```txt
POST ${VITE_AUTH_URL}/refresh
```

con:

```json
{
  "app_id": "app_xxxxxxxxxxxx",
  "api_key": "ak_xxxxxxxxxxxx"
}
```

Si el refresh falla, la sesion se limpia y el usuario vuelve a login.

---

## Mapa de paths

Este mapa traduce el ejemplo de documentacion al comportamiento actual del repo.

| Ejemplo en la doc | Implementacion actual |
| --- | --- |
| `https://celadon-begonia-d7eb0e.netlify.app/login` | `VITE_AUTH_URL + '/login'` |
| `https://celadon-begonia-d7eb0e.netlify.app/register` | `VITE_AUTH_URL + '/register'` |
| `https://tuapp.com/callback` | Ruta local del CRM: `/callback` y tambien `/auth/callback` |
| `https://celadon-begonia-d7eb0e.netlify.app/functions/v1/auth-exchange-code` | `VITE_AUTH_CODE_EXCHANGE_URL` |
| `https://celadon-begonia-d7eb0e.netlify.app/functions/v1/auth-verify-token` | No se usa hoy en el CRM principal; si existe, queda como extension futura |

---

## Estructura del token JWT

El frontend actual consume este contrato minimo:

```json
{
  "sub": "user_123",
  "email": "usuario@ejemplo.com",
  "name": "Usuario Ejemplo",
  "app_id": "app_xxxxxxxxxxxx",
  "role": "administrador",
  "permissions": {
    "dashboard": ["read", "create", "update"],
    "clientes": ["read"]
  },
  "iat": 1234567890,
  "exp": 1234654290,
  "iss": "AuthSystem",
  "aud": "tuapp.com"
}
```

### Campos que usa hoy el CRM

- `sub`: id del usuario.
- `email`: correo del usuario.
- `name`: nombre del usuario.
- `app_id`: identificador de la aplicacion.
- `role`: rol principal.
- `permissions`: permisos por modulo.
- `iat`: fecha de emision.
- `exp`: fecha de expiracion.
- `iss`: emisor.
- `aud`: audiencia.

### Importante sobre permisos

El CRM espera permisos por modulo, por ejemplo:

```json
{
  "clientes": ["read", "create"],
  "tickets": ["read", "update"]
}
```

Es decir, no usa un array simple de permisos globales, sino un mapa por modulo.

### Campos opcionales del backend

El backend puede devolver campos extra como `roles`, `permissions_hierarchy`, `environment`, `tenant_id`, `tenant_name` o `has_access`.
Hoy el frontend no los consume directamente, asi que pueden existir sin romper el flujo.

---

## Archivos clave

### `src/lib/envLoader.ts`

Carga la configuracion dinamica y la inyecta en `import.meta.env`.

### `src/components/Auth/LoginForm.tsx`

Construye la URL de login o registro y redirige al proveedor externo.

### `src/components/Auth/CallbackHandler.tsx`

Procesa el callback, intercambia el `code`, valida expiracion, guarda la sesion y sincroniza `profiles`.

### `src/lib/externalAuth.ts`

Servicio central de auth del CRM:

- redireccion al login externo
- intercambio de `code`
- decode del JWT
- refresh de token
- logout
- almacenamiento en `localStorage`

### `src/contexts/AuthContext.tsx`

Reconstruye el estado de autenticacion al arrancar la app y expone `signIn`, `signOut` y `refreshToken`.

### `src/lib/supabase.ts`

Decide si usa el cliente base o un cliente autenticado. Hoy solo adjunta el
`Authorization: Bearer ...` cuando el JWT parece emitido por Supabase; si no,
cae al cliente anonimo base.

---

## Flujo real de sesion en el CRM

1. El usuario entra a `/login`.
2. El boton redirige a `VITE_AUTH_URL`.
3. AuthSystem devuelve un `code` a `/callback`.
4. El CRM cambia ese `code` por tokens.
5. Se guarda `auth_token`, `refresh_token`, `user_id` y `auth_user`.
6. `AuthContext` valida si hay sesion y refresca si hace falta.
7. `ProtectedRoute` permite entrar al dashboard.

---

## Notas de compatibilidad

- El CRM principal usa `auth_user` como clave de usuario autenticado.
- El flujo publico de auth en `PublicAuthForms.tsx` guarda `user_data`, pero no es el camino que usa `AuthContext` hoy.
- Si quieres unificar ambos flujos, conviene normalizar esa salida a `auth_user`.
- La documentacion de ejemplo que usa `auth-verify-token` puede seguir como referencia, pero no es parte del flujo actual del CRM.

---

## Testing rapido

1. Ejecuta la app.
2. Ve a `/login`.
3. Redirige al sistema externo.
4. Completa login o registro.
5. Verifica que vuelvas a `/callback?code=...`.
6. Confirma que el CRM guarda `auth_token` y `auth_user`.
7. Revisa que la app entra a `/`.

## Verificacion manual del JWT

```js
const token = localStorage.getItem('auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

---

## Soporte

Para integrar un nuevo backend de auth o cambiar el contrato de claims, los puntos a tocar son:

- `src/lib/externalAuth.ts`
- `src/components/Auth/CallbackHandler.tsx`
- `src/contexts/AuthContext.tsx`
- `src/lib/supabase.ts`
