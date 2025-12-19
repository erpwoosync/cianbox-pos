# Infraestructura de Produccion - Cianbox POS

## Resumen de Servidores

| Servidor | IP | Hostname | Rol | OS |
|----------|-----|----------|-----|-----|
| APP Server | 172.16.1.61 | cianbox-pos-app | Backend + Frontend + Runner | Debian 12 (bookworm) |
| DB Server | 172.16.1.62 | cianbox-pos-db1 | PostgreSQL | Debian 12 (bookworm) |

## Diagrama de Arquitectura

```
                         ┌─────────────────────────────────────────┐
                         │            172.16.1.61                  │
                         │          cianbox-pos-app                │
                         │                                         │
    Internet ──────────► │  ┌─────────────────────────────────┐   │
                         │  │           NGINX                  │   │
                         │  │                                  │   │
                         │  │  :80   → Frontend POS            │   │
                         │  │  :8083 → Agency Backoffice       │   │
                         │  │  :8084 → Backoffice Admin        │   │
                         │  │                                  │   │
                         │  │  /api/ → proxy :3001             │   │
                         │  └──────────────┬──────────────────┘   │
                         │                 │                       │
                         │  ┌──────────────▼──────────────────┐   │
                         │  │     PM2: cianbox-pos-api        │   │
                         │  │     Node.js 20.19.6             │   │
                         │  │     Puerto: 3001                │   │
                         │  └──────────────┬──────────────────┘   │
                         │                 │                       │
                         │  ┌──────────────────────────────────┐  │
                         │  │     GitHub Actions Runner        │  │
                         │  │     /opt/actions-runner          │  │
                         │  └──────────────────────────────────┘  │
                         └─────────────────┬───────────────────────┘
                                           │
                         ┌─────────────────▼───────────────────────┐
                         │            172.16.1.62                  │
                         │          cianbox-pos-db1                │
                         │                                         │
                         │  ┌──────────────────────────────────┐  │
                         │  │     PostgreSQL 15.14             │  │
                         │  │     Puerto: 5432                 │  │
                         │  │     DB: cianbox_pos              │  │
                         │  │     User: cianbox_pos            │  │
                         │  └──────────────────────────────────┘  │
                         └─────────────────────────────────────────┘
```

## Conexion SSH

### Credenciales

- **Usuario:** root
- **Autenticacion:** Clave SSH (RSA 4096-bit)
- **Archivo de clave:** `ssh key/root_servers_ssh_key`

### Comandos de Conexion

#### Windows (PowerShell/CMD)

```powershell
# Conectar al servidor de aplicacion
ssh -i "C:\Users\gabri\Drive\Carpetas\Documentos\GitHub\cianbox-pos\ssh key\root_servers_ssh_key" root@172.16.1.61

# Conectar al servidor de base de datos
ssh -i "C:\Users\gabri\Drive\Carpetas\Documentos\GitHub\cianbox-pos\ssh key\root_servers_ssh_key" root@172.16.1.62
```

#### Linux/Mac

```bash
# Dar permisos correctos a la clave (solo primera vez)
chmod 600 "ssh key/root_servers_ssh_key"

# Conectar al servidor de aplicacion
ssh -i "ssh key/root_servers_ssh_key" root@172.16.1.61

# Conectar al servidor de base de datos
ssh -i "ssh key/root_servers_ssh_key" root@172.16.1.62
```

### Configuracion SSH Config (Recomendado)

Agregar al archivo `~/.ssh/config` para conexiones mas sencillas:

```
# Servidor de Aplicacion Cianbox POS
Host cianbox-app
    HostName 172.16.1.61
    User root
    IdentityFile C:\Users\gabri\Drive\Carpetas\Documentos\GitHub\cianbox-pos\ssh key\root_servers_ssh_key
    IdentitiesOnly yes

# Servidor de Base de Datos Cianbox POS
Host cianbox-db
    HostName 172.16.1.62
    User root
    IdentityFile C:\Users\gabri\Drive\Carpetas\Documentos\GitHub\cianbox-pos\ssh key\root_servers_ssh_key
    IdentitiesOnly yes
```

Con esta configuracion:

```bash
ssh cianbox-app    # Servidor de aplicacion
ssh cianbox-db     # Servidor de base de datos
```

---

## Servidor de Aplicacion (172.16.1.61)

### Informacion del Sistema

| Campo | Valor |
|-------|-------|
| Hostname | cianbox-pos-app |
| OS | Debian GNU/Linux 12 (bookworm) |
| Kernel | Linux 6.8.12-13-pve (Proxmox) |
| Node.js | 20.19.6 |

### Servicios y Puertos

| Servicio | Puerto | Descripcion |
|----------|--------|-------------|
| Nginx | 80 | Frontend POS (proxy /api/ → :3001) |
| Nginx | 8083 | Agency Backoffice |
| Nginx | 8084 | Backoffice Admin |
| PM2 (cianbox-pos-api) | 3001 | Backend API Node.js |
| Node (otro proceso) | 3000 | (proceso secundario) |
| SSH | 22 | Acceso remoto |
| GitHub Runner | - | CI/CD self-hosted |

### Estructura de Directorios y Despliegue

```
/var/www/cianbox-pos/
│
├── frontend/                      # ★ POS Frontend (Puerto 80)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js                      # Service Worker (PWA)
│   ├── offline.html
│   └── assets/                    # JS, CSS, imagenes
│
├── apps/
│   ├── backend/                   # ★ Backend API (Puerto 3001)
│   │   ├── dist/                  # Build compilado (PM2 ejecuta esto)
│   │   ├── src/                   # Codigo fuente TypeScript
│   │   ├── prisma/                # Schema y migraciones
│   │   ├── node_modules/
│   │   ├── .env                   # Variables de entorno
│   │   └── package.json
│   │
│   ├── agency/                    # ★ Agency Backoffice (Puerto 8083)
│   │   └── dist/
│   │       ├── index.html
│   │       └── assets/
│   │
│   ├── backoffice/                # ★ Client Backoffice (Puerto 8084)
│   │   └── dist/
│   │       ├── index.html
│   │       └── assets/
│   │
│   └── frontend/                  # (dev/legacy - no usado en prod)
│       ├── src/
│       └── dist/

/opt/actions-runner/               # GitHub Actions Runner
├── _work/                         # Workspace de builds
├── .runner                        # Configuracion del runner
└── svc.sh                         # Script de control del servicio

/var/log/pm2/                      # Logs de PM2
├── cianbox-pos-error-0.log
└── cianbox-pos-out-0.log
```

### Mapeo de Aplicaciones

| App | Puerto | Root Nginx | Contenido |
|-----|--------|------------|-----------|
| **POS Frontend** | 80 | `/var/www/cianbox-pos/frontend` | SPA React (PWA) |
| **Agency Backoffice** | 8083 | `/var/www/cianbox-pos/apps/agency/dist` | SPA React |
| **Client Backoffice** | 8084 | `/var/www/cianbox-pos/apps/backoffice/dist` | SPA React |
| **Backend API** | 3001 | N/A (PM2) | Node.js Express |

### PM2 - Gestion del Backend

```bash
# Ver estado
pm2 status
pm2 show cianbox-pos-api

# Ver logs
pm2 logs cianbox-pos-api
pm2 logs cianbox-pos-api --lines 100

# Reiniciar
pm2 restart cianbox-pos-api

# Recargar sin downtime
pm2 reload cianbox-pos-api

# Detener/Iniciar
pm2 stop cianbox-pos-api
pm2 start cianbox-pos-api

# Limpiar logs
pm2 flush
```

### GitHub Actions Runner

El servidor tiene un **self-hosted runner** configurado para CI/CD automatico.

| Campo | Valor |
|-------|-------|
| Nombre | cianbox-pos-runner |
| Ruta | /opt/actions-runner |
| Repositorio | github.com/erpwoosync/cianbox-pos |
| Pool | Default |
| Servicio | actions.runner.erpwoosync-cianbox-pos.cianbox-pos-runner |

#### Comandos del Runner

```bash
# Ver estado del servicio
systemctl status actions.runner.erpwoosync-cianbox-pos.cianbox-pos-runner

# Reiniciar runner
systemctl restart actions.runner.erpwoosync-cianbox-pos.cianbox-pos-runner

# Ver logs
journalctl -u actions.runner.erpwoosync-cianbox-pos.cianbox-pos-runner -f

# Desde el directorio del runner
cd /opt/actions-runner
./svc.sh status
./svc.sh restart
```

### Nginx - Configuracion de Sites

#### POS Frontend (Puerto 80)

Archivo: `/etc/nginx/sites-available/cianbox-pos`

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/cianbox-pos/frontend;
    index index.html;

    # CORS headers para assets
    add_header Access-Control-Allow-Origin *;

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Socket.io support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location /assets/ {
        add_header Access-Control-Allow-Origin *;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # PWA manifest and service worker
    location /manifest.webmanifest {
        add_header Content-Type application/manifest+json;
        add_header Access-Control-Allow-Origin *;
    }

    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed /;
        add_header Access-Control-Allow-Origin *;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Agency Backoffice (Puerto 8083)

Archivo: `/etc/nginx/sites-available/cianbox-pos-agency`

```nginx
server {
    listen 8083;
    server_name _;
    root /var/www/cianbox-pos/apps/agency/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml
               application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Client Backoffice (Puerto 8084)

Archivo: `/etc/nginx/sites-available/cianbox-pos-backoffice`

```nginx
server {
    listen 8084;
    server_name _;
    root /var/www/cianbox-pos/apps/backoffice/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml
               application/javascript application/json;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Comandos Nginx

```bash
nginx -t                    # Verificar configuracion
systemctl reload nginx      # Recargar configuracion
systemctl restart nginx     # Reiniciar
systemctl status nginx      # Ver estado

# Ver logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## Servidor de Base de Datos (172.16.1.62)

### Informacion del Sistema

| Campo | Valor |
|-------|-------|
| Hostname | cianbox-pos-db1 |
| OS | Debian GNU/Linux 12 (bookworm) |
| PostgreSQL | 15.14 |

### Configuracion de la Base de Datos

| Campo | Valor |
|-------|-------|
| Host | 172.16.1.62 |
| Puerto | 5432 |
| Base de datos | cianbox_pos |
| Usuario | cianbox_pos |
| Encoding | SQL_ASCII |

### Cadena de Conexion (Backend)

```env
DATABASE_URL="postgresql://cianbox_pos:PASSWORD@172.16.1.62:5432/cianbox_pos?schema=public"
```

### Comandos PostgreSQL

```bash
# Conectar como postgres
sudo -u postgres psql

# Conectar a la base de datos del POS
sudo -u postgres psql -d cianbox_pos

# O con el usuario de la app
psql -U cianbox_pos -h localhost -d cianbox_pos

# Ver bases de datos
\l

# Ver tablas
\dt

# Ver conexiones activas
SELECT pid, usename, application_name, client_addr, state
FROM pg_stat_activity
WHERE datname = 'cianbox_pos';
```

### Mantenimiento

```bash
# Estado del servicio
systemctl status postgresql

# Reiniciar PostgreSQL
systemctl restart postgresql

# Ver logs
tail -f /var/log/postgresql/postgresql-15-main.log

# Backup
pg_dump -U cianbox_pos -d cianbox_pos > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup comprimido
pg_dump -U cianbox_pos -d cianbox_pos | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restaurar
psql -U cianbox_pos -d cianbox_pos < backup.sql
```

---

## Despliegue

### Despliegue Automatico (CI/CD)

El repositorio tiene GitHub Actions configurado con un self-hosted runner. Al hacer push/merge a `main`, el despliegue se ejecuta automaticamente.

Ver estado en: **GitHub > Actions**

### Despliegue Manual

#### Backend

```bash
# 1. Conectar
ssh -i "ssh key/root_servers_ssh_key" root@172.16.1.61

# 2. Ir al directorio
cd /var/www/cianbox-pos/apps/backend

# 3. Pull cambios
git pull origin main

# 4. Instalar dependencias
npm install --production

# 5. Compilar
npm run build

# 6. Migraciones (si hay)
npx prisma migrate deploy

# 7. Reiniciar
pm2 restart cianbox-pos-api
```

#### Frontend POS

```bash
# En el servidor
cd /var/www/cianbox-pos/frontend

# Subir archivos del build local
# (desde tu maquina)
scp -i "ssh key/root_servers_ssh_key" -r apps/frontend/dist/* root@172.16.1.61:/var/www/cianbox-pos/frontend/
```

---

## Monitoreo y Troubleshooting

### Comandos Rapidos

```bash
# Estado general del servidor APP
ssh root@172.16.1.61 "pm2 status && systemctl status nginx --no-pager && df -h"

# Logs del backend en tiempo real
ssh root@172.16.1.61 "pm2 logs cianbox-pos-api"

# Estado de la DB
ssh root@172.16.1.62 "systemctl status postgresql && df -h"
```

### Problemas Comunes

| Problema | Causa Probable | Solucion |
|----------|---------------|----------|
| API no responde | Backend caido | `pm2 restart cianbox-pos-api` |
| 502 Bad Gateway | PM2 no corre | Verificar `pm2 status`, reiniciar |
| Error de conexion DB | Firewall o PostgreSQL | Verificar conectividad y servicio |
| Disco lleno | Logs acumulados | `pm2 flush` y limpiar logs |
| Frontend no carga | Nginx config | `nginx -t && systemctl reload nginx` |
| Runner offline | Servicio detenido | Reiniciar servicio del runner |

### Verificar Conectividad DB desde APP

```bash
ssh root@172.16.1.61 "nc -zv 172.16.1.62 5432"
```

---

## Seguridad

### Acceso SSH

- Solo acceso por clave SSH (sin password)
- Clave RSA 4096-bit
- Usuario root (considerar crear usuario no-root)

### Firewall Recomendado

**Servidor APP (172.16.1.61):**
```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 8083/tcp    # Agency
ufw allow 8084/tcp    # Backoffice
```

**Servidor DB (172.16.1.62):**
```bash
ufw allow 22/tcp                              # SSH
ufw allow from 172.16.1.61 to any port 5432  # PostgreSQL solo desde APP
```

---

## Referencias Rapidas

### URLs de Acceso (reemplazar IP con dominio si hay)

| Aplicacion | URL |
|------------|-----|
| POS Frontend | http://172.16.1.61/ |
| API Backend | http://172.16.1.61/api/ |
| Agency Backoffice | http://172.16.1.61:8083/ |
| Backoffice Admin | http://172.16.1.61:8084/ |

### Archivos de Configuracion

| Archivo | Ubicacion |
|---------|-----------|
| Backend .env | /var/www/cianbox-pos/apps/backend/.env |
| Nginx POS | /etc/nginx/sites-available/cianbox-pos |
| Nginx Agency | /etc/nginx/sites-available/cianbox-pos-agency |
| Nginx Backoffice | /etc/nginx/sites-available/cianbox-pos-backoffice |
| PM2 logs | /var/log/pm2/ |
| Runner config | /opt/actions-runner/.runner |

---

**Ultima actualizacion:** Diciembre 2024
