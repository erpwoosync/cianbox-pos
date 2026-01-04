/**
 * Hook para manejar el estado de la sesión de caja
 * Centraliza la lógica de apertura, cierre y consulta de turnos
 */

import { useState, useEffect, useCallback } from 'react';
import { cashService, CashSession } from '../services/api';

export interface UseCashSessionResult {
  // Estado de la sesión
  session: CashSession | null;
  hasOpenSession: boolean;
  expectedCash: number;
  isLoading: boolean;
  error: string | null;

  // Configuración
  cashModeRequired: boolean;
  canSellWithoutSession: boolean;

  // Acciones
  loadSession: () => Promise<void>;
  openSession: (data: {
    pointOfSaleId: string;
    openingAmount: number;
    notes?: string;
  }) => Promise<CashSession | null>;
  closeSession: (data?: {
    count?: {
      bills?: Record<number, number>;
      coins?: Record<number, number>;
      vouchers?: number;
      checks?: number;
      otherValues?: number;
      otherValuesNote?: string;
    };
    notes?: string;
  }) => Promise<boolean>;
  suspendSession: () => Promise<boolean>;
  resumeSession: () => Promise<boolean>;
  refreshExpectedCash: () => Promise<void>;
}

interface UseCashSessionOptions {
  pointOfSaleId?: string;
  cashMode?: 'REQUIRED' | 'OPTIONAL' | 'AUTO';
  autoLoad?: boolean;
}

export function useCashSession(options: UseCashSessionOptions = {}): UseCashSessionResult {
  const { cashMode = 'REQUIRED', autoLoad = true } = options;

  const [session, setSession] = useState<CashSession | null>(null);
  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [expectedCash, setExpectedCash] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determinar si se requiere caja para vender
  const cashModeRequired = cashMode === 'REQUIRED';
  const canSellWithoutSession = cashMode === 'OPTIONAL' || cashMode === 'AUTO' || hasOpenSession;

  /**
   * Cargar sesión actual del usuario
   */
  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await cashService.getCurrent();
      if (response.success) {
        setSession(response.data.session);
        setHasOpenSession(response.data.hasOpenSession);
        setExpectedCash(response.data.expectedCash || 0);
      }
    } catch (err) {
      console.error('Error cargando sesión de caja:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar sesión de caja');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refrescar solo el monto esperado de efectivo
   */
  const refreshExpectedCash = useCallback(async () => {
    if (!session) return;

    try {
      const response = await cashService.getCurrent();
      if (response.success && response.data.session) {
        setExpectedCash(response.data.expectedCash || 0);
        // Actualizar datos de la sesión también
        setSession(response.data.session);
      }
    } catch (err) {
      console.error('Error refrescando efectivo esperado:', err);
    }
  }, [session]);

  /**
   * Abrir nueva sesión de caja
   */
  const openSession = useCallback(async (data: {
    pointOfSaleId: string;
    openingAmount: number;
    notes?: string;
  }): Promise<CashSession | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await cashService.open(data);
      if (response.success) {
        const newSession = response.data.session;
        setSession(newSession);
        setHasOpenSession(true);
        setExpectedCash(Number(newSession.openingAmount));
        return newSession;
      }
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al abrir turno';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Cerrar sesión de caja actual
   */
  const closeSession = useCallback(async (data?: {
    count?: {
      bills?: Record<number, number>;
      coins?: Record<number, number>;
      vouchers?: number;
      checks?: number;
      otherValues?: number;
      otherValuesNote?: string;
    };
    notes?: string;
  }): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await cashService.close(data || {});
      if (response.success) {
        setSession(null);
        setHasOpenSession(false);
        setExpectedCash(0);
        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cerrar turno';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Suspender sesión (pausa temporal)
   */
  const suspendSession = useCallback(async (): Promise<boolean> => {
    if (!session) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await cashService.suspend();
      if (response.success) {
        setSession({ ...session, status: 'SUSPENDED' });
        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al suspender turno';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  /**
   * Reanudar sesión suspendida
   */
  const resumeSession = useCallback(async (): Promise<boolean> => {
    if (!session) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await cashService.resume();
      if (response.success) {
        setSession({ ...session, status: 'OPEN' });
        return true;
      }
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al reanudar turno';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Cargar sesión automáticamente al montar
  useEffect(() => {
    if (autoLoad) {
      loadSession();
    }
  }, [autoLoad, loadSession]);

  return {
    session,
    hasOpenSession,
    expectedCash,
    isLoading,
    error,
    cashModeRequired,
    canSellWithoutSession,
    loadSession,
    openSession,
    closeSession,
    suspendSession,
    resumeSession,
    refreshExpectedCash,
  };
}

export default useCashSession;
