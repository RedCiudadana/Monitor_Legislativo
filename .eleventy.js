const moment = require("moment");
const now = new Date();
const rmj = require('render-markdown-js')
const xlsx = require('xlsx');
const path = require('path');
const natural = require('natural'); // Para similitud de cadenas
const levenshtein = require('js-levenshtein');
const fs = require('fs');

module.exports = function (eleventyConfig) {

    eleventyConfig.setTemplateFormats("njk,html,md");
    
    eleventyConfig.addPassthroughCopy('src');
    eleventyConfig.addPassthroughCopy('assets');
    eleventyConfig.addPassthroughCopy('admin');
    eleventyConfig.addPassthroughCopy('preguntas_data');
    eleventyConfig.addPassthroughCopy('excel_data');

    // filtros

    eleventyConfig.addNunjucksFilter("rmj", function(content) {
        return rmj(content);
    });

    eleventyConfig.addNunjucksFilter("limit", function (array, limit) {
        return array.slice(0, limit);
    });

    eleventyConfig.addNunjucksFilter("limitPart", function(array, limit1, limit2) {
        return array.slice(limit1, limit2);
    });

    eleventyConfig.addFilter("dateFormat", function(date, format) {
        return moment(date).format(format);
    });

    eleventyConfig.addFilter("log", function (value) {
        console.log(value);
        return value; // Devuelve el valor original para no alterar la salida
    });

    eleventyConfig.addFilter('findPreguntaPage', function(preguntaId, preguntaPages) {
        return preguntaPages.find(function(page) {
            return page.data.pregunta.id === preguntaId;
        });
    });      

    eleventyConfig.addFilter("filterByDiputado", function (preguntas, diputadoNombre) {
        if (!diputadoNombre) return preguntas;
        return preguntas.filter(pregunta => {
            return pregunta.votos.some(voto =>
                voto.nombreDiputado.toLowerCase().includes(diputadoNombre.toLowerCase())
            );
        });
    });
    
    eleventyConfig.addFilter("filterByPreguntaName", function (preguntas, preguntaNombre) {
        if (!preguntaNombre) return preguntas;
        return preguntas.filter(pregunta => 
          pregunta['Nombre de Pregunta'].toLowerCase().includes(preguntaNombre.toLowerCase())
        );
    });

    eleventyConfig.addFilter("filterVotosByDiputado", function (votos, nombreDiputado) {
        if (!nombreDiputado || !votos) return [];
        return votos.filter(voto => voto.nombreDiputado === nombreDiputado);
    });

    eleventyConfig.addFilter("findPreguntaByName", function (preguntas, nombrePregunta) {
        if (!preguntas || !nombrePregunta) return [];
        return preguntas.filter(preg => preg.data.pregunta['Nombre de Pregunta'] === nombrePregunta);
    });

    eleventyConfig.addNunjucksFilter('findClosestDiputado', function(nombreDiputado, diputados) {
        let minDistance = Infinity;
        let closestDiputado = null;
        let threshold = 5; // Ajusta este valor según tus necesidades
      
        diputados.forEach(function(diputado) {
          let diputadoNombre = diputado.data.diputado['Nombre'];
          let distance = levenshtein(nombreDiputado.toLowerCase(), diputadoNombre.toLowerCase());
          if (distance < minDistance) {
            minDistance = distance;
            closestDiputado = diputado;
          }
        });
      
        if (minDistance <= threshold) {
          return closestDiputado;
        } else {
          return null;
        }
    });

    // Función para normalizar nombres
    const normalizeName = (name) => {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    };

    // Construir los datos de las sesiones una sola vez
    const preguntasDataDir = './preguntas_data';
    const diputados = require('./_data/diputados.json');
    const sesionesData = [];

    // Leer todos los archivos en el directorio preguntas_data
    const files = fs.readdirSync(preguntasDataDir);

    files.forEach(file => {
        // Verificar si el archivo coincide con 'sesion_*.js'
        if (file.startsWith('sesion_') && file.endsWith('.js')) {
            const sessionPath = path.resolve(__dirname, preguntasDataDir, file);
            try {
                const sessionData = require(sessionPath)(); // Asumiendo que el módulo exporta una función que devuelve los datos

                // Extraer el número de sesión y la fecha del nombre del archivo
                let baseName = path.basename(file, '.js'); // 'sesion_47_5-11-24'
                let sessionInfo = baseName.replace('sesion_', ''); // '47_5-11-24'
                let [sessionNumber, sessionDateStr] = sessionInfo.split('_'); // ['47', '5-11-24']

                // Convertir el número de sesión a entero
                sessionNumber = parseInt(sessionNumber, 10);

                // Convertir la fecha a un objeto Date
                let [day, month, year] = sessionDateStr.split('-').map(num => parseInt(num, 10));
                if (year < 50) {
                    year += 2000;
                } else {
                    year += 1900;
                }
                let sessionDate = new Date(year, month - 1, day);
                let formattedDate = moment(sessionDate).format('DD/MM/YYYY');

                // Procesar los datos de la sesión
                sessionData.forEach(pregunta => {
                    pregunta.votos = pregunta.votos.map(voto => {
                        const nombreDiputadoExcel = normalizeName(voto.nombreDiputado);

                        // Buscar el diputado más similar
                        let diputadoEncontrado = null;
                        let maxSimilitud = 0;

                        diputados.forEach(diputado => {
                            const nombreDiputadoColeccion = normalizeName(diputado['Nombre']);
                            const similitud = natural.JaroWinklerDistance(nombreDiputadoExcel, nombreDiputadoColeccion);

                            if (similitud > maxSimilitud && similitud > 0.85) { // Umbral de similitud
                                maxSimilitud = similitud;
                                diputadoEncontrado = diputado;
                            }
                        });

                        return {
                            ...voto,
                            diputado: diputadoEncontrado
                        };
                    });

                    // Agregar información de la sesión a la pregunta
                    pregunta.sesion = {
                        numero: sessionNumber,
                        fecha: sessionDate,
                        fechaFormateada: formattedDate,
                        nombreSesion: `Sesión ${sessionNumber}`,
                        url: `/sesiones/${sessionNumber}/`
                    };
                });

                // Agregar la sesión al array de sesionesData
                sesionesData.push({
                    nombreSesion: `Sesión ${sessionNumber}`,
                    numeroSesion: sessionNumber,
                    fechaSesion: sessionDate,
                    fechaSesionFormateada: formattedDate,
                    preguntas: sessionData,
                });

            } catch (error) {
                console.error(`Error al cargar los datos de la sesión desde ${sessionPath}:`, error.message);
            }
        }
    });

    // Añadir la colección de sesiones
    eleventyConfig.addCollection('sesiones', () => {
        return sesionesData;
    });

    // Añadir la colección de preguntas
    eleventyConfig.addCollection('preguntas', () => {
        const preguntas = [];
    
        sesionesData.forEach(sesion => {
            sesion.preguntas.forEach(pregunta => {
                // Asignar un ID único a cada pregunta
                pregunta.id = `sesion-${sesion.numeroSesion}-pregunta-${pregunta['Número de Pregunta']}`;
                preguntas.push(pregunta);
            });
        });
    
        return preguntas;
    });


}