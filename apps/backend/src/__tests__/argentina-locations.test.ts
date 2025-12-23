/**
 * Tests para el archivo de ciudades argentinas por provincia
 */
import {
  argentineProvinces,
  getCitiesByProvince,
  getProvinceCapital,
  findProvinceByCity,
  isCityInProvince,
  getAllProvinces,
  getTotalCitiesCount,
} from '../utils/argentina-locations';

describe('Argentina Locations', () => {
  describe('argentineProvinces', () => {
    it('should have 24 provinces', () => {
      const provinces = Object.keys(argentineProvinces);
      expect(provinces).toHaveLength(24);
    });

    it('should include all provinces', () => {
      const expectedProvinces = [
        'Buenos Aires',
        'Capital Federal',
        'Catamarca',
        'Chaco',
        'Chubut',
        'Córdoba',
        'Corrientes',
        'Entre Ríos',
        'Formosa',
        'Jujuy',
        'La Pampa',
        'La Rioja',
        'Mendoza',
        'Misiones',
        'Neuquén',
        'Río Negro',
        'Salta',
        'San Juan',
        'San Luis',
        'Santa Cruz',
        'Santa Fe',
        'Santiago del Estero',
        'Tierra del Fuego',
        'Tucumán',
      ];

      expectedProvinces.forEach(province => {
        expect(argentineProvinces[province]).toBeDefined();
      });
    });

    it('should have capital for each province', () => {
      Object.values(argentineProvinces).forEach(province => {
        expect(province.capital).toBeTruthy();
        expect(typeof province.capital).toBe('string');
      });
    });

    it('should have at least one city per province', () => {
      Object.values(argentineProvinces).forEach(province => {
        expect(province.cities.length).toBeGreaterThan(0);
      });
    });

    it('should include capital in cities list', () => {
      Object.values(argentineProvinces).forEach(province => {
        // Capital Federal uses "Capital Federal" as capital which should be in cities
        expect(province.cities).toContain(province.capital);
      });
    });
  });

  describe('getCitiesByProvince', () => {
    it('should return cities for Buenos Aires', () => {
      const cities = getCitiesByProvince('Buenos Aires');
      expect(cities).toContain('La Plata');
      expect(cities).toContain('Mar del Plata');
      expect(cities.length).toBeGreaterThan(50);
    });

    it('should return cities for Córdoba', () => {
      const cities = getCitiesByProvince('Córdoba');
      expect(cities).toContain('Córdoba');
      expect(cities).toContain('Villa Carlos Paz');
    });

    it('should return empty array for unknown province', () => {
      const cities = getCitiesByProvince('Unknown Province');
      expect(cities).toEqual([]);
    });

    it('should be case insensitive', () => {
      const cities1 = getCitiesByProvince('buenos aires');
      const cities2 = getCitiesByProvince('BUENOS AIRES');
      expect(cities1.length).toBeGreaterThan(0);
      expect(cities1).toEqual(cities2);
    });
  });

  describe('getProvinceCapital', () => {
    it('should return La Plata for Buenos Aires', () => {
      expect(getProvinceCapital('Buenos Aires')).toBe('La Plata');
    });

    it('should return Capital Federal for Capital Federal', () => {
      expect(getProvinceCapital('Capital Federal')).toBe('Capital Federal');
    });

    it('should return Córdoba for Córdoba', () => {
      expect(getProvinceCapital('Córdoba')).toBe('Córdoba');
    });

    it('should return Ushuaia for Tierra del Fuego', () => {
      expect(getProvinceCapital('Tierra del Fuego')).toBe('Ushuaia');
    });

    it('should return empty string for unknown province', () => {
      expect(getProvinceCapital('Unknown')).toBe('');
    });

    it('should be case insensitive', () => {
      expect(getProvinceCapital('mendoza')).toBe('Mendoza');
      expect(getProvinceCapital('MENDOZA')).toBe('Mendoza');
    });
  });

  describe('findProvinceByCity', () => {
    it('should find Buenos Aires for Mar del Plata', () => {
      expect(findProvinceByCity('Mar del Plata')).toBe('Buenos Aires');
    });

    it('should find Córdoba for Villa Carlos Paz', () => {
      expect(findProvinceByCity('Villa Carlos Paz')).toBe('Córdoba');
    });

    it('should find Capital Federal for Palermo', () => {
      expect(findProvinceByCity('Palermo')).toBe('Capital Federal');
    });

    it('should return null for unknown city', () => {
      expect(findProvinceByCity('Ciudad Inexistente')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(findProvinceByCity('mar del plata')).toBe('Buenos Aires');
      expect(findProvinceByCity('MAR DEL PLATA')).toBe('Buenos Aires');
    });
  });

  describe('isCityInProvince', () => {
    it('should return true for Mar del Plata in Buenos Aires', () => {
      expect(isCityInProvince('Mar del Plata', 'Buenos Aires')).toBe(true);
    });

    it('should return false for Mar del Plata in Córdoba', () => {
      expect(isCityInProvince('Mar del Plata', 'Córdoba')).toBe(false);
    });

    it('should return true for Córdoba in Córdoba', () => {
      expect(isCityInProvince('Córdoba', 'Córdoba')).toBe(true);
    });

    it('should return false for unknown city', () => {
      expect(isCityInProvince('Ciudad Inexistente', 'Buenos Aires')).toBe(false);
    });

    it('should return false for unknown province', () => {
      expect(isCityInProvince('La Plata', 'Unknown Province')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isCityInProvince('la plata', 'buenos aires')).toBe(true);
      expect(isCityInProvince('LA PLATA', 'BUENOS AIRES')).toBe(true);
    });
  });

  describe('getAllProvinces', () => {
    it('should return 24 provinces', () => {
      const provinces = getAllProvinces();
      expect(provinces).toHaveLength(24);
    });

    it('should include major provinces', () => {
      const provinces = getAllProvinces();
      expect(provinces).toContain('Buenos Aires');
      expect(provinces).toContain('Capital Federal');
      expect(provinces).toContain('Córdoba');
      expect(provinces).toContain('Santa Fe');
      expect(provinces).toContain('Mendoza');
    });
  });

  describe('getTotalCitiesCount', () => {
    it('should return a positive number', () => {
      const count = getTotalCitiesCount();
      expect(count).toBeGreaterThan(100);
    });

    it('should be consistent with province cities', () => {
      let manualCount = 0;
      Object.values(argentineProvinces).forEach(province => {
        manualCount += province.cities.length;
      });
      expect(getTotalCitiesCount()).toBe(manualCount);
    });
  });

  describe('Provincial capitals', () => {
    const expectedCapitals: Record<string, string> = {
      'Buenos Aires': 'La Plata',
      'Capital Federal': 'Capital Federal',
      'Catamarca': 'Catamarca',
      'Chaco': 'Resistencia',
      'Chubut': 'Rawson',
      'Córdoba': 'Córdoba',
      'Corrientes': 'Corrientes',
      'Entre Ríos': 'Paraná',
      'Formosa': 'Formosa',
      'Jujuy': 'San Salvador de Jujuy',
      'La Pampa': 'Santa Rosa',
      'La Rioja': 'La Rioja',
      'Mendoza': 'Mendoza',
      'Misiones': 'Posadas',
      'Neuquén': 'Neuquén',
      'Río Negro': 'Viedma',
      'Salta': 'Salta',
      'San Juan': 'San Juan',
      'San Luis': 'San Luis',
      'Santa Cruz': 'Río Gallegos',
      'Santa Fe': 'Santa Fe',
      'Santiago del Estero': 'Santiago del Estero',
      'Tierra del Fuego': 'Ushuaia',
      'Tucumán': 'San Miguel de Tucumán',
    };

    Object.entries(expectedCapitals).forEach(([province, capital]) => {
      it(`should have ${capital} as capital of ${province}`, () => {
        expect(getProvinceCapital(province)).toBe(capital);
      });
    });
  });
});
