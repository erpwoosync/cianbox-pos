import { useState, useEffect, useCallback, useRef } from 'react';
import db, { STORES } from '../services/indexedDB';

type StoreName = typeof STORES[keyof typeof STORES];

/**
 * Hook para usar IndexedDB como almacenamiento reactivo
 * Similar a useLocalStorage pero con IndexedDB
 */
export function useIndexedDB<T extends { id: string }>(
  storeName: StoreName,
  initialValue: T[]
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T[]>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const initialValueRef = useRef(initialValue);
  const hasInitialized = useRef(false);

  // Cargar datos al montar
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const loadData = async () => {
      try {
        const data = await db.getAll<T>(storeName);
        if (data.length > 0) {
          setStoredValue(data);
        } else if (initialValueRef.current.length > 0) {
          // Si no hay datos en IndexedDB, guardar el valor inicial
          await db.putMany(storeName, initialValueRef.current);
          setStoredValue(initialValueRef.current);
        }
      } catch (error) {
        console.error(`Error loading from IndexedDB (${storeName}):`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [storeName]);

  // Función para actualizar el valor
  const setValue = useCallback(
    (value: T[] | ((prev: T[]) => T[])) => {
      setStoredValue((prevValue) => {
        const newValue = value instanceof Function ? value(prevValue) : value;

        // Guardar en IndexedDB de forma asíncrona
        (async () => {
          try {
            // Limpiar store y guardar nuevos datos
            await db.clear(storeName);
            if (newValue.length > 0) {
              await db.putMany(storeName, newValue);
            }
          } catch (error) {
            console.error(`Error saving to IndexedDB (${storeName}):`, error);
          }
        })();

        return newValue;
      });
    },
    [storeName]
  );

  return [storedValue, setValue, isLoading];
}

/**
 * Hook para un solo item en IndexedDB
 */
export function useIndexedDBItem<T extends { id: string }>(
  storeName: StoreName,
  id: string,
  initialValue: T | null
): [T | null, (value: T | null) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T | null>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos al montar
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await db.getById<T>(storeName, id);
        if (data) {
          setStoredValue(data);
        }
      } catch (error) {
        console.error(`Error loading item from IndexedDB (${storeName}):`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [storeName, id]);

  // Función para actualizar el valor
  const setValue = useCallback(
    (value: T | null) => {
      setStoredValue(value);

      // Guardar en IndexedDB de forma asíncrona
      (async () => {
        try {
          if (value) {
            await db.put(storeName, value);
          } else {
            await db.remove(storeName, id);
          }
        } catch (error) {
          console.error(`Error saving item to IndexedDB (${storeName}):`, error);
        }
      })();
    },
    [storeName, id]
  );

  return [storedValue, setValue, isLoading];
}

export default useIndexedDB;
