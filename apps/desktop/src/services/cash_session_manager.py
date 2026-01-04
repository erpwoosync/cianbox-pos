"""
Manager de sesion de caja.

Gestiona el estado de la sesion de caja actual y proporciona
acceso centralizado a las operaciones de caja.
"""

from typing import Optional, Callable, List
from dataclasses import dataclass
from enum import Enum

from PyQt6.QtCore import QObject, pyqtSignal, QTimer

from loguru import logger

from src.api.cash import (
    CashAPI,
    CashSession,
    CashSessionStatus,
    CashMovement,
    CashMovementType,
    CashMovementReason,
    CashCount,
    SessionSummary,
    get_cash_api,
)


class CashSessionManager(QObject):
    """
    Manager de sesion de caja.

    Centraliza la gestion del estado de la sesion de caja,
    emite signals cuando cambia el estado y proporciona
    metodos para operaciones de caja.

    Signals:
        session_changed: Emitido cuando cambia la sesion de caja
        session_opened: Emitido cuando se abre una sesion
        session_closed: Emitido cuando se cierra una sesion
        movement_registered: Emitido cuando se registra un movimiento
    """

    session_changed = pyqtSignal(object)  # CashSession o None
    session_opened = pyqtSignal(object)  # CashSession
    session_closed = pyqtSignal(object)  # SessionSummary
    movement_registered = pyqtSignal(object)  # CashMovement

    def __init__(self, parent: Optional[QObject] = None):
        super().__init__(parent)

        self._cash_api = get_cash_api()
        self._current_session: Optional[CashSession] = None
        self._refresh_timer: Optional[QTimer] = None
        self._cash_required: bool = False

        # Timer para refrescar estado periodicamente
        self._setup_refresh_timer()

    @property
    def current_session(self) -> Optional[CashSession]:
        """Obtiene la sesion de caja actual."""
        return self._current_session

    @property
    def is_session_open(self) -> bool:
        """Verifica si hay una sesion de caja abierta."""
        return (
            self._current_session is not None
            and self._current_session.status == CashSessionStatus.OPEN
        )

    @property
    def cash_required(self) -> bool:
        """Indica si se requiere caja abierta para operar."""
        return self._cash_required

    @cash_required.setter
    def cash_required(self, value: bool):
        """Establece si se requiere caja abierta."""
        self._cash_required = value

    def _setup_refresh_timer(self) -> None:
        """Configura el timer de refresco de estado."""
        self._refresh_timer = QTimer(self)
        self._refresh_timer.timeout.connect(self.refresh_session)
        # Refrescar cada 5 minutos
        self._refresh_timer.start(5 * 60 * 1000)

    def check_initial_session(self) -> None:
        """
        Verifica si hay una sesion de caja activa al iniciar.

        Debe llamarse al iniciar la aplicacion.
        """
        logger.info("Verificando sesion de caja inicial...")
        self.refresh_session()

    def refresh_session(self) -> None:
        """Refresca el estado de la sesion de caja actual."""
        try:
            session = self._cash_api.get_current_session()

            if session != self._current_session:
                old_session = self._current_session
                self._current_session = session

                # Emitir signal de cambio
                self.session_changed.emit(session)

                if session:
                    logger.info(f"Sesion de caja actual: {session.session_number} ({session.status.value})")
                else:
                    logger.info("No hay sesion de caja activa")

        except Exception as e:
            logger.error(f"Error al refrescar sesion de caja: {e}")

    def open_session(
        self,
        point_of_sale_id: str,
        opening_amount: float,
        notes: Optional[str] = None,
    ) -> tuple[Optional[CashSession], Optional[str]]:
        """
        Abre un nuevo turno de caja.

        Args:
            point_of_sale_id: ID del punto de venta
            opening_amount: Monto inicial
            notes: Notas opcionales

        Returns:
            Tupla (CashSession, error_message)
        """
        session, error = self._cash_api.open_session(
            point_of_sale_id=point_of_sale_id,
            opening_amount=opening_amount,
            notes=notes,
        )

        if session:
            self._current_session = session
            self.session_changed.emit(session)
            self.session_opened.emit(session)

        return session, error

    def close_session(
        self,
        count: Optional[CashCount] = None,
        notes: Optional[str] = None,
    ) -> tuple[Optional[SessionSummary], Optional[str]]:
        """
        Cierra el turno de caja actual.

        Args:
            count: Arqueo de cierre
            notes: Notas de cierre

        Returns:
            Tupla (SessionSummary, error_message)
        """
        summary, error = self._cash_api.close_session(count=count, notes=notes)

        if summary:
            self._current_session = None
            self.session_changed.emit(None)
            self.session_closed.emit(summary)

        return summary, error

    def suspend_session(self) -> tuple[bool, Optional[str]]:
        """Suspende el turno actual."""
        success, error = self._cash_api.suspend_session()

        if success:
            self.refresh_session()

        return success, error

    def resume_session(self) -> tuple[bool, Optional[str]]:
        """Reanuda un turno suspendido."""
        success, error = self._cash_api.resume_session()

        if success:
            self.refresh_session()

        return success, error

    def deposit(
        self,
        amount: float,
        reason: CashMovementReason,
        description: Optional[str] = None,
        reference: Optional[str] = None,
    ) -> tuple[Optional[CashMovement], Optional[str]]:
        """Registra un ingreso de efectivo."""
        movement, error = self._cash_api.deposit(
            amount=amount,
            reason=reason,
            description=description,
            reference=reference,
        )

        if movement:
            self.movement_registered.emit(movement)

        return movement, error

    def withdraw(
        self,
        amount: float,
        reason: CashMovementReason,
        authorized_by_user_id: str,
        description: Optional[str] = None,
        reference: Optional[str] = None,
    ) -> tuple[Optional[CashMovement], Optional[str]]:
        """Registra un retiro de efectivo."""
        movement, error = self._cash_api.withdraw(
            amount=amount,
            reason=reason,
            authorized_by_user_id=authorized_by_user_id,
            description=description,
            reference=reference,
        )

        if movement:
            self.movement_registered.emit(movement)

        return movement, error

    def get_movements(self) -> List[CashMovement]:
        """Obtiene los movimientos del turno actual."""
        return self._cash_api.get_movements()

    def can_make_sale(self) -> tuple[bool, str]:
        """
        Verifica si se puede realizar una venta.

        Returns:
            Tupla (puede_vender, mensaje_error)
        """
        if not self._cash_required:
            return True, ""

        if not self._current_session:
            return False, "No hay un turno de caja abierto"

        if self._current_session.status == CashSessionStatus.SUSPENDED:
            return False, "El turno de caja esta suspendido"

        if self._current_session.status == CashSessionStatus.COUNTING:
            return False, "El turno de caja esta en proceso de cierre"

        if self._current_session.status != CashSessionStatus.OPEN:
            return False, f"El turno de caja no esta activo ({self._current_session.status.value})"

        return True, ""

    def get_session_display_text(self) -> tuple[str, str, str]:
        """
        Obtiene el texto para mostrar el estado de la sesion.

        Returns:
            Tupla (texto, color, tooltip)
        """
        if not self._current_session:
            return (
                "Turno: Sin abrir",
                "warning",
                "No hay un turno de caja abierto. Abrelo para registrar ventas."
            )

        if self._current_session.status == CashSessionStatus.OPEN:
            return (
                f"Turno: {self._current_session.session_number}",
                "success",
                f"Turno abierto desde {self._current_session.opened_at or 'N/A'}"
            )

        if self._current_session.status == CashSessionStatus.SUSPENDED:
            return (
                f"Turno: {self._current_session.session_number} (Suspendido)",
                "warning",
                "El turno esta suspendido"
            )

        return (
            f"Turno: {self._current_session.session_number} ({self._current_session.status.value})",
            "info",
            ""
        )


# Instancia global (singleton)
_cash_session_manager: Optional[CashSessionManager] = None


def get_cash_session_manager() -> CashSessionManager:
    """
    Obtiene la instancia global del manager de sesion de caja.

    Returns:
        CashSessionManager singleton
    """
    global _cash_session_manager
    if _cash_session_manager is None:
        _cash_session_manager = CashSessionManager()
    return _cash_session_manager


def reset_cash_session_manager() -> None:
    """
    Resetea el manager de sesion de caja.

    Util para tests o al cerrar sesion de usuario.
    """
    global _cash_session_manager
    if _cash_session_manager:
        _cash_session_manager._refresh_timer.stop()
        _cash_session_manager.deleteLater()
    _cash_session_manager = None
