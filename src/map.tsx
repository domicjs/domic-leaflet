
import {
	ArrayOrSingle,
	Attrs,
	Component,
	Mixin,
	DisplayIf,
	getChildren,
	o,
	MaybeObservable,
	Observable,
	observe,
	inserted,
	removed,
	Verb
} from 'domic'

import * as L from 'leaflet'


import {domMarker} from './marker'


(window as any).L_NO_TOUCH = true


export interface MapAttributes extends Attrs {
	center?: MaybeObservable<L.LatLng>
	zoom?: MaybeObservable<number>
	tileLayer: string
}


/**
 * special foreach function
 */
function _foreach<T>(ob: ArrayOrSingle<T> | null, callback: (t: T) => any) {
	if (ob == null) return
	if (Array.isArray(ob))
		ob.forEach(callback)
	else
		callback(ob)
}


export class Map extends Component {

	attrs: MapAttributes
	private l: L.Map | null

	get leafletMap(): L.Map {
		if (!this.l) throw new Error('there is no map active on this node')
		return this.l
	}

	inserted(node: HTMLElement) {
		var map = this.l = L.map(node, {
			zoomControl: false,
			// minZoom: 7,
			zoom: 13,
			attributionControl: false,
			// zoom sur le centre de la france.
			center: [46.48333, 2.53333]
		})

				// Rajout des tiles OSM
    L.tileLayer(this.attrs.tileLayer, {
			// subdomains: TILE_SUBDOMAINS
    }).addTo(this.l);

		requestAnimationFrame(() => map.invalidateSize({}))
	}

	removed() {
		var map = this.leafletMap
		map.eachLayer(l => {
			map.removeLayer(l)
		})
		map.remove()
		this.l = null
	}

	panTo(ll: L.LatLng) {
		this.leafletMap.panTo(ll)
	}

	addLayer(layer: L.Layer) {
		this.leafletMap.addLayer(layer)
	}

	render(children: DocumentFragment) {

		if (this.attrs.center)
			this.observe(this.attrs.center, center => {
				if (center) this.leafletMap.panTo(center, {animate: true})
			})

		if (this.attrs.zoom)
			this.observe(this.attrs.zoom, zoom => {
				if (zoom != null) this.leafletMap.setZoom(zoom, {animate: true})
			})

		return <div class='domic-leaflet-map'>{children}</div>
	}

}



//////////////////////////////////////////////////////////////////////////


export class MapCenterVerb extends Verb {

	map: L.Map

	constructor(public center: MaybeObservable<L.LatLngExpression | L.LatLngBoundsExpression>) {
		super()
	}

	init() {
		this.observe(this.center, center => {
			if (center) {
				if (center instanceof L.LatLng) {
					this.map.setView(center as L.LatLngExpression, this.map.getZoom())
				} else {
					this.map.fitBounds(center as L.LatLngBoundsExpression, {
						animate: true, padding: [150, 150]
					})
				}
			}
		})
	}

	inserted(node: Node) {
		this.map = Map.get(node)!.leafletMap
	}

	removed() {
		this.map = null!
	}

}

export function CenterMap(center: MaybeObservable<L.LatLngExpression | L.LatLngBoundsExpression>) {
	return MapCenterVerb.create(center)
}



export type LeafletCallback<T extends L.LeafletEvent> = (ev: T) => any

export interface MapWatcherCallbacks {
	autopanstart?: LeafletCallback<L.LeafletEvent>
	baselayerchange?: LeafletCallback<L.LayersControlEvent>
	click?: LeafletCallback<L.LeafletMouseEvent>
	// contextmenu?:	LeafletCallback<L.LeafletMouseEvent> FIXME incompatibility with domic.
	dblclick?: LeafletCallback<L.LeafletMouseEvent>
	keypress?: LeafletCallback<L.LeafletEvent> // FIXME there should be KeyboardEvent
	layeradd?: LeafletCallback<L.LayerEvent>
	layerremove?: LeafletCallback<L.LayerEvent>
	load?: LeafletCallback<L.LeafletEvent>
	locationerror?: LeafletCallback<L.ErrorEvent>
	locationfound?: LeafletCallback<L.LocationEvent>
	mousedown?: LeafletCallback<L.LeafletMouseEvent>
	mousemove?: LeafletCallback<L.LeafletMouseEvent>
	mouseout?: LeafletCallback<L.LeafletMouseEvent>
	mouseover?: LeafletCallback<L.LeafletMouseEvent>
	mouseup?: LeafletCallback<L.LeafletMouseEvent>
	move?: LeafletCallback<L.LeafletEvent>
	moveend?: LeafletCallback<L.LeafletEvent>
	movestart?: LeafletCallback<L.LeafletEvent>
	overlayadd?: LeafletCallback<L.LayersControlEvent>
	overlayremove?: LeafletCallback<L.LayersControlEvent>
	popupclose?: LeafletCallback<L.PopupEvent>
	popupopen?: LeafletCallback<L.PopupEvent>
	preclick?: LeafletCallback<L.LeafletMouseEvent>
	resize?: LeafletCallback<L.ResizeEvent>
	tooltipclose?: LeafletCallback<L.TooltipEvent>
	tooltipopen?: LeafletCallback<L.TooltipEvent>
	unload?: LeafletCallback<L.LeafletEvent>
	viewreset?: LeafletCallback<L.LeafletEvent>
	zoom?: LeafletCallback<L.LeafletEvent>
	zoomend?: LeafletCallback<L.LeafletEvent>
	zoomlevelschange?:	LeafletCallback<L.LeafletEvent>
	zoomstart?: LeafletCallback<L.LeafletEvent>
}


export class MapWatcher extends Verb {

	leaflet_map: L.Map | null

	constructor(public callbacks: MapWatcherCallbacks) {
		super()
	}

	inserted() {
		const map = this.leaflet_map = Map.get(this.node)!.leafletMap

		for (var prop in this.callbacks)
			map.on(prop, (this.callbacks as any)[prop])
	}

	removed() {
		const map = this.leaflet_map!

		for (var prop in this.callbacks)
			map.off(prop, (this.callbacks as any)[prop])

		this.leaflet_map = null
	}

}

export function WatchMap(callbacks: MapWatcherCallbacks) {
	return MapWatcher.create(callbacks)
}


export class MarkerDisplayer extends Verb {
	marker: L.Marker

	constructor(public coords: MaybeObservable<L.LatLngExpression>, public dom_marker: Element, public options: L.MarkerOptions) {
		super()
	}

	init() {
		this.marker = domMarker(o.get(this.coords), this.dom_marker, this.options)
		this.observe(this.coords, co => this.marker.setLatLng(co))
	}

	inserted(node: Node) {
		Map.get(node)!.addLayer(this.marker)
	}

	removed(node: Node) {
		this.marker.remove()
	}
}


export function DisplayMarker(coords: MaybeObservable<L.LatLngExpression>, marker: Element, options: L.MarkerOptions = {}) {
	return MarkerDisplayer.create(coords, marker, options)
}


export class LayerDisplayer extends Verb {
	map: L.Map
	layer: L.LayerGroup

	constructor(public layers: MaybeObservable<L.Layer[]|L.Layer>) {
		super()
		this.layer = L.layerGroup([])
	}

	init() {
		this.observe(this.layers, layers => {
			// update the layers in this group
			if (!Array.isArray(layers))
				layers = [layers]

			for (var l of this.layer.getLayers())
				l.remove()
			for (l of layers)
				this.layer.addLayer(l)
		})
	}

	inserted(node: Node) {
		var map = Map.get(node)
		if (map)
			map.leafletMap.addLayer(this.layer)
	}

	removed(node: Node) {
		this.layer.remove()
	}
}


export function DisplayLayers(layers: MaybeObservable<L.Layer|L.Layer[]>) {
	return LayerDisplayer.create(layers)
}