import { useState, useCallback, useEffect } from "react";
import MapView, { type MapPreviewItem } from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import LocationDrawer from "@/components/LocationDrawer";
import { fetchWeather, type WeatherData } from "@/lib/weather";
import { reverseGeocode, type GeoResult } from "@/lib/geocoder";
import { fetchPOIsByCategory, type NearbyPOI } from "@/lib/enrichment";
import { type SearchIntent } from "@/lib/search-intents";
import { useToast } from "@/hooks/use-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { CompassIcon } from "@hugeicons/core-free-icons";

import type { Earthquake, GBIFSpecies, WikimediaPhoto } from "@/lib/enrichment";
import type { SituationTrait } from "@/lib/priorities";

export default function Index() {
  const { toast } = useToast();
  const [center, setCenter] = useState<[number, number]>([2.3522, 48.8566]);
  const [zoom] = useState(6);
  const [mapZoom, setMapZoom] = useState(6);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState("");
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number }>({ lat: 48.8566, lon: 2.3522 });
  const [activeLayer, setActiveLayer] = useState<"none" | "quakes" | "nature" | "risks">("none");
  const [mapData, setMapData] = useState<{ quakes: Earthquake[], nature: GBIFSpecies[], risks: any[] }>({ quakes: [], nature: [], risks: [] });
  const [traits, setTraits] = useState<Set<SituationTrait>>(new Set());
  const [landmarks, setLandmarks] = useState<WikimediaPhoto[]>([]);
  const [activeIntent, setActiveIntent] = useState<SearchIntent | null>(null);
  const [intentResults, setIntentResults] = useState<NearbyPOI[]>([]);
  const [intentLoading, setIntentLoading] = useState(false);
  const [selectedIntentResult, setSelectedIntentResult] = useState<NearbyPOI | null>(null);
  const [activeMapPreview, setActiveMapPreview] = useState<MapPreviewItem | null>(null);

  const loadWeather = useCallback(async (lat: number, lon: number, name?: string, options?: { keepIntent?: boolean }) => {
    setLoading(true);
    setActiveLayer("none");
    setTraits(new Set());
    setLandmarks([]);
    if (!options?.keepIntent) {
      setActiveIntent(null);
      setIntentResults([]);
      setSelectedIntentResult(null);
      setActiveMapPreview(null);
    }

    try {
      const [data, resolvedName] = await Promise.all([
        fetchWeather(lat, lon),
        name ? Promise.resolve(name) : reverseGeocode(lat, lon),
      ]);
      setWeather(data);
      setLocationName(resolvedName);
      setCenter([lon, lat]);
      setMarkerPos([lon, lat]);
      setSelectedCoords({ lat, lon });
      setDrawerOpen(true);
    } catch (e) {
      console.error("Weather fetch failed:", e);
      toast({
        title: "Impossible de charger les données",
        description: "Le service météo est temporairement indisponible ou vous êtes hors ligne.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleSearchSelect = (result: GeoResult) => {
    loadWeather(result.lat, result.lon, result.name);
  };

  const handleIntentSelect = useCallback(async (intent: SearchIntent) => {
    setIntentLoading(true);
    setActiveIntent(intent);
    setSelectedIntentResult(null);
    setDrawerOpen(true);
    setCenter((prev) => prev);

    const lat = selectedCoords.lat;
    const lon = selectedCoords.lon;

    try {
      const results = await fetchPOIsByCategory(lat, lon, intent.overpassKey, 6000);
      setIntentResults(results);
      setSelectedIntentResult(results[0] || null);
      setActiveMapPreview(
        results[0]
          ? {
              id: `category-${results[0].lat}-${results[0].lon}-${results[0].name}`,
              kind: "category",
              title: results[0].name,
              subtitle: results[0].category,
              coordinates: [results[0].lon, results[0].lat],
            }
          : null
      );
      setLocationName(intent.label);
    } catch (e) {
      console.error("Intent fetch failed:", e);
      toast({
        title: "Impossible de charger cette catégorie",
        description: "La recherche thématique est temporairement indisponible.",
        variant: "destructive",
      });
    } finally {
      setIntentLoading(false);
    }
  }, [selectedCoords.lat, selectedCoords.lon, toast]);

  const handleIntentResultSelect = (poi: NearbyPOI) => {
    setSelectedIntentResult(poi);
    setActiveMapPreview({
      id: `category-${poi.lat}-${poi.lon}-${poi.name}`,
      kind: "category",
      title: poi.name,
      subtitle: poi.category,
      coordinates: [poi.lon, poi.lat],
    });
    loadWeather(poi.lat, poi.lon, poi.name, { keepIntent: true });
  };

  const handleMapClick = (lat: number, lon: number) => {
    loadWeather(lat, lon);
  };

  useEffect(() => {
    if (selectedIntentResult) {
      setActiveMapPreview({
        id: `category-${selectedIntentResult.lat}-${selectedIntentResult.lon}-${selectedIntentResult.name}`,
        kind: "category",
        title: selectedIntentResult.name,
        subtitle: selectedIntentResult.category,
        coordinates: [selectedIntentResult.lon, selectedIntentResult.lat],
      });
    }
  }, [selectedIntentResult]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
      () => {}
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <MapView 
        center={center} 
        zoom={zoom} 
        onMapClick={handleMapClick}
        onZoomChange={setMapZoom}
        markerPosition={markerPos} 
        activeLayer={activeLayer}
        quakesData={mapData.quakes}
        natureData={mapData.nature}
        naturalEventsData={mapData.risks}
        traits={traits}
        landmarks={landmarks}
        categoryResults={intentResults}
        selectedCategoryResult={selectedIntentResult}
        onCategoryResultClick={(poi) => {
          setSelectedIntentResult(poi);
          setActiveMapPreview({
            id: `category-${poi.lat}-${poi.lon}-${poi.name}`,
            kind: "category",
            title: poi.name,
            subtitle: poi.category,
            coordinates: [poi.lon, poi.lat],
          });
          setDrawerOpen(true);
        }}
        onLayerChange={setActiveLayer}
        previewItem={activeMapPreview}
        onPreviewSelect={setActiveMapPreview}
      />

      {/* Search overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-start gap-2 md:right-auto md:w-[400px]">
        <SearchBar onSelect={handleSearchSelect} onIntentSelect={handleIntentSelect} />
        <button
          onClick={handleGeolocate}
          className="shrink-0 flex items-center justify-center w-[42px] h-[42px] rounded-2xl border border-border/30 bg-card/90 blur-calque shadow-soft hover:shadow-warm hover:bg-secondary transition-all"
          title="Ma position"
        >
          <HugeiconsIcon icon={CompassIcon} size={17} className="text-foreground" />
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-16 left-4 z-10 flex items-center gap-2 rounded-2xl border border-border/30 bg-card/90 blur-calque px-3 py-2 shadow-soft">
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
          <span className="text-[11px] text-muted-foreground/60">Chargement...</span>
        </div>
      )}

      {/* Bottom sheet drawer */}
      <LocationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        weather={weather}
        locationName={locationName}
        lat={selectedCoords.lat}
        lon={selectedCoords.lon}
        onLayerSelect={(layer, data) => {
          setActiveLayer(layer);
          if (data) {
            setMapData(prev => ({ ...prev, [layer]: data }));
          }
        }}
        onTraitsChange={setTraits}
        onPhotosLoaded={(photos) => {
          setLandmarks(photos);
          if (!activeIntent && photos[0]) {
            setActiveMapPreview({
              id: "landmark-0",
              kind: "landmark",
              title: photos[0].title,
              subtitle: "Repère visuel",
              imageUrl: photos[0].thumbUrl,
              coordinates: [photos[0].lon, photos[0].lat],
            });
          }
        }}
        zoomLevel={mapZoom}
        categoryIntent={activeIntent}
        categoryResults={intentResults}
        categoryLoading={intentLoading}
        onCategoryResultSelect={handleIntentResultSelect}
        selectedCategoryResult={selectedIntentResult}
        onCategoryHighlight={(poi) => {
          setSelectedIntentResult(poi);
          if (poi) {
            setActiveMapPreview({
              id: `category-${poi.lat}-${poi.lon}-${poi.name}`,
              kind: "category",
              title: poi.name,
              subtitle: poi.category,
              coordinates: [poi.lon, poi.lat],
            });
          }
        }}
      />

      {/* Branding */}
      {!drawerOpen && (
        <div className="absolute bottom-6 left-4 z-10 animate-fade-in-up">
          <div className="rounded-2xl border border-border/30 bg-card/90 blur-calque px-4 py-3 shadow-soft">
            <h2 className="font-serif text-lg tracking-tight">Atlas Nav</h2>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Cliquez sur la carte ou recherchez un lieu</p>
          </div>
        </div>
      )}
    </div>
  );
}
