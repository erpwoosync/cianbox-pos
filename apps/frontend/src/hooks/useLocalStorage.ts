import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

/**
 * Custom hook para sincronizar estado con localStorage de forma robusta
 * Escribe en localStorage en cada cambio de estado
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Inicializar estado desde localStorage (lazy initialization)
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        console.log(`[useLocalStorage] Cargado ${key}:`, parsed);
        return parsed;
      }
    } catch (error) {
      console.error(`[useLocalStorage] Error cargando ${key}:`, error);
    }
    console.log(`[useLocalStorage] Usando valor inicial para ${key}`);
    return initialValue;
  });

  // Ref para evitar guardar en el primer render
  const isFirstMount = useRef(true);

  // Guardar en localStorage cuando cambia el estado
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
      console.log(`[useLocalStorage] Guardado ${key}:`, storedValue);
    } catch (error) {
      console.error(`[useLocalStorage] Error guardando ${key}:`, error);
    }
  }, [key, storedValue]);

  // Escuchar cambios desde otras pestañas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue);
          console.log(`[useLocalStorage] Cambio externo en ${key}:`, newValue);
          setStoredValue(newValue);
        } catch (error) {
          console.error(`[useLocalStorage] Error parseando cambio:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setStoredValue];
}
