"use client";

import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type {
  TerritoryCustomerPin,
  TerritoryMapPayload,
  TerritoryRefreshPayload,
} from "@/lib/sales/territory-types";
import {
  craftEyebrow,
  craftInput,
  craftPrimaryButton,
  craftSecondaryButton,
} from "@/lib/craft/tokens";

interface CustomerProofMapProps {
  repSlug: string;
  repName: string;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

const CHICO_CENTER: [number, number] = [39.7285, -121.8375];
const RADIUS_OPTIONS = [1, 3, 5, 10] as const;

function milesBetween(left: UserLocation, right: UserLocation): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

function completedDate(value: string | null): string {
  if (!value) return "Completed in Jobber";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Completed in Jobber";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function mapErrorMessage(status: number, body: { error?: string } | null) {
  if (status === 401) return "Unlock the private field desk to use the proof map.";
  return body?.error ?? "The private customer proof map could not be loaded.";
}

export function CustomerProofMap({ repSlug, repName }: CustomerProofMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const proofLayerRef = useRef<LayerGroup | null>(null);
  const userLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const fittedPinSetRef = useRef<string | null>(null);
  const [payload, setPayload] = useState<TerritoryMapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const loadMap = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/territory`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as
        | (TerritoryMapPayload & { error?: string })
        | null;
      if (!response.ok || !body?.pins) {
        throw new Error(mapErrorMessage(response.status, body));
      }
      setPayload(body);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The private customer proof map could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [repSlug]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadMap());
    return () => window.cancelAnimationFrame(frame);
  }, [loadMap]);

  const refreshMap = async () => {
    setRefreshing(true);
    setError(null);
    const waiting = payload?.coverage.pendingProperties ?? 0;
    setRefreshProgress(
      waiting > 0
        ? `Finishing ${waiting} verified Jobber addresses…`
        : "Syncing completed work from Jobber…",
    );

    try {
      const response = await fetch(
        `/api/sales/${encodeURIComponent(repSlug)}/territory`,
        {
          method: "POST",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ syncJobber: true }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | (TerritoryRefreshPayload & { error?: string })
        | null;
      if (!response.ok || !body?.pins || !body.refresh) {
        throw new Error(mapErrorMessage(response.status, body));
      }
      setPayload(body);
      if (body.refresh.failed > 0) {
        throw new Error(
          "Google address mapping was temporarily unavailable. Jobber data is current; mapping stopped safely.",
        );
      }
      const mapped = body.coverage.mappedProperties;
      const reviewCount =
        body.coverage.unmatchedAddresses +
        body.coverage.unmappableProperties;
      setRefreshProgress(
        body.refresh.remaining > 0
          ? `${mapped} mapped · ${body.refresh.remaining} will continue automatically`
          : `Proof map current · ${mapped} mapped${reviewCount > 0 ? ` · ${reviewCount} need address review` : ""}`,
      );
      setError(null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "The map refresh stopped safely.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const useMyLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("This phone does not provide location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(next);
        setRadiusMiles((current) => current ?? 3);
        mapRef.current?.setView([next.latitude, next.longitude], 14, {
          animate: true,
        });
      },
      (locationFailure) => {
        setLocationError(
          locationFailure.code === locationFailure.PERMISSION_DENIED
            ? "Location was not allowed. Enable it for nearby sorting."
            : "Your location is temporarily unavailable.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const pinsWithDistance = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (payload?.pins ?? [])
      .map((pin) => ({
        pin,
        distance: userLocation
          ? milesBetween(userLocation, pin.location)
          : null,
      }))
      .filter(({ pin, distance }) => {
        if (radiusMiles !== null && distance !== null && distance > radiusMiles) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          pin.customerName,
          pin.address,
          ...pin.services.map((service) => service.label),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (left.distance === null || right.distance === null) return 0;
        return left.distance - right.distance;
      });
  }, [payload?.pins, query, radiusMiles, userLocation]);

  const selectedPin = useMemo(
    () =>
      (payload?.pins ?? []).find(
        (pin) => pin.propertyId === selectedPropertyId,
      ) ?? pinsWithDistance[0]?.pin ?? null,
    [payload?.pins, pinsWithDistance, selectedPropertyId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!mapElementRef.current || mapRef.current) return;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !mapElementRef.current || mapRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: false,
      });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        })
        .addTo(map);
      proofLayerRef.current = leaflet.layerGroup().addTo(map);
      userLayerRef.current = leaflet.layerGroup().addTo(map);
      map.setView(CHICO_CENTER, 11);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      proofLayerRef.current = null;
      userLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = proofLayerRef.current;
    if (!leaflet || !map || !layer) return;
    layer.clearLayers();

    const bounds: Array<[number, number]> = [];
    const pinSetKey = pinsWithDistance
      .map(({ pin }) => pin.propertyId)
      .sort()
      .join("|");
    for (const { pin } of pinsWithDistance) {
      const point: [number, number] = [
        pin.location.latitude,
        pin.location.longitude,
      ];
      bounds.push(point);
      const selected = pin.propertyId === selectedPin?.propertyId;
      const marker = leaflet.circleMarker(point, {
        radius: selected ? 10 : 7,
        color: selected ? "#fef3c7" : "#c9b896",
        weight: selected ? 3 : 2,
        fillColor: selected ? "#facc15" : "#a89878",
        fillOpacity: selected ? 0.96 : 0.82,
      });
      marker.bindTooltip(
        `${pin.customerName} · ${pin.completedVisitCount} completed`,
        { direction: "top", opacity: 0.95 },
      );
      marker.on("click", () => setSelectedPropertyId(pin.propertyId));
      marker.addTo(layer);
    }

    if (
      !userLocation &&
      bounds.length > 0 &&
      fittedPinSetRef.current !== pinSetKey
    ) {
      map.fitBounds(leaflet.latLngBounds(bounds), {
        padding: [28, 28],
        maxZoom: 14,
      });
      fittedPinSetRef.current = pinSetKey;
    }
  }, [mapReady, pinsWithDistance, selectedPin?.propertyId, userLocation]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const layer = userLayerRef.current;
    if (!leaflet || !layer) return;
    layer.clearLayers();
    if (!userLocation) return;
    leaflet
      .circleMarker([userLocation.latitude, userLocation.longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
      .bindTooltip("You are here", { direction: "top" })
      .addTo(layer);
  }, [mapReady, userLocation]);

  const fitAllPins = () => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || pinsWithDistance.length === 0) return;
    map.fitBounds(
      leaflet.latLngBounds(
        pinsWithDistance.map(({ pin }) => [
          pin.location.latitude,
          pin.location.longitude,
        ]),
      ),
      { padding: [28, 28], maxZoom: 14 },
    );
  };

  const pendingProperties = payload?.coverage.pendingProperties ?? 0;
  const reviewProperties = payload
    ? payload.coverage.unmatchedAddresses + payload.coverage.unmappableProperties
    : 0;
  const mappableProperties = payload
    ? Math.max(0, payload.coverage.completedProperties - payload.coverage.unmappableProperties)
    : 0;
  const coveragePercent = mappableProperties > 0
    ? Math.round(((payload?.coverage.mappedProperties ?? 0) / mappableProperties) * 100)
    : 0;

  return (
    <section id="proof-map" className="mt-8" aria-labelledby="proof-map-title">
      <GlassCard tone="elevated" padding="lg" rim className="overflow-hidden">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={craftEyebrow}>Neighborhood proof · Jobber verified</p>
            <h2 id="proof-map-title" className="mt-2 font-serif text-3xl font-light text-foreground sm:text-4xl">
              See the homes we&apos;ve already earned.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Completed visits only. Tap a home to see who we served and what
              SqueegeeKing completed there.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshMap()}
            disabled={refreshing}
            className={`${craftPrimaryButton} shrink-0 disabled:opacity-55`}
          >
            {refreshing
              ? "Finishing map…"
              : pendingProperties > 0
                ? `Finish ${pendingProperties} addresses`
                : "Refresh from Jobber"}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/[0.055] px-4 py-3 text-xs leading-5 text-amber-50/85">
          Internal field reference for {repName}. Never share a customer&apos;s name
          or exact address at another door without their permission—say “a nearby
          SqueegeeKing customer” instead.
        </div>

        {refreshProgress ? (
          <p className="mt-4 text-xs font-semibold text-emerald-200" role="status">
            {refreshProgress}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-2xl border border-red-300/35 bg-red-300/[0.1] px-4 py-3 text-sm text-red-100" role="alert">
            {error}
          </p>
        ) : null}

        {payload ? (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-semibold text-foreground">Verified map coverage</span>
              <span className="tabular-nums text-accent">{coveragePercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8f7a50] via-accent to-emerald-300 transition-[width] duration-700"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              {payload.coverage.mappedProperties} completed properties mapped
              {pendingProperties > 0 ? ` · ${pendingProperties} waiting to finish` : ""}
              {reviewProperties > 0 ? ` · ${reviewProperties} need a Jobber address review` : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label>
            <span className="sr-only">Search completed customers and services</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={craftInput}
              placeholder="Search a customer, street, or service"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={useMyLocation}
            className={craftSecondaryButton}
          >
            {userLocation ? "Location active" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={fitAllPins}
            disabled={pinsWithDistance.length === 0}
            className={`${craftSecondaryButton} disabled:opacity-45`}
          >
            Fit all homes
          </button>
        </div>

        {locationError ? (
          <p className="mt-3 text-xs text-amber-100" role="status">
            {locationError}
          </p>
        ) : null}

        {userLocation ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Map radius">
            <button
              type="button"
              onClick={() => setRadiusMiles(null)}
              aria-pressed={radiusMiles === null}
              className={`min-h-10 rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.14em] ${
                radiusMiles === null
                  ? "border-accent bg-accent text-background"
                  : "border-white/15 text-muted"
              }`}
            >
              All
            </button>
            {RADIUS_OPTIONS.map((radius) => (
              <button
                key={radius}
                type="button"
                onClick={() => setRadiusMiles(radius)}
                aria-pressed={radiusMiles === radius}
                className={`min-h-10 rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.14em] ${
                  radiusMiles === radius
                    ? "border-accent bg-accent text-background"
                    : "border-white/15 text-muted"
                }`}
              >
                {radius} mi
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
          <div className="relative overflow-hidden rounded-[1.4rem] border border-white/[0.1] bg-[#11100e]">
            <div ref={mapElementRef} className="h-[24rem] w-full sm:h-[34rem]" aria-label="Completed customer map" />
            {!loading && payload ? (
              <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-[#090806]/88 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-foreground shadow-xl backdrop-blur-xl">
                {pinsWithDistance.length} verified homes in view
              </div>
            ) : null}
            {loading ? (
              <div className="absolute inset-0 grid place-items-center bg-[#0b0a09]/80 text-sm text-muted backdrop-blur-sm">
                Loading private proof map…
              </div>
            ) : null}
            {!loading && pinsWithDistance.length === 0 ? (
              <div className="pointer-events-none absolute inset-x-5 top-5 rounded-2xl border border-white/[0.1] bg-black/75 px-4 py-3 text-sm text-foreground backdrop-blur-xl">
                No mapped completed homes match this view yet.
              </div>
            ) : null}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-2 rounded-md bg-[#090806]/80 px-2 py-1 text-[8px] text-white/65 backdrop-blur-sm hover:text-white"
            >
              Map data © OpenStreetMap
            </a>
          </div>

          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                ["Mapped", payload?.coverage.mappedProperties ?? 0],
                ["Completed", payload?.coverage.completedProperties ?? 0],
                ["Waiting", pendingProperties],
                ["Review", reviewProperties],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-3 text-center">
                  <p className="font-serif text-2xl text-foreground">{value}</p>
                  <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-muted">{label}</p>
                </div>
              ))}
            </div>

            {selectedPin ? (
              <ProofCard
                pin={selectedPin}
                distance={
                  userLocation
                    ? milesBetween(userLocation, selectedPin.location)
                    : null
                }
              />
            ) : (
              <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/[0.1] px-5 py-10 text-center text-sm text-muted">
                {pendingProperties > 0
                  ? `${pendingProperties} completed-property addresses are ready to finish mapping.`
                  : "Refresh from Jobber to build the first verified proof pins."}
              </div>
            )}

            {pinsWithDistance.length > 1 ? (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {pinsWithDistance.slice(0, 12).map(({ pin, distance }) => (
                  <button
                    key={pin.propertyId}
                    type="button"
                    onClick={() => {
                      setSelectedPropertyId(pin.propertyId);
                      mapRef.current?.setView(
                        [pin.location.latitude, pin.location.longitude],
                        15,
                        { animate: true },
                      );
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      pin.propertyId === selectedPin?.propertyId
                        ? "border-accent/50 bg-accent/[0.09]"
                        : "border-white/[0.07] bg-black/10"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">{pin.customerName}</span>
                      {distance !== null ? (
                        <span className="shrink-0 text-[10px] text-accent">{distance.toFixed(1)} mi</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">{pin.address}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </GlassCard>
    </section>
  );
}

function ProofCard({
  pin,
  distance,
}: {
  pin: TerritoryCustomerPin;
  distance: number | null;
}) {
  const directionsUrl = new URL("https://www.google.com/maps/dir/");
  directionsUrl.search = new URLSearchParams({
    api: "1",
    destination: `${pin.location.latitude},${pin.location.longitude}`,
  }).toString();

  return (
    <article className="mt-4 rounded-[1.4rem] border border-accent/25 bg-accent/[0.055] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">Jobber completed</p>
          <h3 className="mt-2 font-serif text-2xl font-light text-foreground">{pin.customerName}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{pin.address}</p>
        </div>
        {distance !== null ? (
          <span className="shrink-0 rounded-full border border-accent/25 px-3 py-1.5 text-[10px] font-semibold text-accent">
            {distance.toFixed(1)} mi
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-y border-white/[0.07] py-3 text-xs">
        <span className="text-foreground">{pin.completedVisitCount} completed {pin.completedVisitCount === 1 ? "visit" : "visits"}</span>
        <span className="text-muted">Last {completedDate(pin.lastCompletedAt)}</span>
      </div>

      <div className="mt-4 space-y-2">
        {pin.services.slice(0, 5).map((service, index) => (
          <div key={`${service.jobNumber ?? "visit"}-${service.completedAt ?? index}`} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-foreground/85">{service.label}</span>
            <span className="shrink-0 text-muted">{completedDate(service.completedAt)}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <a
          href={pin.jobberWebUri}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-accent/35 bg-accent/[0.09] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-accent"
        >
          Open Jobber
        </a>
        <a
          href={directionsUrl.toString()}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground"
        >
          Directions
        </a>
      </div>
    </article>
  );
}
