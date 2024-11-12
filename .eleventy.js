const moment = require("moment");
const now = new Date();
const rmj = require('render-markdown-js')
const xlsx = require('xlsx');
const path = require('path');
const natural = require('natural'); // Para similitud de cadenas
const levenshtein = require('js-levenshtein');

module.exports = function (eleventyConfig) {

    eleventyConfig.setTemplateFormats("njk,html,md");
    
    eleventyConfig.addPassthroughCopy('src');
    eleventyConfig.addPassthroughCopy('assets');
    eleventyConfig.addPassthroughCopy('admin');

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

    // Añadir la colección de preguntas
    eleventyConfig.addCollection('preguntas', (collectionApi) => {
        // Obtener las preguntas con votos desde _data
        const preguntasConVotos = require('./preguntas_data/sesion_47_5-11-24.js')();

        // Obtener la colección existente de diputados
        const diputados = require('./_data/diputados.json');

        // Función para normalizar nombres
        const normalizeName = (name) => {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        };

        // Relacionar los diputados en los votos
        preguntasConVotos.forEach(pregunta => {
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
        });

        return preguntasConVotos;
    });

}