# Catálogo de motos Honda · GOI S.A.

Catálogo online de motos con fotos, precio sugerido y ficha técnica, y un **panel de administración** para manejarlo sin tocar código.
Corre en Cloudflare (Pages + base de datos D1, plan gratuito). El panel está en `/admin/`.

## Qué se maneja desde el panel

- **Motos:** nombre, frase corta, grupo del filtro de la portada (Ciudad, Aventura…), versiones y precios, vigencia del precio, foto principal (se sube desde la compu y se achica sola), otras fotos, ficha técnica y si la moto está visible. «Cargar fichas oficiales Honda» trae las 27 motos de motos.honda.com.ar sin pisar lo que ya editaste.
- **Precios del mes:** una sola pantalla con todas las motos para actualizar los precios y la fecha de vigencia de una vez. Cuando pasa la vigencia, el catálogo deja de mostrar el precio y dice «Consultá el precio vigente». Un precio con vigencia vacía no vence (sirve para precios propios de GOI).
- **Textos del sitio:** contacto (WhatsApp, teléfono, correo, dirección, Instagram), portada, los tres bloques, formulario de cotización, aviso legal y orden de los filtros.

## Cómo está armado

| Parte | Dónde |
|---|---|
| Páginas públicas (se arman en el servidor con los datos actuales) | `functions/index.js`, `functions/modelos/[slug].js`, `src/render.js` |
| Estilos, scripts del navegador, fuentes y logo | `public/assets/` |
| Panel de administración | `public/admin/` y `public/assets/admin.js` |
| API del panel | `functions/api/admin/` |
| Base de datos (motos, textos, fotos) | `migrations/0001_catalogo.sql` |
| Datos oficiales de Honda para la primera carga | `data/models.json` (se genera con `scripts/honda-catalog/`) |
| Pruebas | `tests/flow.test.mjs` |

Los cambios del panel se ven en el catálogo en menos de un minuto.

## Probar en tu computadora

```bash
npm install
npm run db:local        # crea la base local
npm run dev             # http://localhost:8789  (panel en /admin/)
npm test                # pruebas, con el servidor encendido
```

Necesita un archivo `.dev.vars` (no se sube a GitHub) con `ADMIN_PASSWORD=` y `SESSION_SECRET=`.

## Publicar (Cloudflare)

1. `npx wrangler login`
2. `npx wrangler d1 create goi-catalogo` → pegar el `database_id` en `wrangler.toml`.
3. `npm run db:remote`
4. `npx wrangler pages project create goi-catalogo --production-branch main`
5. Cargar los secretos `ADMIN_PASSWORD` (la clave del panel) y `SESSION_SECRET` (texto largo al azar) con `npx wrangler pages secret put NOMBRE --project-name goi-catalogo`.
6. `npm run deploy`
7. Entrar al panel y apretar «Cargar fichas oficiales Honda».
8. Dominio: en Cloudflare → goi-catalogo → Custom domains, agregar el dominio y crear el CNAME en el DNS.

Para actualizar el código: `npm run deploy`. Los cambios de contenido se hacen desde el panel, no hace falta publicar.

## Datos de Honda

- Las fotos se enlazan directo desde motos.honda.com.ar. Si Honda cambia una dirección, esa foto deja de verse: en el panel se puede subir una foto propia como foto principal.
- La Wave 110S no tiene ficha técnica publicada por Honda: se puede cargar a mano desde el panel.
- Los modelos con versión E-Clutch y MT muestran una sola tabla, y lo que cambia aparece como `E-Clutch: … / MT: …`.
- Para traer de nuevo los datos de Honda (por ejemplo si lanzan modelos): `scripts/honda-catalog/README.md`.

## Seguridad

- La clave del panel y el secreto de sesión viven solo en Cloudflare. La sesión es una cookie firmada de 8 horas, `HttpOnly` y `SameSite=Strict`.
- Los textos que se cargan en el panel se muestran siempre como texto, nunca como HTML.
- Las páginas bloquean scripts y estilos de otros sitios.
- Las fotos subidas se validan por su contenido (JPG, PNG o WebP).

## Formulario de cotización

No guarda datos: arma el mensaje y abre WhatsApp con el texto listo.
