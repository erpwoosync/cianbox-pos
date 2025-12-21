"""
Punto de entrada de la aplicacion Cianbox POS Desktop.

Este modulo inicializa todos los componentes y lanza la aplicacion.
"""

import sys
from pathlib import Path

# Asegurar que el directorio src y su padre esten en el path
src_dir = Path(__file__).parent
parent_dir = src_dir.parent

if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))


def setup_environment() -> None:
    """
    Configura el entorno antes de inicializar la aplicacion.

    - Crea directorios necesarios
    - Configura logging
    - Inicializa base de datos
    """
    from config import get_settings
    from config.logging import setup_logging
    from db import init_database

    settings = get_settings()

    # Crear directorios necesarios
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.logs_dir.mkdir(parents=True, exist_ok=True)

    # Configurar logging
    setup_logging(settings)

    # Inicializar base de datos
    init_database()


def main() -> int:
    """
    Funcion principal de la aplicacion.

    Returns:
        Codigo de salida (0 = exito, otro = error)
    """
    from loguru import logger

    try:
        # Configurar entorno
        setup_environment()

        logger.info("=" * 60)
        logger.info("Iniciando Cianbox POS Desktop")
        logger.info("=" * 60)

        # Importar y crear aplicacion Qt
        from ui.app import create_application
        app = create_application()

        # Ejecutar aplicacion
        exit_code = app.run()

        logger.info(f"Aplicacion finalizada con codigo: {exit_code}")
        return exit_code

    except Exception as e:
        logger.exception(f"Error fatal en la aplicacion: {e}")

        # Mostrar error en ventana si es posible
        try:
            from PyQt6.QtWidgets import QApplication, QMessageBox

            if not QApplication.instance():
                app = QApplication(sys.argv)

            QMessageBox.critical(
                None,
                "Error Fatal",
                f"Error al iniciar la aplicacion:\n\n{str(e)}\n\n"
                "Por favor, revisa los logs para mas informacion."
            )
        except Exception:
            print(f"ERROR FATAL: {e}", file=sys.stderr)

        return 1


def run_cli_mode() -> None:
    """
    Ejecuta en modo CLI para tareas de mantenimiento.

    Soporta comandos:
        --version: Muestra version
        --sync: Ejecuta sincronizacion
        --reset-db: Reinicia base de datos
        --check: Verifica conexion
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Cianbox POS Desktop",
        prog="cianbox-pos"
    )

    parser.add_argument(
        "--version", "-v",
        action="store_true",
        help="Muestra la version"
    )

    parser.add_argument(
        "--check",
        action="store_true",
        help="Verifica conexion con el servidor"
    )

    parser.add_argument(
        "--reset-db",
        action="store_true",
        help="Reinicia la base de datos local"
    )

    parser.add_argument(
        "--logs",
        action="store_true",
        help="Abre directorio de logs"
    )

    parser.add_argument(
        "--gui",
        action="store_true",
        help="Inicia la interfaz grafica (default)"
    )

    args = parser.parse_args()

    if args.version:
        from config import get_settings
        settings = get_settings()
        print(f"{settings.APP_NAME} v{settings.APP_VERSION}")
        return

    if args.check:
        check_connection()
        return

    if args.reset_db:
        reset_database()
        return

    if args.logs:
        open_logs_directory()
        return

    # Default: ejecutar GUI
    sys.exit(main())


def check_connection() -> None:
    """Verifica la conexion con el servidor."""
    from config import get_settings
    from api import get_api_client

    setup_environment()

    settings = get_settings()
    client = get_api_client()

    print(f"Verificando conexion a: {settings.API_URL}")

    try:
        # Hacer ping al servidor
        response = client.request("GET", "/health", skip_auth_refresh=True)

        if response.success:
            print("Conexion exitosa!")
            print(f"Estado del servidor: OK")
        else:
            print(f"Error: {response.error}")

    except Exception as e:
        print(f"Error de conexion: {e}")


def reset_database() -> None:
    """Reinicia la base de datos local."""
    from config import get_settings
    from db import init_database

    settings = get_settings()
    db_path = Path(settings.DATABASE_PATH)

    if db_path.exists():
        confirm = input(f"Esto eliminara la base de datos en {db_path}. Continuar? [s/N]: ")
        if confirm.lower() != 's':
            print("Operacion cancelada.")
            return

        db_path.unlink()
        print("Base de datos eliminada.")

    # Recrear
    init_database()
    print("Base de datos recreada exitosamente.")


def open_logs_directory() -> None:
    """Abre el directorio de logs."""
    import subprocess
    from config import get_settings

    settings = get_settings()
    logs_dir = settings.logs_dir

    if sys.platform == "win32":
        subprocess.run(["explorer", str(logs_dir)])
    elif sys.platform == "darwin":
        subprocess.run(["open", str(logs_dir)])
    else:
        subprocess.run(["xdg-open", str(logs_dir)])

    print(f"Abriendo: {logs_dir}")


if __name__ == "__main__":
    # Verificar si hay argumentos de CLI
    if len(sys.argv) > 1:
        run_cli_mode()
    else:
        sys.exit(main())
