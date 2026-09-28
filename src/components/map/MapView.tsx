import { useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer, Marker, NavigationControl, Popup, ScaleControl, Source,
  type MapLayerMouseEvent, type MapRef,
} from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { dataset } from '../../data';
import { EL_AREA_BORDERS, EL_AREA_LABELS } from '../../data/elAreas';
import { useAppStore } from '../../store/useAppStore';
import type { RankingResult, ScoredSite } from '../../types';
import { scoreColor, fmtKm } from '../../lib/format';
import {
  OSM_RASTER_STYLE, PLANNING_COLORS, PLANNING_KINDS, POSITRON_STYLE, QUARRY_ICONS, RESTRICTION_COLORS,
  RESTRICTION_KINDS, SOIL_COLORS, STATUS_COLORS, VOLTAGE_RADIUS, WELL_STEPS,
} from './mapStyle';
import { MapPopupContent, type PopupTarget } from './Popups';
import { LayerPanel } from './LayerPanel';
import { Legend } from './Legend';

const INITIAL_VIEW = { bounds: [10.8, 55.2, 24.2, 69.1] as [number, number, number, number], fitBoundsOptions: { padding: 20 } };

function matchExpr(prop: string, map: Record<string, string | number>, fallback: string | number): unknown[] {
  return ['match', ['get', prop], ...Object.entries(map).flat(), fallback];
}

/** Väljer bakgrundskarta: OpenFreeMap Positron, annars OSM-raster. */
function useBaseStyle(): string | StyleSpecification | null {
  const [style, setStyle] = useState<string | StyleSpecification | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    fetch(POSITRON_STYLE, { signal: ctrl.signal })
      .then((r) => setStyle(r.ok ? POSITRON_STYLE : OSM_RASTER_STYLE))
      .catch(() => setStyle(OSM_RASTER_STYLE))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);
  return style;
}

export function MapView({ ranking, selected }: { ranking: RankingResult | null; selected: ScoredSite | null }) {
  const mapRef = useRef<MapRef>(null);
  const baseStyle = useBaseStyle();
  const layers = useAppStore((s) => s.layers);
  const selectSite = useAppStore((s) => s.selectSite);
  const maxDist = useAppStore((s) => s.requirements.maxDistanceToSubstationKm);
  const [popup, setPopup] = useState<PopupTarget | null>(null);

  // --- Statiska lager ---
  const soils = useMemo<FeatureCollection<Polygon>>(() => ({
    type: 'FeatureCollection',
    features: dataset.soils.map((s) => ({ type: 'Feature', id: s.id, properties: { id: s.id, soilType: s.soilType }, geometry: s.geometry })),
  }), []);
  const wells = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: dataset.wells.map((w) => ({ type: 'Feature', properties: { id: w.id, depth: w.depthToRockM }, geometry: { type: 'Point', coordinates: w.coord } })),
  }), []);
  const substations = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: dataset.substations.map((s) => ({
      type: 'Feature',
      properties: { id: s.id, status: s.status, kv: String(s.voltageKv) },
      geometry: { type: 'Point', coordinates: s.coord },
    })),
  }), []);
  const planningFc = useMemo(() => {
    const make = (kinds: string[]): FeatureCollection<Polygon> => ({
      type: 'FeatureCollection',
      features: dataset.planning
        .filter((p) => kinds.includes(p.kind))
        .map((p) => ({ type: 'Feature', properties: { id: p.id, kind: p.kind, blocking: p.blocking }, geometry: p.geometry })),
    });
    return { restrictions: make(RESTRICTION_KINDS), planning: make(PLANNING_KINDS) };
  }, []);

  // --- Resultatlager ---
  const others = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: (ranking ? ranking.others.map((s) => s.site) : ranking === null ? dataset.sites : []).map((site) => ({
      type: 'Feature', properties: { id: site.id }, geometry: { type: 'Point', coordinates: site.centroid },
    })),
  }), [ranking]);
  const topPolys = useMemo<FeatureCollection<Polygon>>(() => ({
    type: 'FeatureCollection',
    features: (ranking?.top ?? []).map((s) => ({ type: 'Feature', properties: { id: s.site.id, rank: s.rank }, geometry: s.site.geometry })),
  }), [ranking]);

  // --- Vald plats: linjer och buffert ---
  const selection = useMemo(() => {
    if (!selected) return null;
    const c = selected.site.centroid;
    const lines: Feature<LineString, { kind: string; label: string }>[] = [];
    const labels: { coord: [number, number]; text: string; kind: string }[] = [];
    const addLine = (to: [number, number], kind: string, label: string) => {
      lines.push({ type: 'Feature', properties: { kind, label }, geometry: { type: 'LineString', coordinates: [c, to] } });
      labels.push({ coord: [(c[0] + to[0]) / 2, (c[1] + to[1]) / 2], text: label, kind });
    };
    const nearestStation = selected.nearbyStations[0];
    if (nearestStation) addLine(nearestStation.station.coord, 'station', `⚡ ${fmtKm(nearestStation.distanceKm)}`);
    if (selected.bestStation.station.id !== nearestStation?.station.id) {
      addLine(selected.bestStation.station.coord, 'best', `⚡ bäst ${fmtKm(selected.bestStation.distanceKm)}`);
    }
    if (selected.nearestQuarry) addLine(selected.nearestQuarry.quarry.coord, 'quarry', `⛰ ${fmtKm(selected.nearestQuarry.distanceKm)}`);
    const buffer = turf.circle(c, maxDist, { units: 'kilometers', steps: 96 });
    return { lines: { type: 'FeatureCollection', features: lines } as FeatureCollection<LineString>, labels, buffer };
  }, [selected, maxDist]);

  // Flyg till vald plats
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.flyTo({ center: selected.site.centroid, zoom: Math.max(mapRef.current.getZoom(), 10.5), duration: 1200 });
  }, [selected?.site.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anpassa vyn efter nya resultat
  const topKey = ranking?.top.map((s) => s.site.id).join(',') ?? '';
  useEffect(() => {
    if (!ranking || ranking.top.length === 0 || !mapRef.current || selected) return;
    const bbox = turf.bbox(turf.featureCollection(ranking.top.map((s) => turf.point(s.site.centroid))));
    mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, maxZoom: 9, duration: 1000 });
  }, [topKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const interactive = [
    layers.others && 'others',
    layers.substations && 'substations',
    layers.wells && 'wells',
    layers.soils && 'soils-fill',
    layers.restrictions && 'restrictions-fill',
    layers.planning && 'planning-fill',
    layers.top && 'top-fill',
  ].filter(Boolean) as string[];

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) {
      setPopup(null);
      return;
    }
    const id = String(f.properties?.id);
    const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const layer = f.layer.id;
    const kind: PopupTarget['kind'] =
      layer === 'others' ? 'other' : layer === 'substations' ? 'substation' : layer === 'wells' ? 'well'
        : layer === 'soils-fill' ? 'soil' : layer === 'top-fill' ? 'top' : 'planning';
    if (kind === 'top') selectSite(id);
    setPopup({ kind, id, coord });
  };

  if (!baseStyle) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        <span className="animate-pulse">Laddar karta…</span>
      </div>
    );
  }

  const dashed = (kind: string) => (kind === 'best' ? [1, 1.5] : [2, 1.5]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        mapStyle={baseStyle}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={interactive}
        onClick={onClick}
        attributionControl={{ compact: true }}
        maxBounds={[2, 53, 32, 71]}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />

        {/* Elområden */}
        <Source id="elareas" type="geojson" data={EL_AREA_BORDERS}>
          <Layer id="elareas-line" type="line" layout={{ visibility: layers.elAreas ? 'visible' : 'none' }}
            paint={{ 'line-color': '#334155', 'line-width': 1.2, 'line-dasharray': [4, 2], 'line-opacity': 0.7 }} />
        </Source>

        {/* Jordarter */}
        <Source id="soils" type="geojson" data={soils}>
          <Layer id="soils-fill" type="fill" layout={{ visibility: layers.soils ? 'visible' : 'none' }}
            paint={{ 'fill-color': matchExpr('soilType', SOIL_COLORS, '#ccc') as never, 'fill-opacity': 0.4 }} />
          <Layer id="soils-line" type="line" layout={{ visibility: layers.soils ? 'visible' : 'none' }}
            paint={{ 'line-color': matchExpr('soilType', SOIL_COLORS, '#ccc') as never, 'line-width': 0.6 }} />
        </Source>

        {/* Planområden */}
        <Source id="planning" type="geojson" data={planningFc.planning}>
          <Layer id="planning-fill" type="fill" layout={{ visibility: layers.planning ? 'visible' : 'none' }}
            paint={{ 'fill-color': matchExpr('kind', PLANNING_COLORS as Record<string, string>, '#a78bfa') as never, 'fill-opacity': 0.3 }} />
          <Layer id="planning-line" type="line" layout={{ visibility: layers.planning ? 'visible' : 'none' }}
            paint={{ 'line-color': matchExpr('kind', PLANNING_COLORS as Record<string, string>, '#a78bfa') as never, 'line-width': 1 }} />
        </Source>

        {/* Restriktioner */}
        <Source id="restrictions" type="geojson" data={planningFc.restrictions}>
          <Layer id="restrictions-fill" type="fill" layout={{ visibility: layers.restrictions ? 'visible' : 'none' }}
            paint={{ 'fill-color': matchExpr('kind', RESTRICTION_COLORS as Record<string, string>, '#15803d') as never, 'fill-opacity': 0.12 }} />
          <Layer id="restrictions-line" type="line" layout={{ visibility: layers.restrictions ? 'visible' : 'none' }}
            paint={{ 'line-color': matchExpr('kind', RESTRICTION_COLORS as Record<string, string>, '#15803d') as never, 'line-width': 1.5, 'line-dasharray': [2, 2] }} />
        </Source>

        {/* Avståndsband kring vald plats */}
        {selection && (
          <Source id="buffer" type="geojson" data={selection.buffer}>
            <Layer id="buffer-fill" type="fill" paint={{ 'fill-color': '#0f766e', 'fill-opacity': 0.05 }} />
            <Layer id="buffer-line" type="line" paint={{ 'line-color': '#0f766e', 'line-width': 1.5, 'line-dasharray': [3, 2] }} />
          </Source>
        )}

        {/* Brunnar */}
        <Source id="wells" type="geojson" data={wells}>
          <Layer id="wells" type="circle" layout={{ visibility: layers.wells ? 'visible' : 'none' }}
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 10, 3.5, 14, 6],
              'circle-color': ['step', ['get', 'depth'], ...WELL_STEPS.flatMap(([v, c], i) => (i === 0 ? [c] : [v, c]))] as never,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 0.5,
            }} />
        </Source>

        {/* Övriga kandidatplatser */}
        <Source id="others" type="geojson" data={others}>
          <Layer id="others" type="circle" layout={{ visibility: layers.others ? 'visible' : 'none' }}
            paint={{ 'circle-radius': 5, 'circle-color': '#94a3b8', 'circle-stroke-color': '#475569', 'circle-stroke-width': 1 }} />
        </Source>

        {/* Topp 10 – polygoner vid zoom ≥ 11 */}
        <Source id="top" type="geojson" data={topPolys}>
          <Layer id="top-fill" type="fill" minzoom={11} layout={{ visibility: layers.top ? 'visible' : 'none' }}
            paint={{ 'fill-color': '#0f766e', 'fill-opacity': 0.25 }} />
          <Layer id="top-line" type="line" minzoom={11} layout={{ visibility: layers.top ? 'visible' : 'none' }}
            paint={{ 'line-color': '#0f766e', 'line-width': 2 }} />
        </Source>

        {/* Linjer till station och täkt */}
        {selection && (
          <Source id="sel-lines" type="geojson" data={selection.lines}>
            {(['station', 'best', 'quarry'] as const).map((k) => (
              <Layer key={k} id={`sel-${k}`} type="line" filter={['==', ['get', 'kind'], k]}
                paint={{ 'line-color': k === 'quarry' ? '#92400e' : '#0f172a', 'line-width': 2, 'line-dasharray': dashed(k) }} />
            ))}
          </Source>
        )}

        {/* Stationer ovanpå polygonlager */}
        <Source id="substations" type="geojson" data={substations}>
          <Layer id="substations" type="circle" layout={{ visibility: layers.substations ? 'visible' : 'none' }}
            paint={{
              'circle-radius': matchExpr('kv', VOLTAGE_RADIUS, 5) as never,
              'circle-color': matchExpr('status', STATUS_COLORS, '#888') as never,
              'circle-stroke-color': '#0f172a',
              'circle-stroke-width': 1.2,
              'circle-opacity': 0.9,
            }} />
        </Source>

        {layers.elAreas && EL_AREA_LABELS.map((l) => (
          <Marker key={l.name} longitude={l.coord[0]} latitude={l.coord[1]}>
            <span className="pointer-events-none select-none text-lg font-bold text-slate-500/60">{l.name}</span>
          </Marker>
        ))}

        {layers.quarries && dataset.quarries.map((q) => (
          <Marker key={q.id} longitude={q.coord[0]} latitude={q.coord[1]}
            onClick={(e) => { e.originalEvent.stopPropagation(); setPopup({ kind: 'quarry', id: q.id, coord: q.coord }); }}>
            <span title={q.name}
              className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm border text-[11px] shadow ${q.acceptsMasses ? 'border-amber-900 bg-amber-200' : 'border-stone-700 bg-stone-200'}`}>
              {QUARRY_ICONS[q.type]}
            </span>
          </Marker>
        ))}

        {layers.excluded && ranking?.excluded.map((e) => (
          <Marker key={e.site.id} longitude={e.site.centroid[0]} latitude={e.site.centroid[1]}
            onClick={(ev) => { ev.originalEvent.stopPropagation(); setPopup({ kind: 'excluded', id: e.site.id, coord: e.site.centroid }); }}>
            <span className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-red-800 bg-red-500 text-[10px] font-bold leading-none text-white">✕</span>
          </Marker>
        ))}

        {selection?.labels.map((l) => (
          <Marker key={l.kind} longitude={l.coord[0]} latitude={l.coord[1]}>
            <span className={`pointer-events-none rounded px-1 py-0.5 text-[10px] font-semibold shadow ${l.kind === 'quarry' ? 'bg-amber-100 text-amber-900' : 'bg-white text-slate-900'}`}>{l.text}</span>
          </Marker>
        ))}

        {layers.top && ranking?.top.slice().reverse().map((s) => {
          const isSel = selected?.site.id === s.site.id;
          return (
            <Marker key={s.site.id} longitude={s.site.centroid[0]} latitude={s.site.centroid[1]} anchor="bottom"
              style={{ zIndex: isSel ? 20 : 10 }}
              onClick={(e) => { e.originalEvent.stopPropagation(); selectSite(s.site.id); setPopup({ kind: 'top', id: s.site.id, coord: s.site.centroid }); }}>
              <button
                aria-label={`Plats ${s.rank}: ${s.site.name}`}
                className={`flex h-7 w-7 items-center justify-center rounded-full rounded-bl-none border-2 text-xs font-bold text-white shadow-md transition ${isSel ? 'scale-125 border-slate-900' : 'border-white'}`}
                style={{ background: scoreColor(s.total), transform: 'rotate(-45deg)' }}
              >
                <span style={{ transform: 'rotate(45deg)' }}>{s.rank}</span>
              </button>
            </Marker>
          );
        })}

        {popup && (
          <Popup longitude={popup.coord[0]} latitude={popup.coord[1]} onClose={() => setPopup(null)} closeOnClick={false} maxWidth="260px" offset={popup.kind === 'top' ? 30 : 8}>
            <MapPopupContent target={popup} ranking={ranking} onDetails={(id) => { selectSite(id); setPopup(null); }} />
          </Popup>
        )}
      </Map>

      <LayerPanel ranking={ranking} />
      <Legend />
    </div>
  );
}
