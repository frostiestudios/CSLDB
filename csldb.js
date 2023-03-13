var map = L.map('map').setView([33,33]);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
var hello = print("Hello World")
map.locate({setView: true, maxZoom: 16});
function onLocationFound(e) {
    L.marker(e.latlng, {icon: usericon}).addTo(map)

}
map.on('locationfound', onLocationFound)