import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Earthquake, GBIFSpecies, WikimediaPhoto } from "@/lib/enrichment";
import type { SituationTrait } from "@/lib/priorities";
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon, BookOpen01Icon, Alert02Icon, Leaf01Icon, Navigation03Icon, ViewIcon } from "@hugeicons/core-free-icons";

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

export default function MapView({ center, zoom, onMapClick, onZoomChange, markerPosition, activeLayer = "none", quakesData = [], natureData = [], naturalEventsData = [], traits, landmarks = [] }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const landmarksRef = useRef<maplibregl.Marker[]>([]);
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

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Layer Selector */}
      <div className="absolute top-20 right-4 z-20">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center justify-center w-[42px] h-[42px] rounded-2xl border border-border/30 bg-card/90 blur-calque shadow-soft hover:shadow-warm transition-all">
              <HugeiconsIcon icon={Layers01Icon} size={19} className="text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4 bg-card/95 blur-calque border-border/30 shadow-lifted rounded-3xl mr-4" align="end">
            <div className="space-y-5">
              <div>
                <h3 className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 mb-3 px-1">Type de carte</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(MAP_STYLES) as [StyleKey, any][]).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => setCurrentStyle(key)}
                      className={`flex flex-col items-center gap-1.5 p-1 rounded-2xl transition-all ${
                        currentStyle === key ? "bg-muted/60 ring-1 ring-border" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="w-full aspect-square rounded-xl overflow-hidden border border-border/20 shadow-subtle">
                        <img src={style.thumbnail} alt={style.name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`text-[9px] font-medium ${currentStyle === key ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 mb-3 px-1">Détails</h3>
                <div className="grid grid-cols-4 gap-2">
                  <LayerOption icon={ViewIcon} label="3D" active={show3D} onClick={() => setShow3D(!show3D)} />
                  <LayerOption icon={Alert02Icon} label="Risques" active={activeLayer === "quakes"} onClick={() => {}} />
                  <LayerOption icon={Leaf01Icon} label="Nature" active={activeLayer === "nature"} onClick={() => {}} />
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
      `}</style>
    </div>
  );
}

function LayerOption({ icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 transition-all group"
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${
        active 
          ? "bg-primary border-primary text-primary-foreground shadow-soft" 
          : "bg-muted/40 border-border/20 text-muted-foreground group-hover:bg-muted/60"
      }`}>
        <HugeiconsIcon icon={icon} size={17} />
      </div>
      <span className={`text-[8px] font-medium truncate w-full text-center ${active ? "text-foreground font-semibold" : "text-muted-foreground/60"}`}>
        {label}
      </span>
    </button>
  );
}
