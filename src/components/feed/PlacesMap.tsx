"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { track, EVENTS } from "@/lib/analytics";

type Category = "food" | "travel";
type Props = { category: Category; onPinClick: (itemId: string) => void };
type LoadState = "loading" | "ready" | "error";

type PointInfo = {
  point_id: string;
  item_id: string;
  name: string;
  sub_label: string | null;
  thumbnail_url: string | null;
  category: Category;
};

export function PlacesMap({ category, onPinClick }: Props) {
  const points = useQuery(api.places.mapPoints, { category });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const mapsLibRef = useRef<google.maps.MapsLibrary | null>(null);
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const trackedOpenRef = useRef(false);
  const onPinClickRef = useRef(onPinClick);

  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((bundle) => {
        if (cancelled || !containerRef.current) return;
        mapsLibRef.current = bundle.maps;
        markerLibRef.current = bundle.marker;
        mapRef.current = new bundle.maps.Map(containerRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new bundle.maps.InfoWindow();
        setLoadState("ready");
      })
      .catch((err) => {
        console.error("[PlacesMap] failed to load Google Maps", err);
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
      infoRef.current?.close();
      clustererRef.current?.clearMarkers();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
      mapRef.current = null;
      clustererRef.current = null;
      infoRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (loadState !== "ready" || !mapRef.current || !markerLibRef.current) return;
    if (!points) return;

    if (!trackedOpenRef.current) {
      track(EVENTS.MAP_OPENED, { category, point_count: points.length });
      trackedOpenRef.current = true;
    }

    const map = mapRef.current;
    const MarkerCtor = markerLibRef.current.Marker;
    const LatLngBoundsCtor = google.maps.LatLngBounds;

    const nextIds = new Set(points.map((p) => p.point_id));
    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    for (const p of points) {
      let marker = markersRef.current.get(p.point_id);
      if (!marker) {
        marker = new MarkerCtor({
          position: { lat: p.lat, lng: p.lng },
          title: p.name,
        });
        const info: PointInfo = {
          point_id: p.point_id,
          item_id: String(p.item_id),
          name: p.name,
          sub_label: p.sub_label,
          thumbnail_url: p.thumbnail_url,
          category: p.category,
        };
        marker.addListener("click", () => {
          if (!infoRef.current || !mapRef.current) return;
          infoRef.current.setContent(renderInfoHTML(info));
          infoRef.current.open({ anchor: marker, map: mapRef.current });
          setTimeout(() => {
            document
              .getElementById(`open-item-${info.point_id}`)
              ?.addEventListener(
                "click",
                () => {
                  track(EVENTS.MAP_PIN_CLICKED, {
                    item_id: info.item_id,
                    point_id: info.point_id,
                    category: info.category,
                    sub_label: info.sub_label,
                  });
                  onPinClickRef.current(info.item_id);
                },
                { once: true },
              );
          }, 0);
        });
        markersRef.current.set(p.point_id, marker);
      } else {
        marker.setPosition({ lat: p.lat, lng: p.lng });
      }
    }

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers(Array.from(markersRef.current.values()));
    } else {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: Array.from(markersRef.current.values()),
      });
    }

    if (points.length > 0) {
      const bounds = new LatLngBoundsCtor();
      for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds, 48);
      if (points.length === 1) map.setZoom(13);
    }
  }, [points, loadState, category]);

  useEffect(() => {
    trackedOpenRef.current = false;
  }, [category]);

  if (loadState === "error") {
    return (
      <div className="flex items-center justify-center h-[60vh] text-fa-muted text-sm">
        Map unavailable. Check your Google Maps API key.
      </div>
    );
  }

  if (points === undefined || loadState === "loading") {
    return (
      <div className="h-[60vh] rounded-lg bg-fa-surface animate-pulse" aria-label="Loading map" />
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-fa-muted text-sm text-center px-4">
        No places with coordinates yet. New items will appear here once they&apos;re processed.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[70vh] rounded-lg overflow-hidden" />;
}

function renderInfoHTML(p: PointInfo): string {
  const thumb = p.thumbnail_url
    ? `<img src="${p.thumbnail_url}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:4px;margin-bottom:8px" />`
    : "";
  const sub = p.sub_label
    ? `<div style="font-size:12px;color:#666;margin-bottom:8px">${escapeHTML(p.sub_label)}</div>`
    : "";
  return `
    <div style="width:200px;font-family:inherit">
      ${thumb}
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHTML(p.name)}</div>
      ${sub}
      <button id="open-item-${p.point_id}" style="width:100%;min-height:44px;background:#111;color:#fff;border:0;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Open saved item</button>
    </div>
  `;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
