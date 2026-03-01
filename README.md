# AuthSystem Public Forms

Este es un proyecto standalone de formularios públicos para AuthSystem.

## Deployment

Este proyecto está configurado para deployarse automáticamente en Netlify.

## Configuración

La configuración de la aplicación está embebida en el archivo `src/lib/config.ts`:

- apiBaseUrl: URL de la API pública de AuthSystem
- appId: ID de la aplicación
- apiKey: API key de la aplicación

## Rutas

- `/login` - Formulario de inicio de sesión
- `/register` - Formulario de registro
- `/reset-password` - Formulario de recuperación de contraseña

Todas las rutas requieren los parámetros `app_id` y `api_key` en la URL.
