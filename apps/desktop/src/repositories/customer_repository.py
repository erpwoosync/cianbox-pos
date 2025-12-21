"""
Repositorio de clientes.

Proporciona acceso a clientes con metodos de busqueda optimizados.
"""

from typing import List, Optional

from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from .base import BaseRepository
from src.models import Customer


class CustomerRepository(BaseRepository[Customer]):
    """
    Repositorio para operaciones con clientes.

    Extiende BaseRepository con metodos especificos
    para busqueda y filtrado de clientes.
    """

    def __init__(self, session: Session):
        super().__init__(session, Customer)

    def search(
        self,
        tenant_id: str,
        query: str,
        limit: int = 50,
        only_active: bool = True,
    ) -> List[Customer]:
        """
        Busca clientes por texto.

        Busca en nombre, documento, email, telefono.

        Args:
            tenant_id: ID del tenant
            query: Texto de busqueda
            limit: Limite de resultados
            only_active: Solo clientes activos

        Returns:
            Lista de clientes que coinciden
        """
        search_term = f"%{query}%"

        stmt = (
            select(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(
                or_(
                    Customer.name.ilike(search_term),
                    Customer.trade_name.ilike(search_term),
                    Customer.tax_id.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.phone.ilike(search_term),
                    Customer.mobile.ilike(search_term),
                )
            )
        )

        if only_active:
            stmt = stmt.where(Customer.is_active == True)

        stmt = stmt.order_by(Customer.name).limit(limit)

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def get_by_tax_id(
        self,
        tenant_id: str,
        tax_id: str,
    ) -> Optional[Customer]:
        """
        Obtiene un cliente por documento.

        Args:
            tenant_id: ID del tenant
            tax_id: Numero de documento (CUIT/DNI)

        Returns:
            Cliente o None
        """
        # Limpiar el documento de caracteres no numericos
        cleaned_tax_id = "".join(c for c in tax_id if c.isdigit())

        stmt = (
            select(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(
                or_(
                    Customer.tax_id == tax_id,
                    Customer.tax_id == cleaned_tax_id,
                )
            )
        )

        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_cianbox_id(
        self,
        tenant_id: str,
        cianbox_id: int,
    ) -> Optional[Customer]:
        """
        Obtiene un cliente por ID de Cianbox.

        Args:
            tenant_id: ID del tenant
            cianbox_id: ID en Cianbox

        Returns:
            Cliente o None
        """
        stmt = (
            select(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(Customer.cianbox_id == cianbox_id)
        )

        result = self.session.execute(stmt)
        return result.scalar_one_or_none()

    def get_active(
        self,
        tenant_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Customer]:
        """
        Obtiene clientes activos.

        Args:
            tenant_id: ID del tenant
            limit: Limite de resultados
            offset: Desplazamiento

        Returns:
            Lista de clientes activos
        """
        stmt = (
            select(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(Customer.is_active == True)
            .order_by(Customer.name)
            .offset(offset)
            .limit(limit)
        )

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def get_with_credit(
        self,
        tenant_id: str,
        limit: int = 100,
    ) -> List[Customer]:
        """
        Obtiene clientes con credito habilitado.

        Args:
            tenant_id: ID del tenant
            limit: Limite de resultados

        Returns:
            Lista de clientes con credito
        """
        stmt = (
            select(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(Customer.is_active == True)
            .where(Customer.credit_limit > 0)
            .order_by(Customer.name)
            .limit(limit)
        )

        result = self.session.execute(stmt)
        return list(result.scalars().all())

    def count_active(self, tenant_id: str) -> int:
        """
        Cuenta clientes activos.

        Args:
            tenant_id: ID del tenant

        Returns:
            Numero de clientes activos
        """
        stmt = (
            select(func.count())
            .select_from(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(Customer.is_active == True)
        )

        result = self.session.execute(stmt)
        return result.scalar() or 0

    def get_recent(
        self,
        tenant_id: str,
        limit: int = 10,
    ) -> List[Customer]:
        """
        Obtiene los clientes mas recientes.

        Args:
            tenant_id: ID del tenant
            limit: Limite de resultados

        Returns:
            Lista de clientes ordenados por fecha de sync
        """
        stmt = (
            select(Customer)
            .where(Customer.tenant_id == tenant_id)
            .where(Customer.is_active == True)
            .order_by(Customer.last_synced_at.desc())
            .limit(limit)
        )

        result = self.session.execute(stmt)
        return list(result.scalars().all())
