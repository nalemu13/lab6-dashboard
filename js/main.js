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

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getSeverityColorExpression() {
  return [
    'match',
    ['get', 'SEVERITYDESC'],
    'Property Damage Only Collision', '#8aa1b1',
    'Injury Collision', '#42c3d6',
    'Serious Injury Collision', '#f59f00',
    'Fatality Collision', '#e03131',
    '#adb5bd'
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

      const html = `
        <div style="font-weight:700; margin-bottom:6px;">Collision Details</div>
        <div><b>Severity:</b> ${p.SEVERITYDESC}</div>
        <div><b>Type:</b> ${p.COLLISIONTYPE}</div>
        <div><b>Location:</b> ${p.LOCATION}</div>
        <div><b>Date:</b> ${p.INCDATE}</div>
        <div><b>Injuries:</b> ${p.INJURIES}</div>
      `;

      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map);
    });

    map.on('mouseenter', LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });

    document.getElementById('reset-btn')
      .addEventListener('click', resetDashboard);

    updateDashboard();
  });

  map.on('moveend', updateDashboard);
}

function updateDashboard() {
  if (!map || !map.getLayer(LAYER_ID)) return;

  const features = map.queryRenderedFeatures({
    layers: [LAYER_ID]
  });

  document.getElementById('kpi-collisions')
    .textContent = features.length;

  let injuriesSum = 0;

  let pdo = 0;
  let injury = 0;
  let serious = 0;
  let fatal = 0;
  let unknown = 0;

  features.forEach((f) => {
    const p = f.properties || {};
    const sev = p.SEVERITYDESC;

    injuriesSum += safeNumber(p.INJURIES);

    if (sev === 'Property Damage Only Collision') pdo++;
    else if (sev === 'Injury Collision') injury++;
    else if (sev === 'Serious Injury Collision') serious++;
    else if (sev === 'Fatality Collision') fatal++;
    else unknown++;
  });

  document.getElementById('kpi-injuries')
    .textContent = injuriesSum;

  const categories = [
    'Property Damage Only',
    'Injury Collision',
    'Serious Injury Collision',
    'Fatality Collision',
    'Unknown'
  ];

  const counts = [
    pdo,
    injury,
    serious,
    fatal,
    unknown
  ];

  if (!chart) {
    chart = c3.generate({
      bindto: '#chart',

      data: {
        columns: [
          ['Count', ...counts]
        ],
        type: 'bar',

        color: function(color, d) {
          const colors = [
            '#8aa1b1',
            '#42c3d6',
            '#f59f00',
            '#e03131',
            '#adb5bd'
          ];
          return colors[d.index];
        }
      },

      axis: {
        x: {
          type: 'category',
          categories: categories,
          tick: {
            rotate: 20,
            multiline: false
          }
        },

        y: {
          tick: {
            format: d => d
          }
        }
      },

      legend: {
        show: false
      },

      bar: {
        width: {
          ratio: 0.75
        }
      }
    });
  } else {
    chart.load({
      columns: [
        ['Count', ...counts]
      ]
    });
  }
}

function resetDashboard() {
  map.flyTo({
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom
  });
}

initMap();
