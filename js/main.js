mapboxgl.accessToken = 'pk.eyJ1IjoibmFsZW11MTMiLCJhIjoiY21sMGR1OHlkMGNsMDNpcHhqbHQxZnNkaSJ9.lIr1YapCLUudIRiNX6kFuA';

const map = new mapboxgl.Map({
container: 'map',
style: 'mapbox://styles/mapbox/dark-v11',
center: [-122.33, 47.60],
zoom: 11
});


map.on('load', () => {

fetch('data/collisions.geojson')

.then(response => response.json())

.then(data => {

map.addSource('collisions', {

type: 'geojson',

data: data

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

});

});
