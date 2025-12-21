# Cianbox POS Desktop

Aplicacion POS (Point of Sale) nativa para Windows x64, desarrollada en Python con PyQt6.

## Requisitos del Sistema

- Windows 10/11 x64
- Python 3.11 o superior
- Conexion a Internet (para sincronizacion)
- Impresora termica compatible (opcional)
- Lector de codigo de barras USB (opcional)
- Terminal MercadoPago Point (opcional)

## Instalacion para Desarrollo

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-repo/cianbox-pos.git
cd cianbox-pos/apps/desktop
```

### 2. Crear entorno virtual

```bash
python -m venv venv
venv\Scripts\activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements-dev.txt
```

### 4. Configurar variables de entorno

```bash
copy .env.example .env
# Editar .env con los valores correctos
```

### 5. Ejecutar la aplicacion

```bash
python -m src.main
```

## Estructura del Proyecto

```
desktop/
|-- src/
|   |-- main.py              # Entry point
|   |-- app.py               # Aplicacion principal
|   |-- config/              # Configuracion
|   |-- models/              # Modelos de datos
|   |-- schemas/             # Schemas Pydantic
|   |-- api/                 # Cliente API
|   |-- services/            # Logica de negocio
|   |-- db/                  # Base de datos local
|   |-- ui/                  # Interfaz grafica
|   |   |-- windows/         # Ventanas principales
|   |   |-- components/      # Componentes reutilizables
|   |   |-- dialogs/         # Dialogos modales
|   |   |-- styles/          # Estilos y temas
|   |-- utils/               # Utilidades
|
|-- assets/                  # Recursos (iconos, imagenes, fuentes)
|-- tests/                   # Tests unitarios
|-- scripts/                 # Scripts de build
|-- requirements.txt         # Dependencias de produccion
|-- requirements-dev.txt     # Dependencias de desarrollo
|-- pyproject.toml           # Configuracion del proyecto
|-- .env.example             # Variables de entorno ejemplo
```

## Compilacion para Produccion

### Crear ejecutable con PyInstaller

```bash
pyinstaller cianbox-pos.spec --noconfirm
```

El ejecutable se generara en `dist/cianbox-pos/`.

## Atajos de Teclado

| Tecla | Accion |
|-------|--------|
| F1 | Ayuda |
| F2 | Buscar producto |
| F4 | Aplicar descuento |
| F5 | Actualizar precios |
| F6 | Abrir cajon |
| F7 | Reimprimir ticket |
| F9 | Anular item |
| F12 | Cobrar |
| ESC | Cancelar |
| Enter | Confirmar |

## Modo Offline

La aplicacion puede operar sin conexion a Internet:

1. Los productos y precios se almacenan localmente
2. Las ventas se guardan en cola offline
3. Al recuperar conexion, se sincronizan automaticamente

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contactar a soporte@cianbox.com.

## Licencia

Software propietario. Todos los derechos reservados.
