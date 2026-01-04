"""
API de gestion de caja.

Maneja sesiones de caja, movimientos, arqueos y gift cards.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

from loguru import logger

from .client import APIClient, get_api_client
from .exceptions import APIError


class CashMovementType(str, Enum):
    """Tipos de movimiento de caja."""

    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    CHANGE_FUND = "CHANGE_FUND"


class CashMovementReason(str, Enum):
    """Razones de movimiento de caja."""

    SAFE_DEPOSIT = "SAFE_DEPOSIT"
    BANK_DEPOSIT = "BANK_DEPOSIT"
    SUPPLIER_PAYMENT = "SUPPLIER_PAYMENT"
    EXPENSE = "EXPENSE"
    CHANGE_FUND = "CHANGE_FUND"
    INITIAL_FUND = "INITIAL_FUND"
    LOAN_RETURN = "LOAN_RETURN"
    CORRECTION = "CORRECTION"
    COUNT_DIFFERENCE = "COUNT_DIFFERENCE"
    SHIFT_TRANSFER = "SHIFT_TRANSFER"
    OTHER = "OTHER"

    @classmethod
    def get_display_name(cls, reason: "CashMovementReason") -> str:
        """Obtiene el nombre para mostrar."""
        names = {
            cls.SAFE_DEPOSIT: "Deposito en Caja Fuerte",
            cls.BANK_DEPOSIT: "Deposito Bancario",
            cls.SUPPLIER_PAYMENT: "Pago a Proveedor",
            cls.EXPENSE: "Gasto",
            cls.CHANGE_FUND: "Fondo de Cambio",
            cls.INITIAL_FUND: "Fondo Inicial",
            cls.LOAN_RETURN: "Devolucion de Prestamo",
            cls.CORRECTION: "Correccion",
            cls.COUNT_DIFFERENCE: "Diferencia de Arqueo",
            cls.SHIFT_TRANSFER: "Transferencia de Turno",
            cls.OTHER: "Otro",
        }
        return names.get(reason, reason.value)


class CashSessionStatus(str, Enum):
    """Estados de sesion de caja."""

    OPEN = "OPEN"
    SUSPENDED = "SUSPENDED"
    COUNTING = "COUNTING"
    CLOSED = "CLOSED"
    TRANSFERRED = "TRANSFERRED"


@dataclass
class CashSession:
    """Datos de una sesion de caja."""

    id: str
    session_number: str
    status: CashSessionStatus
    opening_amount: float
    closing_amount: Optional[float] = None
    expected_amount: Optional[float] = None
    difference: Optional[float] = None
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    point_of_sale_id: Optional[str] = None
    point_of_sale_name: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    sales_count: int = 0
    movements_count: int = 0
    expected_cash: float = 0.0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CashSession":
        """Crea instancia desde diccionario de la API."""
        pos = data.get("pointOfSale", {})
        branch = data.get("branch", {})
        user = data.get("user", {})
        counts = data.get("_count", {})

        return cls(
            id=data.get("id", ""),
            session_number=data.get("sessionNumber", ""),
            status=CashSessionStatus(data.get("status", "OPEN")),
            opening_amount=float(data.get("openingAmount", 0)),
            closing_amount=float(data.get("closingAmount")) if data.get("closingAmount") else None,
            expected_amount=float(data.get("expectedAmount")) if data.get("expectedAmount") else None,
            difference=float(data.get("difference")) if data.get("difference") else None,
            opened_at=data.get("openedAt"),
            closed_at=data.get("closedAt"),
            point_of_sale_id=pos.get("id") or data.get("pointOfSaleId"),
            point_of_sale_name=pos.get("name"),
            branch_id=branch.get("id") or data.get("branchId"),
            branch_name=branch.get("name"),
            user_id=user.get("id") or data.get("userId"),
            user_name=user.get("name"),
            sales_count=counts.get("sales", 0),
            movements_count=counts.get("movements", 0),
            expected_cash=float(data.get("expectedCash", 0)),
        )


@dataclass
class CashMovement:
    """Datos de un movimiento de caja."""

    id: str
    type: CashMovementType
    amount: float
    reason: CashMovementReason
    description: Optional[str] = None
    reference: Optional[str] = None
    created_at: Optional[str] = None
    created_by_name: Optional[str] = None
    authorized_by_name: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CashMovement":
        """Crea instancia desde diccionario de la API."""
        created_by = data.get("createdBy", {})
        authorized_by = data.get("authorizedBy", {})

        return cls(
            id=data.get("id", ""),
            type=CashMovementType(data.get("type", "DEPOSIT")),
            amount=float(data.get("amount", 0)),
            reason=CashMovementReason(data.get("reason", "OTHER")),
            description=data.get("description"),
            reference=data.get("reference"),
            created_at=data.get("createdAt"),
            created_by_name=created_by.get("name"),
            authorized_by_name=authorized_by.get("name"),
        )


@dataclass
class CashCount:
    """Datos de un arqueo de caja."""

    bills: Dict[str, int] = field(default_factory=dict)
    coins: Dict[str, int] = field(default_factory=dict)
    vouchers: float = 0.0
    checks: float = 0.0
    other_values: float = 0.0
    other_values_note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario para la API."""
        return {
            "bills": self.bills,
            "coins": self.coins,
            "vouchers": self.vouchers,
            "checks": self.checks,
            "otherValues": self.other_values,
            "otherValuesNote": self.other_values_note,
        }

    def calculate_total_bills(self) -> float:
        """Calcula el total de billetes."""
        denominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10]
        total = 0.0
        for denom in denominations:
            total += self.bills.get(str(denom), 0) * denom
        return total

    def calculate_total_coins(self) -> float:
        """Calcula el total de monedas."""
        denominations = [500, 200, 100, 50, 25, 10, 5, 2, 1]
        total = 0.0
        for denom in denominations:
            total += self.coins.get(str(denom), 0) * denom
        return total

    def calculate_total(self) -> float:
        """Calcula el total del arqueo."""
        return (
            self.calculate_total_bills()
            + self.calculate_total_coins()
            + self.vouchers
            + self.checks
            + self.other_values
        )


@dataclass
class SessionSummary:
    """Resumen de cierre de sesion."""

    opening_amount: float = 0.0
    closing_amount: float = 0.0
    expected_amount: float = 0.0
    difference: float = 0.0
    difference_type: Optional[str] = None
    total_cash: float = 0.0
    total_debit: float = 0.0
    total_credit: float = 0.0
    total_qr: float = 0.0
    total_mp_point: float = 0.0
    total_transfer: float = 0.0
    total_other: float = 0.0
    sales_count: int = 0
    sales_total: float = 0.0
    refunds_count: int = 0
    refunds_total: float = 0.0
    cancels_count: int = 0
    withdrawals_total: float = 0.0
    deposits_total: float = 0.0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionSummary":
        """Crea instancia desde diccionario de la API."""
        return cls(
            opening_amount=float(data.get("openingAmount", 0)),
            closing_amount=float(data.get("closingAmount", 0)),
            expected_amount=float(data.get("expectedAmount", 0)),
            difference=float(data.get("difference", 0)),
            difference_type=data.get("differenceType"),
            total_cash=float(data.get("totalCash", 0)),
            total_debit=float(data.get("totalDebit", 0)),
            total_credit=float(data.get("totalCredit", 0)),
            total_qr=float(data.get("totalQr", 0)),
            total_mp_point=float(data.get("totalMpPoint", 0)),
            total_transfer=float(data.get("totalTransfer", 0)),
            total_other=float(data.get("totalOther", 0)),
            sales_count=int(data.get("salesCount", 0)),
            sales_total=float(data.get("salesTotal", 0)),
            refunds_count=int(data.get("refundsCount", 0)),
            refunds_total=float(data.get("refundsTotal", 0)),
            cancels_count=int(data.get("cancelsCount", 0)),
            withdrawals_total=float(data.get("withdrawalsTotal", 0)),
            deposits_total=float(data.get("depositsTotal", 0)),
        )


@dataclass
class GiftCardInfo:
    """Informacion de una gift card."""

    code: str
    initial_amount: float
    current_balance: float
    currency: str
    status: str
    expires_at: Optional[str] = None
    activated_at: Optional[str] = None
    is_expired: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GiftCardInfo":
        """Crea instancia desde diccionario de la API."""
        return cls(
            code=data.get("code", ""),
            initial_amount=float(data.get("initialAmount", 0)),
            current_balance=float(data.get("currentBalance", 0)),
            currency=data.get("currency", "ARS"),
            status=data.get("status", ""),
            expires_at=data.get("expiresAt"),
            activated_at=data.get("activatedAt"),
            is_expired=data.get("isExpired", False),
        )


class CashAPI:
    """
    API de gestion de caja.

    Maneja sesiones de caja, movimientos y arqueos.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de caja.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    # =========================================================================
    # SESIONES DE CAJA
    # =========================================================================

    def get_current_session(self) -> Optional[CashSession]:
        """
        Obtiene la sesion de caja actual del usuario.

        Returns:
            CashSession si hay sesion abierta, None si no
        """
        logger.debug("Obteniendo sesion de caja actual")

        try:
            response = self.client.get("/api/cash/current")

            if response.success and response.data:
                data = response.data
                if data.get("hasOpenSession") and data.get("session"):
                    return CashSession.from_dict(data["session"])

            return None

        except Exception as e:
            logger.error(f"Error obteniendo sesion actual: {e}")
            return None

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
        logger.info(f"Abriendo turno de caja en POS {point_of_sale_id} con ${opening_amount}")

        try:
            data = {
                "pointOfSaleId": point_of_sale_id,
                "openingAmount": opening_amount,
            }
            if notes:
                data["notes"] = notes

            response = self.client.post("/api/cash/open", data=data)

            if response.success and response.data:
                session_data = response.data.get("session", response.data)
                session = CashSession.from_dict(session_data)
                logger.info(f"Turno abierto: {session.session_number}")
                return session, None

            error = response.error or "Error al abrir turno"
            logger.warning(f"Error abriendo turno: {error}")
            return None, error

        except APIError as e:
            logger.error(f"Error API al abrir turno: {e}")
            return None, str(e)
        except Exception as e:
            logger.error(f"Error inesperado al abrir turno: {e}")
            return None, str(e)

    def close_session(
        self,
        count: Optional[CashCount] = None,
        notes: Optional[str] = None,
    ) -> tuple[Optional[SessionSummary], Optional[str]]:
        """
        Cierra el turno de caja actual.

        Args:
            count: Arqueo de cierre (opcional)
            notes: Notas de cierre

        Returns:
            Tupla (SessionSummary, error_message)
        """
        logger.info("Cerrando turno de caja")

        try:
            data = {}
            if count:
                data["count"] = count.to_dict()
            if notes:
                data["notes"] = notes

            response = self.client.post("/api/cash/close", data=data)

            if response.success and response.data:
                summary_data = response.data.get("summary", {})
                summary = SessionSummary.from_dict(summary_data)
                logger.info("Turno cerrado exitosamente")
                return summary, None

            error = response.error or "Error al cerrar turno"
            logger.warning(f"Error cerrando turno: {error}")
            return None, error

        except APIError as e:
            logger.error(f"Error API al cerrar turno: {e}")
            return None, str(e)
        except Exception as e:
            logger.error(f"Error inesperado al cerrar turno: {e}")
            return None, str(e)

    def suspend_session(self) -> tuple[bool, Optional[str]]:
        """
        Suspende el turno actual.

        Returns:
            Tupla (success, error_message)
        """
        logger.info("Suspendiendo turno de caja")

        try:
            response = self.client.post("/api/cash/suspend")

            if response.success:
                logger.info("Turno suspendido")
                return True, None

            error = response.error or "Error al suspender turno"
            return False, error

        except Exception as e:
            logger.error(f"Error suspendiendo turno: {e}")
            return False, str(e)

    def resume_session(self) -> tuple[bool, Optional[str]]:
        """
        Reanuda un turno suspendido.

        Returns:
            Tupla (success, error_message)
        """
        logger.info("Reanudando turno de caja")

        try:
            response = self.client.post("/api/cash/resume")

            if response.success:
                logger.info("Turno reanudado")
                return True, None

            error = response.error or "Error al reanudar turno"
            return False, error

        except Exception as e:
            logger.error(f"Error reanudando turno: {e}")
            return False, str(e)

    # =========================================================================
    # MOVIMIENTOS
    # =========================================================================

    def deposit(
        self,
        amount: float,
        reason: CashMovementReason,
        description: Optional[str] = None,
        reference: Optional[str] = None,
    ) -> tuple[Optional[CashMovement], Optional[str]]:
        """
        Registra un ingreso de efectivo.

        Args:
            amount: Monto a ingresar
            reason: Razon del ingreso
            description: Descripcion opcional
            reference: Referencia opcional

        Returns:
            Tupla (CashMovement, error_message)
        """
        logger.info(f"Registrando ingreso: ${amount} - {reason.value}")

        try:
            data = {
                "amount": amount,
                "reason": reason.value,
            }
            if description:
                data["description"] = description
            if reference:
                data["reference"] = reference

            response = self.client.post("/api/cash/deposit", data=data)

            if response.success and response.data:
                movement_data = response.data.get("movement", response.data)
                movement = CashMovement.from_dict(movement_data)
                logger.info(f"Ingreso registrado: {movement.id}")
                return movement, None

            error = response.error or "Error al registrar ingreso"
            return None, error

        except Exception as e:
            logger.error(f"Error registrando ingreso: {e}")
            return None, str(e)

    def withdraw(
        self,
        amount: float,
        reason: CashMovementReason,
        authorized_by_user_id: str,
        description: Optional[str] = None,
        reference: Optional[str] = None,
        destination_type: Optional[str] = None,
    ) -> tuple[Optional[CashMovement], Optional[str]]:
        """
        Registra un retiro de efectivo.

        Args:
            amount: Monto a retirar
            reason: Razon del retiro
            authorized_by_user_id: ID del supervisor que autoriza
            description: Descripcion opcional
            reference: Referencia opcional
            destination_type: Tipo de destino opcional

        Returns:
            Tupla (CashMovement, error_message)
        """
        logger.info(f"Registrando retiro: ${amount} - {reason.value}")

        try:
            data = {
                "amount": amount,
                "reason": reason.value,
                "authorizedByUserId": authorized_by_user_id,
            }
            if description:
                data["description"] = description
            if reference:
                data["reference"] = reference
            if destination_type:
                data["destinationType"] = destination_type

            response = self.client.post("/api/cash/withdraw", data=data)

            if response.success and response.data:
                movement_data = response.data.get("movement", response.data)
                movement = CashMovement.from_dict(movement_data)
                logger.info(f"Retiro registrado: {movement.id}")
                return movement, None

            error = response.error or "Error al registrar retiro"
            return None, error

        except Exception as e:
            logger.error(f"Error registrando retiro: {e}")
            return None, str(e)

    def get_movements(self) -> List[CashMovement]:
        """
        Obtiene los movimientos del turno actual.

        Returns:
            Lista de movimientos
        """
        try:
            response = self.client.get("/api/cash/movements")

            if response.success and response.data:
                movements_data = response.data.get("movements", [])
                return [CashMovement.from_dict(m) for m in movements_data]

            return []

        except Exception as e:
            logger.error(f"Error obteniendo movimientos: {e}")
            return []

    # =========================================================================
    # ARQUEOS
    # =========================================================================

    def register_count(
        self,
        count: CashCount,
        count_type: str = "PARTIAL",
        notes: Optional[str] = None,
    ) -> tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Registra un arqueo de caja.

        Args:
            count: Datos del arqueo
            count_type: Tipo de arqueo (OPENING, PARTIAL, CLOSING, AUDIT)
            notes: Notas opcionales

        Returns:
            Tupla (success, error_message, summary)
        """
        logger.info(f"Registrando arqueo tipo {count_type}")

        try:
            data = {
                "type": count_type,
                "bills": count.bills,
                "coins": count.coins,
                "vouchers": count.vouchers,
                "checks": count.checks,
                "otherValues": count.other_values,
            }
            if count.other_values_note:
                data["otherValuesNote"] = count.other_values_note
            if notes:
                data["notes"] = notes

            response = self.client.post("/api/cash/count", data=data)

            if response.success and response.data:
                summary = response.data.get("summary", {})
                logger.info("Arqueo registrado")
                return True, None, summary

            error = response.error or "Error al registrar arqueo"
            return False, error, None

        except Exception as e:
            logger.error(f"Error registrando arqueo: {e}")
            return False, str(e), None


class GiftCardAPI:
    """
    API de Gift Cards.

    Maneja consulta de saldo y canje de gift cards.
    """

    def __init__(self, client: Optional[APIClient] = None):
        """
        Inicializa la API de gift cards.

        Args:
            client: Cliente API (default: instancia global)
        """
        self.client = client or get_api_client()

    def check_balance(self, code: str) -> tuple[Optional[GiftCardInfo], Optional[str]]:
        """
        Consulta el saldo de una gift card.

        Args:
            code: Codigo de la gift card

        Returns:
            Tupla (GiftCardInfo, error_message)
        """
        logger.info(f"Consultando saldo de gift card: {code[:4]}****")

        try:
            response = self.client.post("/api/gift-cards/balance", data={"code": code})

            if response.success and response.data:
                gc_data = response.data.get("giftCard", response.data)
                gift_card = GiftCardInfo.from_dict(gc_data)
                logger.info(f"Saldo disponible: ${gift_card.current_balance}")
                return gift_card, None

            error = response.error or "Gift card no encontrada"
            return None, error

        except APIError as e:
            logger.error(f"Error consultando gift card: {e}")
            return None, str(e)
        except Exception as e:
            logger.error(f"Error inesperado consultando gift card: {e}")
            return None, str(e)

    def redeem(
        self,
        code: str,
        amount: float,
        sale_id: Optional[str] = None,
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Canjea saldo de una gift card.

        Args:
            code: Codigo de la gift card
            amount: Monto a canjear
            sale_id: ID de la venta (opcional, se asocia al pago)

        Returns:
            Tupla (resultado, error_message)
        """
        logger.info(f"Canjeando ${amount} de gift card: {code[:4]}****")

        try:
            data = {
                "code": code,
                "amount": amount,
            }
            if sale_id:
                data["saleId"] = sale_id

            response = self.client.post("/api/gift-cards/redeem", data=data)

            if response.success and response.data:
                result = {
                    "amount_redeemed": float(response.data.get("amountRedeemed", 0)),
                    "remaining_balance": float(response.data.get("remainingBalance", 0)),
                    "gift_card": GiftCardInfo.from_dict(response.data.get("giftCard", {})),
                }
                logger.info(f"Canjeados ${result['amount_redeemed']}, saldo restante: ${result['remaining_balance']}")
                return result, None

            error = response.error or "Error al canjear gift card"
            return None, error

        except APIError as e:
            logger.error(f"Error canjeando gift card: {e}")
            return None, str(e)
        except Exception as e:
            logger.error(f"Error inesperado canjeando gift card: {e}")
            return None, str(e)


# Instancias globales (singleton)
_cash_api: Optional[CashAPI] = None
_gift_card_api: Optional[GiftCardAPI] = None


def get_cash_api() -> CashAPI:
    """
    Obtiene la instancia global del cliente de caja.

    Returns:
        CashAPI singleton
    """
    global _cash_api
    if _cash_api is None:
        _cash_api = CashAPI()
    return _cash_api


def get_gift_card_api() -> GiftCardAPI:
    """
    Obtiene la instancia global del cliente de gift cards.

    Returns:
        GiftCardAPI singleton
    """
    global _gift_card_api
    if _gift_card_api is None:
        _gift_card_api = GiftCardAPI()
    return _gift_card_api
