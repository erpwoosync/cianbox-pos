/**
 * Tests para la preparación de datos de Store para la API de MP
 */
import { normalizeStateName, getDefaultCityForState } from '../utils/mp-location';

describe('MP Store Data Preparation', () => {
  // Simular la estructura de una Branch
  interface Branch {
    id: string;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    state: string | null;
  }

  // Simular la preparación de datos para crear un Store
  const prepareStoreData = (branch: Branch) => {
    const externalId = branch.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const stateName = normalizeStateName(branch.state);
    const cityName = getDefaultCityForState(stateName);

    return {
      name: branch.name,
      external_id: externalId,
      location: {
        street_name: branch.address || 'Sin dirección',
        street_number: '0',
        city_name: cityName,
        state_name: stateName,
      },
    };
  };

  describe('prepareStoreData', () => {
    it('should prepare data for a complete branch', () => {
      const branch: Branch = {
        id: '1',
        name: 'Sucursal Centro',
        code: 'SUC-1',
        address: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        state: 'Buenos Aires',
      };

      const result = prepareStoreData(branch);

      expect(result.name).toBe('Sucursal Centro');
      expect(result.external_id).toBe('SUC1');
      expect(result.location.street_name).toBe('Av. Corrientes 1234');
      expect(result.location.state_name).toBe('Buenos Aires');
      expect(result.location.city_name).toBe('La Plata'); // Default city for Buenos Aires
    });

    it('should handle branch with null address', () => {
      const branch: Branch = {
        id: '2',
        name: 'Sucursal Norte',
        code: 'SUC-2',
        address: null,
        city: null,
        state: 'Córdoba',
      };

      const result = prepareStoreData(branch);

      expect(result.location.street_name).toBe('Sin dirección');
      expect(result.location.state_name).toBe('Córdoba');
      expect(result.location.city_name).toBe('Córdoba');
    });

    it('should normalize state name with common variations', () => {
      const branch: Branch = {
        id: '3',
        name: 'Sucursal CABA',
        code: 'SUC-3',
        address: 'Av. Santa Fe 100',
        city: 'CABA',
        state: 'CABA',
      };

      const result = prepareStoreData(branch);

      expect(result.location.state_name).toBe('Capital Federal');
      expect(result.location.city_name).toBe('Capital Federal');
    });

    it('should handle branch with accented state name', () => {
      const branch: Branch = {
        id: '4',
        name: 'Sucursal Córdoba',
        code: 'SUC-CBA',
        address: 'Av. Colón 500',
        city: 'Córdoba',
        state: 'cordoba', // lowercase without accent
      };

      const result = prepareStoreData(branch);

      expect(result.external_id).toBe('SUCCBA');
      expect(result.location.state_name).toBe('Córdoba');
      expect(result.location.city_name).toBe('Córdoba');
    });

    it('should handle branch with null state', () => {
      const branch: Branch = {
        id: '5',
        name: 'Sucursal Sin Provincia',
        code: 'SUC-5',
        address: 'Calle 123',
        city: null,
        state: null,
      };

      const result = prepareStoreData(branch);

      expect(result.location.state_name).toBe('Buenos Aires');
      expect(result.location.city_name).toBe('La Plata');
    });
  });

  describe('External ID validation', () => {
    it('should only contain alphanumeric characters', () => {
      const codes = ['SUC-1', 'SUC_2', 'SUC 3', 'SUC.4', 'SUC!5'];

      codes.forEach(code => {
        const externalId = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        expect(externalId).toMatch(/^[A-Z0-9]+$/);
      });
    });

    it('should be uppercase', () => {
      const code = 'suc-lowercase';
      const externalId = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      expect(externalId).toBe('SUCLOWERCASE');
    });
  });
});
