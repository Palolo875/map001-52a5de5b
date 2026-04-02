import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Earthquake, GBIFSpecies, NearbyPOI, WikimediaPhoto } from "@/lib/enrichment";
import type { SituationTrait } from "@/lib/priorities";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon, BookOpen01Icon, Alert02Icon, Leaf01Icon, Navigation03Icon, ViewIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

export interface MapPreviewItem {
  id: string;
  kind: "category" | "landmark";
  title: string;
  subtitle?: string;
  imageUrl?: string;
  coordinates: [number, number];
}

interface MapViewProps {
  center: [number, number]; // [lon, lat]
  zoom: number;
  onMapClick?: (lat: number, lon: number) => void;
  onZoomChange?: (zoom: number) => void;
  markerPosition?: [number, number] | null;
  activeLayer?: "none" | "quakes" | "nature" | "risks";
  quakesData?: Earthquake[];
  natureData?: GBIFSpecies[];
  naturalEventsData?: any[];
  traits?: Set<SituationTrait>;
  landmarks?: WikimediaPhoto[];
  categoryResults?: NearbyPOI[];
  selectedCategoryResult?: NearbyPOI | null;
  onCategoryResultClick?: (poi: NearbyPOI) => void;
  onLayerChange?: (layer: "none" | "quakes" | "nature" | "risks") => void;
  previewItem?: MapPreviewItem | null;
  onPreviewSelect?: (preview: MapPreviewItem | null) => void;
}

const MAP_STYLES = {
  plan: {
    name: "Plan",
    url: "https://tiles.openfreemap.org/styles/bright",
    thumbnail: "https://tiles.openfreemap.org/styles/bright/thumbnail.png"
  },
  satellite: {
    name: "Satellite",
    url: {
      version: 8,
      projection: { type: "mercator" },
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256
        }
      },
      layers: [
        {
          id: "satellite",
          type: "raster",
          source: "esri-satellite",
          minzoom: 0,
          maxzoom: 22
        }
      ]
    },
    thumbnail: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/2819/4166"
  },
  sombre: {
    name: "Sombre",
    url: "https://tiles.openfreemap.org/styles/dark",
    thumbnail: "https://tiles.openfreemap.org/styles/dark/thumbnail.png"
  },
  relief: {
    name: "Relief",
    url: "https://tiles.openfreemap.org/styles/liberty",
    thumbnail: "https://tiles.openfreemap.org/styles/liberty/thumbnail.png"
  }
};

type StyleKey = keyof typeof MAP_STYLES;

export default function MapView({
  center,
  zoom,
  onMapClick,
  onZoomChange,
  markerPosition,
  activeLayer = "none",
  quakesData = [],
  natureData = [],
  naturalEventsData = [],
  traits,
  landmarks = [],
  categoryResults = [],
  selectedCategoryResult = null,
  onCategoryResultClick,
  onLayerChange,
  previewItem = null,
  onPreviewSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const landmarksRef = useRef<maplibregl.Marker[]>([]);
  const categoryMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [currentStyle, setCurrentStyle] = useState<StyleKey>("plan");
  const [show3D, setShow3D] = useState(true);
  const quakesDataRef = useRef(quakesData);
  const naturalEventsDataRef = useRef(naturalEventsData);

  useEffect(() => {
    quakesDataRef.current = quakesData;
    naturalEventsDataRef.current = naturalEventsData;
  }, [quakesData, naturalEventsData]);

  // Setup 3D Building extrusion
  const setup3DBuildings = (map: maplibregl.Map) => {
    if (!map.isStyleLoaded()) return;
    
    if (!show3D) {
      if (map.getLayer("3d-buildings")) map.removeLayer("3d-buildings");
      return;
    }

    const style = map.getStyle();
    if (!style || !style.layers) return;
    const layers = style.layers;
    let labelLayerId;
    if (layers) {
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === "symbol" && (layers[i].layout as any)?.["text-field"]) {
          labelLayerId = layers[i].id;
          break;
        }
      }
    }

    if (!map.getSource("openmaptiles")) return;

    if (!map.getLayer("3d-buildings")) {
      map.addLayer(
        {
          id: "3d-buildings",
          source: "openmaptiles",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": currentStyle === "sombre" ? "#333" : "#eee",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13, 0,
              14, ["get", "render_height"]
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13, 0,
              14, ["get", "render_min_height"]
            ],
            "fill-extrusion-opacity": 0.8
          }
        },
        labelLayerId
      );
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[currentStyle].url as any,
      center,
      zoom,
      attributionControl: false,
    });

    const addCustomLayers = (map: maplibregl.Map) => {
      if (!map.isStyleLoaded()) return;

      if (!map.getSource("quakes-source")) {
        map.addSource("quakes-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      if (!map.getSource("nasa-source")) {
        map.addSource("nasa-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      }
      
      if (!map.getLayer("quakes-layer")) {
        map.addLayer({
          id: "quakes-layer",
          type: "circle",
          source: "quakes-source",
          paint: {
            "circle-radius": ["*", ["get", "mag"], 4],
            "circle-color": "#f97316",
            "circle-opacity": 0.6,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff"
          }
        });
      }

      if (!map.getLayer("nasa-layer")) {
        map.addLayer({
          id: "nasa-layer",
          type: "circle",
          source: "nasa-source",
          paint: {
            "circle-radius": 8,
            "circle-color": "#ef4444",
            "circle-opacity": 0.8,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff"
          }
        });
      }

      // Update data
      if (map.getSource("quakes-source")) {
        (map.getSource("quakes-source") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: quakesDataRef.current.map(q => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [q.lon, q.lat] },
            properties: { mag: q.magnitude }
          }))
        });
      }

      if (map.getSource("nasa-source")) {
        (map.getSource("nasa-source") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: (naturalEventsDataRef.current || []).map(e => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [e.lon, e.lat] },
            properties: { category: e.category }
          }))
        });
      }
    };

    map.on("load", () => {
      setup3DBuildings(map);
      addCustomLayers(map);
    });

    map.on("style.load", () => {
      setup3DBuildings(map);
      addCustomLayers(map);
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), "bottom-left");

    map.on("click", (e) => {
      onMapClick?.(e.lngLat.lat, e.lngLat.lng);
    });

    map.on("zoomend", () => {
      const z = Math.round(map.getZoom());
      onZoomChange?.(z);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center smoothly
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center,
        zoom,
        speed: 1.2,
        curve: 1.1,
        essential: true
      });
    }
  }, [center]);

  // Handle Style change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[currentStyle].url as any);
    }
  }, [currentStyle]);

  // Handle 3D toggle
  useEffect(() => {
    if (mapRef.current) {
      setup3DBuildings(mapRef.current);
    }
  }, [show3D, currentStyle]);

  // Handle Data Layers (Quakes, Nature, Risks)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Helper to clear existing layers
    const ids = ["quakes-layer", "nature-layer", "nasa-layer"];
    const sources = ["quakes-source", "nature-source", "nasa-source"];

    // Update Sources & Layers
    const updateLayers = () => {
      // 1. Quakes
      if (map.getSource("quakes-source")) {
        (map.getSource("quakes-source") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: quakesData.map(q => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [q.lon, q.lat] },
            properties: { mag: q.magnitude }
          }))
        });
      }

      // 2. NASA Events
      if (map.getSource("nasa-source")) {
        (map.getSource("nasa-source") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: (naturalEventsData || []).map(e => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [e.lon, e.lat] },
            properties: { category: e.category }
          }))
        });
      }
    };

    if (map.loaded()) updateLayers();

  }, [quakesData, naturalEventsData]);

  // Marker handling
  useEffect(() => {
    if (!mapRef.current) return;
    if (markerPosition) {
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: "#ef4444" })
          .setLngLat(markerPosition)
          .addTo(mapRef.current);
      } else {
        markerRef.current.setLngLat(markerPosition);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [markerPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    landmarksRef.current.forEach((marker) => marker.remove());
    landmarksRef.current = [];

    if (!landmarks.length) return;

    landmarksRef.current = landmarks.slice(0, 6).map((landmark, index) => {
      const isSelected = previewItem?.kind === "landmark" && previewItem.id === `landmark-${index}`;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "atlas-landmark-marker";
      element.setAttribute("aria-label", landmark.title);
      element.style.width = isSelected ? "56px" : "48px";
      element.style.height = isSelected ? "56px" : "48px";
      element.style.borderRadius = "999px";
      element.style.overflow = "hidden";
      element.style.border = isSelected ? "2px solid rgba(255,255,255,0.96)" : "2px solid rgba(255,255,255,0.82)";
      element.style.boxShadow = isSelected
        ? "0 16px 36px rgba(15,23,42,0.34)"
        : "0 10px 24px rgba(15,23,42,0.2)";
      element.style.background = "#ffffff";
      element.style.cursor = "pointer";
      element.innerHTML = landmark.thumbUrl
        ? `<img src="${landmark.thumbUrl}" alt="${landmark.title}" style="width:100%;height:100%;object-fit:cover;" />`
        : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:18px;">📍</span>`;

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onPreviewSelect?.({
          id: `landmark-${index}`,
          kind: "landmark",
          title: landmark.title,
          subtitle: "Repère visuel",
          imageUrl: landmark.thumbUrl,
          coordinates: [landmark.lon, landmark.lat],
        });
      });

      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([landmark.lon, landmark.lat])
        .addTo(map);
    });
  }, [landmarks, previewItem, onPreviewSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    categoryMarkersRef.current.forEach((marker) => marker.remove());
    categoryMarkersRef.current = [];

    if (!categoryResults.length) return;

    categoryMarkersRef.current = categoryResults.map((poi) => {
      const isSelected =
        selectedCategoryResult &&
        selectedCategoryResult.lat === poi.lat &&
        selectedCategoryResult.lon === poi.lon &&
        selectedCategoryResult.name === poi.name;

      const element = document.createElement("button");
      element.type = "button";
      element.className = "atlas-category-marker";
      element.setAttribute("aria-label", poi.name);
      element.innerHTML = `<span>${getCategoryMarkerGlyph(poi.category)}</span>`;
      element.style.width = isSelected ? "46px" : "38px";
      element.style.height = isSelected ? "46px" : "38px";
      element.style.borderRadius = "999px";
      element.style.border = isSelected ? "2px solid rgba(255,255,255,0.95)" : "1px solid rgba(255,255,255,0.9)";
      element.style.background = isSelected ? "#111827" : "rgba(17,24,39,0.82)";
      element.style.color = "#ffffff";
      element.style.boxShadow = isSelected
        ? "0 14px 30px rgba(15,23,42,0.28)"
        : "0 8px 20px rgba(15,23,42,0.18)";
      element.style.backdropFilter = "blur(6px)";
      element.style.cursor = "pointer";
      element.style.fontSize = isSelected ? "18px" : "15px";
      element.style.display = "flex";
      element.style.alignItems = "center";
      element.style.justifyContent = "center";
      element.style.transition = "all 180ms ease";

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onPreviewSelect?.({
          id: `category-${poi.lat}-${poi.lon}-${poi.name}`,
          kind: "category",
          title: poi.name,
          subtitle: poi.category,
          coordinates: [poi.lon, poi.lat],
        });
        onCategoryResultClick?.(poi);
      });

      return new maplibregl.Marker({ element })
        .setLngLat([poi.lon, poi.lat])
        .addTo(map);
    });
  }, [categoryResults, selectedCategoryResult, onCategoryResultClick, onPreviewSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !previewItem) return;

    map.flyTo({
      center: previewItem.coordinates,
      zoom: Math.max(map.getZoom(), 14),
      speed: 1.1,
      curve: 1.15,
      essential: true,
    });
  }, [previewItem]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />

      {previewItem && (
        <button
          type="button"
          onClick={() => {
            if (previewItem.kind === "category") {
              const poi = categoryResults.find(
                (item) =>
                  `category-${item.lat}-${item.lon}-${item.name}` === previewItem.id
              );
              if (poi) onCategoryResultClick?.(poi);
            }
          }}
          className="absolute left-4 bottom-6 z-20 w-[min(340px,calc(100%-2rem))] rounded-3xl border border-white/60 bg-card/90 shadow-lifted backdrop-blur-xl overflow-hidden text-left group transition-all"
        >
          <div className="flex items-stretch p-2 relative">
            <div className="w-[100px] h-[100px] shrink-0 rounded-2xl overflow-hidden bg-muted/30">
              {previewItem.imageUrl ? (
                <img src={previewItem.imageUrl} alt={previewItem.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl">
                  {previewItem.kind === "landmark" ? "🖼️" : "📍"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 px-4 py-3 flex flex-col justify-center">
              <p className="truncate font-serif text-xl text-foreground leading-tight">{previewItem.title}</p>
              {previewItem.subtitle && (
                <p className="mt-1 text-[13px] text-muted-foreground/90">{previewItem.subtitle}</p>
              )}
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground flex items-center gap-1 group-hover:gap-1.5 transition-all">
                {previewItem.kind === "category" ? "Ouvrir le détail" : "Repère visuel"}
                <span className="text-lg leading-none mb-0.5">›</span>
              </p>
            </div>
            <div 
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/20 flex items-center justify-center hover:bg-background transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewSelect?.(null);
              }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-foreground" />
            </div>
          </div>
        </button>
      )}
      
      {/* Layer Selector */}
      <div className="absolute top-20 right-4 z-20">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center justify-center w-[42px] h-[42px] rounded-2xl border border-border/30 bg-card/90 blur-calque shadow-soft hover:shadow-warm transition-all">
              <HugeiconsIcon icon={Layers01Icon} size={19} className="text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-5 bg-card/95 blur-calque border-border/30 shadow-lifted rounded-3xl mr-4" align="end">
            <div className="space-y-6">
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground mb-4">Type de carte</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.entries(MAP_STYLES) as [StyleKey, any][]).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => setCurrentStyle(key)}
                      className="flex flex-col items-center gap-2 transition-all group"
                    >
                      <div className={`w-full aspect-square rounded-[1rem] overflow-hidden border-2 transition-all ${
                        currentStyle === key ? "border-primary shadow-soft" : "border-transparent shadow-subtle group-hover:border-border"
                      }`}>
                        <img src={style.thumbnail} alt={style.name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`text-[10px] font-medium ${currentStyle === key ? "text-primary font-semibold" : "text-muted-foreground/70 group-hover:text-foreground"}`}>
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground mb-4">Détails de la carte</h3>
                <div className="grid grid-cols-4 gap-2">
                  <LayerOption icon={ViewIcon} label="3D" active={show3D} onClick={() => setShow3D(!show3D)} />
                  <LayerOption
                    icon={Alert02Icon}
                    label="Risques"
                    active={activeLayer === "quakes" || activeLayer === "risks"}
                    onClick={() => onLayerChange?.(activeLayer === "quakes" || activeLayer === "risks" ? "none" : "quakes")}
                  />
                  <LayerOption
                    icon={Leaf01Icon}
                    label="Nature"
                    active={activeLayer === "nature"}
                    onClick={() => onLayerChange?.(activeLayer === "nature" ? "none" : "nature")}
                  />
                  <LayerOption icon={Navigation03Icon} label="Trafic" active={false} onClick={() => {}} />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <style>{`
        .maplibregl-ctrl-group {
          border-radius: 16px !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03) !important;
          padding: 2px !important;
          background: rgba(255, 255, 255, 0.92) !important;
          backdrop-filter: blur(3px) !important;
        }
        .maplibregl-ctrl-group button {
          width: 34px !important;
          height: 34px !important;
          border-radius: 12px !important;
        }
        .dark .maplibregl-ctrl-group {
          background: rgba(25, 25, 30, 0.92) !important;
          border-color: rgba(255,255,255,0.06) !important;
        }
        .atlas-category-marker span {
          line-height: 1;
          transform: translateY(1px);
        }
        .atlas-landmark-marker img {
          display: block;
        }
      `}</style>
    </div>
  );
}

function getCategoryMarkerGlyph(category: string) {
  switch (category) {
    case "Parc":
      return "🌲";
    case "Musée":
      return "🏛️";
    case "Restaurant":
      return "☕";
    case "Hôtel":
      return "🛏️";
    case "Transport":
      return "🚇";
    case "Hôpital":
    case "Pharmacie":
      return "🆘";
    default:
      return "•";
  }
}

function LayerOption({ icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 transition-all group"
    >
      <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center border-2 transition-all ${
        active 
          ? "bg-primary/5 border-primary text-primary shadow-soft" 
          : "bg-muted/40 border-transparent text-muted-foreground group-hover:bg-muted/60 group-hover:border-border/30"
      }`}>
        <HugeiconsIcon icon={icon} size={20} />
      </div>
      <span className={`text-[9px] font-medium truncate w-full text-center ${active ? "text-primary font-semibold" : "text-muted-foreground/70 group-hover:text-foreground"}`}>
        {label}
      </span>
    </button>
  );
}
