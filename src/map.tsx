
import {
	ArrayOrSingle,
	BasicAttributes,
	Component,
	Controller,
	d,
	HTMLComponent,
	o,
	O,
	Observable,
	onmount,
	onunmount,
	onrender,
	VirtualHolder,
} from 'domic'

import * as L from 'leaflet'

(window as any).L_NO_TOUCH = true


export interface MapAttributes extends BasicAttributes {
	center?: O<L.LatLng>
	zoom?: O<number>
	tileLayer: string
}


/**
 * special foreach function
 */
function _foreach<T>(ob: ArrayOrSingle<T>, callback: (t: T) => any) {
	if (ob == null) return
	if (Array.isArray(ob))
		ob.forEach(callback)
	else
		callback(ob)
}

function _addLayer(node: Node, layer: L.Layer) {
	const parent = Layer.get(node)
	if (parent) {
		parent.layer.addLayer(layer)
		return
	}

	const map = Map.get(node)
	map.l.addLayer(layer)
}


export class Map extends HTMLComponent {

	attrs: MapAttributes
	l: L.Map

	public o_zoom: Observable<number> = o(-1)
	public o_center: Observable<L.LatLng> = o(null)

	@onmount
	drawMap() {
		this.l = L.map(this.node, {
			zoomControl: false,
			minZoom: 7,
			zoom: 13,
			attributionControl: false,
			// zoom sur le centre de la france.
			center: [46.48333, 2.53333]
		})

				// Rajout des tiles OSM
    L.tileLayer(this.attrs.tileLayer, {
			// subdomains: TILE_SUBDOMAINS
    }).addTo(this.l);

		this.l.on('zoomend', ev => this.o_zoom.set(this.l.getZoom()))
		this.l.on('moveend', ev => this.o_center.set(this.l.getCenter()))

		requestAnimationFrame(() => this.l.invalidateSize({}))
	}

	@onunmount
	cleanup() {
		this.l.eachLayer(l => {
			this.l.removeLayer(l)
		})
		this.l.remove()
		this.l = null
	}

	panTo(ll: L.LatLng) {
		this.l.panTo(ll)
	}

	render(children: DocumentFragment) {

		this.observe(this.attrs.center, center => {
			if (center) this.l.panTo(center, {animate: true})
		})

		this.observe(this.attrs.zoom, zoom => {
			if (zoom != null) this.l.setZoom(zoom, {animate: true})
		})

		return <div class='domic-leaflet-map'>{children}</div>
	}

}


export const DivIcon: new (opts: L.DivIconOptions) => L.DivIcon = (L as any).DivIcon

export interface DOMIconOptions extends L.DivIconOptions {
	node: HTMLElement
}

export class DOMIcon extends DivIcon {

	options: DOMIconOptions

	constructor(opts: DOMIconOptions) {
		super(opts)
	}

	createIcon(old: HTMLElement) {
		return old ? old : this.options.node
	}

}





export class Layer extends VirtualHolder {

	name = 'leaflet layer'

	attrs: {
		contents?: O<ArrayOrSingle<L.Layer>>,
	}

	layer = L.featureGroup()
	current: ArrayOrSingle<L.Layer> = null

	@onmount
	addToMap(node: Node) {
		const layer = Layer.get(node.parentNode)
		if (layer) {
			layer.layer.addLayer(this.layer)
			return
		}

		// If there was no Layer above us, just add ourselves
		// to the map.
		const map = Map.get(node)
		map.l.addLayer(this.layer)
	}

	@onunmount
	remove() {
		_foreach(this.current, ob => ob.remove())
		this.layer.remove()
	}

	@onrender
	linkContent() {
		// If there is contents, just add them.
		if (this.attrs.contents) {
			this.observe(this.attrs.contents, layer => this.update(layer))
		}
	}

	update(obj: ArrayOrSingle<L.Layer>) {
			const map = Map.get(this.node)
			const layer = Layer.get(this.node.parentNode)

			_foreach(this.current, ob => ob.remove())
			this.current = obj
			_foreach(obj, ob => layer ? layer.layer.addLayer(ob) : ob.addTo(map.l))
	}

	// render() {
	// 	return document.createComment('whatever')
	// }

}


export interface SVGMarkerAttributes extends L.MarkerOptions {
	coords: O<L.LatLngExpression>
	className?: O<string>
	// popup ?
	// onclick ?
	// ???
}


/**
 *
 */
export class SVGMarker extends Component {

	attrs: SVGMarkerAttributes
	marker: L.Marker = null

	@onmount
	addToMap(node: Node) {
		_addLayer(node, this.marker)
	}

	@onunmount
	removeFromMap(node: Node) {
		this.marker.remove()
	}

	/**
	 * extend this.
	 */
	renderMarker(children: DocumentFragment): L.Marker {
		return L.marker(o.get(this.attrs.coords), {
			icon: new DOMIcon({node: this.renderSVG(children) as HTMLElement})
		})
	}

	renderSVG(ch: DocumentFragment): Node {
		return null
	}

	render(children: DocumentFragment) {
		this.marker = this.renderMarker(children)

		this.observe(this.attrs.coords, coords => this.marker.setLatLng(coords))

		return document.createComment('marker')
	}

}



export class Centerer extends Component {

	attrs: {center: Observable<L.LatLng>}
	map: Map

	@onmount
	setupCentering() {
		this.map = Map.get(this.node)
	}

	@onunmount
	bye() {
		this.map = null
	}

	render() {
		this.observe(this.attrs.center, center => {
			if (this.map && center) this.map.l.setView(center, this.map.l.getZoom())
		})

		return document.createComment('centerer')
	}

}