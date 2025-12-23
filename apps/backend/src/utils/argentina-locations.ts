/**
 * Ciudades de Argentina organizadas por provincia
 * Para validación y mapeo con la API de Mercado Pago
 */

export interface Province {
  name: string;
  capital: string;
  cities: string[];
}

export const argentineProvinces: Record<string, Province> = {
  'Buenos Aires': {
    name: 'Buenos Aires',
    capital: 'La Plata',
    cities: [
      'La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil', 'Olavarría',
      'Pergamino', 'Junín', 'Necochea', 'San Nicolás', 'Zárate',
      'Campana', 'Luján', 'Mercedes', 'Chivilcoy', 'Azul',
      'Trenque Lauquen', 'Balcarce', 'Dolores', 'Chascomús', 'Lobos',
      'San Pedro', 'Baradero', 'Arrecifes', 'Salto', 'Rojas',
      'Chacabuco', 'Bragado', 'Pehuajó', '9 de Julio', 'Carlos Casares',
      'General Villegas', 'Lincoln', 'General Pinto', 'Bolívar', 'Saladillo',
      'Las Flores', 'Rauch', 'Ayacucho', 'Maipú', 'General Belgrano',
      'Monte', 'Roque Pérez', 'Navarro', 'Suipacha', 'Cañuelas',
      'San Vicente', 'Brandsen', 'General Paz', 'Pila', 'Tordillo',
      'General Lavalle', 'General Madariaga', 'Pinamar', 'Villa Gesell', 'Mar Chiquita',
      'General Alvarado', 'Lobería', 'San Cayetano', 'Tres Arroyos', 'Coronel Dorrego',
      'Monte Hermoso', 'Coronel Rosales', 'Coronel Pringles', 'Coronel Suárez', 'Saavedra',
      'Tornquist', 'Puán', 'Adolfo Alsina', 'Guaminí', 'Daireaux',
      'General La Madrid', 'Laprida', 'Benito Juárez', 'Tapalqué', 'General Alvear',
      'Alberti', 'Leandro N. Alem', 'General Arenales', 'General Viamonte', 'Florentino Ameghino',
      'Rivadavia', 'Pellegrini', 'Salliqueló', 'Tres Lomas', 'Hipólito Yrigoyen',
      'Avellaneda', 'Lanús', 'Lomas de Zamora', 'Quilmes', 'Berazategui',
      'Florencio Varela', 'Almirante Brown', 'Esteban Echeverría', 'Ezeiza', 'La Matanza',
      'Merlo', 'Moreno', 'Morón', 'Hurlingham', 'Ituzaingó',
      'Tres de febrero', 'San Martín', 'Vicente López', 'San Isidro', 'San Fernando',
      'Tigre', 'Escobar', 'Pilar', 'Malvinas Argentinas', 'José C. Paz',
      'San Miguel', 'General Rodríguez', 'Marcos Paz', 'General Las Heras', 'Exaltación de la Cruz',
      'Ensenada', 'Berisso', 'Magdalena', 'Punta Indio', 'Presidente Perón',
      'San Clemente Del Tuyu', 'Santa Teresita', 'San Bernardo Del Tuyu', 'Mar de Ajo',
      'Mar del Tuyu', 'Costa del Este', 'Cariló', 'Valeria del Mar', 'Ostende',
      'Miramar', 'Mar del Sur', 'San Clemente', 'Las Toninas', 'La Lucila del Mar',
      'Mar Azul', 'Mar de las Pampas', 'Costa Esmeralda', 'Verónica', 'Ingeniero Allan',
    ],
  },

  'Capital Federal': {
    name: 'Capital Federal',
    capital: 'Capital Federal',
    cities: [
      'Capital Federal', 'Buenos Aires', 'CABA',
      'Palermo', 'Recoleta', 'Belgrano', 'Caballito', 'Flores',
      'Villa Urquiza', 'Villa Devoto', 'Villa del Parque', 'Almagro', 'Boedo',
      'San Telmo', 'La Boca', 'Barracas', 'Constitución', 'Monserrat',
      'Puerto Madero', 'Retiro', 'San Nicolás', 'Balvanera', 'Once',
      'Congreso', 'Tribunales', 'Microcentro', 'San Cristóbal', 'Parque Patricios',
      'Nueva Pompeya', 'Villa Soldati', 'Villa Lugano', 'Mataderos', 'Liniers',
      'Villa Luro', 'Vélez Sársfield', 'Floresta', 'Monte Castro', 'Villa Real',
      'Versalles', 'Villa Pueyrredón', 'Agronomía', 'Paternal', 'Chacarita',
      'Villa Crespo', 'Colegiales', 'Núñez', 'Saavedra', 'Villa Ortúzar',
      'Parque Chas', 'Villa General Mitre',
    ],
  },

  'Catamarca': {
    name: 'Catamarca',
    capital: 'Catamarca',
    cities: [
      'Catamarca', 'San Fernando del Valle de Catamarca', 'Tinogasta', 'Andalgalá',
      'Belén', 'Santa María', 'Recreo', 'Chumbicha', 'Fiambalá',
      'Pomán', 'Saujil', 'Hualfín', 'Londres', 'San José',
      'Antofagasta de la Sierra', 'El Rodeo', 'Las Juntas', 'Mutquín', 'Copacabana',
      'Aconquija', 'Los Varela', 'Icaño', 'La Puerta', 'Puerta de Corral Quemado',
    ],
  },

  'Chaco': {
    name: 'Chaco',
    capital: 'Resistencia',
    cities: [
      'Resistencia', 'Presidencia Roque Sáenz Peña', 'Villa Ángela', 'Charata',
      'General San Martín', 'Barranqueras', 'Fontana', 'Quitilipi', 'Machagai',
      'Las Breñas', 'General Pinedo', 'Castelli', 'San Bernardo', 'Presidencia de la Plaza',
      'Tres Isletas', 'Corzuela', 'Avia Terai', 'Campo Largo', 'Colonia Elisa',
      'Charadai', 'Ciervo Petiso', 'Colonias Unidas', 'Concepción del Bermejo', 'Cote Lai',
      'El Sauzalito', 'Enrique Urien', 'Gancedo', 'General José de San Martín', 'General Vedia',
      'Hermoso Campo', 'Juan José Castelli', 'La Clotilde', 'La Eduvigis', 'La Escondida',
      'La Leonesa', 'La Tigra', 'La Verde', 'Laguna Blanca', 'Laguna Limpia',
      'Lapachito', 'Las Garcitas', 'Las Palmas', 'Los Frentones', 'Makallé',
      'Margarita Belén', 'Miraflores', 'Napenay', 'Pampa Almirón', 'Pampa del Indio',
      'Pampa del Infierno', 'Puerto Bermejo', 'Puerto Eva Perón', 'Puerto Tirol', 'Puerto Vilelas',
      'Samuhú', 'San Bernardo', 'Santa Sylvina', 'Taco Pozo', 'Villa Berthet',
      'Villa Río Bermejito',
    ],
  },

  'Chubut': {
    name: 'Chubut',
    capital: 'Rawson',
    cities: [
      'Rawson', 'Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Esquel',
      'Sarmiento', 'Gaiman', 'Dolavon', 'Rada Tilly', 'El Hoyo',
      'Lago Puelo', 'Epuyén', 'Cholila', 'El Maitén', 'Tecka',
      'Gobernador Costa', 'José de San Martín', 'Río Mayo', 'Alto Río Senguer', 'Facundo',
      'Camarones', 'Paso de Indios', 'Las Plumas', 'Los Altares', 'Gualjaina',
      'Cushamen', 'Corcovado', 'Carrenleufú', 'Río Pico', 'Aldea Apeleg',
      'Buen Pasto', 'Cerro Centinela', 'Dique Florentino Ameghino', 'Dr. Ricardo Rojas', 'El Mirasol',
      'Lagunita Salada', 'Paso del Sapo', 'Playa Unión', '28 de Julio', 'Trevelin',
    ],
  },

  'Córdoba': {
    name: 'Córdoba',
    capital: 'Córdoba',
    cities: [
      'Córdoba', 'Villa Carlos Paz', 'Río Cuarto', 'Villa María', 'San Francisco',
      'Alta Gracia', 'Río Tercero', 'Bell Ville', 'Jesús María', 'Cosquín',
      'La Falda', 'Villa Dolores', 'Cruz del Eje', 'Morteros', 'Marcos Juárez',
      'Villa Allende', 'La Calera', 'Río Ceballos', 'Unquillo', 'Mendiolaza',
      'Salsipuedes', 'Villa del Totoral', 'Colonia Caroya', 'Arroyito', 'Las Varillas',
      'Oncativo', 'Oliva', 'Villa Nueva', 'Laboulaye', 'General Deheza',
      'Corral de Bustos', 'Monte Maíz', 'Justiniano Posse', 'Leones', 'Canals',
      'General Cabrera', 'La Carlota', 'Río Segundo', 'Pilar', 'Villa del Rosario',
      'Embalse', 'Santa Rosa de Calamuchita', 'Villa General Belgrano', 'Los Cocos', 'La Cumbre',
      'Capilla del Monte', 'San Marcos Sierras', 'Dean Funes', 'Quilino', 'Villa de Soto',
      'San Carlos Minas', 'Pocho', 'Mina Clavero', 'Nono', 'Las Rosas',
      'San José de la Dormida', 'Obispo Trejo', 'Río Primero', 'Santa Rosa de Río Primero', 'Montecristo',
      'Despeñaderos', 'Almafuerte', 'Hernando', 'Dalmacio Vélez Sársfield', 'General Levalle',
      'Huinca Renancó', 'Vicuña Mackenna', 'Coronel Moldes', 'Sampacho', 'Adelia María',
      'Alcira Gigena', 'Berrotarán', 'Elena', 'Las Higueras', 'Holmberg',
      'Alejandro Roca', 'Ucacha', 'Bengolea', 'Arias', 'Camilo Aldao',
      'Corral de Bustos', 'Inriville', 'Noetinger', 'Wenceslao Escalante', 'Ordóñez',
      'Morrison', 'Idiazábal', 'James Craik', 'Tancacha', 'Los Surgentes',
    ],
  },

  'Corrientes': {
    name: 'Corrientes',
    capital: 'Corrientes',
    cities: [
      'Corrientes', 'Goya', 'Mercedes', 'Curuzú Cuatiá', 'Paso de los Libres',
      'Monte Caseros', 'Santo Tomé', 'Bella Vista', 'Esquina', 'Ituzaingó',
      'Alvear', 'Virasoro', 'Empedrado', 'Saladas', 'San Luis del Palmar',
      'Concepción', 'Mburucuyá', 'San Roque', 'Caá Catí', 'General Paz',
      'Itá Ibaté', 'Loreto', 'San Miguel', 'Yapeyú', 'La Cruz',
      'Mocoretá', 'Sauce', 'Lavalle', 'Goya', 'Santa Lucía',
      'Perugorría', 'San Cosme', 'Itatí', 'Berón de Astrada', 'Santa Ana',
      'San Carlos', 'Colonia Liebig', 'Gobernador Valentín Virasoro', 'Garruchos', 'Chavarría',
      'Colonia Carlos Pellegrini', 'Felipe Yofré', 'Mariano I. Loza', 'Colonia Pando', 'Riachuelo',
      'Tabay', 'Tatacuá', '9 de Julio', 'Bonpland', 'Parada Pucheta',
      'Juan Pujol', 'Guaviraví', 'Yataytí Calle',
    ],
  },

  'Entre Ríos': {
    name: 'Entre Ríos',
    capital: 'Paraná',
    cities: [
      'Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Gualeguay',
      'Chajarí', 'Villaguay', 'Victoria', 'Federación', 'Colón',
      'La Paz', 'Crespo', 'Diamante', 'Nogoyá', 'Federal',
      'San José', 'Basavilbaso', 'Villa Elisa', 'Rosario del Tala', 'San Salvador',
      'Larroque', 'Urdinarrain', 'Hernandarias', 'Bovril', 'Cerrito',
      'Hasenkamp', 'Oro Verde', 'San Benito', 'Viale', 'Seguí',
      'María Grande', 'Tabossi', 'Aldea Valle María', 'Aldea San Antonio', 'General Ramírez',
      'Maciá', 'Lucas González', 'Conscripto Bernardi', 'Ubajay', 'Pueblo Liebig',
      'San José de Feliciano', 'General Campos', 'Libertador San Martín', 'Los Charrúas', 'Santa Elena',
      'Aranguren', 'Gilbert', 'Ingeniero Sajaroff', 'Villa Clara', 'Puerto Yeruá',
      'Sauce de Luna', 'Villa Mantero', 'Pronunciamiento',
    ],
  },

  'Formosa': {
    name: 'Formosa',
    capital: 'Formosa',
    cities: [
      'Formosa', 'Clorinda', 'Pirané', 'El Colorado', 'Laguna Blanca',
      'Ibarreta', 'Las Lomitas', 'Ingeniero Juárez', 'General Güemes', 'Riacho He-He',
      'Villafañe', 'Gran Guardia', 'Espinillo', 'Estanislao del Campo', 'Comandante Fontana',
      'Palo Santo', 'Herradura', 'Villa General Güemes', 'San Martín II', 'Misión Tacaaglé',
      'Laguna Naick-Neck', 'Colonia Pastoril', 'El Espinillo', 'General Lucio V. Mansilla', 'Buena Vista',
      'Villa Escolar', 'Mayor Vicente Villafañe', 'San Hilario', 'Mojón de Fierro', 'Portón Negro',
      'Subteniente Perín', 'Tres Lagunas',
    ],
  },

  'Jujuy': {
    name: 'Jujuy',
    capital: 'San Salvador de Jujuy',
    cities: [
      'San Salvador de Jujuy', 'San Pedro de Jujuy', 'Palpalá', 'Libertador General San Martín',
      'Perico', 'El Carmen', 'Humahuaca', 'La Quiaca', 'Tilcara',
      'Abra Pampa', 'Monterrico', 'Fraile Pintado', 'Calilegua', 'Yuto',
      'San Antonio', 'Maimará', 'Purmamarca', 'Volcán', 'Tumbaya',
      'Susques', 'Rinconada', 'Santa Catalina', 'Yavi', 'Cangrejillos',
      'Coranzulí', 'El Aguilar', 'Huacalera', 'Iturbe', 'Ledesma',
      'Palma Sola', 'San Francisco', 'Valle Grande', 'Santa Clara', 'Caimancito',
      'Aguas Calientes', 'Pampa Blanca', 'Arrayanal', 'Los Alisos', 'El Bananal',
    ],
  },

  'La Pampa': {
    name: 'La Pampa',
    capital: 'Santa Rosa',
    cities: [
      'Santa Rosa', 'General Pico', 'Toay', 'General Acha', 'Eduardo Castex',
      'Macachín', 'Realicó', 'Intendente Alvear', 'Victorica', 'Ingeniero Luiggi',
      'Quemú Quemú', 'Catriló', 'Winifreda', 'Trenel', 'Rancul',
      'Bernardo Larroudé', 'Miguel Cané', 'Anguil', 'Uriburu', '25 de Mayo',
      'Guatraché', 'Jacinto Arauz', 'Doblas', 'Alpachiri', 'General San Martín',
      'Colonia Barón', 'Bernasconi', 'Villa Mirasol', 'Alta Italia', 'Embajador Martini',
      'Monte Nievas', 'Sarah', 'Coronel Hilario Lagos', 'Lonquimay', 'La Maruja',
      'Parera', 'Quetrequén', 'Relmo', 'Telén', 'Carro Quemado',
      'Colonia Santa María', 'Luan Toro', 'Loventué', 'Conhelo', 'Rucanelo',
      'La Humada', 'Puelén', 'Algarrobo del Águila', 'Santa Isabel', 'Limay Mahuida',
      'Casa de Piedra', 'Gobernador Duval', 'Puelches',
    ],
  },

  'La Rioja': {
    name: 'La Rioja',
    capital: 'La Rioja',
    cities: [
      'La Rioja', 'Chilecito', 'Aimogasta', 'Chamical', 'Chepes',
      'Villa Unión', 'Famatina', 'Nonogasta', 'Sanagasta', 'Anillaco',
      'Arauco', 'Olta', 'Ulapes', 'Milagro', 'Tama',
      'Castro Barros', 'Pituil', 'Santa Vera Cruz', 'Vichigasta', 'Sañogasta',
      'Malligasta', 'Guandacol', 'Pagancillo', 'Vinchina', 'Villa Castelli',
      'Jagüé', 'Alto Carrizal', 'Bajo Carrizal', 'San Blas', 'Patquía',
      'Los Colorados', 'San Ramón', 'Aminga', 'Chuquis', 'Pinchas',
      'Mascasín', 'Portezuelo', 'Salicas', 'Termas de Santa Teresita', 'Villa Mazán',
    ],
  },

  'Mendoza': {
    name: 'Mendoza',
    capital: 'Mendoza',
    cities: [
      'Mendoza', 'San Rafael', 'Godoy Cruz', 'Guaymallén', 'Las Heras',
      'Maipú', 'Luján de Cuyo', 'San Martín', 'Rivadavia', 'Tunuyán',
      'Tupungato', 'General Alvear', 'Malargüe', 'Junín', 'La Paz',
      'Santa Rosa', 'Lavalle', 'Villa Nueva', 'Palmira', 'San Carlos',
      'Eugenio Bustos', 'La Consulta', 'Pareditas', 'Vista Flores', 'Uspallata',
      'Potrerillos', 'Cacheuta', 'Chacras de Coria', 'Vistalba', 'Agrelo',
      'Perdriel', 'Carrodilla', 'Drummond', 'Fray Luis Beltrán', 'Rodeo del Medio',
      'Russell', 'Coquimbito', 'Cruz de Piedra', 'Lunlunta', 'Barrancas',
      'Medrano', 'Alto Verde', 'Chapanay', 'Monte Comán', 'Real del Padre',
      'Villa Atuel', '25 de Mayo', 'El Nihuil', 'Rama Caída', 'Cuadro Benegas',
      'Las Paredes', 'Salto de las Rosas', 'El Sosneado', 'Agua Escondida', 'Bardas Blancas',
    ],
  },

  'Misiones': {
    name: 'Misiones',
    capital: 'Posadas',
    cities: [
      'Posadas', 'Oberá', 'Eldorado', 'Puerto Iguazú', 'Leandro N. Alem',
      'Apóstoles', 'Jardín América', 'San Vicente', 'Puerto Rico', 'Montecarlo',
      'San Pedro', 'Aristóbulo del Valle', 'Wanda', 'Puerto Esperanza', 'Comandante Andresito',
      'Bernardo de Irigoyen', 'San Antonio', 'Campo Grande', 'Ruiz de Montoya', 'Campo Ramón',
      'Campo Viera', 'Candelaria', 'Capioví', 'Caraguatay', 'Cerro Azul',
      'Colonia Aurora', 'Colonia Delicia', 'Colonia Victoria', 'Concepción de la Sierra', 'Corpus',
      'Dos Arroyos', 'Dos de Mayo', 'El Alcázar', 'El Soberbio', 'Florentino Ameghino',
      'Garuhapé', 'General Alvear', 'General Urquiza', 'Gobernador López', 'Gobernador Roca',
      'Guaraní', 'Itacaruaré', 'Loreto', 'Los Helechos', 'Mártires',
      'Mojón Grande', 'Olegario Víctor Andrade', 'Panambí', 'Piray', 'Profundidad',
      'Puerto Leoni', 'Puerto Pinares', 'San Ignacio', 'San Javier', 'San José',
      'San Martín', 'Santa Ana', 'Santa María', 'Santiago de Liniers', 'Santo Pipó',
      '25 de Mayo', 'Tres Capones',
    ],
  },

  'Neuquén': {
    name: 'Neuquén',
    capital: 'Neuquén',
    cities: [
      'Neuquén', 'San Martín de los Andes', 'Plottier', 'Centenario', 'Cutral Có',
      'Plaza Huincul', 'Zapala', 'Junín de los Andes', 'Senillosa', 'Villa La Angostura',
      'Chos Malal', 'Rincón de los Sauces', 'Aluminé', 'Las Lajas', 'Loncopué',
      'San Patricio del Chañar', 'Añelo', 'Vista Alegre', 'El Chocón', 'Piedra del Águila',
      'Picún Leufú', 'Covunco', 'Mariano Moreno', 'El Huecú', 'Buta Ranquil',
      'Tricao Malal', 'Andacollo', 'Las Ovejas', 'Huinganco', 'Villa Pehuenia',
      'Caviahue', 'Copahue', 'Villa Traful', 'Villa El Chocón', 'Paso Aguerre',
    ],
  },

  'Río Negro': {
    name: 'Río Negro',
    capital: 'Viedma',
    cities: [
      'Viedma', 'San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'Villa Regina',
      'Allen', 'Cinco Saltos', 'El Bolsón', 'Choele Choel', 'Catriel',
      'Sierra Grande', 'San Antonio Oeste', 'Ingeniero Jacobacci', 'Río Colorado', 'Luis Beltrán',
      'Lamarque', 'Darwin', 'Cervantes', 'Mainqué', 'Chichinales',
      'Belisle', 'Chimpay', 'Coronel Belisle', 'Pomona', 'Godoy',
      'Huergo', 'Padre Stefenelli', 'Fernández Oro', 'Contralmirante Cordero', 'Barda del Medio',
      'Villa Manzano', 'Campo Grande', 'Pilcaniyeu', 'Comallo', 'Clemente Onelli',
      'Ñorquinco', 'Maquinchao', 'Los Menucos', 'Ramos Mexía', 'Valcheta',
      'San Javier', 'General Conesa', 'Guardia Mitre', 'Patagones', 'Balneario El Cóndor',
      'Las Grutas', 'Playas Doradas', 'Puerto San Antonio Este', 'El Cuy', 'Mencué',
    ],
  },

  'Salta': {
    name: 'Salta',
    capital: 'Salta',
    cities: [
      'Salta', 'San Ramón de la Nueva Orán', 'Tartagal', 'General Güemes', 'Metán',
      'Cafayate', 'Rosario de la Frontera', 'Embarcación', 'Joaquín V. González', 'General Mosconi',
      'Aguaray', 'Salvador Mazza', 'Pichanal', 'Colonia Santa Rosa', 'Hipólito Yrigoyen',
      'San José de Metán', 'Rosario de Lerma', 'Campo Quijano', 'El Carril', 'Chicoana',
      'La Caldera', 'Vaqueros', 'Cerrillos', 'La Merced', 'El Galpón',
      'Las Lajitas', 'Apolinario Saravia', 'General Pizarro', 'Rivadavia Banda Sur', 'Rivadavia Banda Norte',
      'Coronel Moldes', 'La Viña', 'Guachipas', 'Animaná', 'San Carlos',
      'Angastaco', 'Molinos', 'Cachi', 'Payogasta', 'La Poma',
      'San Antonio de los Cobres', 'Tolar Grande', 'Santa Victoria Este', 'Los Toldos', 'Nazareno',
      'Iruya', 'Isla de Cañas', 'Santa Victoria Oeste', 'Campo Santo', 'El Bordo',
      'General Ballivián', 'Urundel', 'Coronel Cornejo', 'Dragones', 'Tolloche',
    ],
  },

  'San Juan': {
    name: 'San Juan',
    capital: 'San Juan',
    cities: [
      'San Juan', 'Rawson', 'Rivadavia', 'Chimbas', 'Santa Lucía',
      'Pocito', 'Albardón', 'San Martín', '25 de Mayo', 'Caucete',
      '9 de Julio', 'Angaco', 'Ullum', 'Zonda', 'Jáchal',
      'Iglesia', 'Calingasta', 'Valle Fértil', 'San Agustín de Valle Fértil', 'Sarmiento',
      'Media Agua', 'Las Flores', 'Villa Krause', 'Villa Aberastain', 'Carpintería',
      'Las Chacritas', 'Villa Ibáñez', 'Tamberías', 'Barreal', 'Rodeo',
      'Tudcum', 'Huaco', 'Mogna', 'Niquivil', 'San José de Jáchal',
      'Villa Mercedes', 'Villa Basilio Nievas', 'Bermejo', 'La Bebida', 'Villa El Salvador',
      'Colonia Fiscal', 'Villa General San Martín', 'Dos Acequias', 'Guanacache', 'Villa Santa Rosa',
    ],
  },

  'San Luis': {
    name: 'San Luis',
    capital: 'San Luis',
    cities: [
      'San Luis', 'Villa Mercedes', 'Merlo', 'La Punta', 'Justo Daract',
      'Buena Esperanza', 'Quines', 'Tilisarao', 'Concarán', 'Santa Rosa del Conlara',
      'Naschel', 'La Toma', 'Juana Koslay', 'Potrero de los Funes', 'El Volcán',
      'Carpintería', 'Los Molles', 'Cortaderas', 'Papagayos', 'Villa de la Quebrada',
      'San Francisco del Monte de Oro', 'Luján', 'Nogolí', 'Villa General Roca', 'Arizona',
      'Batavia', 'Beazley', 'Juan Jorba', 'Juan Llerena', 'La Punilla',
      'Lafinur', 'Las Aguadas', 'Las Chacras', 'Leandro N. Alem', 'Lince',
      'Los Cajones', 'Navia', 'Nueva Galia', 'Paso Grande', 'San Gerónimo',
      'San Martín', 'Talita', 'Unión', 'Villa del Carmen', 'Villa Praga',
      'Alto Pelado', 'Alto Pencoso', 'Anchorena', 'Bagual', 'Fortín El Patria',
      'Fortuna', 'Fraga', 'La Verde', 'Ranqueles', 'Zanjitas',
    ],
  },

  'Santa Cruz': {
    name: 'Santa Cruz',
    capital: 'Río Gallegos',
    cities: [
      'Río Gallegos', 'Caleta Olivia', 'Pico Truncado', 'El Calafate', 'Puerto Deseado',
      'Las Heras', 'San Julián', 'Perito Moreno', 'Puerto Santa Cruz', '28 de Noviembre',
      'Río Turbio', 'Comandante Luis Piedra Buena', 'Los Antiguos', 'Gobernador Gregores', 'Puerto San Julián',
      'Cañadón Seco', 'Fitz Roy', 'Jaramillo', 'Koluel Kaike', 'Tellier',
      'Tres Lagos', 'El Chaltén', 'Lago Posadas', 'Hipólito Yrigoyen', 'Bajo Caracoles',
    ],
  },

  'Santa Fe': {
    name: 'Santa Fe',
    capital: 'Santa Fe',
    cities: [
      'Santa Fe', 'Rosario', 'Rafaela', 'Venado Tuerto', 'Reconquista',
      'Villa Gobernador Gálvez', 'San Lorenzo', 'Santo Tomé', 'Esperanza', 'Casilda',
      'Cañada de Gómez', 'Sunchales', 'San Justo', 'Firmat', 'San Jorge',
      'Las Rosas', 'San Carlos Centro', 'Funes', 'Granadero Baigorria', 'Capitán Bermúdez',
      'Pérez', 'Arroyo Seco', 'Villa Constitución', 'Rufino', 'Tostado',
      'Vera', 'Avellaneda', 'Gálvez', 'Carcarañá', 'Coronda',
      'San Cristóbal', 'Ceres', 'San Javier', 'Laguna Paiva', 'Recreo',
      'Arequito', 'Armstrong', 'Totoras', 'Las Parejas', 'Maciel',
      'San Genaro', 'Alcorta', 'Acebal', 'Álvarez', 'Chabás',
      'Fray Luis Beltrán', 'Puerto General San Martín', 'San Jerónimo Norte', 'Humboldt', 'Pilar',
      'Frontera', 'Josefina', 'Santa Clara de Saguier', 'San Vicente', 'Sastre',
      'El Trébol', 'María Juana', 'San Martín de las Escobas', 'Wheelwright', 'Hughes',
      'Villa Cañás', 'Elortondo', 'Máximo Paz', 'Murphy', 'San Eduardo',
      'Sancti Spíritu', 'María Teresa', 'Berabevú', 'Carmen', 'Chovet',
      'Chapuy', 'Melincué', 'Labordeboy', 'Carreras', 'Diego de Alvear',
      'Christophersen', 'Teodelina', 'Amenábar', 'Maggiolo', 'San Francisco de Santa Fe',
      'San Gregorio', 'Santa Isabel', 'Villada', 'Suardi', 'San Guillermo',
      'Arrufó', 'Colonia Rosa', 'Tacural', 'Lehmann', 'Villa Ocampo',
      'Las Toscas', 'Villa Ana', 'Guadalupe Norte', 'Florencia', 'Malabrigo',
      'Romang', 'Alejandra', 'San Antonio de Obligado', 'Reconquista', 'Avellaneda',
    ],
  },

  'Santiago del Estero': {
    name: 'Santiago del Estero',
    capital: 'Santiago del Estero',
    cities: [
      'Santiago del Estero', 'La Banda', 'Termas de Río Hondo', 'Añatuya', 'Frías',
      'Quimilí', 'Monte Quemado', 'Fernández', 'Loreto', 'Beltrán',
      'Suncho Corral', 'Campo Gallo', 'Clodomira', 'Villa Ojo de Agua', 'Pinto',
      'Bandera', 'Selva', 'Tintina', 'Colonia Dora', 'Los Juríes',
      'Sachayoj', 'Los Telares', 'Villa Atamisqui', 'Sumampa', 'Ojo de Agua',
      'Garza', 'Herrera', 'Nueva Esperanza', 'Pampa de los Guanacos', 'Pozo Hondo',
      'Santos Lugares', 'Sol de Julio', 'Brea Pozo', 'Icaño', 'Villa La Punta',
      'Vilmer', 'Choya', 'Villa General Mitre', 'Ingeniero Forres', 'Laprida',
      'Malbrán', 'Nueva Francia', 'Palo Negro', 'Rapelli', 'Real Sayana',
      'Simbolar', 'Tapso', 'Tenené', 'Weisburd', 'Argentina',
    ],
  },

  'Tierra del Fuego': {
    name: 'Tierra del Fuego',
    capital: 'Ushuaia',
    cities: [
      'Ushuaia', 'Río Grande', 'Tolhuin', 'Puerto Almanza', 'Lago Escondido',
      'San Sebastián', 'Estancia Sara', 'Puerto Williams',
    ],
  },

  'Tucumán': {
    name: 'Tucumán',
    capital: 'San Miguel de Tucumán',
    cities: [
      'San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Banda del Río Salí', 'Concepción',
      'Monteros', 'Aguilares', 'Famaillá', 'Alderetes', 'Las Talitas',
      'Simoca', 'Lules', 'Bella Vista', 'Juan Bautista Alberdi', 'Graneros',
      'La Cocha', 'Tafí del Valle', 'Amaicha del Valle', 'Colalao del Valle', 'El Mollar',
      'San Pedro de Colalao', 'Trancas', 'Burruyacú', 'Villa Benjamín Aráoz', 'El Bracho',
      'Cevil Redondo', 'Delfín Gallo', 'El Manantial', 'San Pablo', 'Los Nogales',
      'Raco', 'Río Chico', 'San José', 'San Javier', 'Villa Nougués',
      'El Cadillal', 'Leales', 'Santa Rosa de Leales', 'Los Ralos', 'Lamadrid',
      'Villa de Leales', 'Medinas', 'Acheral', 'Alpachiri', 'Arcadia',
      'Atahona', 'Choromoro', 'El Chañar', 'El Polear', 'El Sacrificio',
      'Escaba', 'Huasa Pampa', 'La Florida', 'La Ramada', 'La Trinidad',
      'León Rouges', 'Los Puestos', 'Los Sarmientos', 'Manuela Pedraza', 'Monteagudo',
      'Piedrabuena', 'Quilmes', 'Río Seco', 'Rumi Punco', 'San Andrés',
      'San Felipe', 'San Ignacio', 'Santa Ana', 'Santa Cruz', 'Santa Lucía',
      'Soldado Maldonado', 'Tacanas', 'Teniente Berdina', 'Villa Belgrano', 'Villa Chicligasta',
      'Villa Quinteros', 'Yánima', 'Los Sosa',
    ],
  },
};

/**
 * Busca una provincia por nombre (case insensitive)
 */
function findProvince(provinceName: string): Province | undefined {
  // Primero intentar match exacto
  if (argentineProvinces[provinceName]) {
    return argentineProvinces[provinceName];
  }

  // Buscar case insensitive
  const normalized = provinceName.toLowerCase().trim();
  for (const [key, province] of Object.entries(argentineProvinces)) {
    if (key.toLowerCase() === normalized) {
      return province;
    }
  }

  return undefined;
}

/**
 * Obtiene todas las ciudades de una provincia
 */
export function getCitiesByProvince(provinceName: string): string[] {
  const province = findProvince(provinceName);
  return province ? province.cities : [];
}

/**
 * Obtiene la capital de una provincia
 */
export function getProvinceCapital(provinceName: string): string {
  const province = findProvince(provinceName);
  return province ? province.capital : '';
}

/**
 * Busca una ciudad en todas las provincias y retorna la provincia
 */
export function findProvinceByCity(cityName: string): string | null {
  const normalizedCity = cityName.toLowerCase().trim();

  for (const [provinceName, province] of Object.entries(argentineProvinces)) {
    const found = province.cities.some(
      city => city.toLowerCase() === normalizedCity
    );
    if (found) {
      return provinceName;
    }
  }

  return null;
}

/**
 * Verifica si una ciudad existe en una provincia específica
 */
export function isCityInProvince(cityName: string, provinceName: string): boolean {
  const province = findProvince(provinceName);
  if (!province) return false;

  const normalizedCity = cityName.toLowerCase().trim();
  return province.cities.some(city => city.toLowerCase() === normalizedCity);
}

/**
 * Obtiene todas las provincias
 */
export function getAllProvinces(): string[] {
  return Object.keys(argentineProvinces);
}

/**
 * Obtiene el total de ciudades en el sistema
 */
export function getTotalCitiesCount(): number {
  return Object.values(argentineProvinces).reduce(
    (total, province) => total + province.cities.length,
    0
  );
}
