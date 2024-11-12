const xlsx = require('xlsx');
const path = require('path');

module.exports = () => {
  // Ruta al archivo Excel
  const workbook = xlsx.readFile(path.join(__dirname, '../excel_data/sesion_45_29-10-24.xlsx'));

  // Leer la hoja de preguntas (asumiendo que es la primera hoja)
  const sheetNames = workbook.SheetNames;
  const preguntasSheet = workbook.Sheets[sheetNames[0]];
  const preguntas = xlsx.utils.sheet_to_json(preguntasSheet);

  // Crear un objeto para almacenar los votos por pregunta
  const votosPorPregunta = {};

  // Leer las hojas de votos (suponiendo que son las demás hojas)
  sheetNames.slice(1).forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const votosRaw = xlsx.utils.sheet_to_json(sheet);

    // Obtener el número de la pregunta del nombre de la hoja
    const numeroPregunta = sheetName.replace('Pregunta ', '').trim();

    // Procesar los votos y asegurarnos de que los campos coincidan
    const votos = votosRaw.map(voto => {
      let nombreCompleto = voto['Nombre'] || '';
      let bloque = voto['Bloque'] || '';

      // Eliminar cualquier palabra en mayúsculas al final del nombre
      nombreCompleto = nombreCompleto.replace(/\b[A-ZÁÉÍÓÚÑÜ]{2,}\b$/g, '').trim();

      // Si el bloque no está definido, intentamos extraerlo del nombre completo
      if (!bloque && nombreCompleto.match(/\b(PARTIDO|INDEPENDIENTES|COMUNIDAD|BIENESTAR|CABAL|TODOS|VICTORIA|AZUL)\b/)) {
        const partes = nombreCompleto.split(/\b(PARTIDO|INDEPENDIENTES|COMUNIDAD|BIENESTAR|CABAL|TODOS|VICTORIA|AZUL)\b/);
        nombreCompleto = partes[0].trim();
        bloque = partes[1] ? partes[1].trim() : '';
      }

      return {
        nombreDiputado: nombreCompleto,
        bloque: bloque || voto['Bloque'],
        votoEmitido: voto['Voto Emitido']
      };
    });

    votosPorPregunta[numeroPregunta] = votos;
  });

  // Combinar preguntas con sus votos
  const preguntasConVotos = preguntas.map(pregunta => {
    const numeroPregunta = String(pregunta['Número de Pregunta']).trim();
    const votos = votosPorPregunta[numeroPregunta] || [];
    return {
      ...pregunta,
      votos
    };
  });

//   'Número de Pregunta': '15',
//     'Nombre de Pregunta': 'APROBACIÓN EN TERCER DEBATE DEL PREYECTO DE DECRETO QUE DISPONE APROBAR LA INICIATIVA DE LEY 6000',
//     'URL del PDF': 'https://www.congreso.gob.gt/pdf_resultado_votacion/48731/41238',
  return preguntasConVotos;
};
