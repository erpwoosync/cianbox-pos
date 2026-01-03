"""
Cargador asincrono de imagenes para productos.

Utiliza QNetworkAccessManager para descargar imagenes de forma asincrona
sin bloquear la interfaz. Implementa cache en memoria para evitar
descargas repetidas.

Uso:
    from src.utils.image_loader import ImageLoader

    # Obtener instancia singleton
    loader = ImageLoader.instance()

    # Cargar imagen en un QLabel
    loader.load_image(url, label, width=175, height=50)
"""

from typing import Dict, Optional, Callable
from PyQt6.QtWidgets import QLabel
from PyQt6.QtCore import QObject, QUrl, QByteArray, Qt
from PyQt6.QtGui import QPixmap, QImage
from PyQt6.QtNetwork import QNetworkAccessManager, QNetworkRequest, QNetworkReply
from loguru import logger

try:
    from PyQt6 import sip
except ImportError:
    sip = None


class ImageLoader(QObject):
    """
    Cargador asincrono de imagenes con cache.

    Singleton que maneja la descarga de imagenes de URLs remotas
    y las aplica a QLabels de forma asincrona.
    """

    _instance: Optional["ImageLoader"] = None

    def __init__(self) -> None:
        """Inicializa el cargador con manager de red y cache."""
        super().__init__()
        self._manager = QNetworkAccessManager(self)
        self._cache: Dict[str, QPixmap] = {}
        self._pending: Dict[str, list] = {}  # URL -> lista de (label, width, height)

    @classmethod
    def instance(cls) -> "ImageLoader":
        """Obtiene la instancia singleton del cargador."""
        if cls._instance is None:
            cls._instance = ImageLoader()
        return cls._instance

    def load_image(
        self,
        url: str,
        label: QLabel,
        width: int = 175,
        height: int = 50,
        placeholder: str = "[IMG]",
    ) -> None:
        """
        Carga una imagen desde URL y la aplica al label.

        Si la imagen esta en cache, la aplica inmediatamente.
        Si no, inicia la descarga asincrona.

        Args:
            url: URL de la imagen
            label: QLabel donde mostrar la imagen
            width: Ancho deseado
            height: Alto deseado
            placeholder: Texto a mostrar mientras carga
        """
        if not url:
            return

        # Normalizar URL
        url = url.strip()
        if not url.startswith(("http://", "https://")):
            return

        # Verificar cache
        cache_key = f"{url}_{width}_{height}"
        if cache_key in self._cache:
            label.setPixmap(self._cache[cache_key])
            label.setText("")
            return

        # Mostrar placeholder
        label.setText(placeholder)

        # Si ya hay una peticion pendiente para esta URL, agregar a la lista
        if url in self._pending:
            self._pending[url].append((label, width, height, cache_key))
            return

        # Iniciar nueva descarga
        self._pending[url] = [(label, width, height, cache_key)]
        request = QNetworkRequest(QUrl(url))
        request.setRawHeader(b"User-Agent", b"CianboxPOS/1.0")
        reply = self._manager.get(request)
        reply.finished.connect(lambda: self._on_image_loaded(reply, url))

    def _on_image_loaded(self, reply: QNetworkReply, url: str) -> None:
        """
        Callback cuando termina la descarga de una imagen.

        Args:
            reply: Respuesta de red
            url: URL original de la imagen
        """
        try:
            if reply.error() != QNetworkReply.NetworkError.NoError:
                logger.warning(f"Error cargando imagen {url}: {reply.errorString()}")
                return

            # Leer datos
            data = reply.readAll()
            if not data:
                return

            # Crear imagen
            image = QImage()
            if not image.loadFromData(data):
                logger.warning(f"No se pudo decodificar imagen: {url}")
                return

            # Aplicar a todos los labels pendientes
            if url in self._pending:
                for label, width, height, cache_key in self._pending[url]:
                    try:
                        # Verificar que el label no haya sido destruido
                        if sip and sip.isdeleted(label):
                            continue

                        # Escalar imagen manteniendo aspecto
                        pixmap = QPixmap.fromImage(image)
                        scaled = pixmap.scaled(
                            width,
                            height,
                            Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation,
                        )

                        # Guardar en cache
                        self._cache[cache_key] = scaled

                        # Aplicar al label
                        label.setPixmap(scaled)
                        label.setText("")
                        label.repaint()  # Forzar repintado
                    except (RuntimeError, Exception) as e:
                        # Label fue destruido u otro error
                        logger.debug(f"No se pudo aplicar imagen: {e}")

                del self._pending[url]

        except Exception as e:
            logger.error(f"Error procesando imagen {url}: {e}")
        finally:
            reply.deleteLater()

    def clear_cache(self) -> None:
        """Limpia el cache de imagenes."""
        self._cache.clear()

    def preload_images(self, urls: list[str], width: int = 175, height: int = 50) -> None:
        """
        Pre-carga multiples imagenes en cache.

        Args:
            urls: Lista de URLs a pre-cargar
            width: Ancho deseado
            height: Alto deseado
        """
        for url in urls:
            if url:
                cache_key = f"{url}_{width}_{height}"
                if cache_key not in self._cache:
                    # Crear un label temporal para la descarga
                    temp_label = QLabel()
                    self.load_image(url, temp_label, width, height)


# Funcion de conveniencia
def get_image_loader() -> ImageLoader:
    """Obtiene la instancia singleton del cargador de imagenes."""
    return ImageLoader.instance()
