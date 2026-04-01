import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import type { WeatherData } from "@/lib/weather";
import { getWeatherDescription, getWindDirection } from "@/lib/weather";
import { generateNarrative } from "@/lib/narrative";
import {
  fetchWikipediaSummary, fetchWikimediaPhotos, fetchCountryInfo,
  fetchNearbyPOIs, fetchEarthquakes, fetchGBIFSpecies, fetchEONETEvents, fetchINaturalistSpecies,
  fetchReliefWebDisasters, fetchOpenFEMADeclarations, fetchCityBikes,
  getNavigationOptions,
  type WikiSummary, type WikimediaPhoto, type CountryInfo,
  type NearbyPOI, type Earthquake, type GBIFSpecies, type NaturalEvent, type BikeStation,
} from "@/lib/enrichment";
import NarrativeCard from "./NarrativeCard";
import HourlyForecast from "./HourlyForecast";
import DailyForecast from "./DailyForecast";
import StoryCarousel from "./StoryCarousel";
import GaugeArc from "./GaugeArc";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Image01Icon, BookOpen01Icon, Globe02Icon, Location01Icon, 
  CallIcon, Navigation03Icon, Share01Icon, Bookmark02Icon, 
  ArrowRight01Icon, Leaf01Icon, Alert02Icon, SparklesIcon, VolumeHighIcon,
  FastWindIcon, DropletIcon, Sun03Icon, Cancel01Icon
} from "@hugeicons/core-free-icons";
import { detectSituations, calculateModuleWeights, type SituationTrait } from "@/lib/priorities";

interface LocationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weather: WeatherData | null;
  locationName: string;
  lat: number;
  lon: number;
  onLayerSelect?: (layer: "none" | "quakes" | "nature", data?: any) => void;
  onTraitsChange?: (traits: Set<SituationTrait>) => void;
  onPhotosLoaded?: (photos: WikimediaPhoto[]) => void;
  zoomLevel?: number;
}

type TabId = "explore" | "meteo" | "autour";

export default function LocationDrawer({ open, onOpenChange, weather, locationName, lat, lon, onLayerSelect, onTraitsChange, onPhotosLoaded, zoomLevel }: LocationDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("explore");
  const [wiki, setWiki] = useState<WikiSummary | null>(null);
  const [photos, setPhotos] = useState<WikimediaPhoto[]>([]);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [pois, setPois] = useState<NearbyPOI[]>([]);
  const [quakes, setQuakes] = useState<Earthquake[]>([]);
  const [species, setSpecies] = useState<GBIFSpecies[]>([]);
  const [naturalEvents, setNaturalEvents] = useState<NaturalEvent[]>([]);
  const [bikeStations, setBikeStations] = useState<BikeStation[]>([]);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [traits, setTraits] = useState<Set<SituationTrait>>(new Set());

  const narrative = useMemo(
    () => (weather ? generateNarrative(weather, locationName, traits) : []),
    [weather, locationName, traits]
  );

  useEffect(() => {
    if (!open || !lat) return;
    setEnrichLoading(true);
    setWiki(null);
    setPhotos([]);
    setCountry(null);
    setPois([]);
    setQuakes([]);
    setSpecies([]);
    setNaturalEvents([]);
    setBikeStations([]);
    setActiveTab("explore");

    // 1. Lance les requêtes de manière asynchrone sans bloquer le UI
    fetchWikipediaSummary(lat, lon, locationName).then(w => { if(w) setWiki(w); });
    fetchWikimediaPhotos(lat, lon, 6).then(p => { if(p.length > 0) { setPhotos(p); onPhotosLoaded?.(p); }});
    fetchCountryInfo(lat, lon).then(c => { 
      if(c) {
        setCountry(c);
        // Cascading fetches dependent on country code (ReliefWeb, FEMA)
        const code = c.tld.replace('.', '').toUpperCase() || "FR"; // Approximatif, idéalement on aurait le cca2
        fetchReliefWebDisasters(lat, lon, code).then(e => { if(e.length > 0) setNaturalEvents(prev => [...prev, ...e]); });
        fetchOpenFEMADeclarations(lat, lon, code).then(e => { if(e.length > 0) setNaturalEvents(prev => [...prev, ...e]); });
      }
    });
    fetchNearbyPOIs(lat, lon, 2000).then(p => { if(p.length > 0) setPois(p); });
    fetchCityBikes(lat, lon, 2000).then(b => { if(b.length > 0) setBikeStations(b); });
    fetchEarthquakes(lat, lon, 300, 30).then(q => { if(q.length > 0) setQuakes(q); });
    fetchGBIFSpecies(lat, lon).then(s => { if(s.length > 0) setSpecies(prev => { const map = new Map([...prev, ...s].map(x => [x.scientificName, x])); return Array.from(map.values()); }); });
    fetchINaturalistSpecies(lat, lon).then(s => { if(s.length > 0) setSpecies(prev => { const map = new Map([...prev, ...s].map(x => [x.scientificName, x])); return Array.from(map.values()); }); });
    fetchEONETEvents(lat, lon, 500).then(e => { if(e.length > 0) setNaturalEvents(prev => [...prev, ...e]); });

    // 2. Met à jour les traits (intelligence situationnelle) une fois l'essentiel chargé
    Promise.allSettled([
      fetchWikipediaSummary(lat, lon, locationName),
      fetchNearbyPOIs(lat, lon, 2000),
      fetchEarthquakes(lat, lon, 300, 30),
    ]).then((results) => {
      const wp = results[0].status === 'fulfilled' ? results[0].value : null;
      const cp = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
      const eq = results[2].status === 'fulfilled' ? (results[2].value || []) : [];
      
      const newTraits = detectSituations({
        locationName,
        weather,
        pois: cp,
        quakes: eq,
        wiki: wp,
        zoomLevel,
        poiCount: cp.length,
      });
      setTraits(newTraits);
      onTraitsChange?.(newTraits);
      setEnrichLoading(false); // Le Skeleton disparaît ici, mais les données visuelles sont déjà entrain d'apparaître
    }).catch(() => setEnrichLoading(false));
  }, [open, lat, lon, locationName, weather, zoomLevel]);

  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  if (!weather) return null;

  const { current } = weather;

  const speakAura = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `
      ${locationName}. 
      Actuellement ${current.temperature} degrés. ${getWeatherDescription(current.weatherCode)}. 
      ${traits.has("VITAL") ? "C'est une zone avec services et assistance." : ""}
      ${traits.has("WILD") ? "Vous êtes dans un environnement naturel." : ""}
      ${wiki?.extract ? wiki.extract.slice(0, 160) : ""}
    `;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92vh] outline-none bg-background">
        {/* Back button for sub-tabs */}
        {activeTab !== 'explore' && (
          <div className="absolute top-4 left-4 z-10">
            <button 
              onClick={() => {
                setActiveTab('explore');
                onLayerSelect?.('none');
              }}
              className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-foreground bg-card blur-calque px-3 py-2 rounded-2xl border border-border/40 shadow-soft hover:bg-secondary transition-all"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="rotate-180" />
              Retour
            </button>
          </div>
        )}

        <DrawerHeader className={`pb-0 px-5 relative transition-all duration-300 ${activeTab !== 'explore' ? 'pt-14' : ''}`}>
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="min-w-0">
              <DrawerTitle className="font-serif text-3xl text-foreground truncate tracking-tight">
                {locationName}
              </DrawerTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-[10px] font-mono text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-lg">
                  {lat.toFixed(4)}, {lon.toFixed(4)}
                </p>
                <button 
                  onClick={speakAura}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all text-[9px] uppercase tracking-widest font-medium ${
                    isSpeaking 
                      ? 'bg-primary border-primary text-primary-foreground animate-soft-pulse' 
                      : 'bg-card border-border/40 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <HugeiconsIcon icon={VolumeHighIcon} size={10} />
                  {isSpeaking ? "Pause" : "Audio"}
                </button>
              </div>
            </div>
            <DrawerClose 
              className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors shrink-0" 
              onClick={() => onLayerSelect?.('none')}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-muted-foreground" />
            </DrawerClose>
          </div>

          <p className="text-xs text-muted-foreground mt-1.5 italic">
            {getWeatherDescription(current.weatherCode)}
            {country && ` — ${country.subregion || country.region || country.name}`}
          </p>
        </DrawerHeader>

        {/* ─── Temperature Hero + Perspective side by side ─── */}
        <div className={`transition-all duration-300 overflow-hidden ${activeTab === 'explore' ? 'opacity-100 max-h-[180px]' : 'opacity-0 max-h-0'}`}>
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-start gap-4">
              {/* Left: Temperature */}
              <div className="shrink-0">
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-serif tracking-tighter leading-none">{Math.round(current.temperature)}</span>
                  <span className="text-lg text-muted-foreground font-serif mb-1">°C</span>
                </div>
                <div className="flex flex-col gap-1 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={Sun03Icon} size={10} className="text-muted-foreground/60" />
                    Ressenti {current.apparentTemperature.toFixed(0)}°
                  </span>
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={DropletIcon} size={10} className="text-muted-foreground/60" />
                    {current.humidity}%
                  </span>
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon icon={FastWindIcon} size={10} className="text-muted-foreground/60" />
                    {current.windSpeed.toFixed(0)} km/h
                  </span>
                </div>
              </div>

              {/* Right: Top 2 narrative insights */}
              <div className="flex-1 min-w-0 border-l border-border/20 pl-4">
                {narrative.slice(0, 2).map((insight, i) => (
                  <NarrativeCard key={insight.category + i} insight={insight} index={i} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Action Pills ─── */}
        <div className={`transition-all duration-300 overflow-hidden ${activeTab === 'explore' ? 'opacity-100 max-h-[80px]' : 'opacity-0 max-h-0'}`}>
          <div className="px-5 pb-3 mt-1">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x pb-1">
              {traits.has("VITAL") && (
                <a
                  href="tel:112"
                  className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full border border-pastel-red-text/30 bg-pastel-red-bg px-4 text-[10px] font-bold uppercase tracking-widest text-pastel-red-text animate-soft-pulse shadow-soft"
                >
                  <HugeiconsIcon icon={CallIcon} size={13} />
                  Appeler (112)
                </a>
              )}
              <NavigationButton lat={lat} lon={lon} locationName={locationName} />
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: locationName,
                      text: `Découvrez ${locationName} sur Atlas Nav.`,
                      url: window.location.href,
                    }).catch(() => {});
                  }
                }}
                className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full border border-border/40 bg-card px-4 text-[10px] font-medium uppercase tracking-widest text-foreground hover:bg-secondary transition-all"
              >
                <HugeiconsIcon icon={Share01Icon} size={13} />
                Partager
              </button>
              <button className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full border border-border/40 bg-card px-4 text-[10px] font-medium uppercase tracking-widest text-foreground hover:bg-secondary transition-all">
                <HugeiconsIcon icon={Bookmark02Icon} size={13} />
                Sauver
              </button>
            </div>
          </div>
        </div>

        {/* ─── Tab Content ─── */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {activeTab === "explore" && (
            <ExploreTab
              wiki={wiki}
              photos={photos}
              country={country}
              pois={pois}
              quakes={quakes}
              species={species}
              naturalEvents={naturalEvents}
              bikeStations={bikeStations}
              lat={lat}
              lon={lon}
              locationName={locationName}
              loading={enrichLoading}
              setActiveTab={setActiveTab}
              weather={weather}
              narrative={narrative}
              traits={traits}
              onLayerSelect={onLayerSelect}
            />
          )}
          {activeTab === "meteo" && (
            <MeteoTab weather={weather} />
          )}
          {activeTab === "autour" && (
            <AutourTab
              pois={pois}
              bikeStations={bikeStations}
              loading={enrichLoading}
              lat={lat}
              lon={lon}
              traits={traits}
              locationName={locationName}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Navigation Button with app picker ──────────────────────────────
function NavigationButton({ lat, lon, locationName }: { lat: number; lon: number; locationName: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const options = getNavigationOptions(lat, lon, locationName);
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full px-4 text-[10px] font-medium uppercase tracking-widest transition-all bg-primary text-primary-foreground hover:opacity-90"
      >
        <HugeiconsIcon icon={Navigation03Icon} size={13} />
        Itinéraire
      </button>
      {showPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
          <div className="absolute top-full left-0 mt-2 z-50 bg-card border border-border/40 rounded-2xl shadow-warm overflow-hidden min-w-[160px] animate-fade-in-up">
            {options.map((opt) => (
              <a
                key={opt.label}
                href={opt.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowPicker(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0"
              >
                <HugeiconsIcon icon={Navigation03Icon} size={11} className="text-muted-foreground/60" />
                {opt.label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Météo Tab ───────────────────────────────────────────────────────
function MeteoTab({ weather }: { weather: WeatherData }) {
  const { current } = weather;
  return (
    <div className="pb-8 animate-fade-in-up px-5">
      {/* Hourly — compact list with mini bars */}
      <Section title="Prochaines heures" className="pt-4">
        <HourlyForecast hourly={weather.hourly} />
      </Section>

      {/* Daily */}
      <Section title="7 prochains jours">
        <DailyForecast daily={weather.daily} />
      </Section>

      {/* Gauges */}
      <Section title="Qualité de l'environnement">
        <div className="flex justify-around items-end mt-2 mb-2">
          <GaugeArc 
            value={current.uvIndex} min={0} max={11} label="Index UV" size={120}
            colorStops={[
              { offset: "0%", color: "#93b399" },
              { offset: "50%", color: "#e6c875" },
              { offset: "100%", color: "#d9a0a0" }
            ]}
          />
          {weather.airQuality && (
            <GaugeArc 
              value={weather.airQuality.aqi} min={0} max={100} label="AQI" size={120}
              colorStops={[
                { offset: "0%", color: "#93b399" },
                { offset: "50%", color: "#e6c875" },
                { offset: "100%", color: "#d9a0a0" }
              ]}
            />
          )}
        </div>
      </Section>

      {/* Metrics */}
      <Section title="Données détaillées">
        <div className="grid grid-cols-3 gap-px bg-border/20 rounded-xl overflow-hidden mt-2">
          <MetricCell label="Pression" value={`${current.pressure.toFixed(0)} hPa`} />
          <MetricCell label="Visibilité" value={`${(current.visibility / 1000).toFixed(1)} km`} />
          <MetricCell label="Rosée" value={`${current.dewPoint.toFixed(1)}°`} />
          <MetricCell label="Nuages" value={`${current.cloudCover}%`} />
          <MetricCell label="Altitude" value={`${weather.elevation.toFixed(0)}m`} />
          <MetricCell label="UV" value={current.uvIndex.toFixed(1)} />
          {weather.airQuality && (
            <>
              <MetricCell label="PM2.5" value={`${weather.airQuality.pm25.toFixed(1)}`} />
              <MetricCell label="PM10" value={`${weather.airQuality.pm10.toFixed(1)}`} />
              <MetricCell label="NO₂" value={`${weather.airQuality.no2.toFixed(1)}`} />
              <MetricCell label="O₃" value={`${weather.airQuality.o3.toFixed(1)}`} />
              <MetricCell label="SO₂" value={`${weather.airQuality.so2.toFixed(1)}`} />
            </>
          )}
        </div>
      </Section>

      {/* Ephemeris */}
      <Section title="Éphémérides">
        <div className="flex gap-6 text-sm text-muted-foreground">
          <div>
            <span className="text-[10px] uppercase tracking-widest block mb-1 text-muted-foreground/60">Lever</span>
            <span className="text-foreground font-mono">{formatTime(weather.daily.sunrise[0])}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest block mb-1 text-muted-foreground/60">Coucher</span>
            <span className="text-foreground font-mono">{formatTime(weather.daily.sunset[0])}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ─── Explorer Tab ────────────────────────────────────────────────────
function ExploreTab({
  wiki, photos, country, pois, quakes, species, naturalEvents, bikeStations, lat, lon, locationName, loading, setActiveTab, weather, narrative, traits, onLayerSelect
}: {
  wiki: WikiSummary | null;
  photos: WikimediaPhoto[];
  country: CountryInfo | null;
  pois: NearbyPOI[];
  quakes: Earthquake[];
  species: GBIFSpecies[];
  naturalEvents: NaturalEvent[];
  bikeStations: BikeStation[];
  lat: number;
  lon: number;
  locationName: string;
  loading: boolean;
  setActiveTab: (tab: TabId) => void;
  weather: WeatherData;
  narrative: any[];
  traits: Set<SituationTrait>;
  onLayerSelect?: (layer: "none" | "quakes" | "nature", data?: any) => void;
}) {
  const priorities = useMemo(() => calculateModuleWeights(traits), [traits]);

  if (loading) return (
    <div className="px-5 py-6 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex gap-4">
        <div className="h-16 w-16 bg-muted/60 rounded-2xl shrink-0" />
        <div className="space-y-3 flex-1 pt-1">
          <div className="h-4 w-1/3 bg-muted rounded-full" />
          <div className="h-3 w-1/2 bg-muted/60 rounded-full" />
        </div>
      </div>
      
      {/* Story skeleton */}
      <div className="h-40 w-full bg-muted/40 rounded-2xl" />
      
      {/* Modules skeleton */}
      <div className="space-y-4">
        <div className="h-3 w-1/4 bg-muted rounded-full" />
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-24 bg-muted/50 rounded-xl col-span-2 row-span-2" />
          <div className="h-11 bg-muted/50 rounded-xl" />
          <div className="h-11 bg-muted/50 rounded-xl" />
        </div>
      </div>
      
      {/* List skeleton */}
      <div className="space-y-3 pt-2 border-t border-border/10">
        <div className="h-10 bg-muted/30 rounded-xl w-full" />
        <div className="h-10 bg-muted/30 rounded-xl w-full" />
        <div className="h-10 bg-muted/30 rounded-xl w-full" />
      </div>
    </div>
  );

  return (
    <div className="pb-10">
      {/* ─── Situation Badges ─── */}
      <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5">
        {traits.has("VITAL") && (
          <span className="bg-pastel-red-bg text-pastel-red-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pastel-red-text animate-soft-pulse" />
            Assistance
          </span>
        )}
        {traits.has("WILD") && (
          <span className="bg-pastel-green-bg text-pastel-green-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <HugeiconsIcon icon={Leaf01Icon} size={10} />
            Zone Sauvage
          </span>
        )}
        {quakes.length > 0 && Math.max(...quakes.map(q => q.magnitude)) >= 3 && (
          <span className="bg-pastel-yellow-bg text-pastel-yellow-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <HugeiconsIcon icon={Alert02Icon} size={10} />
            Sismique
          </span>
        )}
        {weather.current.temperature > 30 && (
          <span className="bg-pastel-yellow-bg text-pastel-yellow-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <HugeiconsIcon icon={SparklesIcon} size={10} />
            Chaleur
          </span>
        )}
        {!wiki && pois.length === 0 && (
          <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <HugeiconsIcon icon={Globe02Icon} size={10} />
            Hors-Piste
          </span>
        )}
      </div>

      {priorities.map((module) => renderModule(module.id))}
    </div>
  );

  function renderModule(moduleId: string) {
    switch (moduleId) {
      case "narrative":
        return (
          <div key="narrative" className="px-5 pt-4">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle className="mb-0">Perspective</SectionTitle>
              <button 
                onClick={() => setActiveTab('meteo')}
                className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-full"
              >
                Météo détaillée
                <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              </button>
            </div>
            {/* Show remaining insights (first 2 are in header) */}
            {narrative.slice(2).length > 0 && (
              <div className="border-t border-border/15 pt-2">
                {narrative.slice(2).map((insight, i) => (
                  <NarrativeCard key={insight.category + i} insight={insight} index={i} />
                ))}
              </div>
            )}
          </div>
        );
      
      case "story":
        return (
          <div key="story" className="pt-4">
            <StoryCarousel 
              quakes={quakes} 
              species={species} 
              wiki={wiki} 
              naturalEvents={naturalEvents}
              onSelectStory={(id) => {
                if (id === 'nature' && onLayerSelect) onLayerSelect('nature', species);
                if (id === 'quakes' && onLayerSelect) onLayerSelect('quakes', quakes);
                if (id === 'risks' && onLayerSelect) onLayerSelect('quakes', naturalEvents);
              }} 
            />
          </div>
        );

      case "isolated_brief": {
        const isActuallyIsolated = pois.length === 0 && !wiki && !country && photos.length === 0 && species.length === 0 && quakes.length === 0;
        if (!isActuallyIsolated) return null;
        
        return (
          <div key="isolated_brief" className="px-5 pt-4 animate-fade-in-up">
            <div className="rounded-2xl p-6 text-center border border-border/15">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-muted/30 rounded-full flex items-center justify-center border border-border/20 mb-4">
                  <HugeiconsIcon icon={Globe02Icon} size={24} className="text-muted-foreground" />
                </div>
                <h3 className="font-serif text-xl text-foreground mb-2">L'essentiel du lieu</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto mb-4">
                  Ce point est déconnecté des infrastructures humaines.
                </p>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">Silence</p>
                    <p className="text-sm font-mono text-foreground">95-100%</p>
                  </div>
                  <div className="w-px h-8 bg-border/30" />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">Pollution</p>
                    <p className="text-sm font-mono text-foreground">0.0%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "photos":
        return photos.length > 0 ? (
          <div key="photos" className="px-5 pt-4 animate-fade-in-up">
            <SectionTitle icon={Image01Icon}>Documentation</SectionTitle>
            <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
              {photos.slice(0, 1).map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="col-span-2 row-span-2 block relative group rounded-xl overflow-hidden">
                  <img src={p.thumbUrl} alt={p.title} className="w-full h-full min-h-[120px] object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
              {photos.slice(1, 3).map((p, i) => (
                <a key={i+1} href={p.url} target="_blank" rel="noopener noreferrer" className="block relative group rounded-xl overflow-hidden">
                  <img src={p.thumbUrl} alt={p.title} className="w-full h-[58px] object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                </a>
              ))}
            </div>
            {photos.length > 3 && (
              <div className="grid grid-cols-3 gap-1 mt-1">
                {photos.slice(3, 6).map((p, i) => (
                  <a key={i+3} href={p.url} target="_blank" rel="noopener noreferrer" className="block relative group rounded-xl overflow-hidden">
                    <img src={p.thumbUrl} alt={p.title} className="w-full h-16 object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : null;

      case "wiki_brief":
        return wiki ? (
          <div key="wiki_brief" className="px-5 pt-4 animate-fade-in-up">
            <SectionTitle icon={BookOpen01Icon}>Synthèse Culturelle</SectionTitle>
            {/* Integrated layout — photo banner + content flow */}
            {wiki.thumbnail && (
              <div className="relative rounded-xl overflow-hidden mb-3 h-[120px]">
                <img src={wiki.thumbnail} alt={wiki.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-3">
                  <h3 className="text-sm font-serif text-foreground">{wiki.title}</h3>
                  {wiki.description && (
                    <p className="text-[10px] text-muted-foreground/70">{wiki.description}</p>
                  )}
                </div>
              </div>
            )}
            {!wiki.thumbnail && (
              <div className="mb-2">
                <h3 className="text-sm font-medium text-foreground">{wiki.title}</h3>
                {wiki.description && (
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{wiki.description}</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{wiki.extract}</p>
            
            {/* Facts inline row */}
            {wiki.facts && Object.keys(wiki.facts).length > 0 && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-border/15">
                {wiki.facts.population && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Population</p>
                    <p className="text-sm font-mono text-foreground">{formatPopulation(wiki.facts.population)}</p>
                  </div>
                )}
                {wiki.facts.area && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Superficie</p>
                    <p className="text-sm font-mono text-foreground">{wiki.facts.area.toLocaleString("fr-FR")} km²</p>
                  </div>
                )}
                {wiki.facts.elevation && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Altitude</p>
                    <p className="text-sm font-mono text-foreground">{wiki.facts.elevation} m</p>
                  </div>
                )}
              </div>
            )}

            {wiki.url && (
              <a href={wiki.url} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Lire la suite
                <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              </a>
            )}
          </div>
        ) : null;

      case "events_brief":
        return naturalEvents.length > 0 ? (
          <div key="events_brief" className="px-5 pt-4 animate-fade-in-up">
            <SectionTitle icon={Alert02Icon}>Alertes & Crises</SectionTitle>
            <div className="space-y-px">
              {naturalEvents.map((evt, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/15 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground mb-0.5">{evt.title}</p>
                    <div className="flex gap-2">
                      <span className="text-[10px] text-pastel-red-text uppercase tracking-widest">{evt.category}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">({evt.source})</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-pastel-red-text ml-3 shrink-0">
                    {evt.distanceKm > 0 ? `${evt.distanceKm} km` : "National"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null;

      case "country":
        return country ? (
          <div key="country" className="px-5 pt-4 animate-fade-in-up">
            <SectionTitle icon={Globe02Icon}>Identité culturelle</SectionTitle>
            <div className="flex items-start gap-3 mb-3">
              {country.flag && (
                <img src={country.flag} alt={country.name} className="w-10 h-7 rounded object-cover border border-border/30" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{country.name}</p>
                {country.nativeName && country.nativeName !== country.name && (
                  <p className="text-xs text-muted-foreground/70 italic">{country.nativeName}</p>
                )}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <InfoRow label="Langue" value={country.languages.join(", ")} />
              <InfoRow label="Devises" value={country.currencies.map((c) => `${c.name} (${c.symbol})`).join(", ")} />
              <InfoRow label="Capitale" value={country.capital} />
              <InfoRow label="Population" value={formatPopulation(country.population)} />
              <InfoRow label="Superficie" value={`${country.area.toLocaleString("fr-FR")} km²`} />
              <InfoRow label="Région" value={`${country.subregion || country.region}`} />
              <InfoRow label="Fuseau" value={country.timezones[0] || ""} />
              {country.emergency && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                    <HugeiconsIcon icon={CallIcon} size={10} />
                    Numéros d'urgence
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-pastel-red-bg/30 rounded-xl px-2.5 py-1.5 flex justify-between items-center">
                      <span className="text-[10px] text-pastel-red-text">Général</span>
                      <span className="text-sm font-mono font-semibold text-pastel-red-text">{country.emergency.all}</span>
                    </div>
                    {country.emergency.police && (
                      <div className="bg-muted/30 rounded-xl px-2.5 py-1.5 flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground">Police</span>
                        <span className="text-sm font-mono text-foreground">{country.emergency.police}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null;

      case "pois":
        return pois.length > 0 || bikeStations.length > 0 ? (
          <div key="pois" className="px-5 pt-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <SectionTitle icon={Location01Icon} className="mb-0">
                Proximité{traits.has("VITAL") ? " & Aide" : ""}
              </SectionTitle>
              <button
                onClick={() => setActiveTab("autour")}
                className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-full"
              >
                Tout voir
                <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              </button>
            </div>
            <div className="border-t border-border/15">
              {/* Combine POIs and BikeStations, sort by distance, take top 5 */}
              {[...pois, ...bikeStations.map(b => ({ name: b.name, category: "Vélos", distance: b.distance, isBike: true, free_bikes: b.free_bikes }))]
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5)
                .map((poi: any, i) => (
                <div key={i} className={`flex items-center justify-between py-2.5 border-b border-border/15 last:border-0 ${poi.category === 'Hôpital' || poi.category === 'Pharmacie' ? 'bg-pastel-red-bg/10' : ''}`}>
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider mt-0.5 ${
                      poi.category === 'Hôpital' || poi.category === 'Pharmacie' 
                        ? 'bg-pastel-red-bg text-pastel-red-text font-semibold' 
                        : poi.isBike
                          ? 'bg-pastel-blue-bg text-pastel-blue-text font-semibold'
                          : 'bg-muted/40 text-muted-foreground'
                    }`}>
                      {poi.category}
                    </span>
                    <span className="text-sm text-foreground truncate">
                      {poi.name}
                      {poi.isBike && <span className="ml-2 text-[10px] text-muted-foreground">({poi.free_bikes} dispos)</span>}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/60 ml-2 shrink-0">
                    {poi.distance < 1000 ? `${poi.distance}m` : `${(poi.distance / 1000).toFixed(1)}km`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null;

      case "nature_brief":
        return species.length > 0 ? (
          <div key="nature_brief" className="px-5 pt-4 animate-fade-in-up">
            <SectionTitle icon={Leaf01Icon}>Biodiversité</SectionTitle>
            <p className="text-sm text-foreground leading-relaxed">
              <strong className="font-mono text-pastel-green-text">{species.length} espèces</strong> répertoriées.
              {species[0] && ` Principale : ${species[0].vernacularName || species[0].scientificName} (${species[0].count} obs.).`}
            </p>
            <button
              onClick={() => onLayerSelect?.('nature', species)}
              className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-pastel-green-text hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={Location01Icon} size={11} />
              Voir sur la carte
            </button>
          </div>
        ) : null;

      case "quakes_brief": {
        if (quakes.length === 0) return null;
        const maxMag = Math.max(...quakes.map(q => q.magnitude));
        return (
          <div key="quakes_brief" className="px-5 pt-4 animate-fade-in-up">
            <SectionTitle icon={Alert02Icon}>Activité sismique</SectionTitle>
            <p className="text-sm text-foreground leading-relaxed">
              <strong className="font-mono text-pastel-red-text">{quakes.length} secousses</strong> (30j, 300km).
              Max : <strong className="font-mono text-pastel-red-text">M{maxMag.toFixed(1)}</strong>.
            </p>
            <button
              onClick={() => onLayerSelect?.('quakes', quakes)}
              className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-pastel-red-text hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={Location01Icon} size={11} />
              Voir sur la carte
            </button>
          </div>
        );
      }

      case "navigation":
        return (
          <div key="navigation" className="px-5 pt-4 pb-4 animate-fade-in-up">
            <SectionTitle icon={Navigation03Icon}>Navigation</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              {getNavigationOptions(lat, lon, locationName).map((opt) => (
                <a key={opt.label} href={opt.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border/20 px-3 py-2.5 text-[11px] font-medium text-foreground hover:bg-muted/30 transition-all"
                >
                  {opt.label}
                </a>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pb-8">
        {loading ? (
          <div className="px-5 py-6 space-y-8 animate-pulse">
            {/* Header skeleton */}
            <div className="flex gap-4">
              <div className="h-16 w-16 bg-muted/60 rounded-2xl shrink-0" />
              <div className="space-y-3 flex-1 pt-1">
                <div className="h-4 w-1/3 bg-muted rounded-full" />
                <div className="h-3 w-1/2 bg-muted/60 rounded-full" />
              </div>
            </div>
            
            {/* Story skeleton */}
            <div className="h-40 w-full bg-muted/40 rounded-2xl" />
            
            {/* Modules skeleton */}
            <div className="space-y-4">
              <div className="h-3 w-1/4 bg-muted rounded-full" />
              <div className="grid grid-cols-3 gap-1.5">
                <div className="h-24 bg-muted/50 rounded-xl col-span-2 row-span-2" />
                <div className="h-11 bg-muted/50 rounded-xl" />
                <div className="h-11 bg-muted/50 rounded-xl" />
              </div>
            </div>
            
            {/* List skeleton */}
            <div className="space-y-3 pt-2 border-t border-border/10">
              <div className="h-10 bg-muted/30 rounded-xl w-full" />
              <div className="h-10 bg-muted/30 rounded-xl w-full" />
              <div className="h-10 bg-muted/30 rounded-xl w-full" />
            </div>
          </div>
        ) : (
          priorities.map((p) => renderModule(p.id))
        )}
    </div>
  );
}

// ─── Autour Tab ──────────────────────────────────────────────────────
const POI_CATEGORIES = [
  { key: "all", label: "Tout" },
  { key: "Restaurant", label: "Restaurants" },
  { key: "Hôtel", label: "Hôtels" },
  { key: "Commerce", label: "Commerces" },
  { key: "Musée", label: "Culture" },
  { key: "Transport", label: "Transports" },
  { key: "Hôpital", label: "Santé" },
  { key: "Pharmacie", label: "Santé" },
  { key: "other", label: "Autres" },
];

function AutourTab({ pois, bikeStations, loading, lat, lon, traits, locationName }: {
  pois: NearbyPOI[];
  bikeStations: BikeStation[];
  loading: boolean;
  lat: number;
  lon: number;
  traits: Set<SituationTrait>;
  locationName: string;
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const combinedData = useMemo(() => {
    return [
      ...pois,
      ...bikeStations.map(b => ({
        name: b.name,
        category: "Vélos",
        type: "vélos",
        distance: b.distance,
        lat: b.lat,
        lon: b.lon,
        isBike: true,
        free_bikes: b.free_bikes
      }))
    ].sort((a, b) => a.distance - b.distance);
  }, [pois, bikeStations]);

  const availableCategories = useMemo(() => {
    const cats = new Set(combinedData.map(p => p.category));
    const chips = [{ key: "all", label: "Tout" }];
    const seen = new Set<string>();
    
    POI_CATEGORIES.forEach(c => {
      if (c.key === "all" || c.key === "other") return;
      if (cats.has(c.key) && !seen.has(c.label)) {
        chips.push(c);
        seen.add(c.label);
      }
    });
    
    // Add CityBikes category if present
    if (cats.has("Vélos") && !seen.has("Mobilité")) {
      chips.push({ key: "Vélos", label: "Mobilité" });
      seen.add("Mobilité");
    }
    
    const knownCats = new Set([...POI_CATEGORIES.map(c => c.key), "Vélos"]);
    const hasOther = combinedData.some(p => !knownCats.has(p.category));
    if (hasOther) chips.push({ key: "other", label: "Autres" });
    
    return chips;
  }, [combinedData]);

  const filteredPois = useMemo(() => {
    if (activeFilter === "all") return combinedData;
    if (activeFilter === "Vélos") return combinedData.filter(p => p.category === "Vélos");
    if (activeFilter === "other") {
      const knownCats = new Set([...POI_CATEGORIES.map(c => c.key), "Vélos"]);
      return combinedData.filter(p => !knownCats.has(p.category));
    }
    const matchingKeys = POI_CATEGORIES
      .filter(c => c.label === POI_CATEGORIES.find(pc => pc.key === activeFilter)?.label)
      .map(c => c.key);
    return combinedData.filter(p => matchingKeys.includes(p.category));
  }, [combinedData, activeFilter]);

  const navOptions = getNavigationOptions(lat, lon, locationName);

  return (
    <div className="pb-8 animate-fade-in-up">
      <div className="px-5 pt-4 pb-4">
        <div className="mb-4">
          <h2 className="text-2xl font-serif mb-1 tracking-tight">Autour de vous</h2>
          <p className="text-xs text-muted-foreground/70">
            {pois.length} lieux dans un rayon de 2 km
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-3 snap-x">
          {availableCategories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveFilter(cat.key)}
              className={`snap-start shrink-0 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-all ${
                activeFilter === cat.key
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "bg-transparent text-muted-foreground border-border/40 hover:bg-muted/50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-0 py-4 animate-pulse border-t border-border/15 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-3.5 border-b border-border/15 last:border-0">
                <div className="flex gap-3 items-center w-full max-w-[200px]">
                  <div className="h-6 w-16 bg-muted/80 rounded-full" />
                  <div className="h-4 w-full bg-muted/50 rounded-full" />
                </div>
                <div className="h-3 w-10 bg-muted/40 rounded-full ml-4" />
              </div>
            ))}
          </div>
        ) : combinedData.length === 0 ? (
          <div className="py-5">
            <p className="text-sm text-foreground">Aucun lieu d'intérêt trouvé.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Essayez un endroit plus peuplé.</p>
          </div>
        ) : filteredPois.length === 0 ? (
          <div className="py-5">
            <p className="text-sm text-foreground">Aucun résultat pour ce filtre.</p>
          </div>
        ) : (
          <div className="border-t border-border/15">
            {filteredPois.map((poi: any, i) => {
              const isEmergency = poi.category === 'Hôpital' || poi.category === 'Pharmacie' || poi.category === 'Police';
              return (
                <a
                  key={i}
                  href={navOptions[0]?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between py-3 border-b border-border/15 last:border-0 hover:bg-muted/20 transition-colors ${
                    isEmergency && traits.has("VITAL") ? 'bg-pastel-red-bg/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider mt-0.5 ${
                      isEmergency
                        ? 'bg-pastel-red-bg text-pastel-red-text font-semibold'
                        : poi.isBike
                          ? 'bg-pastel-blue-bg text-pastel-blue-text font-semibold'
                          : 'bg-muted/40 text-muted-foreground'
                    }`}>
                      {poi.category}
                    </span>
                    <span className="text-sm text-foreground truncate block">
                      {poi.name}
                      {poi.isBike && <span className="ml-2 text-[10px] text-muted-foreground">({poi.free_bikes} dispos)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-mono text-muted-foreground/50">
                      {poi.distance < 1000 ? `${poi.distance}m` : `${(poi.distance / 1000).toFixed(1)}km`}
                    </span>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={11} className="text-muted-foreground/40" />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared primitives ───────────────────────────────────────────────
function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`pt-4 pb-3 ${className || ''}`}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function SectionTitle({ children, icon, className }: { children: React.ReactNode; icon?: any; className?: string }) {
  return (
    <h2 className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 mb-2 ${className || ''}`}>
      {icon && <HugeiconsIcon icon={icon} size={12} className="text-muted-foreground/50" />}
      {children}
    </h2>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-2.5">
      <p className="text-[8px] uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-xs font-mono mt-0.5 text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 shrink-0 w-20">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Mrd`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K`;
  return n.toString();
}
