/**
 * Utilidades para normalización de ubicaciones para la API de Mercado Pago
 */

// Mapeo de nombres de provincias a valores válidos de MP
const stateMap: Record<string, string> = {
  // Variaciones comunes
  'bsas': 'Buenos Aires',
  'bs as': 'Buenos Aires',
  'bs. as.': 'Buenos Aires',
  'buenos aires': 'Buenos Aires',
  'pcia buenos aires': 'Buenos Aires',
  'provincia de buenos aires': 'Buenos Aires',
  'caba': 'Capital Federal',
  'capital': 'Capital Federal',
  'capital federal': 'Capital Federal',
  'ciudad de buenos aires': 'Capital Federal',
  'ciudad autonoma de buenos aires': 'Capital Federal',
  'cordoba': 'Córdoba',
  'córdoba': 'Córdoba',
  'cba': 'Córdoba',
  'entre rios': 'Entre Ríos',
  'entreríos': 'Entre Ríos',
  'neuquen': 'Neuquén',
  'neuquén': 'Neuquén',
  'rio negro': 'Río Negro',
  'río negro': 'Río Negro',
  'tucuman': 'Tucumán',
  'tucumán': 'Tucumán',
  'catamarca': 'Catamarca',
  'chaco': 'Chaco',
  'chubut': 'Chubut',
  'corrientes': 'Corrientes',
  'formosa': 'Formosa',
  'jujuy': 'Jujuy',
  'la pampa': 'La Pampa',
  'la rioja': 'La Rioja',
  'mendoza': 'Mendoza',
  'misiones': 'Misiones',
  'salta': 'Salta',
  'san juan': 'San Juan',
  'san luis': 'San Luis',
  'santa cruz': 'Santa Cruz',
  'santa fe': 'Santa Fe',
  'santiago del estero': 'Santiago del Estero',
  'tierra del fuego': 'Tierra del Fuego',
};

// Ciudad por defecto según la provincia (MP requiere ciudades específicas)
const cityByState: Record<string, string> = {
  'Buenos Aires': 'La Plata',
  'Capital Federal': 'Capital Federal',
  'Catamarca': 'Catamarca',
  'Chaco': 'Resistencia',
  'Chubut': 'Rawson',
  'Corrientes': 'Corrientes',
  'Córdoba': 'Córdoba',
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

/**
 * Normaliza el nombre de una provincia a un valor válido para la API de MP
 */
export function normalizeStateName(state: string | null): string {
  if (!state) return 'Buenos Aires';
  const normalized = state.toLowerCase().trim();
  return stateMap[normalized] || state;
}

/**
 * Obtiene la ciudad por defecto (capital) de una provincia
 * MP tiene una lista limitada de ciudades válidas por provincia
 */
export function getDefaultCityForState(state: string): string {
  return cityByState[state] || 'Capital Federal';
}

/**
 * Lista de provincias válidas en MP
 */
export const validStates = [
  'Buenos Aires',
  'Capital Federal',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Corrientes',
  'Córdoba',
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
