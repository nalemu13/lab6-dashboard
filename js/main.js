mapboxgl.accessToken = 'pk.eyJ1IjoibmFsZW11MTMiLCJhIjoiY21sMGR1OHlkMGNsMDNpcHhqbHQxZnNkaSJ9.lIr1YapCLUudIRiNX6kFuA';

const DEFAULT_VIEW = { center: [-122.33, 47.60], zoom: 11 };

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: DEFAULT_VIEW.center,
  zoom: DEFAULT_VIEW.zoom
});

let chart = null;

map.on('load', async () => {
  const resp = await fetch('data/collisions.geojson');
  const data = await resp.json();

  map.addSource('collisions', {
    type: 'geojson',
    data
  });

  map.addLayer({
    id: 'collisions-layer',
    type: 'circle',
    source: 'collisions',
    paint: {
      'circle-radius': 4,
      'circle-color': '#ff6600',
      'circle-opacity': 0.7
    }
  });

  updateDashboard();
});

map.on('moveend', updateDashboard);

function updateDashboard() {
  const features = map.queryRenderedFeatures({ layers: ['collisions-layer'] });

  // KPI count
  document.getElementById('count').textContent = features.length;


  const CATEGORY_FIELD = 'JUNCTIONTYPE';
  const counts = {};

  for (const f of features) {
    const v = f.properties?.[CATEGORY_FIELD];
    const key = (v === null || v === undefined || v === '') ? 'Unknown' : String(v);
    counts[key] = (counts[key] || 0) + 1;
  }

  const columns = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => [k, v]);

  if (!chart) {
    chart = c3.generate({
      bindto: '#chart',
      data: { columns, type: 'bar' }
    });
  } else {
    chart.load({ columns });
  }
}

document.getElementById('reset-btn').addEventListener('click', () => {
  map.flyTo(DEFAULT_VIEW);
});
