/* global mapboxgl, c3 */

mapboxgl.accessToken = 'pk.eyJ1IjoibmFsZW11MTMiLCJhIjoiY21sMGR1OHlkMGNsMDNpcHhqbHQxZnNkaSJ9.lIr1YapCLUudIRiNX6kFuA';

const DEFAULT_VIEW = {
  center: [-122.33, 47.60],
  zoom: 10.2
};

let map;
let chart = null;

const DATA_PATH = 'data/collisions.geojson';
const SOURCE_ID = 'collisions';
const LAYER_ID = 'collisions-layer';

// These get refreshed every time the dashboard updates
let currentLabels = [];
let currentBarColors = [];

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function severityToColor(sev) {
  if (sev === 'Property Damage Only Collision') return '#8aa1b1';
  if (sev === 'Injury Collision') return '#42c3d6';
  if (sev === 'Serious Injury Collision') return '#f59f00';
  if (sev === 'Fatality Collision') return '#e03131';
  return '#adb5bd'; // Unknown / Other
}

function getSeverityColorExpression() {
  return [
    'match',
    ['get', 'SEVERITYDESC'],
    'Property Damage Only Collision', '#8aa1b1',
    'Injury Collision', '#42c3d6',
    'Serious Injury Collision', '#f59f00',
    'Fatality Collision', '#e03131',
    /* default */ '#adb5bd'
  ];
}

function initMap() {
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom
  });

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  map.on('load', async () => {
    const data = await fetch(DATA_PATH).then(r => r.json());

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: data
    });

    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['to-number', ['get', 'INJURIES'], 0],
          0, 4,
          1, 6,
          5, 12,
          15, 18,
          30, 24
        ],
        'circle-color': getSeverityColorExpression(),
        'circle-opacity': 0.75,
        'circle-stroke-color': 'rgba(255,255,255,0.55)',
        'circle-stroke-width': 1
      }
    });

    map.on('click', LAYER_ID, (e) => {
      const f = e.features && e.features[0];
      if (!f) return;

      const p = f.properties || {};
      const sev = p.SEVERITYDESC || 'Unknown';
      const type = p.COLLISIONTYPE || 'Unknown';
      const date = p.INCDATE || '';
      const time = p.INCDTTM || '';
      const injuries = safeNumber(p.INJURIES);
      const serious = safeNumber(p.SERIOUSINJURIES);
      const fatals = safeNumber(p.FATALITIES);
      const location = p.LOCATION || '';

      const html = `
        <div style="font-weight:700; margin-bottom:6px;">Collision Details</div>
        <div><b>Severity:</b> ${sev}</div>
        <div><b>Type:</b> ${type}</div>
        <div><b>Location:</b> ${location}</div>
        <div><b>Date:</b> ${date}</div>
        <div><b>Date/Time:</b> ${time}</div>
        <div><b>Injuries:</b> ${injuries} (Serious: ${serious}, Fatalities: ${fatals})</div>
      `;

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });

    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', resetDashboard);

    updateDashboard();
  });

  map.on('moveend', updateDashboard);
}

function buildChartColumnsFromCounts(severityCounts) {
  const preferredOrder = [
    'Property Damage Only Collision',
    'Injury Collision',
    'Serious Injury Collision',
    'Fatality Collision',
    'Unknown / Other'
  ];

  // Stable label list (so colors match consistently)
  const labels = preferredOrder.filter(k => severityCounts[k] !== undefined);

  // Add unexpected categories at the end
  Object.keys(severityCounts).forEach((k) => {
    if (!preferredOrder.includes(k)) labels.push(k);
  });

  // Save globally for bar coloring
  currentLabels = labels;
  currentBarColors = labels.map(severityToColor);

  // C3 needs explicit x column
  const xCol = ['x', ...labels];
  const countCol = ['Count', ...labels.map(l => severityCounts[l] || 0)];

  return { xCol, countCol };
}

function updateDashboard() {
  if (!map || !map.getLayer(LAYER_ID)) return;

  const features = map.queryRenderedFeatures({ layers: [LAYER_ID] });

  document.getElementById('kpi-collisions').textContent = String(features.length);

  let injuriesSum = 0;
  const severityCounts = {};

  features.forEach((f) => {
    const p = f.properties || {};
    const sev = p.SEVERITYDESC || 'Unknown / Other';
    const injuries = safeNumber(p.INJURIES);

    injuriesSum += injuries;

    if (!severityCounts[sev]) severityCounts[sev] = 0;
    severityCounts[sev] += 1;
  });

  document.getElementById('kpi-injuries').textContent = String(injuriesSum);

  const { xCol, countCol } = buildChartColumnsFromCounts(severityCounts);

  if (!chart) {
    chart = c3.generate({
      bindto: '#chart',
      data: {
        x: 'x',
        columns: [xCol, countCol],
        type: 'bar',

        // IMPORTANT: color each bar by its index (category), not the series
        color: function (color, d) {
          // d.index exists for bars
          if (d && typeof d.index === 'number' && currentBarColors[d.index]) {
            return currentBarColors[d.index];
          }
          return color;
        }
      },
      axis: {
        x: {
          type: 'category',
          tick: {
            rotate: 20,
            multiline: false
          }
        },
        y: {
          tick: { format: (d) => d }
        }
      },
      legend: { show: false },
      bar: { width: { ratio: 0.75 } }
    });
  } else {
    // Update chart values + labels (and bar colors update automatically because d.index changes)
    chart.load({
      columns: [xCol, countCol],
      unload: true
    });
  }
}

function resetDashboard() {
  if (!map) return;

  map.flyTo({
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    essential: true
  });
}

initMap();
