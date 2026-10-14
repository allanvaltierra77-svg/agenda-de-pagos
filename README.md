# Mi Agenda de Pagos — MVP

Panel familiar de pagos en HTML/CSS/JavaScript, preparado para GitHub Pages y Supabase.

## Lo que funciona en esta primera entrega
- Dashboard con totales de pagos pendientes, vencidos y pagados este mes.
- Gráfica de estado de pagos.
- Calendario mensual de vencimientos.
- Alta y edición de pagos.
- Frecuencia: una sola vez, quincenal, mensual o personalizada (en esta versión se registra la frecuencia; la generación automática de siguientes vencimientos se implementará después).
- Marcar pago como realizado y conservarlo en el historial.
- Exportar historial a CSV.
- Diseño adaptable a computadora y celular.
- Datos de demostración guardados en el navegador local.

## Importante antes de usar con datos reales
**La primera versión es una demostración local.** Los datos solo se guardan en el navegador y no se sincronizan entre dispositivos. No introduzcas información bancaria sensible. La conexión de Supabase todavía no está implementada en `app.js`.

## Archivos
- `index.html`: estructura de la aplicación.
- `styles.css`: diseño adaptable.
- `app.js`: comportamiento y datos de demostración.
- `supabase/schema.sql`: propuesta inicial de tablas y políticas RLS.

## Probar en tu computadora
1. Descomprime el ZIP.
2. Abre `index.html` en Chrome o Edge.
3. Prueba “Nuevo pago”, “Ya pagué”, calendario, historial y exportación CSV.
4. Los cambios se guardan solo en ese navegador mediante `localStorage`.

La gráfica usa Chart.js y la etiqueta de Supabase usa su librería CDN; se requiere conexión a internet para cargar esas librerías.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo y privado o público según tu preferencia. Recuerda: GitHub Pages publica el contenido del sitio, aunque el repositorio sea privado algunas funciones pueden depender del plan.
2. Sube `index.html`, `styles.css`, `app.js` y la carpeta `supabase` al repositorio.
3. En Settings → Pages, selecciona la rama principal y la carpeta raíz.
4. Abre la URL que GitHub Pages genere.

No subas contraseñas, tokens privados ni claves `service_role` al repositorio.

## Siguiente fase: Supabase
1. Crea un proyecto Supabase.
2. Revisa y ejecuta `supabase/schema.sql` en SQL Editor.
3. Crea dos usuarios en Authentication.
4. Crea un hogar y agrega los dos usuarios a `household_members` usando un procedimiento administrativo seguro.
5. Configura `SUPABASE_URL` y la clave publicable/anon en el frontend. Estas dos variables no sustituyen las políticas RLS.
6. Implementa las operaciones de lectura/escritura con sesión iniciada y valida las políticas con ambos usuarios antes de cargar datos reales.

**No uses la clave `service_role` en el navegador.** Esa clave omite controles RLS y debe permanecer en un entorno de servidor.

## Siguiente fase: WhatsApp
- Usar WhatsApp Business Platform o un proveedor autorizado.
- Guardar el token únicamente como secreto del servidor.
- Programar una función segura para consultar vencimientos y enviar avisos al número confirmado de tu papá.
- Registrar cada recordatorio enviado para evitar duplicados.
- No enviar avisos hasta confirmar consentimiento, número y plantillas necesarias.

## Pendientes conocidos de este MVP
- Sin autenticación ni sincronización en nube todavía.
- No envía WhatsApp ni notificaciones push.
- La frecuencia quincenal/mensual se guarda, pero todavía no crea automáticamente la siguiente ocurrencia.
- Los pagos marcados como realizados permanecen en el registro; la fase siguiente normalizará las ocurrencias recurrentes y su historial.
- Las políticas RLS deben probarse con los dos usuarios y completarse con un flujo de creación de hogar/membresías antes de producción.
