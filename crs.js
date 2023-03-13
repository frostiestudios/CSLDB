var map = L.map('map', {
    crs: L.CRS.Simple
});
var bounds = [[0,0], [1728,1728]];
var image = L.imageOverlay('mvsk.png', bounds).addTo(map);
map.fitBounds(bounds);
var yx = L.latLng;

var xy = function(x, y) {
    if (Array.isArray(x)) {    // When doing xy([x, y]);
        return yx(x[1], x[0]);
    }
    return yx(y, x);  // When doing xy(x, y);
};
var sol      = xy(500, 500);
var mizar    = xy( 41.6, 130.1);
var kruegerZ = xy( 13.4,  56.5);
var deneb    = xy(218.7,   8.3);

L.marker(     sol).addTo(map).bindPopup(      'Sol');
L.marker(   mizar).addTo(map).bindPopup(    'Mizar');
L.marker(kruegerZ).addTo(map).bindPopup('Krueger-Z');
L.marker(   deneb).addTo(map).bindPopup(    'Deneb');

var travel = L.polyline([sol, deneb]).addTo(map);
