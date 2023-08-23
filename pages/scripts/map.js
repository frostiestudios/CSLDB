var map = L.map('map',{
    crs: L.CRS.Simple,
    minZoom: -5,
});
var customLayer = L.imageOverlay('/pages/maps/map.svg',[[0,0],[1000,1000]]).addTo(map);
map.fitBounds([[0,0],[1000,1000]]);
