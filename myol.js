/*!
 * OPENLAYERS V5 ADAPTATION - https://openlayers.org/
 * (C) Dominique Cavailhez 2017
 * https://github.com/Dominique92/MyOl
 *
 * I have designed this openlayers adaptation as simple as possible to make it maintained with basics JS skills
 * You only have to include openlayers/dist .js & .css files & my 2 & that's it !
 * No classes, no jquery, no es6 modules, no nodejs build nor minification, no npm repository, ... only a pack of JS functions & CSS
 * I know, I know, this is not up to date way of programming but thtat's my choice & you are free to take it, modifiy & adapt as you wish
 */
//END test with libs non debug / on mobile
//END http://jsbeautifier.org/ & http://jshint.com
//BEST Site off line, application

/**
 * HACK send 'onAdd' event to layers when added to a map
 */
ol.Map.prototype.renderFrame_ = function(time) {
	var layers = this.getLayerGroup().getLayerStatesArray();
	for (var i = 0, ii = layers.length; i < ii; ++i)
		if (!layers[i].layer.map_) { // Only once
			layers[i].layer.map_ = this; // Store the map where the layer is rendered
			layers[i].layer.dispatchEvent('onadd');
		}

	ol.PluggableMap.prototype.renderFrame_.call(this, time);
};

//***************************************************************
// TILE LAYERS
//***************************************************************
//BEST Superzoom
/**
 * Openstreetmap
 */
function layerOSM(url, attribution) {
	return new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: url,
			attributions: [
				attribution || '',
				ol.source.OSM.ATTRIBUTION
			]
		})
	});
}

/**
 * Kompas (austria)
 * Requires layerOSM
 */
function layerKompass(layer) {
	return layerOSM(
		'http://ec{0-3}.cdn.ecmaps.de/WmsGateway.ashx.jpg?' + // Not available via https
		'Experience=ecmaps&MapStyle=' + layer + '&TileX={x}&TileY={y}&ZoomLevel={z}',
		'<a href="http://www.kompass.de/livemap/">KOMPASS</a>'
	);
}

/**
 * Thunderforest
 * Requires layerOSM
 */
function layerThunderforest(layer, key) {
	return layerOSM(
		'//{a-c}.tile.thunderforest.com/' + layer + '/{z}/{x}/{y}.png?apikey=' + key,
		'<a href="http://www.thunderforest.com">Thunderforest</a>'
	);
}

/**
 * Google
 */
function layerGoogle(layer) {
	return new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: '//mt{0-3}.google.com/vt/lyrs=' + layer + '&x={x}&y={y}&z={z}',
			attributions: '&copy; <a href="https://www.google.com/maps">Google</a>'
		})
	});
}

/**
 * Stamen http://maps.stamen.com
 */
function layerStamen(layer) {
	return new ol.layer.Tile({
		source: new ol.source.Stamen({
			layer: layer
		})
	});
}

/**
 * IGN France
 * Doc on http://api.ign.fr
 * Get a free key : http://professionnels.ign.fr/ign/contrats
 */
function layerIGN(key, layer, format) {
	var IGNresolutions = [],
		IGNmatrixIds = [];
	for (var i = 0; i < 18; i++) {
		IGNresolutions[i] = ol.extent.getWidth(ol.proj.get('EPSG:3857').getExtent()) / 256 / Math.pow(2, i);
		IGNmatrixIds[i] = i.toString();
	}
	var IGNtileGrid = new ol.tilegrid.WMTS({
		origin: [-20037508, 20037508],
		resolutions: IGNresolutions,
		matrixIds: IGNmatrixIds
	});

	return new ol.layer.Tile({
		source: new ol.source.WMTS({
			url: '//wxs.ign.fr/' + key + '/wmts',
			layer: layer,
			matrixSet: 'PM',
			format: format || 'image/jpeg',
			tileGrid: IGNtileGrid,
			style: 'normal',
			attributions: '<a href="http://www.geoportail.fr/" target="_blank">' +
				'<img src="https://api.ign.fr/geoportail/api/js/latest/theme/geoportal/img/logo_gp.gif"></a>'
		})
	});
}

/**
 * Spain
 */
function layerSpain(serveur, layer) {
	return new ol.layer.Tile({
		source: new ol.source.XYZ({
			url: '//www.ign.es/wmts/' + serveur + '?layer=' + layer +
				'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg' +
				'&style=default&tilematrixset=GoogleMapsCompatible' +
				'&TileMatrix={z}&TileCol={x}&TileRow={y}',
			attributions: '&copy; <a href="http://www.ign.es/">IGN España</a>'
		})
	});
}

/**
 * Layers with not all resolutions or area available
 * Virtual class
 * Displays OSM outside the zoom area, 
 * Displays blank outside of validity area
 * Requires 'onadd' layer event
 */
function layerTileIncomplete(extent, sources) {
	var layer = new ol.layer.Tile(),
		backgroundSource = new ol.source.Stamen({
			layer: 'terrain'
		});
	layer.on('onadd', function(event) {
		event.target.map_.getView().on('change', change);
		change(); // At init
	});

	// Zoom has changed
	function change() {
		var view = layer.map_.getView(),
			currentResolution = 999999; // Init loop at max resolution
		sources[currentResolution] = backgroundSource; // Add extrabound source on the top of the list

		// Search for sources according to the map resolution
		if (ol.extent.intersects(extent, view.calculateExtent(layer.map_.getSize())))
			currentResolution = Object.keys(sources).filter(function(event) { // HACK : use of filter to perform an action
				return event > view.getResolution();
			})[0];

		// Update layer if necessary
		if (layer.getSource() != sources[currentResolution])
			layer.setSource(sources[currentResolution]);
	}

	return layer;
}

/**
 * Swisstopo https://api.geo.admin.ch/
 * Register your domain: https://shop.swisstopo.admin.ch/fr/products/geoservice/swisstopo_geoservices/WMTS_info
 * Requires layerTileIncomplete
 */
function layerSwissTopo(layer) {
	var projectionExtent = ol.proj.get('EPSG:3857').getExtent(),
		resolutions = [],
		matrixIds = [];
	for (var r = 0; r < 18; ++r) {
		resolutions[r] = ol.extent.getWidth(projectionExtent) / 256 / Math.pow(2, r);
		matrixIds[r] = r;
	}
	var tileGrid = new ol.tilegrid.WMTS({
		origin: ol.extent.getTopLeft(projectionExtent),
		resolutions: resolutions,
		matrixIds: matrixIds
	});

	return layerTileIncomplete([664577, 5753148, 1167741, 6075303], {
		500: new ol.source.WMTS(({
			crossOrigin: 'anonymous',
			url: '//wmts2{0-4}.geo.admin.ch/1.0.0/' + layer + '/default/current/3857/{TileMatrix}/{TileCol}/{TileRow}.jpeg',
			tileGrid: tileGrid,
			requestEncoding: 'REST',
			attributions: '&copy <a href="https://map.geo.admin.ch/">SwissTopo</a>'
		}))
	});
}

/**
 * Italy IGM
 * Requires layerTileIncomplete
 */
function layerIGM() {
	function igmSource(url, layer) {
		return new ol.source.TileWMS({
			url: 'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/' + url + '.map',
			params: {
				layers: layer
			},
			attributions: '&copy <a href="http://www.pcn.minambiente.it/viewer">IGM</a>'
		});
	}

	return layerTileIncomplete([660124, 4131313, 2113957, 5958411], { // EPSG:6875 (Italie)
		100: igmSource('IGM_250000', 'CB.IGM250000'),
		25: igmSource('IGM_100000', 'MB.IGM100000'),
		5: igmSource('IGM_25000', 'CB.IGM25000')
	});
}

//BEST éviter d'appeler à l'init https://dev.virtualearth.net sur les cartes BING
/**
 * Ordnance Survey : Great Britain
 * Requires layerTileIncomplete
 */
function layerOS(key) {
	return layerTileIncomplete([-841575, 6439351, 198148, 8589177], { // EPSG:27700 (G.B.)
		100: new ol.source.BingMaps({
			imagerySet: 'ordnanceSurvey',
			key: key
		})
	});
}

/**
 * Bing (Microsoft)
 */
function layerBing(layer, key) {
	return new ol.layer.Tile({
		source: new ol.source.BingMaps({
			imagerySet: layer,
			key: key,
		})
	});
}

//***************************************************************
// VECTORS, GEOJSON & AJAX LAYERS
//***************************************************************
/**
 * Mem in cookies the checkbox content with name="name"
 */
function controlPermanentCheckbox(name, callback) {
	var checkElements = document.getElementsByName(name),
		cookie =
		location.hash.match('map-' + name + '=([^#,&;]*)') || // Priority to the hash
		document.cookie.match('map-' + name + '=([^;]*)'); // Then the cookie

	for (var e = 0; e < checkElements.length; e++) {
		checkElements[e].addEventListener('click', permanentCheckboxClick, false); // Attach the action

		if (cookie) // Set the checks accordingly with the cookie
			checkElements[e].checked = cookie[1].split(',').indexOf(checkElements[e].value) !== -1;
	}

	// Call callback once at the init
	callback(null, permanentCheckboxList(name));

	function permanentCheckboxClick(event) {
		var list = permanentCheckboxList(name, event);
		if (typeof callback == 'function')
			callback(event, list);
	}
}

function permanentCheckboxList(name, event) {
	var checkElements = document.getElementsByName(name),
		allChecks = [];

	for (var e = 0; e < checkElements.length; e++) {
		// Select/deselect all (clicking an <input> without value)
		if (event) {
			if (event.target.value == 'on') // The Select/deselect has a default value = "on"
				checkElements[e].checked = event.target.checked; // Check all if "all" is clicked
			else if (checkElements[e].value == 'on')
				checkElements[e].checked = false; // Reset the "all" checks if another check is clicked
		}

		// Get status of all checks
		if (checkElements[e].checked) // List checked elements
			allChecks.push(checkElements[e].value);
	}

	// Mem in a cookie
	document.cookie = 'map-' + name + '=' + allChecks.join(',') + ';path=/';

	return allChecks; // Returns list of checked values or ids
}

/**
 * BBOX dependant strategy
 * Same that bbox but reloads if we zoom in because we delivered more points when zoom in
 * Returns {ol.loadingstrategy} to be used in layer definition
 */
ol.loadingstrategy.bboxDependant = function(extent, resolution) {
	if (this.resolution != resolution) // Force loading when zoom in
		this.clear();
	this.resolution = resolution; // Mem resolution for further requests
	return [extent];
};

/**
 * GeoJson POI layer
 * Requires 'onadd' layer event
 * Requires ol.loadingstrategy.bboxDependant & controlPermanentCheckbox
 */
function layerVectorURL(options) {
	var source = new ol.source.Vector({
			strategy: ol.loadingstrategy.bboxDependant,
			url: function(extent, resolution, projection) {
				var bbox = ol.proj.transformExtent(extent, projection.getCode(), 'EPSG:4326'),
					list = permanentCheckboxList(options.selector).filter(function(event) {
						return event !== 'on'; // Remove the "all" input (default value = "on")
					});
				return typeof options.url == 'function' ?
					options.url(bbox, list, resolution) :
					options.url + list.join(',') + '&bbox=' + bbox.join(','); // Default most common url format
			},
			format: options.format || new ol.format.GeoJSON()
		}),
		layer = new ol.layer.Vector({
			source: source,
			zIndex: 1, // Above baselayer even if included to the map before
			style: typeof options.style != 'function' ?
				ol.style.Style.defaultFunction : function(feature) {
					return new ol.style.Style(options.style(feature.getProperties()));
				}
		});

	// Optional checkboxes to tune layer parameters
	if (options.selector) {
		controlPermanentCheckbox(options.selector, function(event, list) {
			layer.setVisible(list.length);
			if (list.length)
				source.clear(); // Redraw the layer
		});
	}

	layer.options_ = options; //HACK Mem options for interactions
	layer.on('onadd', initLayerVectorURLListeners);

	return layer;
}

// We use only one listener for hover and one for click for all vector layers
function initLayerVectorURLListeners(e) {
	var map = e.target.map_;
	if (!map.popElement_) { //HACK Only once for all layers
		// Display a label when hover the feature
		map.popElement_ = document.createElement('div');
		var dx = 0.4,
			xAnchor, // Spread too closes icons
			hovered = [],
			popup = new ol.Overlay({
				element: map.popElement_
			});
		map.addOverlay(popup);

		map.on('pointermove', pointerMove);

		function pointerMove(event) {
			// Reset cursor & popup position
			map.getViewport().style.cursor = 'default'; // To get the default cursor if there is no feature here

			var mapRect = map.getTargetElement().getBoundingClientRect(),
				popupRect = map.popElement_.getBoundingClientRect();
			if (popupRect.left - 5 > mapRect.x + event.pixel[0] || mapRect.x + event.pixel[0] >= popupRect.right + 5 ||
				popupRect.top - 5 > mapRect.y + event.pixel[1] || mapRect.y + event.pixel[1] >= popupRect.bottom + 5)
				popup.setPosition(undefined); // Hide label by default if none feature or his popup here

			// Reset previous hovered styles
			if (hovered)
				hovered.forEach(function(h) {
					if (h.layer && h.options)
						h.feature.setStyle(new ol.style.Style(h.options.style(h.feature.getProperties())));
				});

			// Search the hovered the feature(s)
			hovered = [];
			map.forEachFeatureAtPixel(event.pixel, function(f, l) {
				if (l && l.options_) {
					var h = {
						event: event,
						feature: f,
						layer: l,
						options: l.options_,
						properties: f.getProperties(),
						coordinates: f.getGeometry().flatCoordinates // If it's a point, just over it
					};
					h.pixel = map.getPixelFromCoordinate(h.coordinates);
					h.ll4326 = ol.proj.transform(h.coordinates, 'EPSG:3857', 'EPSG:4326');
					hovered.push(h);
				}
			});

			if (hovered) {
				// Sort features left to right
				hovered.sort(function(a, b) {
					return a.pixel[0] - b.pixel[0];
				});
				xAnchor = 0.5 + dx * (hovered.length - 1) / 2;
				hovered.forEach(checkHovered);
			}
		}

		function checkHovered(h) {
			// Hover a clikable feature
			if (h.options.click)
				map.getViewport().style.cursor = 'pointer';

			// Apply hover if any
			var style = (h.options.hover || h.options.style)(h.feature.getProperties());

			// Shift icon if too many grouped here
			if (hovered.length > 1 &&
				style.image) {
				style.image.anchor_[0] = xAnchor;
				xAnchor -= dx;
			}
			h.feature.setStyle(new ol.style.Style(style));

			if (!popup.getPosition()) { // Only for the first feature on the hovered stack
				// Calculate the label' anchor
				if (h.coordinates.length != 2)
					h.coordinates = h.event.coordinate; // If it's a surface, over the pointer
				popup.setPosition(map.getView().getCenter()); // For popup size calculation

				// Fill label class & text
				h.properties.lon = Math.round(h.ll4326[0] * 100000) / 100000;
				h.properties.lat = Math.round(h.ll4326[1] * 100000) / 100000;
				map.popElement_.className = 'popup ' + (h.layer.options_.labelClass || '');
				map.popElement_.innerHTML = typeof h.options.label == 'function' ?
					h.options.label(h.properties, h.feature, h.layer) :
					h.options.label || '';

				// Shift of the label to stay into the map regarding the pointer position
				if (h.pixel[1] < map.popElement_.clientHeight + 12) { // On the top of the map (not enough space for it)
					h.pixel[0] += h.pixel[0] < map.getSize()[0] / 2 ? 10 : -map.popElement_.clientWidth - 10;
					h.pixel[1] = 2;
				} else {
					h.pixel[0] -= map.popElement_.clientWidth / 2;
					h.pixel[0] = Math.max(h.pixel[0], 0); // Bord gauche
					h.pixel[0] = Math.min(h.pixel[0], map.getSize()[0] - map.popElement_.clientWidth - 1); // Bord droit
					h.pixel[1] -= map.popElement_.clientHeight + 10;
				}
				popup.setPosition(map.getCoordinateFromPixel(h.pixel));
			}
		}

		// Click on a feature
		map.on('click', function(event) {
			if (!event.originalEvent.shiftKey &&
				!event.originalEvent.ctrlKey &&
				!event.originalEvent.altKey)
				map.forEachFeatureAtPixel(
					event.pixel,
					function(feature, layer) {
						if (layer && layer.options_ &&
							typeof layer.options_.click == 'function')
							layer.options_.click(feature.getProperties());
					}, {
						hitTolerance: 6
					});
		});
	}
}

/**
 * Feature format for reading data in the OSMXML format
 * Convert areas into points to display it as an icon
 */
ol.format.OSMXMLPOI = function() {
	ol.format.OSMXML.call(this);

	this.readFeatures = function(source, opt_options) {
		for (var node = source.documentElement.firstChild; node; node = node.nextSibling)
			if (node.nodeName == 'way') {
				// Create a new 'node' element centered on the surface
				var newNode = source.createElement('node');
				source.documentElement.appendChild(newNode);
				newNode.id = node.id;

				// Add a tag to mem what node type it was
				var newTag = source.createElement('tag');
				newTag.setAttribute('k', 'nodetype');
				newTag.setAttribute('v', 'way');
				newNode.appendChild(newTag);

				for (var subTagNode = node.firstChild; subTagNode; subTagNode = subTagNode.nextSibling)
					switch (subTagNode.nodeName) {
						case 'center':
							newNode.setAttribute('lon', subTagNode.getAttribute('lon'));
							newNode.setAttribute('lat', subTagNode.getAttribute('lat'));
							newNode.setAttribute('nodeName', subTagNode.nodeName);
							break;
						case 'tag':
							newNode.appendChild(subTagNode.cloneNode());
					}
			}
		return ol.format.OSMXML.prototype.readFeatures.call(this, source, opt_options);
	};
};
ol.inherits(ol.format.OSMXMLPOI, ol.format.OSMXML);

/**
 * OSM overpass poi layer
 * From: https://openlayers.org/en/latest/examples/vector-osm.html
 * Doc: http://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide
 * Requires layerVectorURL
 */
//BEST restos, wc
function layerOverpass(options) {
	var layer = layerVectorURL({
		url: function(bbox, list, resolution) {
			var bb = '(' + bbox[1] + ',' + bbox[0] + ',' + bbox[3] + ',' + bbox[2] + ');',
				args = [];

			if (resolution < 30) // Only for small areas
				for (var l = 0; l < list.length; l++)
					args.push(
						'node' + list[l] + bb + // Ask for nodes in the bbox
						'way' + list[l] + bb // Also ask for areas
					);

			return options.url +
				'?data=[timeout:5];(' + // Not too much !
				args.join('') +
				');out center;'; // add center of areas
		},
		format: new ol.format.OSMXMLPOI(),
		selector: options.selector,
		style: function(properties) {
			return {
				image: new ol.style.Icon({
					src: '//dc9.fr/chemineur/ext/Dominique92/GeoBB/types_points/' + overpassType(properties) + '.png'
				})
			};
		},
		labelClass: options.labelClass,
		label: formatLabel
	});

	function formatLabel(p, f) { // p = properties, f = feature
		var language = {
				hotel: 'h&ocirc;tel',
				camp_site: 'camping',
				convenience: 'alimentation',
				supermarket: 'supermarch&egrave;'
			},
			type = p.type = overpassType(p),
			description = [
				(p.name && p.name.toLowerCase().indexOf(type) ? type : '') +
				'*'.repeat(p.stars),
				p.rooms ? p.rooms + ' chambres' : '',
				p.place ? p.place + ' places' : '',
				p.capacity ? p.capacity + ' places' : '',
				p.ele ? parseInt(p.ele, 10) + 'm' : '',
			].join(' ').replace( // Word translation if necessary
				new RegExp(Object.keys(language).join('|'), 'gi'),
				function(m) {
					return language[m.toLowerCase()];
				}
			),
			phone = p.phone || p['contact:phone'],
			address = [
				p['addr:housenumber'],
				p['addr:street'],
				p['addr:postcode'],
				p['addr:city']
			],
			osmUrl = p.url = 'http://www.openstreetmap.org/' + (p.nodetype ? p.nodetype : 'node') + '/' + f.getId(),
			popup = [
				p.name ? '<b>' + p.name + '</b>' : '',
				description ? description.charAt(0).toUpperCase() + description.substr(1) : '', // Uppercase the first letter
				phone ? '&phone;<a title="Appeler" href="tel:' + phone.replace(/[^0-9\+]+/ig, '') + '">' + phone + '</a>' : '',
				p.email ? '&#9993;<a title="Envoyer un mail" href="mailto:' + p.email + '">' + p.email + '</a>' : '',
				p['addr:street'] ? address.join(' ') : '',
				p.website ? '&#8943;<a title="Voir le site web" target="_blank" href="' + p.website + '">' + (p.website.split('/')[2] || p.website) + '</a>' : '',
				'&copy; Voir sur <a title="Voir la fiche d\'origine sur openstreetmap" target="_blank" href="' + osmUrl + '">OSM</a>'
			],
			postLabel = typeof options.label == 'function' ? options.label(p, f) : options.label || '';

		popup = popup.concat(typeof postLabel == 'object' ? postLabel : [postLabel]);
		return ('<p>' + popup.join('</p><p>') + '</p>').replace(/<p>\s*<\/p>/ig, '');
	}

	function overpassType(properties) {
		var checkElements = document.getElementsByName(options.selector);
		for (var e = 0; e < checkElements.length; e++)
			if (checkElements[e].checked) {
				var conditions = checkElements[e].value.split('"');
				if (properties[conditions[1]] &&
					properties[conditions[1]].match(conditions[3]))
					return checkElements[e].id;
			}
	}

	return layer;
}

/**
 * Marqueurs
 * Requires proj4.js for swiss coordinates
 * Requires 'onadd' layer event
 */
function marqueur(imageUrl, ll, IdDisplay, format, movable) { // imageUrl, [lon, lat], 'id-display', ['format de base', 'format suisse']
	var point = new ol.geom.Point(
			ol.proj.fromLonLat(ll)
		),
		iconStyle = new ol.style.Style({
			image: new ol.style.Icon(({
				src: imageUrl,
				anchor: [0.5, 0.5]
			}))
		}),
		iconFeature = new ol.Feature({
			geometry: point
		}),
		layer = new ol.layer.Vector({
			source: new ol.source.Vector({
				features: [iconFeature]
			}),
			style: iconStyle,
			zIndex: 2
		});
	layer.on('onadd', function(event) {
		if (movable) {
			// Drag and drop
			event.target.map_.addInteraction(new ol.interaction.Modify({
				features: new ol.Collection([iconFeature]),
				style: iconStyle
			}));
			point.on('change', function() {
				displayLL(this.getCoordinates());
			});
		}
	});

	// Show a coordinate
	function displayLL(ll) {
		var ll4326 = ol.proj.transform(ll, 'EPSG:3857', 'EPSG:4326'),
			html = format[0],
			p = [Math.round(ll4326[0] * 100000) / 100000, Math.round(ll4326[1] * 100000) / 100000];

		// Adding Swiss coordinates EPSG:21781 (CH1903 / LV03)
		if (ol.extent.containsCoordinate([664577, 5753148, 1167741, 6075303], ll) && // Si on est dans la zone suisse EPSG:21781
			format.length >= 2 &&
			typeof proj4 == 'function') {
			proj4.defs('EPSG:21781', '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=660.077,13.551,369.344,2.484,1.783,2.939,5.66 +units=m +no_defs');
			ol.proj.proj4.register(proj4);
			var c21781 = ol.proj.transform(ll, 'EPSG:3857', 'EPSG:21781');
			html += format[1];
			p.push(Math.round(c21781[0]), Math.round(c21781[1]));
		}

		// We integrate coordinates in html format
		for (var r in p) // === sprinft
			html = html.replace('{' + r + '}', p[r]);

		// We insert the resulting HTML string where it is going
		var displayElement = document.getElementById(IdDisplay);
		if (displayElement)
			displayElement.innerHTML = html;
	}

	// Display coords
	displayLL(ol.proj.fromLonLat(ll));

	// <input> coords edition
	layer.edit = function(event, nol, projection) {
		var coord = ol.proj.transform(point.getCoordinates(), 'EPSG:3857', 'EPSG:' + projection); // La position actuelle du marqueur
		coord[nol] = parseFloat(event.value); // On change la valeur qui a été modifiée
		point.setCoordinates(ol.proj.transform(coord, 'EPSG:' + projection, 'EPSG:3857')); // On repositionne le marqueur
	};

	return layer;
}

//******************************************************************************
// CONTROLS
//******************************************************************************
/**
 * Control buttons
 * Abstract definition to be used by other control buttons definitions
 *
 * label {string} character to be displayed in the button.
 * options.className {string} className of the button.
 * options.rightPosition {float} distance to the top when the button is on the right of the map.
 * options.title {string} displayed when the control is hovered.
 * options.render {function} called when the control is rendered.
 * options.action {function} called when the control is clicked.
 */
var nextButtonTopPos = 6; // Top position of next button (em)

function controlButton(options) {
	var buttonElement = document.createElement('button');
	buttonElement.innerHTML = options.label || '';
	if (options.action)
		buttonElement.addEventListener('click', options.action, false);
	var divElement = document.createElement('div');
	divElement.className = 'ol-button ol-unselectable ol-control ' + (options.className || '');
	if (options.rightPosition) {
		divElement.style.right = '.5em';
		divElement.style.top = options.rightPosition + 'em';
	} else {
		divElement.style.left = '.5em';
		divElement.style.top = (nextButtonTopPos += 2) + 'em';
	}
	divElement.title = options.title;
	divElement.appendChild(buttonElement);

	return new ol.control.Control({
		element: divElement,
		render: options.render
	});
}

/**
 * Layer switcher control
 * baseLayers {[ol.layer]} layers to be chosen one to fill the map.
 * Requires controlButton & controlPermanentCheckbox
 */
function controlLayersSwitcher(baseLayers) {
	var control = controlButton({
		label: '&hellip;',
		className: 'switch-layer',
		title: 'Liste des cartes',
		rightPosition: 0.5,
		render: render
	});

	// Transparency slider (first position)
	var rangeElement = document.createElement('input');
	rangeElement.type = 'range';
	rangeElement.className = 'range-layer';
	rangeElement.oninput = displayLayerSelector;
	rangeElement.title = 'Glisser pour faire varier la tranparence';
	control.element.appendChild(rangeElement);

	// Layer selector
	var selectorElement = document.createElement('div');
	selectorElement.style.overflow = 'auto';
	selectorElement.title = 'Ctrl+click : multicouches';
	control.element.appendChild(selectorElement);

	// When the map is created & rendered
	var map;

	function render(event) {
		if (!map) { // Only the first time
			map = event.map; // mem map for further use

			// Base layers selector init
			for (var name in baseLayers) {
				var baseElement = document.createElement('div');
				baseElement.innerHTML =
					'<input type="checkbox" name="baselayer" value="' + name + '">' +
					'<span title="">' + name + '</span>';
				selectorElement.appendChild(baseElement);
				map.addLayer(baseLayers[name]);
			}

			// Make the selector memorized by cookies
			controlPermanentCheckbox('baselayer', displayLayerSelector);

			// Hover the button open the selector
			control.element.firstElementChild.onmouseover = displayLayerSelector;

			// Click or change map size close the selector
			map.on(['click', 'change:size'], function() {
				displayLayerSelector();
			});

			// Leaving the map close the selector
			window.addEventListener('mousemove', function(event) {
				var divRect = map.getTargetElement().getBoundingClientRect();
				if (event.clientX < divRect.left || event.clientX > divRect.right ||
					event.clientY < divRect.top || event.clientY > divRect.bottom)
					displayLayerSelector();
			}, false);
		}
	}

	function displayLayerSelector(event, list) {
		// Check the first if none checked
		if (list && list.length === 0)
			selectorElement.firstChild.firstChild.checked = true;

		// Leave only one checked except if Ctrl key is on
		if (event && event.type == 'click' && !event.ctrlKey) {
			var checkElements = document.getElementsByName('baselayer');
			for (var e = 0; e < checkElements.length; e++)
				if (checkElements[e] != event.target)
					checkElements[e].checked = false;
		}

		list = permanentCheckboxList('baselayer');

		// Refresh layers visibility & opacity
		for (var layerName in baseLayers) {
			baseLayers[layerName].setVisible(list.indexOf(layerName) !== -1);
			baseLayers[layerName].setOpacity(0);
		}
		baseLayers[list[0]].setOpacity(1);
		if (list.length >= 2)
			baseLayers[list[1]].setOpacity(rangeElement.value / 100);

		// Refresh control button, range & selector
		control.element.firstElementChild.style.display = event ? 'none' : '';
		rangeElement.style.display = event && list.length > 1 ? '' : 'none';
		selectorElement.style.display = event ? '' : 'none';
		selectorElement.style.maxHeight = (map.getTargetElement().clientHeight - 58 - (list.length > 1 ? 24 : 0)) + 'px';
	}

	return control;
}

/**
 * Permalink control
 * options.visible {true | false | undefined} add a controlPermalink button to the map.
 * options.init {true | false | undefined} use url hash or "controlPermalink" cookie to position the map.
 * "map" url hash or cookie = {map=<ZOOM>/<LON>/<LAT>/<LAYER>}
 * options.defaultPos {<ZOOM>/<LON>/<LAT>/<LAYER>} if nothing else is defined.
 */
function controlPermalink(options) {
	var divElement = document.createElement('div'),
		aElement = document.createElement('a'),
		params,
		control = new ol.control.Control({
			element: divElement,
			render: render
		});
	if (options.visible) {
		divElement.className = 'ol-permalink';
		aElement.innerHTML = 'Permalink';
		aElement.title = 'Generate a link with map zoom & position';
		divElement.appendChild(aElement);
	}

	function render(event) {
		var view = event.map.getView();

		// Set the map at the init
		if (options.init !== false && // If use hash & cookies
			typeof params == 'undefined') { // Only once
			params =
				location.hash.match(/map=([-0-9\.]+)\/([-0-9\.]+)\/([-0-9\.]+)/) || // Priority to the hash
				document.cookie.match(/map=([-0-9\.]+)\/([-0-9\.]+)\/([-0-9\.]+)/) || // Then the cookie
				(options.defaultPos || '6/2/47').match(/([-0-9\.]+)\/([-0-9\.]+)\/([-0-9\.]+)/); // Appli default / Final
			view.setZoom(params[1]);
			view.setCenter(ol.proj.transform([parseFloat(params[2]), parseFloat(params[3])], 'EPSG:4326', 'EPSG:3857'));
		}

		// Check the current map zoom & position
		var ll4326 = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326');
		params = [
			parseInt(view.getZoom()),
			Math.round(ll4326[0] * 100000) / 100000,
			Math.round(ll4326[1] * 100000) / 100000
		];

		// Set the new permalink
		aElement.href = '#map=' + params.join('/');
		document.cookie = 'map=' + params.join('/') + ';path=/';
	}

	return control;
}

/**
 * GPS control
 * Requires controlButton
 */
function controlGPS() {
	// The position marker
	var point_ = new ol.geom.Point([0, 0]),
		source_ = new ol.source.Vector({
			features: [new ol.Feature({
				geometry: point_
			})]
		}),
		style_ = new ol.style.Style({
			image: new ol.style.Icon({
				anchor: [0.5, 0.5], // Picto marking the position on the map
				src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAA7VBMVEUAAAA/X39UVHFMZn9NXnRPX3RMW3VPXXNOXHJOXXNNXHNOXXFPXHNNXXFPXHFOW3NPXHNPXXJPXXFPXXNNXXFNW3NOXHJPW25PXXNRX3NSYHVSYHZ0fIx1fo13gI95hJR6go96g5B7hpZ8hZV9hpZ9h5d/iZiBi5ucoquepa+fpbGhqbSiqbXNbm7Ob2/OcHDOcXHOcnLPdHTQdXXWiIjXiorXjIzenp7eoKDgpKTgpaXgpqbks7TktLTktbXnubnr2drr5+nr6Ons29vs29zs6Ors6ert6uvt6uzu6uz18fH18fL68PD++/v+/Pw8gTaQAAAAFnRSTlMACAkKLjAylJWWmJmdv8HD19ja2/n6GaRWtgAAAMxJREFUGBkFwctqwkAUgOH/nMnVzuDGFhRKKVjf/226cKWbQgNVkphMzFz6fQJQlY0S/boCAqa1AMAwJwRjW4wtcxgS05gEa3HHOYipzxP9ZKot9tR5ZfIff7FetMQcf4tDVexNd1IKbbA+7S59f9mlZGmMVVdpXN+3gwh+RiGLAjkDGTQSjHfhes3OV0+CkXrdL/4gzVunxQ+DYZNvn+Mg6aav35GH8OJS/SUrVTw/9e4FtRvypsbPwmPMAto6AOC+ZASgLBpDmGMA/gHW2Vtk8HXNjQAAAABJRU5ErkJggg=='
			})
		}),
		layer = new ol.layer.Vector({
			source: source_,
			style: style_
		});

	// Interface with the system GPS
	var geolocation = new ol.Geolocation();
	geolocation.on('error', function(error) {
		alert('Geolocation error: ' + error.message);
	});

	var active = false,
		bouton = controlButton({
			className: 'gps-button',
			title: 'Centrer sur la position GPS',
			action: function(event) {
				active ^= 1; // Toggle on / off
				event.target.style.color = active ? 'black' : 'white'; // Color button
				geolocation.setTracking(active); // Turn on / off
				if (active)
					bouton.getMap().addLayer(layer);
				else
					bouton.getMap().removeLayer(layer);
			}
		});

	geolocation.on('change', function() {
		var pos = ol.proj.fromLonLat(this.getPosition());
		bouton.getMap().getView().setCenter(pos);
		point_.setCoordinates(pos);
	});

	return bouton;
}

/**
 * Control to displays the length of a line overflown
 */
function controlLengthLine() {
	var divElement = document.createElement('div'),
		control = new ol.control.Control({
			element: divElement,
			render: render
		});

	function render(event) {
		if (!divElement.className) { // Only once
			divElement.className = 'ol-length-line';

			event.map.on(['pointermove'], function(event) {
				divElement.innerHTML = ''; // Clear the measure if hover no feature

				event.map.forEachFeatureAtPixel(event.pixel, calculateLength, {
					hitTolerance: 6
				});
			});
		}
	}

	function calculateLength(f) {
		var length = ol.sphere.getLength(f.getGeometry());
		if (length >= 100000)
			divElement.innerHTML = (Math.round(length / 1000)) + ' km';
		else if (length >= 10000)
			divElement.innerHTML = (Math.round(length / 1000 * 10) / 10) + ' km';
		else if (length >= 1000)
			divElement.innerHTML = (Math.round(length / 1000 * 100) / 100) + ' km';
		else if (length >= 1)
			divElement.innerHTML = (Math.round(length)) + ' m';
		return false; // Continue detection (for editor that has temporary layers)
	}

	return control;
}

/**
 * GPX file loader control
 * Requires controlButton
 */
//BEST Pas d'upload/download sur mobile (-> va vers photos !)
function controlLoadGPX() {
	var inputElement = document.createElement('input'),
		button = controlButton({
			label: '&uArr;',
			title: 'Visualiser un fichier GPX sur la carte',
			action: function() {
				inputElement.click();
			}
		}),
		format = new ol.format.GPX(),
		reader = new FileReader();

	inputElement.type = 'file';
	inputElement.addEventListener('change', function() {
		reader.readAsText(inputElement.files[0]);
	});

	reader.onload = function() {
		var map = button.getMap(),
			features = format.readFeatures(reader.result, {
				dataProjection: 'EPSG:4326',
				featureProjection: 'EPSG:3857'
			});

		if (map.sourceEditor) { // If there is an active editor
			map.sourceEditor.addFeatures(features); // Add the track to the editor

			// Zoom the map on the added features
			var extent = ol.extent.createEmpty();
			for (var f in features)
				ol.extent.extend(extent, features[f].getGeometry().getExtent());
			button.getMap().getView().fit(extent);
		} else {
			// Display the track on the map
			var source = new ol.source.Vector({
					format: format,
					features: features
				}),
				vector = new ol.layer.Vector({
					source: source
				});
			button.getMap().addLayer(vector);
			button.getMap().getView().fit(source.getExtent());
		}
	};
	return button;
}

/**
 * GPX file downloader control
 * Requires controlButton
 */
function controlDownloadGPX() {
	var map,
		selectedFeatures = [],
		hiddenElement = document.createElement('a'),
		button = controlButton({
			label: '&dArr;',
			title: 'Obtenir un fichier GPX',
			render: render,
			action: function() {
				if (map.sourceEditor) // If there is an active editor
					download(map.sourceEditor.getFeatures());
				else if (selectedFeatures.length) // If there are selected features
					download(selectedFeatures);
				else
					alert('Sélectionnez une ou plusieurs traces à sauvegarder avec "Shift+Clic"');
			}
		});

	//HACK for Moz
	hiddenElement.target = '_blank';
	hiddenElement.style = 'display:none;opacity:0;color:transparent;';
	(document.body || document.documentElement).appendChild(hiddenElement);

	function render(event) {
		if (!map) {
			map = event.map;

			// Selection of lines
			var select = new ol.interaction.Select({
				condition: function(event) {
					return ol.events.condition.shiftKeyOnly(event) && ol.events.condition.click(event);
				},
				filter: function(f) {
					return f.getGeometry().getType().indexOf('String') !== -1;
				},
				hitTolerance: 6
			});
			select.on('select', function(event) {
				selectedFeatures = event.target.getFeatures().getArray();
			});
			map.addInteraction(select);
		}
	}

	function download(layers) {
		var fileName = 'trace.gpx',
			gpx = new ol.format.GPX().writeFeatures(layers, {
				dataProjection: 'EPSG:4326',
				featureProjection: 'EPSG:3857'
			}),
			file = new Blob([gpx.replace(/>/g, ">\n")], {
				type: 'application/gpx+xml'
			});

		//HACK for IE/Edge
		if (typeof navigator.msSaveOrOpenBlob !== 'undefined')
			return navigator.msSaveOrOpenBlob(file, fileName);
		else if (typeof navigator.msSaveBlob !== 'undefined')
			return navigator.msSaveBlob(file, fileName);

		hiddenElement.href = URL.createObjectURL(file);
		hiddenElement.download = fileName;

		if (typeof hiddenElement.click === 'function')
			hiddenElement.click();
		else
			hiddenElement.dispatchEvent(new MouseEvent('click', {
				view: window,
				bubbles: true,
				cancelable: true
			}));
	}

	return button;
}

// HACK to display a title on the geocoder
window.addEventListener('load', function() {
	var buttonElement = document.getElementById('gcd-button-control');
	if (buttonElement)
		buttonElement.title = 'Recherche de lieu par son nom';
}, true);

/**
 * Print control
 */
function controlPrint() {
//TODO impression full format page -> CSS
	return controlButton({
		className: 'print-button',
		title: 'Imprimer la carte',
		action: function() {
			window.print();
		}
	});
}

/**
 * Line Editor
 * Requires controlButton
 * Requires activated controlLengthLine
 */
function controlLineEditor(id, snapLayers) {
	var textareaElement = document.getElementById(id), // <textarea> element
		format = new ol.format.GeoJSON(),
		features = format.readFeatures(
			JSON.parse(textareaElement.textContent), {
				featureProjection: 'EPSG:3857' // Read/write data as ESPG:4326 by default
			}
		),
		source = new ol.source.Vector({
			features: features,
			wrapX: false
		}),
		layer = new ol.layer.Vector({
			source: source,
			zIndex: 3
		}),
		interactions = {
			snap: new ol.interaction.Snap({
				source: source
			}),
			modify: new ol.interaction.Modify({
				source: source,
				deleteCondition: function(event) {
					//HACK because the system don't trig singleClick
					return ol.events.condition.altKeyOnly(event) && ol.events.condition.click(event);
				}
			}),
			draw: new ol.interaction.Draw({
				source: source,
				type: 'LineString'
			}),
			hover: new ol.interaction.Select({
				layers: [layer],
				condition: ol.events.condition.pointerMove,
				hitTolerance: 6
			})
		},
		editMode = true, // Versus false if insert line mode
		bouton = controlButton({
			label: 'E',
			render: render,
			title: "Editeur de lignes\n" +
				"Click sur E pour ajouter ou étendre une ligne, doubleclick pour finir\n" +
				"Click sur un sommet puis déplacer pour modifier\n" +
				"Click sur un segment puis déplacer pour créer un sommet\n" +
				"Alt+click sur un sommet pour le supprimer\n" +
				"Alt+click sur un segment pour le supprimer et couper la ligne\n" +
				"Ctrl+Alt+click sur une ligne pour la supprimer",
			action: function() {
				setMode(editMode ^= 1); // Alternately switch modes
			}
		}),
		map;

	function render(event) {
		if (!map) {
			map = event.map;
			map.sourceEditor = source; //HACK to make other control acting differently when there is an editor
			map.addLayer(layer);
			//HACK Avoid zooming when you leave the mode by doubleclick
			map.getInteractions().getArray().forEach(function(i) {
				if (i instanceof ol.interaction.DoubleClickZoom)
					map.removeInteraction(i);
			});

			// Snap on features external to the editor
			if (snapLayers)
				for (var s in snapLayers)
					snapLayers[s].getSource().on('change', snapFeatures);

			setMode(true); // Set edit mode by default
		}
	}

	function snapFeatures() {
		this.forEachFeature(
			function(f) {
				interactions.snap.addFeature(f);
			}
		);
	}

	function setMode(em) {
		editMode = em;
		bouton.element.firstChild.innerHTML = editMode ? 'E' : '+';
		bouton.element.firstChild.style.color = editMode ? 'white' : 'black';
		for (var i in interactions)
			map.removeInteraction(interactions[i]);
		map.addInteraction(editMode ? interactions.modify : interactions.draw);
		map.addInteraction(interactions.snap);
		map.addInteraction(interactions.hover);
	}

	interactions.draw.on(['drawend'], function() {
		setMode(true); // We close the line creation mode
	});
	source.on(['addfeature'], function() {
		stickLines();
	});
	source.on(['change'], function() {
		// Save lines in <EL> as geoJSON at every change
		textareaElement.textContent = format.writeFeatures(source.getFeatures(), {
			featureProjection: 'EPSG:3857'
		});
		map.dispatchEvent('changed'); //HACK Reset hover if any
	});

	// Removes a line, a segment, and breaks a line in 2
	interactions.modify.on('modifyend', function(e) {
		// We retrieve the list of targeted features
		var event = e.mapBrowserEvent,
			features = map.getFeaturesAtPixel(event.pixel, {
				hitTolerance: 6
			}),
			pointer = null,
			line = null;

		for (var f in features)
			if (features[f].getGeometry().getType().indexOf('String') !== -1)
				line = features[f]; // The targetted line
			else
				pointer = features[f]; // The pointer

		if (pointer && line &&
			event.type == 'pointerup' &&
			event.originalEvent.altKey) {
			source.removeFeature(line); // We delete the line

			if (!event.originalEvent.ctrlKey) {
				var cp = pointer.getGeometry().flatCoordinates, // The coordinates of the cut point marker
					vc = line.getGeometry().flatCoordinates, // The coordinates of the vertices of the line to be cut
					cs = [[],[]], // [[],[]], // The coordinates of the 2 cut segments
					s = 0;
				for (var cl = 0; cl < vc.length; cl += line.getGeometry().stride)
					// If we found the cutoff point
					if (cp[0] == vc[cl] && cp[1] == vc[cl + 1])
						s++; // We skip it and increment the segment counter
					else // We add the current point
						cs[s].push(vc.slice(cl));

				// We draw the 2 ends of lines
				for (var c in cs)
					if (cs[c].length > 1) // If they have at least 2 points
						source.addFeature(new ol.Feature({
							geometry: new ol.geom.LineString(cs[c], line.getGeometry().layout)
						}));

			}
		}
		stickLines();
	});

	// Join lines with identical ends
	function stickLines() {
		var lines = [],
			fs = source.getFeatures();
		for (var f in fs)
			if (fs[f].getGeometry().getType().indexOf('String') !== -1) { // If it contains strings
				var cs = fs[f].getGeometry().getCoordinates();
				if (fs[f].getGeometry().getType().indexOf('String') !== -1)
					cs = [cs];
				for (var c in cs) {
					var coordinates = cs[c];
					if (coordinates.length > 1) // If the line owns at least 2 points
						for (var i = 0; i < 2; i++) { // Twice (in both directions)
							lines.push({
								feature: fs[f],
								first: coordinates[0], // The first point
								suite: coordinates.slice(1) // The other points
							});
							coordinates = coordinates.reverse(); // And we redo the other way
						}
				}
			}

		for (var l1 in lines)
			for (var l2 in lines) {
				if (lines[l1].feature.ol_uid < lines[l2].feature.ol_uid && // Not the same line & not twice
					lines[l1].first[0] == lines[l2].first[0] && lines[l1].first[1] == lines[l2].first[1]) { // The ends matches
					// Remove the 2 lines
					source.removeFeature(lines[l1].feature);
					source.removeFeature(lines[l2].feature);

					// And add the merged one by gluing the 2 ends
					source.addFeature(new ol.Feature({
						geometry: new ol.geom.LineString(lines[l1].suite.reverse().concat([lines[l1].first]).concat(lines[l2].suite))
					}));

					return stickLines(); // Restart at the beginning
				}
			}

	}

	return bouton;
}
