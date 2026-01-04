/**
 * Tests para la generación de códigos de cajas MP QR
 */

describe('MP Cashier Code Generation', () => {
  // Simular la lógica de generación de códigos
  const generateExternalId = (branchCode: string, cashierCount: number): string => {
    const cleanCode = branchCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const nextNumber = cashierCount + 1;
    return `${cleanCode}CAJA${String(nextNumber).padStart(2, '0')}`;
  };

  describe('generateExternalId', () => {
    it('should generate SUC1CAJA01 for first cashier of SUC-1', () => {
      expect(generateExternalId('SUC-1', 0)).toBe('SUC1CAJA01');
    });

    it('should generate SUC1CAJA02 for second cashier of SUC-1', () => {
      expect(generateExternalId('SUC-1', 1)).toBe('SUC1CAJA02');
    });

    it('should generate SUC2CAJA01 for first cashier of SUC-2', () => {
      expect(generateExternalId('SUC-2', 0)).toBe('SUC2CAJA01');
    });

    it('should handle branch codes without hyphens', () => {
      expect(generateExternalId('SUCURSAL1', 0)).toBe('SUCURSAL1CAJA01');
    });

    it('should handle lowercase branch codes', () => {
      expect(generateExternalId('suc-1', 0)).toBe('SUC1CAJA01');
    });

    it('should handle branch codes with spaces', () => {
      expect(generateExternalId('SUC 1', 0)).toBe('SUC1CAJA01');
    });

    it('should pad single digit cashier numbers', () => {
      expect(generateExternalId('SUC-1', 8)).toBe('SUC1CAJA09');
    });

    it('should handle double digit cashier numbers', () => {
      expect(generateExternalId('SUC-1', 9)).toBe('SUC1CAJA10');
    });

    it('should handle triple digit cashier numbers', () => {
      expect(generateExternalId('SUC-1', 99)).toBe('SUC1CAJA100');
    });
  });

  // Simular la lógica de limpieza del code de sucursal
  const cleanBranchCode = (code: string): string => {
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  };

  describe('cleanBranchCode', () => {
    it('should remove hyphens', () => {
      expect(cleanBranchCode('SUC-1')).toBe('SUC1');
    });

    it('should remove spaces', () => {
      expect(cleanBranchCode('SUC 1')).toBe('SUC1');
    });

    it('should convert to uppercase', () => {
      expect(cleanBranchCode('suc-1')).toBe('SUC1');
    });

    it('should remove special characters', () => {
      expect(cleanBranchCode('SUC_1!@#')).toBe('SUC1');
    });

    it('should handle complex codes', () => {
      expect(cleanBranchCode('Sucursal-Centro-1')).toBe('SUCURSALCENTRO1');
    });
  });
});

describe('MP Store External ID Generation', () => {
  const generateStoreExternalId = (branchCode: string): string => {
    return branchCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  };

  it('should generate SUC1 for SUC-1', () => {
    expect(generateStoreExternalId('SUC-1')).toBe('SUC1');
  });

  it('should generate SUC2 for SUC-2', () => {
    expect(generateStoreExternalId('SUC-2')).toBe('SUC2');
  });

  it('should handle codes with multiple hyphens', () => {
    expect(generateStoreExternalId('SUC-CENTRO-1')).toBe('SUCCENTRO1');
  });
});
