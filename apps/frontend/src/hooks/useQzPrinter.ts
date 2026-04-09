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

  // Configure QZ Tray security (demo cert + unsigned)
  const setupSecurity = useCallback(async () => {
    const qz = await getQz();
    qz.security.setCertificatePromise(function(resolve: Function) {
      resolve("-----BEGIN CERTIFICATE-----\n" +
"MIIE9TCCAt2gAwIBAgIQNzkyMDI0MTIyMDE5MDI0NDANBgkqhkiG9w0BAQsFADCB\n" +
"mDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAk5ZMRswGQYDVQQKDBJRWiBJbmR1c3Ry\n" +
"aWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMsIExMQzEZMBcGA1UEAwwQ\n" +
"cXppbmR1c3RyaWVzLmNvbTEnMCUGCSqGSIb3DQEJARYYc3VwcG9ydEBxemluZHVz\n" +
"dHJpZXMuY29tMB4XDTI0MTIyMDE5MDI0NFoXDTI5MTIyMDE4NTMxOVowga4xFjAU\n" +
"BgNVBAYMDVVuaXRlZCBTdGF0ZXMxCzAJBgNVBAgMAk5ZMRIwEAYDVQQHDAlDYW5h\n" +
"c3RvdGExGzAZBgNVBAoMElFaIEluZHVzdHJpZXMsIExMQzEbMBkGA1UECwwSUVog\n" +
"SW5kdXN0cmllcywgTExDMRswGQYDVQQDDBJRWiBJbmR1c3RyaWVzLCBMTEMxHDAa\n" +
"BgkqhkiG9w0BCQEMDXN1cHBvcnRAcXouaW8wggEiMA0GCSqGSIb3DQEBAQUAA4IB\n" +
"DwAwggEKAoIBAQC+j6ewVhtLHbY3uBNgqNB5DSz+QX9Pz5Dm46bI9vt/Q1Q6BL8I\n" +
"dhaxT2PA1AY0fqQgkzlSrwqNCjWZcrNZRw/e54FGM8zf3azbHrQif6d7Wo1JK5oN\n" +
"kI3jdB54YVwHIAt6i3BcLIvyOHsPnrKjlpROz72Kx1kK5g0gLDuH5RYVM9KFK+HR\n" +
"fBc3JSfeg8nUkTqYJVzlT5AGRWPXeDWloqQqSyuB1t8DihNBReWyJHQ7a4yerLOI\n" +
"J6N0jAlLDx9yt9UznAxnoO+7tKBfxCbNJerGfePMOwRKq0gx+r8M/FTrAoj+yc+T\n" +
"SOYtuY/VZ79HCTP/vLgm1pGyrta1we24fVezAgMBAAGjIzAhMB8GA1UdIwQYMBaA\n" +
"FJCmULeE1LnqX/IFhBN4ReipdVRcMA0GCSqGSIb3DQEBCwUAA4ICAQAMvfp931Zt\n" +
"PgfqGXSrsM+GAVBxcRVm14MyldWfRr+MVaFZ6cH7c+fSs8hUt2qNPwHrnpK9eev5\n" +
"MPUL27hjfiTPwv1ojLJ180aMO0ZAfPfnKeLO8uTzY7GiPQeGK7Qh39kX9XxEOidG\n" +
"rMwfllZ6jJReS0ZGaX8LUXhh9RHGSYJhxgyUV7clB/dJch8Bbcd+DOxwc1POUHx1\n" +
"wWExKkoWzHCCYNvqxLC9p1eO2Elz9J9ynDjXtCBl7lssnoSUKtahBCKgN5tYmZZK\n" +
"NErKPQpbYk5yTEK1gybxhup8i2sGEJXZ9HRJLAl0UxB+eCu1ExWv7eGbcbIZJbeh\n" +
"bwRf03fatsqzCQbGboLWtMQfcxHrEu+5MdZwOFx8i+c0c2WYad2MkkzGYHBVHPtY\n" +
"o+PR61uIwJC2mNkPpX94CIFxSHyZumttyVKF4AhIPm9IMGTHaIr5M39zesQpVc7N\n" +
"VIgxmMuePBrLyh6vKvuqD7W3S2HWA/8IUX703tdhoXhv5lNo1j0oywSrrUkCvUvJ\n" +
"FjPS8+VUtVZNl7SVetQTexdcUwoADj6c1UwL9QWItskJ5Myesco3ZY0O+3QbgCuQ\n" +
"SRqN5D0qdaLNMdEwh1YekUp4i1jm0jzPzia+WvJrW1k1ZafV6ep+YkMBkC1SFYFw\n" +
"1Mdy+fYGyXlSn/Mvou//SSb0fUMIpXE9NA==\n" +
"-----END CERTIFICATE-----");
    });
    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise(function() {
      return function(resolve: Function) {
        resolve();
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
