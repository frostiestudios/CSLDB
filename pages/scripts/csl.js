"use strict";

const svgns = "http://www.w3.org/2000/svg";
const xlinkns = "http://www.w3.org/1999/xlink";
const halfCanvas = 8650;
const tileCount = 9;
const canvasMargin = 0;
const heightMapSide = 1081;

document.addEventListener("DOMContentLoaded", function() {
    document.addEventListener("drop", function(event) {
        event.preventDefault();
        event.stopPropagation();
    
        status("loading file...");
        function processFile(file) {
            const dataReader = new FileReader();
            const domParser = new DOMParser();
            dataReader.onload = function(ev) {
                const xmlDoc = domParser.parseFromString(ev.target.result, "text/xml");
                buildMap(xmlDoc);
            }
            dataReader.readAsText(file);
        }
        
        for (const item of event.dataTransfer.items) {
            if (item.kind == 'file') {
                processFile(item.getAsFile());
                return;
            }
        }
    
        for (const item of event.dataTransfer.files) {
            processFile(item);
            return;
        }
    });

    ["dragenter", "dragover", "dragleave"].forEach(evName => {
        document.addEventListener(evName, function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
        });
    });

    function toggleLayer(ev) {
        const display = this.checked ? "inherit" : "none";
        for (const name of this.name.split("+")) {
            document.querySelector("#" + name).style.display = display;
        }
    }

    for (const toggle of document.querySelectorAll("#controls input[type=checkbox]")) {
        toggle.addEventListener("change", toggleLayer);
    }

    const dropdowns = document.querySelectorAll(".box .collapsed");
    function hideDropdowns() {
        for (const dropdown of dropdowns) {
            dropdown.style.display = "none";
        }
    }
    document.addEventListener("click", hideDropdowns, false);
    document.addEventListener("keyup", function(ev) {
        if (ev.keyCode == 27) {
            hideDropdowns();
        }
    });

    for (const dropdown of dropdowns) {
        dropdown.style.display = "none";
        dropdown.previousElementSibling.addEventListener("click", function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            hideDropdowns();
            dropdown.style.display = "";
        }, true);
        dropdown.addEventListener("click", function(ev) {
            ev.stopPropagation();
        }, true);
    }

    function clampViewbox(cx, cy, halfDim) {
        const min = -halfCanvas;
        var x1 = cx - halfDim;
        if (x1 < min) {
            cx += min - x1;
            x1 = cx - halfDim;
        }
        
        var x2 = cx + halfDim;
        if (x2 > halfCanvas) {
            cx -= x2 - halfCanvas;
            x2 = cx + halfDim;
        }
        
        var y1 = cy - halfDim;
        if (y1 < min) {
            cy += min - y1;
            y1 = cy - halfDim;
        }
        
        var y2 = cy + halfDim;
        if (y2 > halfCanvas) {
            cy -= y2 - halfCanvas;
            y2 = cy + halfDim;
        }
        return [x1, y1, halfDim * 2, halfDim * 2];
    }

    const zoomSlider = document.querySelector("#zoom");
    zoomSlider.addEventListener("input", function() {
        this.nextElementSibling.textContent = (this.value | 0) + 100 + "%";
    });
    zoomSlider.addEventListener("change", function() {
        const svg = document.querySelector("#map");
        const halfDim = halfCanvas / (1 + this.value / 100);
        const box = svg.viewBox.animVal;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        svg.setAttribute("viewBox", clampViewbox(cx, cy, halfDim).join(" "));
    });

    document.querySelector("#contents").addEventListener("mousedown", function(ev) {
        const svg = document.querySelector("#map");
        if (!svg) {
            return;
        }

        const box = svg.viewBox.animVal;
        const scale = [
            box.width / svg.clientWidth,
            box.height / svg.clientHeight];
        const dragStart = [ev.clientX, ev.clientY];
        const boxCoordsStart = [box.x, box.y];
        function mouseMove(mmEv) {
            const newPos = [mmEv.clientX, mmEv.clientY];
            const delta = [
                (newPos[0] - dragStart[0]) * scale[0],
                (newPos[1] - dragStart[1]) * scale[1]];
            const cx = boxCoordsStart[0] - delta[0] + box.width / 2;
            const cy = boxCoordsStart[1] - delta[1] + box.height / 2;
            svg.setAttribute("viewBox", clampViewbox(cx, cy, box.width / 2).join(" "));
        }

        const mouseUp = function(muEv) {
            window.removeEventListener("mouseup", mouseUp);
            window.removeEventListener("mousemove", mouseMove);
        }

        window.addEventListener("mousemove", mouseMove);
        window.addEventListener("mouseup", mouseUp);
        ev.preventDefault();
    });

    const dynamicCSS = document.querySelector("#dynamic-style").sheet;
    var buildingStyle = null;
    document.querySelector("#buildings-style").addEventListener("change", function(ev) {
        if (buildingStyle !== null) {
            dynamicCSS.removeRule(buildingStyle);
            buildingStyle = null;
        }
        switch (this.value) {
            case "hard":
                // default
                break;
            case "soft":
                buildingStyle = dynamicCSS.insertRule("svg #buildings { stroke-width: 0; }");
                break;
            case "hide":
                buildingStyle = dynamicCSS.insertRule("svg #buildings { display: none; }");
                break;
        }
    });

    document.querySelector("#download-as").addEventListener("change", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const cityName = document.querySelector("#cityname").textContent;
        const svg = document.querySelector("#map");
        switch (this.value) {
            case "png4096":
                downloadBitmap(svg, cityName + "-4096.png", "image/png", 4096);
                break;
            case "png2048":
                downloadBitmap(svg, cityName + "-2048.png", "image/png", 2048);
                break;
            case "svg":
                downloadSVG(svg, cityName + ".svg");
                break;
        }
        this.value = "-";
    });
});

class HeightMap {
    constructor(map, defaultColor) {
        this.map = map;
        this.defaultColor = defaultColor;
    }

    interp(value, threshold, min, max) {
        if (value < min) {
            return this.defaultColor;
        }

        var scale = (value - min) / max;
        scale /= threshold;
        scale = Math.round(scale);
        scale *= threshold;

        const indexScaled = scale * (this.map.length - 1);
        const lowIndex = Math.floor(indexScaled);
        const highIndex = Math.ceil(indexScaled);
        return this.lerp(indexScaled - lowIndex, this.map[lowIndex], this.map[highIndex]);
    }

    lerp(offset, lowColor, highColor) {
        var color = new Uint8Array(3);
        for (var i = 0; i < 3; ++i) {
            color[i] = (lowColor[i] * (1 - offset)) + (highColor[i] * offset);
        }
        return color;
    }
}

const defaultHeightMap = new HeightMap([
    new Uint8Array([94, 117, 46]),
    new Uint8Array([173, 196, 20]),
    new Uint8Array([255, 255, 168]),
    new Uint8Array([219, 161, 79]),
    new Uint8Array([79, 46, 13]),
], new Uint8Array([30, 30, 200]));

function status(message) {
    document.querySelector("#subtitle").textContent = message;
}

function intersection(r1, r2) {
    const x1 = Math.max(r1.x1, r2.x1);
    const x2 = Math.min(r1.x2, r2.x2);
    const y1 = Math.max(r1.y1, r2.y1);
    const y2 = Math.min(r1.y2, r2.y2);
    return (x1 < x2 && y1 < y2) ? {x1: x1, y1: y1, x2: x2, y2: y2} : null;
}

function area(r) {
    return r && (r.x2 - r.x1) * (r.y2 - r.y1) || 0;
}

function perceivedLuminance(color) {
    // sqrt( 0.299*R^2 + 0.587*G^2 + 0.114*B^2 )
    function sq(i) { return color[i] * color[i]; }
    return Math.sqrt(0.299 * sq(0) + 0.587 * sq(1) + 0.114 * sq(2));
}

function highlightColor(color) {
    const isDarker = perceivedLuminance(color) <= 127;
    return color.map(n => isDarker ? (n + 256) / 2 : n / 2);
}

const downloadBlob = (function() {
    const a = document.createElement("a");
    a.style = "display: none";
    document.addEventListener("DOMContentLoaded", function() {
        document.body.appendChild(a);
    });
    return function(blob, fileName) {
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }
})();

function makeXMLBlob(element) {
    const ser = new XMLSerializer().serializeToString(element)
    const xmlTag = '<?xml version="1.0" encoding="UTF-8"?>\n';
    return new Blob([xmlTag, ser], {type: "image/svg+xml"});
}

function downloadBitmap(svgElement, fileName, format, resolution, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext("2d");

    // and here we create a blob from the SVG XML to pass to an <img> tag
    // because you can drawImage an <img> of an arbitrary format, including
    // SVG, but you can't draw an SVG node
    const img = document.createElement("img");
    img.width = resolution;
    img.height = resolution;

    // Firefox requires width/height attributes on SVG files that are
    // rendered to canvases
    const svgCopy = dissociateSVG(svgElement);
    svgCopy.setAttribute("width", resolution);
    svgCopy.setAttribute("height", resolution);

    img.src = URL.createObjectURL(makeXMLBlob(svgCopy));
    img.addEventListener("load", function() {
        URL.revokeObjectURL(img.src);
        ctx.drawImage(img, 0, 0, resolution, resolution);
        canvas.toBlob(blob => downloadBlob(blob, fileName), format, quality);
    });
}

const dissociateSVG = (function() {
    // need to embed stylesheet, and to do that we need to embed a CDATA
    // section, and to do that we need to create a new document
    const svgdt = document.implementation.createDocumentType("svg", "-//W3C//DTD SVG 1.2//EN", "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd");

    return function(svgElement) {
        var styleData = "svg { width: " + tileCount + "in; height: " + tileCount + "in; }\n";
        for (const styleSheet of document.styleSheets) {
            for (const rule of styleSheet.cssRules) {
                if (rule.selectorText.indexOf("svg ") == 0) {
                    styleData += rule.cssText.substr(4) + "\n";
                }
            }
        }

        const svgDoc = document.implementation.createDocument(svgns, "svg", svgdt);
        const copy = svgDoc.importNode(svgElement, true);
        svgDoc.replaceChild(copy, svgDoc.documentElement);

        const style = svgDoc.createElementNS(svgns, "style");
        const cdata = svgDoc.createCDATASection(styleData);
        style.appendChild(cdata);
        copy.insertBefore(style, copy.firstChild);
        return copy;
    }
})();

function downloadSVG(svgImage, fileName) {
    downloadBlob(makeXMLBlob(dissociateSVG(svgImage)), fileName);
}

function makePathFromCsl(points) {
    return makePath([...points.querySelectorAll("P")].map(pt => {
        return {x: pt.getAttribute("x") * 1, y: -pt.getAttribute("z")};
    }));
}

function makePath(points) {
    var data = "";
    for (const point of points) {
        data += data.length == 0 ? "M" : "L";
        data += point.x + " " + point.y + " ";
    }
    return data;
}

function renderImageData(imageData, callback, format, quality) {
    const side = Math.sqrt(imageData.length / 4);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    context.putImageData(new ImageData(imageData, side, side), 0, 0);
    canvas.toBlob(function(blob) {
        const blobURL = URL.createObjectURL(blob)
        const image = document.createElementNS(svgns, "image");
        const loadCallback = function(ev) {
            URL.revokeObjectURL(blobURL);
            image.removeEventListener("load", loadCallback);
        }
        image.addEventListener("load", loadCallback);
        image.setAttributeNS(xlinkns, "href", blobURL);
        image.setAttribute("x", -halfCanvas + canvasMargin);
        image.setAttribute("y", -halfCanvas + canvasMargin);
        image.setAttribute("width", 2 * halfCanvas - canvasMargin * 2);
        image.setAttribute("height", 2 * halfCanvas - canvasMargin * 2);
        image.setAttribute("transform", "scale(1, -1)");
        callback(image);
    }, format, quality);
}

function buildTerrain(csldoc, heightMap, callback) {
    const seaLevel = csldoc.querySelector("SeaLevel").textContent | 0;
    const ter = csldoc.querySelector("Terrains").querySelector("Ter");
    const data = ter.textContent.split(/[,:]/);
    const imageData = new Uint8ClampedArray(heightMapSide * heightMapSide * 4);
    for (var readIndex = 0; readIndex < data.length; readIndex += 2) {
        var color = heightMap.interp(data[readIndex], 0.05, seaLevel, (1 << 16) - 1);
        if (data[readIndex + 1] > seaLevel) {
            color = heightMap.lerp(0.75, color, heightMap.defaultColor);
        }
        const writeIndex = readIndex / 2 * 4;
        for (var j = 0; j < 3; ++j) {
            imageData[writeIndex + j] = color[j];
        }
        imageData[writeIndex + 3] = 255;
    }
    return renderImageData(imageData, callback, "image/jpeg", 0.75);
}

function buildForests(csldoc, callback) {
    const imageData = new Uint8ClampedArray(512 * 512 * 4);
    const rows = csldoc.querySelector("Forests").querySelectorAll("Forest");
    for (var y = 0; y < rows.length; ++y) {
        const cells = rows[y].textContent.split(",");
        for (var x = 0; x < cells.length; ++x) {
            const index = (y * 512 + x) * 4;
            imageData[index + 0] = 0; // R
            imageData[index + 1] = 0x40; // G
            imageData[index + 2] = 0; // B
            imageData[index + 3] = cells[x]; // A
        }
    }

    const forestMap = renderImageData(imageData, function(image) {
        image.id = "forests";
        callback(image);
    }, "image/png");
}

function buildDistricts(csldoc) {
    const g = document.createElementNS(svgns, "g");
    g.id = "districts";

    const districts = [...csldoc.querySelector("Districts").querySelectorAll("Dist")];
    districts.sort((a, b) => a.getAttribute("name").localeCompare(b.getAttribute("name")));

    const districtList = document.querySelector("#district-list");
    for (const dist of districts) {
        // svg element
        const point = dist.querySelector("P");
        const text = document.createElementNS(svgns, "text");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("x", point.getAttribute("x"));
        text.setAttribute("y", -point.getAttribute("z"));
        text.textContent = dist.getAttribute("name");

        const stroke = text.cloneNode(true);
        stroke.classList.add("stroke");
        text.classList.add("fill");
        g.appendChild(stroke);
        g.appendChild(text);

        // checkbox and event listener
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.addEventListener("change", function(ev) {
            const display = this.checked ? "" : "none";
            text.style.display = display;
            stroke.style.display = display;
        }, true);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(text.textContent));
        districtList.appendChild(label);
    }
    return g;
}

function buildTransitTable(organizer) {
    const routes = [...organizer.routes];
    routes.sort((a, b) => {
        var aId = a.type + "\0" + a.name;
        var bId = b.type + "\0" + b.name;
        return aId.localeCompare(bId, undefined, {numeric: true, sensitivity: "base"});
    });

    function addCategory(type) {
        const row = document.createElement("tr");
        row.classList.add("category");
        for (var i = 0; i < 2; ++i) {
            const cell = document.createElement("th");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = true;
            const childIndex = i;
            checkbox.addEventListener("change", function(ev) {
                const tr = this.parentNode.parentNode;
                if (childIndex == 0) {
                    const stopsCheckbox = this.parentNode.nextElementSibling.firstChild;
                    stopsCheckbox.checked = this.checked;
                    stopsCheckbox.dispatchEvent(new Event("change"));
                } else if (this.checked) {
                    const linesCheckbox = this.parentNode.previousElementSibling.firstChild;
                    if (!linesCheckbox.checked) {
                        linesCheckbox.checked = true;
                        linesCheckbox.dispatchEvent(new Event("change"));
                    }
                }
                for (var line = tr.nextElementSibling; line && !line.classList.contains("category"); line = line.nextElementSibling) {
                    const checkbox = line.childNodes[childIndex].firstChild;
                    checkbox.checked = this.checked;
                    checkbox.dispatchEvent(new Event("change"));
                }
            });
            cell.appendChild(checkbox);
            row.appendChild(cell);
        }
        const cell = document.createElement("th");
        cell.textContent = type;
        row.appendChild(cell);
        table.appendChild(row);
    }

    const table = document.querySelector("#route-list");
    var type = undefined;
    for (const route of routes) {
        if (route.type != type) {
            type = route.type;
            addCategory(type);
        }

        const row = document.createElement("tr");
        const checkboxes = [];
        for (var i = 0; i < 2; ++i) {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = true;
            const td = document.createElement("td");
            td.appendChild(checkbox);
            row.appendChild(td);
            checkboxes.push(checkbox);
        }

        checkboxes[0].addEventListener("change", function(event) {
            for (const segment of route.domSegments) {
                segment.style.display = this.checked ? "" : "none";
            }
            checkboxes[1].checked = this.checked;
            checkboxes[1].display(new Event("change"));
        });

        checkboxes[1].addEventListener("change", function(event) {
            if (this.checked && !checkboxes[0].checked) {
                checkboxes[0].checked = true;
                checkboxes[0].dispatchEvent(new Event("change"));
            }

            // TODO: hide stop labels and such
        });

        const td = document.createElement("td");
        td.textContent = route.name;
        row.appendChild(td);
        table.appendChild(row);
    }
}

class SegmentGroup {
    constructor(cssClass) {
        this.keywords = [];
        this.cssClass = cssClass;
    }

    matches(name) {
        for (const keyword of this.keywords) {
            if (name.indexOf(keyword) != -1) {
                return true;
            }
        }
        return false;
    }

    static get allGroups() {
        const airplanes = new SegmentGroup("airplane");
        airplanes.keywords.push("Airplane");

        const boats = new SegmentGroup("harbour");
        boats.keywords.push("Harbor");

        const highways = new SegmentGroup("highway");
        highways.keywords.push("Highway");

        const power = new SegmentGroup("power");
        power.keywords.push("Power");

        const train = new SegmentGroup("train");
        train.keywords.push("Train");

        const metro = new SegmentGroup("metro");
        metro.keywords.push("Metro");

        const road = new SegmentGroup("road");
        road.keywords.push("Road", "Avenue", "Oneway", "Alley");

        const misc = new SegmentGroup("misc");
        return [airplanes, boats, highways, power, train, metro, road, misc];
    }

    static get defaultGroup() {
        return this.allGroups[this.allGroups.length - 1];
    }
}

class RoadSegment {
    constructor(segNode) {
        this.id = segNode.getAttribute("id") | 0;
        this.startNode = segNode.getAttribute("sn") | 0;
        this.endNode = segNode.getAttribute("en") | 0;
        this.width = segNode.getAttribute("width") | 0;
        this.points = [];
        this.routes = {};
        this.maxZ = 1 / -0;
        for (const point of segNode.querySelectorAll("P")) {
            const x = point.getAttribute("x") * 1;
            const y = -point.getAttribute("z");
            this.maxZ = Math.max(this.maxZ, point.getAttribute("y"));
            this.points.push({x: x, y: y});
        }

        this.layer = SegmentGroup.defaultGroup;
        const name = segNode.querySelector("Name").textContent;
        for (const group of SegmentGroup.allGroups) {
            if (group.matches(name)) {
                this.layer = group;
            }
        }

        if (this.layer.cssClass == "power") {
            // power lines show too low for some reason
            this.maxZ += 20;
        }
    }

    get routeCount() {
        return Object.keys(this.routes).length;
    }

    toPath(document, width) {
        const p = document.createElementNS(svgns, "path");
        width = width || this.width;
        p.setAttribute("d", makePath(this.points));
        p.setAttribute("stroke-width", width);
        p.classList.add(this.layer.cssClass);
        return p;
    }
}

class RouteSegment {
    constructor(segNode) {
        this.startNode = segNode.getAttribute("sn") | 0;
        this.endNode = segNode.getAttribute("en") | 0;
        this.segments = [...segNode.querySelectorAll("Sg")].map(sg => sg.textContent | 0);
    }

    get key() {
        return this.startNode + "," + this.endNode;
    }
}

class Route {
    constructor(transNode, index) {
        this.index = index;
        this.id = transNode.getAttribute("id");
        this.name = transNode.getAttribute("name");
        this.type = transNode.getAttribute("type");
        const color = transNode.querySelector("color");
        this.color = new Uint8Array([
            color.getAttribute("r"),
            color.getAttribute("g"),
            color.getAttribute("b"),
            color.getAttribute("a"),
        ]);
        this.stops = [...transNode.querySelectorAll("Stop")]
            .map(n => n.getAttribute("node") | 0);
        this.domSegments = [];
        this.domLabels = [];
    }

    toCSS(color) {
        const components = [color[0], color[1], color[2]].join(", ");
        return "rgba(" + components + ", " + color[3] / 255 + ")";
    }

    get cssColor() {
        return this.toCSS(this.color);
    }

    get cssHighlightColor() {
        return this.toCSS(highlightColor(this.color));
    }

    getNodePairs() {
        const stops = [];
        for (var i = 1; i < this.stops.length; ++i) {
            stops.push(this.stops[i - 1] + "," + this.stops[i]);
        }
        stops.push(this.stops[this.stops.length - 1] + "," + this.stops[0]);
        return stops;
    }
}

class TransitStopGroup {
    constructor(stop) {
        this.stops = [stop];
    }

    distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    isWithin(point, threshold) {
        return this.distance(this, point) < threshold;
    }

    get x() {
        return this.stops.reduce((n, v) => (n || 0) + v.x, 0) / this.stops.length;
    }

    get y() {
        return this.stops.reduce((n, v) => (n || 0) + v.y, 0) / this.stops.length;
    }
}

class SegmentOrganizer {
    constructor() {
        this.segmentsByZ = [];
        this.routes = [];
        this.segmentById = {};
        this.nodeById = {};
        this.routeSegments = {};
        this.stopMergeThreshold = 48;
        this.stops = [];
    }

    loadRouteSegment(segment) {
        const routeSegment = new RouteSegment(segment);
        this.routeSegments[routeSegment.key] = routeSegment;
    }

    loadSegment(segment) {
        const roadSegment = new RoadSegment(segment);
        this.segmentById[roadSegment.id] = roadSegment;
        this.segmentsByZ.push(roadSegment);
    }

    forEachRouteSegment(route, callback) {
        for (const key of route.getNodePairs()) {
            for (const id of this.routeSegments[key].segments) {
                callback(this.segmentById[id]);
            }
        }
    }

    loadRoute(transNode) {
        const route = new Route(transNode, this.routes.length + 1);
        if (route.stops.length != 0) {
            this.routes.push(route);
            this.forEachRouteSegment(route, function(segment) {
                segment.routes[route.id] = true;
            });
        }
    }

    load(csldoc) {
        for (const node of csldoc.querySelector("Nodes").querySelectorAll("Node")) {
            const pos = node.querySelector("Pos");
            this.nodeById[node.getAttribute("id") | 0] = {
                x: pos.getAttribute("x") * 1,
                y: -pos.getAttribute("z")
            };
        }

        for (const segment of csldoc.querySelector("Segments").querySelectorAll("Seg")) {
            if (segment.querySelector("Path")) {
                this.loadRouteSegment(segment);
            } else {
                this.loadSegment(segment);
            }
        }

        for (const transNode of csldoc.querySelector("Transports").querySelectorAll("Trans")) {
            this.loadRoute(transNode);
        }

        this.segmentsByZ.sort((a, b) => a.maxZ - b.maxZ);
    }

    buildRoads(document) {
        const bg = document.createElementNS(svgns, "g");
        bg.classList.add("bg");
    
        const fg = document.createElementNS(svgns, "g");
        fg.classList.add("fg");
    
        for (const path of this.segmentsByZ) {
            bg.appendChild(path.toPath(document));
            fg.appendChild(path.toPath(document, path.width - 4));
        }
    
        const segments = document.createElementNS(svgns, "g");
        segments.id = "segments";
        segments.appendChild(bg);
        segments.appendChild(fg);
        return segments;
    }

    buildTransitRoutes(document) {
        const segmentVisits = {};
        const fg = document.createElementNS(svgns, "g");
        const bg = document.createElementNS(svgns, "g");

        const stops = [];
        for (const route of this.routes) {
            for (const stop of route.stops) {
                const pos = this.nodeById[stop];
                stops.push({route: route, x: pos.x, y: pos.y});
            }

            this.forEachRouteSegment(route, function(segment) {
                const strokeUnit = Math.min(segment.width / segment.routeCount, 10);
                const visits = segmentVisits[segment.id] || new Set();
                if (!visits.has(route.id)) {
                    const strokeWidth = strokeUnit * (segment.routeCount - visits.size);
                    visits.add(route.id);
                    segmentVisits[segment.id] = visits;

                    const bgPath = segment.toPath(document, strokeWidth + 3);
                    bgPath.setAttribute("stroke", route.cssHighlightColor);
                    route.domSegments.push(bgPath);
                    bg.appendChild(bgPath);

                    const fgPath = segment.toPath(document, strokeWidth);
                    fgPath.setAttribute("stroke", route.cssColor);
                    route.domSegments.push(fgPath);
                    fg.appendChild(fgPath);
                }
            });
        }

        this.stops = this.groupStops(stops);

        const routes = document.createElementNS(svgns, "g");
        routes.id = "transit";
        routes.appendChild(bg);
        routes.appendChild(fg);
        return routes;
    }

    createStopsLayer(document) {
        const stopsLayer = document.createElementNS(svgns, "g");
        stopsLayer.id = "stops";
        return stopsLayer;
    }

    createStops(document, stopsLayer, placement) {
        for (const label of placement.chosenCandidates) {
            const group = label.representedObject;
            const groupCX = group.x;
            const groupCY = group.y;

            const elem = document.createElementNS(svgns, "g");
            // "string" that ties the stop to the label
            const labelString = document.createElementNS(svgns, "line");
            labelString.setAttribute("x1", groupCX);
            labelString.setAttribute("y1", groupCY);
            labelString.setAttribute("x2", label.cx);
            labelString.setAttribute("y2", label.cy);
            labelString.classList.add("stroked");
            elem.appendChild(labelString);

            const labelG = document.createElementNS(svgns, "g");
            for (const stop of group.stops) {
                const text = document.createElementNS(svgns, "text");
                text.setAttribute("x", label.cx);
                text.setAttribute("y", label.cy);
                text.textContent = "#" + stop.route.index;
                labelG.appendChild(text);
            }
            elem.appendChild(labelG);
            label.domNode = labelG;

            const pin = document.createElementNS(svgns, "circle");
            pin.classList.add("stroked");
            pin.setAttribute("cx", group.x);
            pin.setAttribute("cy", group.y);
            pin.setAttribute("r", Math.min(34, 16 + Math.floor(group.stops.length / 2) * 6));
            elem.appendChild(pin);
            stopsLayer.appendChild(elem);
        }
    }

    updateStops(placement) {
        const padding = 10;
        for (const label of placement.chosenCandidates) {
            const document = label.domNode.ownerDocument;
            label.update(label.domNode);

            var x = padding;
            const spans = label.domNode.querySelectorAll("text");
            for (var i = 0; i < spans.length; ++i) {
                const text = spans[i];
                const route = label.representedObject.stops[i].route;
                text.setAttribute("x", text.getAttribute("x") * 1 + x);
                text.setAttribute("fill", perceivedLuminance(route.color) <= 127 ? "white" : "black");
                
                const textBox = text.getBBox();
                x += textBox.width + padding * 2;

                const bgRect = document.createElementNS(svgns, "rect");
                bgRect.setAttribute("x", textBox.x - padding);
                bgRect.setAttribute("y", textBox.y - padding);
                bgRect.setAttribute("width", textBox.width + padding * 2);
                bgRect.setAttribute("height", textBox.height + padding * 2);
                bgRect.setAttribute("fill", route.cssColor);
                label.domNode.insertBefore(bgRect, text);
            }

            const bbox = label.domNode.getBBox();
            const backRect = document.createElementNS(svgns, "rect");
            backRect.classList.add("stroked");
            backRect.setAttribute("x", bbox.x);
            backRect.setAttribute("y", bbox.y);
            backRect.setAttribute("width", bbox.width);
            backRect.setAttribute("height", bbox.height);
            label.domNode.insertBefore(backRect, label.domNode.firstChild);

            const line = label.domNode.parentNode.querySelector("line");
            line.setAttribute("x2", bbox.x + bbox.width / 2);
            line.setAttribute("y2", bbox.y + bbox.height / 2);
        }
    }

    groupStops(stops) {
        // group stops together (n^2, yikes)
        const stopGroups = [];
        stopLoop: for (const stop of stops) {
            for (const stopGroup of stopGroups) {
                if (stopGroup.isWithin(stop, this.stopMergeThreshold)) {
                    stopGroup.stops.push(stop);
                    continue stopLoop;
                }
            }
            stopGroups.push(new TransitStopGroup(stop));
        }

        // merge stop groups that are close to one another
        for (var i = 0; i < stopGroups.length; ++i) {
            var j = i + 1;
            while (j < stopGroups.length) {
                if (stopGroups[i].isWithin(stopGroups[j], this.stopMergeThreshold)) {
                    stopGroups[i].stops.push(...stopGroups[j].stops);
                    stopGroups.splice(j, 1);
                } else {
                    ++j;
                }
            }
        }

        // sort lines
        for (const group of stopGroups) {
            group.stops.sort((a, b) => a.route.index - b.route.index);
            // remove duplicates
            var i = 1;
            while (i < group.stops.length) {
                if (group.stops[i].route === group.stops[i - 1].route) {
                    group.stops.splice(i, 1);
                } else {
                    ++i;
                }
            }
        }

        return stopGroups;
    }

    seedStopLabels(labels) {
        const labelsOnRadius = (function() {
            const fourthOfPi = Math.PI / 4;
            const twoPi = Math.PI * 2;
            return function(group, r, width, height, count) {
                const cx = group.x;
                const cy = group.y;
                for (var i = 0; i < count; ++i) {
                    const angle = fourthOfPi + twoPi / count * i;
                    const x = cx + Math.cos(angle) * r;
                    const y = cy - Math.sin(angle) * r;
                    labels.addCandidate(new Label(x, y, width, height, group));
                }
            }
        })();

        for (const group of this.stops) {
            const dimensions = this.estimateLabelDimensions(group);
            labelsOnRadius(group, 120 + dimensions[0] / 2, ...dimensions, 6);
            labelsOnRadius(group, 180 + dimensions[0] / 2, ...dimensions, 10);
            labelsOnRadius(group, 240 + dimensions[0] / 2, ...dimensions, 15);
        }
    }

    estimateLabelDimensions(stopGroup) {
        // arbitrary estimate
        return [150 * stopGroup.stops.length, 90];
    }
}

class Label {
    constructor(cx, cy, width, height, representedObject) {
        this.cx = cx;
        this.cy = cy;
        this.x1 = cx - width / 2;
        this.y1 = cy - height / 2;
        this.x2 = cx + width / 2;
        this.y2 = cy + height / 2;
        this.penalty = 0;
        this.domNode = null;
        this.representedObject = representedObject;
    }

    update(domNode) {
        this.domNode = domNode;
        const box = this.domNode.getBBox();
        this.width = box.width;
        this.height = box.height;
        this.x1 = box.x;
        this.x2 = box.x + box.width;
        this.y1 = box.y;
        this.y2 = box.y + box.height;
        this.cx = (this.x1 + this.x2) / 2;
        this.cy = (this.y1 + this.y2) / 2;
    }

    get area() {
        return area(this);
    }
}

class LabelPlacement {
    constructor() {
        this.fixedLabels = [];
        this.candidateLabels = [];
        this.chosenCandidates = [];
    }

    get isComplete() {
        return this.candidateLabels.length == 0;
    }

    addFixedLabel(node, representedObject) {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        const label = new Label(0, 0, 0, 0, representedObject || null);
        label.update(node);
        this.fixedLabels.push(label);
    }

    addCandidate(label) {
        this.candidateLabels.push(label);
    }

    generate() {
        this.fixedLabels.push(...this.chosenCandidates);
        this.chosenCandidates = [];

        if (this.candidateLabels.length) {
            this.updatePenalties();
    
            // process 20% of elements or 10 elements, whichever is higher
            const count = Math.min(Math.max(Math.floor(this.candidateLabels.length / 5), 20), this.candidateLabels.length);
            const maxPenalty = this.candidateLabels[count - 1].penalty;
            const foundElements = new Set();
            for (var i = 0; i < this.candidateLabels.length; ++i) {
                const label = this.candidateLabels[i];
                if (label.penalty > maxPenalty) {
                    break;
                }
                if (!foundElements.has(label.representedObject)) {
                    foundElements.add(label.representedObject);
                    this.chosenCandidates.push(label);
                }
            }

            this.candidateLabels = this.candidateLabels.filter(x => !foundElements.has(x.representedObject));
        }
    }

    updatePenalties() {
        for (var i = 0; i < this.candidateLabels.length; ++i) {
            const label1 = this.candidateLabels[i];
            label1.penalty = 0;

            for (const fixedLabel of this.fixedLabels) {
                const overlap = intersection(label1, fixedLabel);
                const overlapArea = area(overlap);
                label1.penalty += overlapArea / label1.area;
            }

            for (var j = i + 1; j < this.candidateLabels.length; ++j) {
                const label2 = this.candidateLabels[j];
                // can't self-interfere
                if (label1.representedObject === label2.representedObject) {
                    continue;
                }
                const overlap = intersection(label1, label2);
                const overlapArea = area(overlap);
                label1.penalty += overlapArea / label1.area;
                label2.penalty += overlapArea / label2.area;
            }
        }
        this.candidateLabels.sort((a, b) => a.penalty - b.penalty);
    }
}

function buildBuildings(csldoc) {
    const g = document.createElementNS(svgns, "g");
    g.id = "buildings";
    for (const building of csldoc.querySelector("Buildings").querySelectorAll("Buil")) {
        const p = document.createElementNS(svgns, "path");
        p.setAttribute("d", makePathFromCsl(building) + "Z");
        p.classList.add(building.getAttribute("srv"));
        p.classList.add(building.getAttribute("subsrv"));
        g.appendChild(p);
    }
    return g;
}

function generateTiles() {
    const g = document.createElementNS(svgns, "g");
    g.id = "tiles";
    for (var i = 1; i <= tileCount; ++i) {
        const offset = i * (halfCanvas * 2 / tileCount) - halfCanvas - 25;
        const line1 = document.createElementNS(svgns, "line");
        line1.setAttribute("x1", offset);
        line1.setAttribute("y1", -halfCanvas);
        line1.setAttribute("x2", offset);
        line1.setAttribute("y2", halfCanvas);
        g.appendChild(line1);

        const line2 = document.createElementNS(svgns, "line");
        line2.setAttribute("x1", -halfCanvas);
        line2.setAttribute("y1", offset);
        line2.setAttribute("x2", halfCanvas);
        line2.setAttribute("y2", offset);
        g.appendChild(line2);
    }
    return g;
}

function buildMap(csldoc) {
    document.querySelector("#cityname").textContent = csldoc.querySelector("City").textContent;
    const saveTime = new Date(Date.parse(csldoc.querySelector("Generated").textContent));

    const organizer = new SegmentOrganizer();
    const labels = new LabelPlacement();
    const svg = document.createElementNS(svgns, "svg");
    svg.id = "map";
    const min = -halfCanvas;
    const dim = halfCanvas * 2;
    svg.setAttribute("viewBox", [min, min, dim, dim].join(" "));

    const background = document.createElementNS(svgns, "g");
    background.id = "background";
    svg.appendChild(background);

    const contents = document.querySelector("#contents");
    while (contents.childNodes.length) {
        contents.removeChild(contents.firstChild);
    }
    contents.appendChild(svg);

    var grid = null;
    var transit = null;
    var stops = null;
    var districts = null;
    function advance(step) {
        var counter = -1;
        var uiStep = 0;
        const uiStepCount = 8;
        function advStatus(message) {
            status("(" + uiStep + "/" + uiStepCount + ") " + message);
        }

        // in case you ever wondered what a Lawful Evil switch statement looks like
        switch (step) {
        case (uiStep += 1, counter += 1):
            advStatus("building terrain...");
            break;

        case (counter += 1):
            buildTerrain(csldoc, defaultHeightMap, function(terrain) {
                background.insertBefore(terrain, background.firstChild);
            });
            buildForests(csldoc, function(forest) {
                background.appendChild(forest);
            });
            break;

        case (uiStep += 1, counter += 1):
            advStatus("building grid...");
            break;

        case (counter += 1):
            grid = generateTiles();
            svg.appendChild(grid);
            break;

        case (uiStep += 1, counter += 1):
            advStatus("building districts...");
            break;

        case (counter += 1):
            districts = buildDistricts(csldoc);
            svg.appendChild(districts);
            break;

        case (uiStep += 1, counter += 1):
            advStatus("building buildings...");
            break;

        case (counter += 1):
            svg.insertBefore(buildBuildings(csldoc), grid);
            break;

        case (uiStep += 1, counter += 1):
            advStatus("building roads...");
            break;

        case (counter += 1):
            organizer.load(csldoc);
            buildTransitTable(organizer);
            svg.insertBefore(organizer.buildRoads(document), grid);
            break;

        case (uiStep += 1, counter += 1):
            advStatus("building transit routes...");
            break;

        case (counter += 1):
            transit = organizer.buildTransitRoutes(document);
            svg.insertBefore(transit, grid);
            break;

        case (uiStep += 1, counter += 1):
            advStatus("building transit stops...");
            break;

        case (counter += 1):
            for (const node of districts.childNodes) {
                labels.addFixedLabel(node, node);
            }
            organizer.seedStopLabels(labels);
            stops = organizer.createStopsLayer(document);
            svg.insertBefore(stops, grid);
            break;

        case (counter += 1):
            organizer.updateStops(labels);
            // XXX: label placement currently sucks so this is
            // skipped
            //labels.generate();
            organizer.createStops(document, stops, labels);
            // loop until we're out of labels to move around
            if (labels.chosenCandidates.length) {
                setTimeout(advance, 0, step);
                return;
            }
            break;

        case (counter += 1):
            status("As saved on " + saveTime.toString());
            document.querySelector("#controls").style.display = "block";
            return;
        
        default:
            console.error("reached default case of buildMap state machine!");
            return;
        }
        setTimeout(advance, 0, step + 1);
    }
    advance(0);
}
