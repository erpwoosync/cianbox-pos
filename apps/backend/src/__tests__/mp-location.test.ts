import { normalizeStateName, getDefaultCityForState, getBestCityForState, normalizeLocation, validStates } from '../utils/mp-location';

describe('MP Location Utils', () => {
  describe('normalizeStateName', () => {
    it('should return Buenos Aires for null input', () => {
      expect(normalizeStateName(null)).toBe('Buenos Aires');
    });

    it('should return Buenos Aires for empty string', () => {
      expect(normalizeStateName('')).toBe('Buenos Aires');
    });

    // Variaciones de Buenos Aires
    it('should normalize "bsas" to Buenos Aires', () => {
      expect(normalizeStateName('bsas')).toBe('Buenos Aires');
    });

    it('should normalize "bs as" to Buenos Aires', () => {
      expect(normalizeStateName('bs as')).toBe('Buenos Aires');
    });

    it('should normalize "Bs. As." to Buenos Aires', () => {
      expect(normalizeStateName('Bs. As.')).toBe('Buenos Aires');
    });

    it('should normalize "BUENOS AIRES" to Buenos Aires (case insensitive)', () => {
      expect(normalizeStateName('BUENOS AIRES')).toBe('Buenos Aires');
    });

    // Variaciones de Capital Federal
    it('should normalize "caba" to Capital Federal', () => {
      expect(normalizeStateName('caba')).toBe('Capital Federal');
    });

    it('should normalize "CABA" to Capital Federal', () => {
      expect(normalizeStateName('CABA')).toBe('Capital Federal');
    });

    it('should normalize "Ciudad de Buenos Aires" to Capital Federal', () => {
      expect(normalizeStateName('Ciudad de Buenos Aires')).toBe('Capital Federal');
    });

    // Variaciones de Córdoba
    it('should normalize "cordoba" to Córdoba', () => {
      expect(normalizeStateName('cordoba')).toBe('Córdoba');
    });

    it('should normalize "Córdoba" to Córdoba', () => {
      expect(normalizeStateName('Córdoba')).toBe('Córdoba');
    });

    it('should normalize "cba" to Córdoba', () => {
      expect(normalizeStateName('cba')).toBe('Córdoba');
    });

    // Otras provincias con acentos
    it('should normalize "tucuman" to Tucumán', () => {
      expect(normalizeStateName('tucuman')).toBe('Tucumán');
    });

    it('should normalize "neuquen" to Neuquén', () => {
      expect(normalizeStateName('neuquen')).toBe('Neuquén');
    });

    it('should normalize "entre rios" to Entre Ríos', () => {
      expect(normalizeStateName('entre rios')).toBe('Entre Ríos');
    });

    it('should normalize "rio negro" to Río Negro', () => {
      expect(normalizeStateName('rio negro')).toBe('Río Negro');
    });

    // Provincias sin normalización especial
    it('should keep valid state names unchanged', () => {
      expect(normalizeStateName('Mendoza')).toBe('Mendoza');
      expect(normalizeStateName('mendoza')).toBe('Mendoza');
      expect(normalizeStateName('salta')).toBe('Salta');
      expect(normalizeStateName('jujuy')).toBe('Jujuy');
    });

    // Unknown values should be returned as-is
    it('should return unknown values as-is', () => {
      expect(normalizeStateName('Unknown State')).toBe('Unknown State');
    });
  });

  describe('getDefaultCityForState', () => {
    it('should return La Plata for Buenos Aires', () => {
      expect(getDefaultCityForState('Buenos Aires')).toBe('La Plata');
    });

    it('should return Capital Federal for Capital Federal', () => {
      expect(getDefaultCityForState('Capital Federal')).toBe('Capital Federal');
    });

    it('should return Córdoba for Córdoba', () => {
      expect(getDefaultCityForState('Córdoba')).toBe('Córdoba');
    });

    it('should return San Miguel de Tucumán for Tucumán', () => {
      expect(getDefaultCityForState('Tucumán')).toBe('San Miguel de Tucumán');
    });

    it('should return Paraná for Entre Ríos', () => {
      expect(getDefaultCityForState('Entre Ríos')).toBe('Paraná');
    });

    it('should return Ushuaia for Tierra del Fuego', () => {
      expect(getDefaultCityForState('Tierra del Fuego')).toBe('Ushuaia');
    });

    it('should return Capital Federal for unknown state', () => {
      expect(getDefaultCityForState('Unknown')).toBe('Capital Federal');
    });

    // Test all provinces have a city
    it('should have a city for all valid states', () => {
      validStates.forEach(state => {
        const city = getDefaultCityForState(state);
        expect(city).toBeTruthy();
        expect(typeof city).toBe('string');
      });
    });
  });

  describe('validStates', () => {
    it('should contain 24 provinces', () => {
      expect(validStates).toHaveLength(24);
    });

    it('should include all major provinces', () => {
      expect(validStates).toContain('Buenos Aires');
      expect(validStates).toContain('Capital Federal');
      expect(validStates).toContain('Córdoba');
      expect(validStates).toContain('Santa Fe');
      expect(validStates).toContain('Mendoza');
    });

    it('should include provinces with special characters', () => {
      expect(validStates).toContain('Córdoba');
      expect(validStates).toContain('Entre Ríos');
      expect(validStates).toContain('Neuquén');
      expect(validStates).toContain('Río Negro');
      expect(validStates).toContain('Tucumán');
    });
  });

  describe('getBestCityForState', () => {
    it('should return the city if it exists in the province', () => {
      expect(getBestCityForState('Villa del Rosario', 'Córdoba')).toBe('Villa del Rosario');
    });

    it('should return the city case-normalized', () => {
      expect(getBestCityForState('villa del rosario', 'Córdoba')).toBe('Villa del rosario');
    });

    it('should return Mar del Plata for Buenos Aires', () => {
      expect(getBestCityForState('Mar del Plata', 'Buenos Aires')).toBe('Mar del Plata');
    });

    it('should return capital if city is null', () => {
      expect(getBestCityForState(null, 'Córdoba')).toBe('Córdoba');
    });

    it('should return capital if city is not in province', () => {
      // Mar del Plata is in Buenos Aires, not Córdoba
      expect(getBestCityForState('Mar del Plata', 'Córdoba')).toBe('Córdoba');
    });

    it('should return capital for unknown city', () => {
      expect(getBestCityForState('Ciudad Inexistente', 'Mendoza')).toBe('Mendoza');
    });

    it('should handle Villa Carlos Paz in Córdoba', () => {
      expect(getBestCityForState('Villa Carlos Paz', 'Córdoba')).toBe('Villa Carlos Paz');
    });
  });

  describe('normalizeLocation', () => {
    it('should normalize Villa del Rosario, Córdoba correctly', () => {
      const result = normalizeLocation('Villa del Rosario', 'Córdoba');
      expect(result.state).toBe('Córdoba');
      expect(result.city).toBe('Villa del Rosario');
    });

    it('should normalize with lowercase inputs', () => {
      const result = normalizeLocation('villa del rosario', 'cordoba');
      expect(result.state).toBe('Córdoba');
      expect(result.city).toBe('Villa del rosario');
    });

    it('should use capital for null city', () => {
      const result = normalizeLocation(null, 'Córdoba');
      expect(result.state).toBe('Córdoba');
      expect(result.city).toBe('Córdoba');
    });

    it('should normalize CABA correctly', () => {
      const result = normalizeLocation('Palermo', 'CABA');
      expect(result.state).toBe('Capital Federal');
      expect(result.city).toBe('Palermo');
    });

    it('should handle unknown city with fallback to capital', () => {
      const result = normalizeLocation('Ciudad Desconocida', 'Mendoza');
      expect(result.state).toBe('Mendoza');
      expect(result.city).toBe('Mendoza');
    });

    it('should normalize Buenos Aires abbreviations', () => {
      const result = normalizeLocation('La Plata', 'bsas');
      expect(result.state).toBe('Buenos Aires');
      expect(result.city).toBe('La Plata');
    });
  });
});
