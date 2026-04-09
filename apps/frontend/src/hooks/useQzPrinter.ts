import { useState, useCallback, useEffect, useRef } from 'react';

// QZ Tray doesn't have TypeScript types, declare minimal interface
declare const qz: {
  websocket: {
    connect: (opts?: { retries?: number; delay?: number }) => Promise<void>;
    disconnect: () => Promise<void>;
    isActive: () => boolean;
  };
  printers: {
    find: (query?: string) => Promise<string | string[]>;
    getDefault: () => Promise<string>;
  };
  configs: {
    create: (printer: string, opts?: Record<string, unknown>) => unknown;
  };
  print: (config: unknown, data: Array<string | Record<string, unknown>>) => Promise<void>;
  security: {
    setCertificatePromise: (fn: (resolve: (cert: string) => void, reject: (err: string) => void) => void) => void;
    setSignatureAlgorithm: (algo: string) => void;
    setSignaturePromise: (fn: (toSign: string) => (resolve: Function, reject: Function) => void) => void;
  };
};

export function useQzPrinter() {
  const [connected, setConnected] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(() => {
    return localStorage.getItem('qz-printer') || null;
  });
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const initialized = useRef(false);

  // Load qz-tray dynamically (it uses window globals)
  const getQz = useCallback(async () => {
    if ((window as any).qz) return (window as any).qz;
    const mod = await import('qz-tray');
    return mod.default || mod;
  }, []);

  // Configure QZ Tray security with our own certificate
  const setupSecurity = useCallback(async () => {
    const qz = await getQz();
    qz.security.setCertificatePromise(function(resolve: Function, reject: Function) {
      fetch('/qz/digital-certificate.pem', { cache: 'no-store' })
        .then((res: Response) => res.ok ? res.text().then((t: string) => resolve(t)) : reject('No se pudo cargar el certificado'))
        .catch(() => resolve()); // Fallback anónimo si no existe el archivo
    });
    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise(function() {
      return function(resolve: Function) {
        resolve(); // Sin firma — requiere que el cert esté cargado como trusted en QZ Tray
      };
    });
  }, [getQz]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const qz = await getQz();
      await setupSecurity();
      if (qz.websocket.isActive()) {
        setConnected(true);
        const list = await qz.printers.find();
        setPrinters(Array.isArray(list) ? list : [list]);
        setConnecting(false);
        return;
      }
      await qz.websocket.connect({ retries: 2, delay: 1 });
      setConnected(true);

      const list = await qz.printers.find();
      setPrinters(Array.isArray(list) ? list : [list]);
    } catch (err: any) {
      setError('No se pudo conectar a QZ Tray. Verificá que esté instalado y corriendo.');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [getQz]);

  const disconnect = useCallback(async () => {
    try {
      const qz = await getQz();
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } catch {
      // ignore
    }
    setConnected(false);
  }, [getQz]);

  const selectPrinter = useCallback((name: string) => {
    setSelectedPrinter(name);
    localStorage.setItem('qz-printer', name);
  }, []);

  const printRaw = useCallback(async (data: string[], printerName?: string) => {
    const qz = await getQz();
    if (!qz.websocket.isActive()) {
      throw new Error('QZ Tray no está conectado');
    }
    const printer = printerName || selectedPrinter;
    if (!printer) {
      throw new Error('No hay impresora seleccionada');
    }
    const config = qz.configs.create(printer);
    await qz.print(config, data);
  }, [getQz, selectedPrinter]);

  // Check connection on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Try to connect silently
    connect().catch(() => {});
  }, [connect]);

  // Cleanup
  useEffect(() => {
    return () => {
      getQz().then(qz => {
        if (qz.websocket.isActive()) {
          qz.websocket.disconnect().catch(() => {});
        }
      }).catch(() => {});
    };
  }, [getQz]);

  return {
    connected,
    connecting,
    printers,
    selectedPrinter,
    error,
    connect,
    disconnect,
    selectPrinter,
    printRaw,
  };
}
