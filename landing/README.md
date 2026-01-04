# Cianbox POS - Landing Page

Landing page de alta conversion para el sistema POS integrado con Cianbox ERP.

## Estructura de Archivos

```
landing/
├── index.html      # Estructura HTML de la landing
├── styles.css      # Estilos CSS (mobile-first, responsive)
├── script.js       # Interactividad y funcionalidades
├── COPY.md         # Documento con todos los textos
└── README.md       # Este archivo
```

## Visualizar la Landing

Simplemente abrir `index.html` en un navegador moderno. No requiere servidor.

Para desarrollo con recarga automatica, se puede usar cualquier servidor estatico:

```bash
# Con Python 3
python -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

## Secciones Incluidas

1. **Header/Nav** - Navegacion fija con menu responsive
2. **Hero** - Propuesta de valor principal con CTA
3. **Problema** - Pain points del usuario objetivo
4. **Solucion** - Presentacion del producto
5. **Funcionalidades** - 8 features principales
6. **Como Funciona** - Proceso de 3 pasos
7. **Beneficios** - Ventajas con estadisticas
8. **Precios** - 3 planes (Starter, Pro, Enterprise)
9. **FAQ** - 6 preguntas frecuentes con acordeon
10. **CTA Final** - Formulario de contacto/demo
11. **Footer** - Links y copyright

## Caracteristicas Tecnicas

### HTML
- Semantico (header, main, section, footer)
- SEO optimizado (meta tags, Open Graph, Twitter Card)
- Accesible (aria labels, roles)

### CSS
- Variables CSS para facil personalizacion
- Mobile-first responsive design
- Animaciones suaves
- Sistema de grid moderno

### JavaScript
- Sin dependencias externas
- Menu mobile funcional
- FAQ acordeon
- Smooth scroll
- Form validation
- Animaciones on scroll

## Personalizacion

### Colores
Editar las variables CSS en `:root` de `styles.css`:

```css
:root {
    --color-primary: #2563eb;       /* Azul principal */
    --color-secondary: #0f172a;     /* Texto oscuro */
    --color-accent: #06b6d4;        /* Cyan accent */
}
```

### Precios
Los precios estan en ARS y pueden editarse directamente en el HTML:

```html
<span class="pricing-card__amount">15.000</span>
```

### Formulario de Contacto
El formulario actualmente muestra un mensaje de exito. Para conectar con un backend real, editar la funcion `initContactForm()` en `script.js`.

## Assets Necesarios

Para una version de produccion, necesitaras:

1. **Logo** - Actualmente usa un placeholder CSS
2. **Favicon** - Actualmente usa un SVG inline
3. **Open Graph Image** - Imagen para compartir en redes (1200x630px)
4. **Screenshots/Mockups** - Capturas reales del producto

## SEO Checklist

- [x] Meta title y description
- [x] Open Graph tags
- [x] Twitter Card tags
- [x] Estructura semantica (h1, h2, h3)
- [x] Alt text en imagenes (agregar cuando se incluyan)
- [ ] Sitemap.xml (generar al deployar)
- [ ] robots.txt (agregar al deployar)
- [ ] Schema.org markup (opcional)

## Performance

- Tipografia cargada via Google Fonts (Inter)
- CSS minimo (~15KB)
- JavaScript sin dependencias (~5KB)
- Sin imagenes pesadas (usar WebP/AVIF en produccion)

## Deployment

### Produccion Actual

La landing esta desplegada en:

| Entorno | URL |
|---------|-----|
| **Produccion** | https://cianbox-pos-point.ews-cdn.link/landing |

### Servidor

- **Servidor:** 172.16.1.61 (cianbox-pos-app)
- **Ruta:** `/var/www/cianbox-pos/landing`
- **Nginx:** Configurado como location `/landing` en el server principal (puerto 80)

### Deploy Manual

```bash
# Subir archivos al servidor
scp -i "ssh key/root_servers_ssh_key" -r landing/* root@172.16.1.61:/var/www/cianbox-pos/landing/

# Verificar
curl -I https://cianbox-pos-point.ews-cdn.link/landing/
```

### Configuracion Nginx

La landing se sirve desde el mismo server block que el POS frontend:

```nginx
# En /etc/nginx/sites-available/cianbox-pos
location /landing {
    alias /var/www/cianbox-pos/landing;
    index index.html;
    try_files $uri $uri/ /landing/index.html;
}
```

## Metricas Sugeridas

Para tracking de conversiones:

1. **Google Analytics 4** - Eventos de scroll, clics en CTA
2. **Hotjar/Microsoft Clarity** - Heatmaps y grabaciones
3. **Form submissions** - Tracking de leads generados

## Proximos Pasos

1. [ ] Agregar imagenes/screenshots reales del producto
2. [ ] Conectar formulario a CRM o email
3. [ ] Agregar tracking de analytics
4. [ ] A/B testing de headlines
5. [ ] Agregar testimonios de clientes reales
6. [ ] Crear versiones para campanas especificas
