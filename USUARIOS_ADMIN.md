# Apartado Usuarios

Copiar este parche sobre la raíz del proyecto y aceptar reemplazos.

Luego copiar el contenido de `admin-users-styles.css` al final de `app/globals.css`.

Reiniciar:

```bat
Ctrl + C
npm run dev
```

Ingresar a:

```text
http://localhost:3000/admin/usuarios
```

Funciones incluidas:

- Listar usuarios de Supabase Auth.
- Crear usuarios con correo y contraseña desde el panel.
- Elegir rol `Administrador` o `Usuario`.
- Activar o desactivar cuentas.
- Cambiar nombre, rol y contraseña.
- Protección de las operaciones para administradores autenticados.

La clave `SUPABASE_SECRET_KEY` debe permanecer únicamente en `.env.local` y nunca llevar el prefijo `NEXT_PUBLIC_`.
