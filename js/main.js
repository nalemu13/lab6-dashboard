mapboxgl.accessToken =
  "pk.eyJ1IjoibmFsZW11MTMiLCJhIjoiY21sMGR1OHlkMGNsMDNpcHhqbHQxZnNkaSJ9.lIr1YapCLUudIRiNX6kFuA";

const DEFAULT_VIEW = { center: [-122.33, 47.60], zoom: 11 };

const CATEGORY_FIELD = "JUNCTIONTYPE";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v11",
  center: DEFAULT_VIEW.center,
  zoom: DEFAULT_VIEW.zoom,
});

let chart = null;

map.on("load", async () => {
  try {
    const resp = await fetch("data/collisions.geojson");
    if (!resp.ok) {
      throw new Error(`Could not load data/collisions.geojson (HTTP ${resp.status})`);
    }

    const data = await resp.json();

    map.addSource("collisions", {
      type: "geojson",
      data,
    });

    map.addLayer({
      id: "collisions-layer",
      type: "circle",
      source: "collisions",
      paint: {
        "circle-radius": 4,
        "circle-color": "#ff6600",
        "circle-opacity": 0.7,
      },
    });

    updateDashboard();
  } catch (err) {
    console.error(err);
  }
});

map.on("moveend", () => {
  if (map.getLayer("collisions-layer")) updateDashboard();
});

function updateDashboard() {
  const features = map.queryRenderedFeatures({ layers: ["collisions-layer"] });

  const countEl = document.getElementById("count");
  if (countEl) countEl.textContent = features.length;

  const counts = {};

  for (const f of features) {
    const raw = f?.properties?.[CATEGORY_FIELD];
    const key = raw === null || raw === undefined || raw === "" ? "Unknown" : String(raw);
    counts[key] = (counts[key] || 0) + 1;
  }

  const columns = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => [k, v]);

  if (!chart) {
    chart = c3.generate({
      bindto: "#chart",
      data: {
        columns,
        type: "bar",
      },
      axis: {
        y: {
          label: "Count",
        },
      },
    });
  } else {
    chart.load({ columns });
  }
}

const resetBtn = document.getElementById("reset-btn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    map.flyTo(DEFAULT_VIEW);
  });
}
