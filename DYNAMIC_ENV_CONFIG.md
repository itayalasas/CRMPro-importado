# Sistema de Configuración Dinámica

## Descripción

El sistema de configuración dinámica permite cargar las variables de entorno desde una API externa al inicio de la aplicación, eliminando la necesidad de archivos `.env` estáticos en producción.

## Características

✅ **Carga automática** - Las variables se cargan antes de renderizar la aplicación
✅ **Fallback local** - Si la API falla, usa las variables del archivo `.env` local
✅ **Pantalla de carga** - Muestra feedback visual mientras carga la configuración
✅ **Manejo de errores** - Interfaz amigable para errores de configuración
✅ **Singleton pattern** - Una sola instancia del loader en toda la aplicación

## API de Configuración

### Endpoint
```
GET https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env
```

### Headers
```
X-Access-Key: 05c04864455effee17737adb494eb95db4e30fd7a41fe358eea0fe621b06c67b
```

### Respuesta
```json
{
  "project_name": "CRMProd",
  "description": "CRM Production Environment",
  "variables": {
    "VITE_SUPABASE_ANON_KEY": "...",
    "VITE_SUPABASE_URL": "...",
    "VITE_AUTH_URL": "...",
    "VITE_AUTH_SYSTEM_URL": "...",
    "VITE_AUTH_APP_ID": "...",
    "VITE_AUTH_API_KEY": "...",
    "VITE_APP_URL": "..."
  },
  "updated_at": "2025-10-25T04:48:47.844998+00:00"
}
```

## Arquitectura

### 1. Environment Loader (`src/lib/envLoader.ts`)

Servicio singleton que:
- Carga la configuración desde la API
- Inyecta las variables en `import.meta.env`
- Proporciona fallback a `.env` local
- Expone funciones helper para acceder a las variables

```typescript
import { envLoader, getEnvVar, waitForConfig } from './lib/envLoader';

// Esperar a que se cargue la config
await waitForConfig();

// Obtener una variable
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
```

### 2. Loading Screen (`src/components/Common/LoadingScreen.tsx`)

Componente que muestra:
- Spinner animado
- Mensaje de carga personalizable
- Diseño profesional con gradientes

### 3. Root Component (`src/main.tsx`)

Componente raíz que:
- Carga la configuración antes de renderizar `<App />`
- Muestra `LoadingScreen` durante la carga
- Maneja errores con interfaz de reintentar

## Flujo de Ejecución

```
1. Usuario accede a la aplicación
   ↓
2. React renderiza <Root />
   ↓
3. useEffect carga la configuración (await waitForConfig())
   ↓
4. LoadingScreen visible
   ↓
5. API retorna variables (o fallback a .env)
   ↓
6. Variables inyectadas en import.meta.env
   ↓
7. configLoaded = true
   ↓
8. <App /> se renderiza con configuración lista
```

## Integración en Servicios

### Supabase Client
```typescript
// src/lib/supabase.ts
import { getEnvVar } from './envLoader';

function getSupabaseCredentials() {
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
  // ...
}
```

### External Auth
```typescript
// src/lib/externalAuth.ts
import { getEnvVar } from './envLoader';

function getAuthConfig() {
  return {
    AUTH_URL: getEnvVar('VITE_AUTH_URL'),
    APP_ID: getEnvVar('VITE_AUTH_APP_ID'),
    // ...
  };
}
```

## Desarrollo Local

Para desarrollo local, el archivo `.env` sigue funcionando como fallback:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-key
VITE_AUTH_URL=http://localhost:3000
# ...
```

Si la API no está disponible, el sistema automáticamente usa estas variables.

## Producción

En producción:
1. **NO se necesita archivo `.env`**
2. Todas las variables se cargan desde la API
3. Si la API falla, se muestra error con botón de reintentar
4. Las variables se actualizan sin necesidad de re-deploy

## Ventajas

### 🔒 Seguridad
- Las credenciales no están en el código fuente
- No hay archivos `.env` en el repositorio de producción
- Acceso controlado mediante API key

### 🚀 Flexibilidad
- Cambiar configuración sin re-deploy
- Múltiples ambientes gestionados centralmente
- Actualizaciones en tiempo real

### 🛠️ Mantenimiento
- Configuración centralizada
- Logs de cuándo se actualizó cada variable
- Fácil de auditar y versionar

## Logs de Consola

Durante la carga, verás:
```
🔄 Cargando configuración desde API...
✅ Configuración cargada exitosamente
📦 Proyecto: CRMProd
📝 Descripción: CRM Production Environment
🕒 Última actualización: 25/10/2025, 01:48:47
```

En caso de error:
```
❌ Error cargando configuración desde API: [error]
⚠️ Usando variables de entorno locales (.env) como fallback
```

## Troubleshooting

### La aplicación no carga
- Verificar que la API esté disponible
- Verificar que el `X-Access-Key` sea correcto
- Revisar la consola del navegador para errores

### Variables incorrectas
- Verificar respuesta de la API en Network tab
- Verificar que todas las variables requeridas estén en la respuesta
- Limpiar caché del navegador y recargar

### Desarrollo local no funciona
- Verificar que el archivo `.env` exista
- Verificar que las variables tengan el prefijo `VITE_`
- Reiniciar el servidor de desarrollo (`npm run dev`)

## Archivos Relacionados

- `src/lib/envLoader.ts` - Servicio de carga de configuración
- `src/main.tsx` - Punto de entrada con carga de config
- `src/components/Common/LoadingScreen.tsx` - Pantalla de carga
- `src/lib/supabase.ts` - Cliente Supabase con config dinámica
- `src/lib/externalAuth.ts` - Auth externo con config dinámica
