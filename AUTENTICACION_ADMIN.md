# Corrección de autenticación del CRM

Copiar estos archivos sobre la raíz del proyecto y aceptar reemplazos.

Luego reiniciar el servidor:

```bat
Ctrl + C
npm run dev
```

Prueba:

1. Abrir `http://localhost:3000/admin`.
2. Si no hay sesión, debe redirigir a `/admin/login`.
3. Ingresar con el usuario administrador creado en Supabase.
4. Pulsar **Cerrar sesión**.
5. Debe volver a `/admin/login` y bloquear nuevamente `/admin`.

Si el usuario puede iniciar sesión pero vuelve al login con `sin-permisos`, revisar en Supabase → Table Editor → `profiles` que:

- `role` sea `admin`
- `active` sea `true`
