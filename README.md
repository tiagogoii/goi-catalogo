# Catálogo de motos Honda · GOI S.A.

Landing estática del catálogo, publicada en **https://catalogo.goi-sa.com.ar**. HTML y CSS planos: no hay servidor ni base de datos, y se aloja gratis en GitHub Pages.

## Cómo está armado

| Carpeta / archivo | Qué es |
|---|---|
| `data/site.json` | Textos de la portada, bloques, datos de contacto (WhatsApp, teléfono, mail, dirección) y aviso legal. **Es lo que se edita para cambiar textos.** |
| `data/models.json` | Las 27 motos: fotos, precio sugerido con su vigencia, características y ficha técnica. |
| `scripts/build.mjs` | Genera `index.html` y una página por moto (`modelos/<moto>/`), más `sitemap.xml`, `robots.txt` y `CNAME`. |
| `assets/` | Estilos, JavaScript, fuentes y logo. |
| `scripts/honda-catalog/` | Trae de nuevo los datos de motos.honda.com.ar (precios del mes, fichas). |
| `scripts/serve.mjs` | Servidor local para revisar antes de publicar. |

Las carpetas `modelos/` y los archivos `index.html`, `404.html`, `sitemap.xml` están **generados**: no se editan a mano, se vuelven a generar.

## Cambiar algo

```bash
# 1) editar data/site.json (textos, contacto) o data/models.json (un precio, una foto)
# 2) regenerar las páginas
node scripts/build.mjs
# 3) revisar en http://localhost:5200
node scripts/serve.mjs
# 4) publicar
git add -A && git commit -m "Actualiza catálogo" && git push
```

GitHub Pages publica solo al hacer `push` a `main` (tarda un par de minutos).

## Precios

Honda publica un **precio sugerido** para cada moto con fecha de vigencia (hoy, hasta fin de mes). Cuando la fecha pasa, la página deja de mostrar el precio y dice «Consultá el precio vigente», tanto al generar las páginas como en el navegador de quien las abre.
Para poner un precio propio de GOI, en `data/models.json` cambiá `versions[].price` y dejá `price_valid_to` vacío (`""`): sin fecha, el precio no vence.

Actualizar los precios del mes desde Honda:

```powershell
$work = "$env:TEMP\honda"; New-Item -ItemType Directory -Force $work | Out-Null
node scripts/honda-catalog/scrape.mjs "$work\honda-raw.json"   # páginas y fichas PDF (~95 MB); necesita pdftotext (viene con Git for Windows)
node scripts/honda-catalog/build.mjs $work data/models.json
node scripts/build.mjs
```

## Fotos y datos de Honda

- Las fotos se enlazan directo desde motos.honda.com.ar (no se copian). Si Honda cambia una dirección, esa foto deja de verse; en ese caso conviene subir fotos propias a la carpeta `assets/img/` y poner la ruta (`/assets/img/foto.jpg`) en `data/models.json`.
- La Wave 110S no tiene ficha técnica publicada en la web de Honda; queda sin tabla hasta que se cargue a mano.
- Los modelos con versión E-Clutch y MT muestran una sola tabla, y lo que cambia aparece como `E-Clutch: … / MT: …`.

## Formulario de cotización

No hay servidor: el formulario arma el mensaje y abre WhatsApp con el texto listo. Nada se guarda en esta página.

## Dominio

`CNAME` contiene `catalogo.goi-sa.com.ar`. En el DNS de `goi-sa.com.ar` hay que crear un registro **CNAME** con nombre `catalogo` que apunte a `<usuario-de-github>.github.io`.
