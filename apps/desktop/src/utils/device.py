"""
Deteccion e identificacion de dispositivos.

Proporciona funciones para detectar informacion unica del PC
donde se ejecuta la aplicacion POS.

La informacion se usa para:
- Identificar equipos habilitados para usar el POS
- Control de acceso por dispositivo
- Auditoria y trazabilidad
"""

import hashlib
import platform
import socket
import subprocess
import uuid
from dataclasses import dataclass, field, asdict
from typing import Optional
from functools import lru_cache

from loguru import logger


@dataclass
class DeviceInfo:
    """
    Informacion del dispositivo.

    Attributes:
        device_id: ID unico generado del dispositivo (hash de identificadores)
        hostname: Nombre del equipo
        mac_address: Direccion MAC de la interfaz de red principal
        ip_address: Direccion IP local
        os_version: Version del sistema operativo
        cpu_info: Informacion del procesador
        machine_guid: GUID de Windows (del registro)
        disk_serial: Numero de serie del disco principal
        app_version: Version de la aplicacion POS
        username: Nombre del usuario de Windows actual
    """
    device_id: str
    hostname: str
    mac_address: str
    ip_address: str
    os_version: str
    cpu_info: str
    machine_guid: str
    disk_serial: str
    app_version: str
    username: str = ""

    def to_dict(self) -> dict:
        """Convierte la informacion a diccionario."""
        return asdict(self)


def _get_hostname() -> str:
    """
    Obtiene el nombre del equipo.

    Returns:
        Nombre del host o 'UNKNOWN' si falla
    """
    try:
        return socket.gethostname()
    except Exception as e:
        logger.warning(f"No se pudo obtener hostname: {e}")
        return "UNKNOWN"


def _get_mac_address() -> str:
    """
    Obtiene la direccion MAC de la interfaz de red principal.

    Returns:
        Direccion MAC formateada (XX:XX:XX:XX:XX:XX) o 'UNKNOWN'
    """
    try:
        mac = uuid.getnode()
        # Formatear como AA:BB:CC:DD:EE:FF
        mac_str = ':'.join(
            f'{(mac >> ele) & 0xff:02X}'
            for ele in range(0, 48, 8)
        )[::-1]
        # Corregir el formato (el reverse afecta cada par)
        parts = mac_str.split(':')
        # Reordenar correctamente
        mac_formatted = ':'.join(
            f'{(mac >> (40 - i * 8)) & 0xff:02X}'
            for i in range(6)
        )
        return mac_formatted
    except Exception as e:
        logger.warning(f"No se pudo obtener MAC address: {e}")
        return "UNKNOWN"


def _get_ip_address() -> str:
    """
    Obtiene la direccion IP local del equipo.

    Returns:
        Direccion IP o '127.0.0.1' si falla
    """
    try:
        # Crear socket temporal para detectar IP real
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        try:
            # No necesita conectar realmente, solo determina la interfaz
            s.connect(('10.254.254.254', 1))
            ip = s.getsockname()[0]
        except Exception:
            ip = '127.0.0.1'
        finally:
            s.close()
        return ip
    except Exception as e:
        logger.warning(f"No se pudo obtener IP address: {e}")
        return "127.0.0.1"


def _get_os_version() -> str:
    """
    Obtiene la version del sistema operativo.

    Returns:
        String con sistema operativo y version
    """
    try:
        system = platform.system()
        release = platform.release()
        version = platform.version()

        if system == "Windows":
            # Intentar obtener nombre mas amigable
            try:
                import winreg
                key = winreg.OpenKey(
                    winreg.HKEY_LOCAL_MACHINE,
                    r"SOFTWARE\Microsoft\Windows NT\CurrentVersion"
                )
                product_name = winreg.QueryValueEx(key, "ProductName")[0]
                display_version = ""
                try:
                    display_version = winreg.QueryValueEx(key, "DisplayVersion")[0]
                except Exception:
                    pass
                winreg.CloseKey(key)

                if display_version:
                    return f"{product_name} {display_version}"
                return product_name
            except Exception:
                pass

        return f"{system} {release} ({version})"
    except Exception as e:
        logger.warning(f"No se pudo obtener version de OS: {e}")
        return "UNKNOWN"


def _get_cpu_info() -> str:
    """
    Obtiene informacion del procesador.

    Returns:
        Nombre del procesador o 'UNKNOWN'
    """
    try:
        if platform.system() == "Windows":
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
            )
            cpu_name = winreg.QueryValueEx(key, "ProcessorNameString")[0]
            winreg.CloseKey(key)
            return cpu_name.strip()
        else:
            return platform.processor()
    except Exception as e:
        logger.warning(f"No se pudo obtener info de CPU: {e}")
        return "UNKNOWN"


def _get_machine_guid() -> str:
    """
    Obtiene el GUID unico de la maquina Windows.

    Este GUID se genera durante la instalacion de Windows
    y es unico para cada instalacion.

    Returns:
        GUID de la maquina o 'UNKNOWN'
    """
    try:
        if platform.system() == "Windows":
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Cryptography"
            )
            machine_guid = winreg.QueryValueEx(key, "MachineGuid")[0]
            winreg.CloseKey(key)
            return machine_guid
        else:
            # En otros sistemas, generar desde UUID del hardware
            return str(uuid.getnode())
    except Exception as e:
        logger.warning(f"No se pudo obtener MachineGuid: {e}")
        return "UNKNOWN"


def _get_disk_serial() -> str:
    """
    Obtiene el numero de serie del disco principal.

    Returns:
        Serial del disco o 'UNKNOWN'
    """
    try:
        if platform.system() == "Windows":
            # Usar WMIC para obtener serial del disco
            result = subprocess.run(
                ["wmic", "diskdrive", "get", "SerialNumber"],
                capture_output=True,
                text=True,
                timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                # Filtrar lineas vacias y el header
                serials = [
                    line.strip()
                    for line in lines[1:]
                    if line.strip()
                ]
                if serials:
                    return serials[0]
        return "UNKNOWN"
    except Exception as e:
        logger.warning(f"No se pudo obtener serial del disco: {e}")
        return "UNKNOWN"


def _get_username() -> str:
    """
    Obtiene el nombre del usuario actual de Windows.

    Returns:
        Nombre de usuario o 'UNKNOWN'
    """
    try:
        import os
        return os.getlogin()
    except Exception:
        try:
            import getpass
            return getpass.getuser()
        except Exception as e:
            logger.warning(f"No se pudo obtener username: {e}")
            return "UNKNOWN"


def _generate_device_id(
    mac_address: str,
    machine_guid: str,
    disk_serial: str,
) -> str:
    """
    Genera un ID unico del dispositivo.

    Combina multiples identificadores y los hashea para crear
    un ID unico pero dificil de falsificar.

    Args:
        mac_address: Direccion MAC
        machine_guid: GUID de Windows
        disk_serial: Serial del disco

    Returns:
        Hash SHA-256 truncado a 32 caracteres
    """
    # Combinar identificadores
    raw_data = f"{mac_address}|{machine_guid}|{disk_serial}"

    # Agregar salt para mayor seguridad
    salt = "CIANBOX_POS_2024"
    salted_data = f"{salt}:{raw_data}:{salt}"

    # Generar hash
    hash_obj = hashlib.sha256(salted_data.encode('utf-8'))
    device_id = hash_obj.hexdigest()[:32].upper()

    return device_id


@lru_cache(maxsize=1)
def get_device_info() -> DeviceInfo:
    """
    Obtiene toda la informacion del dispositivo.

    Esta funcion cachea el resultado ya que la informacion
    del hardware no cambia durante la ejecucion.

    Returns:
        DeviceInfo con todos los datos del dispositivo
    """
    from src.config import get_settings

    logger.info("Detectando informacion del dispositivo...")

    settings = get_settings()

    # Recopilar informacion
    hostname = _get_hostname()
    mac_address = _get_mac_address()
    ip_address = _get_ip_address()
    os_version = _get_os_version()
    cpu_info = _get_cpu_info()
    machine_guid = _get_machine_guid()
    disk_serial = _get_disk_serial()
    username = _get_username()

    # Generar ID unico
    device_id = _generate_device_id(mac_address, machine_guid, disk_serial)

    device_info = DeviceInfo(
        device_id=device_id,
        hostname=hostname,
        mac_address=mac_address,
        ip_address=ip_address,
        os_version=os_version,
        cpu_info=cpu_info,
        machine_guid=machine_guid,
        disk_serial=disk_serial,
        app_version=settings.APP_VERSION,
        username=username,
    )

    logger.info(f"Dispositivo detectado: {hostname} ({device_id[:8]}...)")
    logger.debug(f"Device Info: {device_info.to_dict()}")

    return device_info


def get_device_id() -> str:
    """
    Obtiene solo el ID unico del dispositivo.

    Atajo conveniente cuando solo se necesita el ID.

    Returns:
        ID unico del dispositivo (32 caracteres hex)
    """
    return get_device_info().device_id


def clear_device_cache() -> None:
    """
    Limpia la cache de informacion del dispositivo.

    Util si se necesita re-detectar la informacion
    (por ejemplo, despues de cambios de red).
    """
    get_device_info.cache_clear()
    logger.debug("Cache de device info limpiada")
