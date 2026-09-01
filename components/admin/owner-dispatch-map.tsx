"use client";

import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { OwnerDispatchVisit } from "@/lib/field-operations/owner-dispatch";

const CHICO_CENTER: [number, number] = [39.7285, -121.8375];
const CREW_COLORS = [
  "#c9b896",
  "#6ee7b7",
  "#93c5fd",
  "#d8b4fe",
  "#fca5a5",
  "#fdba74",
];

function colorForVisit(visit: OwnerDispatchVisit): string {
  if (visit.assignedUsers.length === 0) return "#a1a1aa";
  const key = visit.assignedUsers[0]!.id;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return CREW_COLORS[hash % CREW_COLORS.length]!;
}

export function OwnerDispatchMap({
  visits,
  selectedVisitId,
  onSelect,
}: {
  visits: OwnerDispatchVisit[];
  selectedVisitId: string | null;
  onSelect: (visitId: string) => void;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const fittedSetRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!elementRef.current || mapRef.current) return;
    void import("leaflet").then((leaflet) => {
      if (cancelled || !elementRef.current || mapRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(elementRef.current, {
        zoomControl: true,
        attributionControl: false,
      });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        })
        .addTo(map);
      layerRef.current = leaflet.layerGroup().addTo(map);
      map.setView(CHICO_CENTER, 11);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!leaflet || !map || !layer) return;
    layer.clearLayers();

    const mapped = visits.filter((visit) => visit.location !== null);
    const bounds: Array<[number, number]> = [];
    for (const visit of mapped) {
      const point: [number, number] = [
        visit.location!.latitude,
        visit.location!.longitude,
      ];
      bounds.push(point);
      const selected = visit.projectionId === selectedVisitId;
      const color = colorForVisit(visit);
      const marker = leaflet.circleMarker(point, {
        radius: selected ? 10 : 7,
        color: selected ? "#fff7d6" : color,
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: selected ? 1 : 0.84,
      });
      marker.bindTooltip(
        `${visit.clientName} · ${visit.assignedUsers[0]?.name ?? "Unassigned"}`,
        { direction: "top", opacity: 0.96 },
      );
      marker.on("click", () => onSelect(visit.projectionId));
      marker.addTo(layer);
    }

    const pinSet = mapped
      .map((visit) => visit.projectionId)
      .sort()
      .join("|");
    if (bounds.length > 0 && fittedSetRef.current !== pinSet) {
      map.fitBounds(leaflet.latLngBounds(bounds), {
        padding: [32, 32],
        maxZoom: 14,
      });
      fittedSetRef.current = pinSet;
    }
  }, [mapReady, onSelect, selectedVisitId, visits]);

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#11100e]">
      <div
        ref={elementRef}
        className="h-[26rem] w-full lg:h-[34rem]"
        aria-label="Upcoming Jobber visits map"
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-[#090806]/90 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-xl backdrop-blur-xl">
        {visits.filter((visit) => visit.location).length} mapped · {visits.length} in view
      </div>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 rounded-md bg-[#090806]/85 px-2 py-1 text-[8px] text-white/65 backdrop-blur-sm hover:text-white"
      >
        Map data © OpenStreetMap
      </a>
    </div>
  );
}
