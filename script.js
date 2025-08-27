// Inicializar el mapa (sin vista inicial, se ajustará al centroide del GeoJSON)
const map = L.map('map');

// Capas de mapas
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 20
});

const streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
});

// Añadir capa satelital por defecto
satelliteLayer.addTo(map);

// Iconos personalizados para diferentes tipos
const iconTypes = {
    bodega: L.divIcon({
        html: '<i class="fas fa-warehouse"></i>',
        className: 'custom-marker bodega-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }),
    puesto: L.divIcon({
        html: '<i class="fas fa-store"></i>',
        className: 'custom-marker puesto-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }),
    restaurante: L.divIcon({
        html: '<i class="fas fa-utensils"></i>',
        className: 'custom-marker restaurante-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }),
    point: L.divIcon({
        html: '<i class="fas fa-map-marker-alt"></i>',
        className: 'custom-marker default-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }),
    default: L.divIcon({
        html: '<i class="fas fa-map-marker-alt"></i>',
        className: 'custom-marker default-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    })
};

// Función para determinar qué icono usar
function getIconByType(type) {
    return iconTypes[type] || iconTypes.default;
}

// Función para obtener el centroide de diferentes tipos de geometría
function getCentroid(geometry) {
    switch (geometry.type) {
        case 'Point':
            return geometry.coordinates;
        case 'Polygon':
            // Para polígonos, calcular centroide del primer anillo
            const coords = geometry.coordinates[0];
            const sum = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
            return [sum[0] / coords.length, sum[1] / coords.length];
        case 'LineString':
            // Para líneas, usar el punto medio
            const lineCoords = geometry.coordinates;
            const midIndex = Math.floor(lineCoords.length / 2);
            return lineCoords[midIndex];
        case 'MultiPolygon':
            // Para multipolígonos, usar el primer polígono
            const firstPolygon = geometry.coordinates[0][0];
            const polySum = firstPolygon.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
            return [polySum[0] / firstPolygon.length, polySum[1] / firstPolygon.length];
        default:
            console.warn('Tipo de geometría no soportado:', geometry.type);
            return null;
    }
}

// Cargar y mostrar los marcadores desde export.geojson
fetch('export.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('No se pudo cargar export.geojson');
        }
        return response.json();
    })
    .then(geojsonData => {
        console.log('GeoJSON cargado:', geojsonData);
        
        // Calcular centroide de todas las geometrías
        const allCentroids = geojsonData.features
            .map(f => f.geometry ? getCentroid(f.geometry) : null)
            .filter(Boolean);
        
        let center = [19.390546, -99.14335]; // valor por defecto
        if (allCentroids.length > 0) {
            const sum = allCentroids.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
            center = [sum[1] / allCentroids.length, sum[0] / allCentroids.length];
        }
        map.setView(center, 18);

        // Agregar las geometrías al mapa
        geojsonData.features.forEach(feature => {
            const props = feature.properties;
            const { 
                id, name, type, description, anden, bodega, 
                telefono, email, especie, created_at, updated_at 
            } = props;
            
            // Popup con información completa
            const popupContent = `
                <div class="custom-popup">
                    <div class="popup-title">${name || 'Sin nombre'}</div>
                    ${id ? `<div class="popup-detail"><i class="fas fa-hashtag"></i> ID: ${id}</div>` : ''}
                    ${type ? `<div class="popup-detail"><i class="fas fa-tag"></i> Tipo: ${type}</div>` : ''}
                    ${description && description.trim() ? `<div class="popup-detail"><i class="fas fa-info"></i> ${description}</div>` : ''}
                    ${anden && anden.trim() ? `<div class="popup-detail"><i class="fas fa-map-pin"></i> Andén: ${anden}</div>` : ''}
                    ${bodega && bodega.trim() ? `<div class="popup-detail"><i class="fas fa-warehouse"></i> Bodega: ${bodega}</div>` : ''}
                    ${telefono && telefono.trim() ? `<div class="popup-detail"><i class="fas fa-phone"></i> ${telefono}</div>` : ''}
                    ${email && email.trim() ? `<div class="popup-detail"><i class="fas fa-envelope"></i> ${email}</div>` : ''}
                    ${especie && especie.trim() ? `<div class="popup-detail"><i class="fas fa-fish"></i> Especie: ${especie}</div>` : ''}
                    ${created_at ? `<div class="popup-detail"><i class="fas fa-calendar-plus"></i> Creado: ${new Date(created_at).toLocaleString('es-ES')}</div>` : ''}
                    ${updated_at && updated_at !== created_at ? `<div class="popup-detail"><i class="fas fa-calendar-check"></i> Actualizado: ${new Date(updated_at).toLocaleString('es-ES')}</div>` : ''}
                </div>
            `;

            if (feature.geometry.type === 'Point') {
                // Para puntos, crear marcador
                const coordinates = feature.geometry.coordinates;
                const marker = L.marker([coordinates[1], coordinates[0]], {
                    icon: getIconByType(type)
                }).addTo(map);
                marker.bindPopup(popupContent);
            } else {
                // Para polígonos, líneas, etc., usar L.geoJSON
                const layer = L.geoJSON(feature, {
                    style: {
                        color: '#0071e3',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.3
                    }
                }).addTo(map);
                
                layer.bindPopup(popupContent);
            }
        });
    })
    .catch(error => {
        console.error('Error al cargar el GeoJSON:', error);
        alert('Error al cargar el archivo export.geojson. Asegúrate de servir la página desde un servidor web local.');
    });

// Controladores de cambio de vista
document.getElementById('satellite-btn').addEventListener('click', () => {
    map.removeLayer(streetsLayer);
    satelliteLayer.addTo(map);
});

document.getElementById('streets-btn').addEventListener('click', () => {
    map.removeLayer(satelliteLayer);
    streetsLayer.addTo(map);
});

// Funcionalidad para cargar y mostrar datos CSV
let localesData = [];

// Función para parsear CSV
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
    }
    
    return data;
}

// Función para obtener la clase CSS del tipo
function getTypeClass(type) {
    const typeMap = {
        'mariscos': 'type-mariscos',
        'restaurante': 'type-restaurante',
        'especializado': 'type-especializado',
        'mayorista': 'type-mayorista',
        'pescados': 'type-pescados'
    };
    return typeMap[type] || 'type-mariscos';
}

// Función para renderizar la tabla
function renderTable(data) {
    const tbody = document.getElementById('localesTableBody');
    tbody.innerHTML = '';
    
    data.forEach(bodega => {
        const row = document.createElement('tr');
        
        // Usar los nombres de columnas del bodegascsv.csv
        const nombre = bodega['NOMBRE'] || '';
        const razonSocial = bodega['RAZÓN SOCIAL'] || '';
        const ubicacion = bodega['ANDEN Y NÚMERO DE BODEGA'] || '';
        const telefono = bodega['TELÉFONO'] || '';
        const email = bodega['CORREO ELECTRÓNICO'] || '';
        const producto = bodega['PRODUCTO'] || '';
        const observaciones = bodega['OBSERVACIONES'] || '';
        
        // Determinar qué nombre mostrar
        const nombreMostrar = nombre || razonSocial || 'Sin nombre';
        
        row.innerHTML = `
            <td>
                <div class="local-name">${nombreMostrar}</div>
                ${razonSocial && nombre ? `<div class="razon-social">${razonSocial}</div>` : ''}
            </td>
            <td>
                <div class="location-info">${ubicacion}</div>
            </td>
            <td>${producto}</td>
            <td>${observaciones || 'No especificado'}</td>
            <td>
                <div class="contact-info">
                    ${telefono ? `<a href="tel:${telefono}" class="contact-phone">📞 ${telefono}</a>` : ''}
                    ${email ? `<span class="contact-email">✉️ ${email}</span>` : ''}
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Función para filtrar datos
function filterData(data, searchTerm, filterType) {
    return data.filter(bodega => {
        const nombre = bodega['NOMBRE'] || '';
        const razonSocial = bodega['RAZÓN SOCIAL'] || '';
        const producto = bodega['PRODUCTO'] || '';
        const ubicacion = bodega['ANDEN Y NÚMERO DE BODEGA'] || '';
        const observaciones = bodega['OBSERVACIONES'] || '';
        
        const matchesSearch = !searchTerm || 
            nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
            producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ubicacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            observaciones.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Para las bodegas, todos son del mismo tipo, así que siempre coincide con el filtro
        const matchesFilter = filterType === 'all' || filterType === 'bodega';
        
        return matchesSearch && matchesFilter;
    });
}

// Cargar datos CSV
fetch('bodegascsv.csv')
    .then(response => response.text())
    .then(csvText => {
        localesData = parseCSV(csvText);
        renderTable(localesData);
        
        // Configurar búsqueda
        const searchInput = document.getElementById('searchInput');
        
        // Evento de búsqueda (sin filtros, solo búsqueda)
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            const filteredData = filterData(localesData, searchTerm, 'all');
            renderTable(filteredData);
        });
    })
    .catch(error => {
        console.error('Error al cargar bodegascsv.csv:', error);
        document.getElementById('localesTableBody').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #86868b;">Error al cargar los datos de bodegas</td></tr>';
    });
