import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import type { WeatherData } from "@/lib/weather";
import { getWeatherDescription, getWindDirection } from "@/lib/weather";
import { generateNarrative } from "@/lib/narrative";
import {
  fetchWikipediaSummary, fetchWikimediaPhotos, fetchCountryInfo,
  fetchNearbyPOIs, fetchEarthquakes, fetchGBIFSpecies, fetchEONETEvents, fetchINaturalistSpecies,
  generateGoogleMapsLink, generateAppleMapsLink,
  type WikiSummary, type WikimediaPhoto, type CountryInfo,
  type NearbyPOI, type Earthquake, type GBIFSpecies, type NaturalEvent,
} from "@/lib/enrichment";
import NarrativeCard from "./NarrativeCard";
import HourlyForecast from "./HourlyForecast";
import TemperatureArea from "./TemperatureArea";
import DailyForecast from "./DailyForecast";
import StoryCarousel from "./StoryCarousel";
import GaugeArc from "./GaugeArc";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download01Icon, Image01Icon, BookOpen01Icon, Globe02Icon, Location01Icon, 
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
    setActiveTab("explore");

    Promise.allSettled([
      fetchWikipediaSummary(lat, lon, locationName).then(w => { setWiki(w); return w; }),
      fetchWikimediaPhotos(lat, lon, 6).then(p => { setPhotos(p); return p; }),
      fetchCountryInfo(lat, lon).then(c => { setCountry(c); return c; }),
      fetchNearbyPOIs(lat, lon, 2000).then(p => { setPois(p); return p; }),
      fetchEarthquakes(lat, lon, 300, 30).then(q => { setQuakes(q); return q; }),
      fetchGBIFSpecies(lat, lon).then(s => { setSpecies(prev => [...prev, ...s]); return s; }),
      fetchINaturalistSpecies(lat, lon).then(s => { setSpecies(prev => [...prev, ...s]); return s; }),
      fetchEONETEvents(lat, lon, 500).then(e => { setNaturalEvents(e); return e; }),
    ]).then((results) => {
      const wp = results[0].status === 'fulfilled' ? results[0].value : null;
      const cp = results[3].status === 'fulfilled' ? (results[3].value || []) : [];
      const eq = results[4].status === 'fulfilled' ? (results[4].value || []) : [];
      const pt = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
      
      if (pt.length > 0) onPhotosLoaded?.(pt);

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
    }).finally(() => setEnrichLoading(false));
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
          {/* Location name + close */}
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

          {/* Weather description */}
          <p className="text-xs text-muted-foreground mt-1.5 italic">
            {getWeatherDescription(current.weatherCode)}
            {country && ` — ${country.subregion || country.region || country.name}`}
          </p>
        </DrawerHeader>

        {/* ─── Temperature Hero ─── */}
        <div className={`transition-all duration-300 overflow-hidden ${activeTab === 'explore' ? 'opacity-100 max-h-[120px]' : 'opacity-0 max-h-0'}`}>
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-end gap-1.5">
              <span className="text-6xl font-serif tracking-tighter leading-none">{Math.round(current.temperature)}</span>
              <span className="text-xl text-muted-foreground font-serif mb-1.5">°C</span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Sun03Icon} size={11} className="text-muted-foreground/60" />
                Ressenti {current.apparentTemperature.toFixed(1)}°
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={DropletIcon} size={11} className="text-muted-foreground/60" />
                {current.humidity}%
              </span>
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={FastWindIcon} size={11} className="text-muted-foreground/60" />
                {current.windSpeed.toFixed(0)} km/h {getWindDirection(current.windDirection)}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Action Pills ─── */}
        <div className={`transition-all duration-300 overflow-hidden ${activeTab === 'explore' ? 'opacity-100 max-h-[80px]' : 'opacity-0 max-h-0'}`}>
          <div className="px-5 pb-4 mt-1">
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
              <a
                href={generateGoogleMapsLink(lat, lon)}
                target="_blank"
                rel="noopener noreferrer"
                className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full px-4 text-[10px] font-medium uppercase tracking-widest transition-all shadow-soft bg-primary text-primary-foreground hover:opacity-90"
              >
                <HugeiconsIcon icon={Navigation03Icon} size={13} />
                Itinéraire
              </a>
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
                className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full border border-border/40 bg-card px-4 text-[10px] font-medium uppercase tracking-widest text-foreground hover:bg-secondary transition-all shadow-subtle"
              >
                <HugeiconsIcon icon={Share01Icon} size={13} />
                Partager
              </button>
              <button className="snap-start shrink-0 h-9 flex items-center gap-2 rounded-full border border-border/40 bg-card px-4 text-[10px] font-medium uppercase tracking-widest text-foreground hover:bg-secondary transition-all shadow-subtle">
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
              loading={enrichLoading}
              lat={lat}
              lon={lon}
              traits={traits}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Météo Tab ───────────────────────────────────────────────────────
function MeteoTab({ weather }: { weather: WeatherData }) {
  const { current } = weather;
  return (
    <div className="pb-8 animate-fade-in-up px-5">
      {/* Temperature Area */}
      <Section title="Évolution (24h)" className="pt-4">
        <TemperatureArea hourly={weather.hourly} />
      </Section>

      {/* Daily */}
      <Section title="7 prochains jours">
        <DailyForecast daily={weather.daily} />
      </Section>

      {/* Gauges */}
      <Section title="Qualité de l'environnement">
        <div className="flex justify-around items-end mt-4 mb-2">
          <GaugeArc 
            value={current.uvIndex} min={0} max={11} label="Index UV" size={130}
            colorStops={[
              { offset: "0%", color: "#93b399" },
              { offset: "50%", color: "#e6c875" },
              { offset: "100%", color: "#d9a0a0" }
            ]}
          />
          {weather.airQuality && (
            <GaugeArc 
              value={weather.airQuality.aqi} min={0} max={100} label="AQI" size={130}
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
        <div className="grid grid-cols-2 gap-2 mt-3">
          <MetricCell label="Pression" value={`${current.pressure.toFixed(0)} hPa`} />
          <MetricCell label="Visibilité" value={`${(current.visibility / 1000).toFixed(1)} km`} />
          <MetricCell label="Point de rosée" value={`${current.dewPoint.toFixed(1)}°C`} />
          <MetricCell label="Couverture" value={`${current.cloudCover}%`} />
          <MetricCell label="Altitude" value={`${weather.elevation.toFixed(0)}m`} />
          {weather.airQuality && (
            <>
              <MetricCell label="PM2.5" value={`${weather.airQuality.pm25.toFixed(1)} µg/m³`} />
              <MetricCell label="PM10" value={`${weather.airQuality.pm10.toFixed(1)} µg/m³`} />
              <MetricCell label="NO2" value={`${weather.airQuality.no2.toFixed(1)} µg/m³`} />
              <MetricCell label="Ozone" value={`${weather.airQuality.o3.toFixed(1)} µg/m³`} />
              <MetricCell label="SO2" value={`${weather.airQuality.so2.toFixed(1)} µg/m³`} />
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
  wiki, photos, country, pois, quakes, species, naturalEvents, lat, lon, locationName, loading, setActiveTab, weather, narrative, traits, onLayerSelect
}: {
  wiki: WikiSummary | null;
  photos: WikimediaPhoto[];
  country: CountryInfo | null;
  pois: NearbyPOI[];
  quakes: Earthquake[];
  species: GBIFSpecies[];
  naturalEvents: NaturalEvent[];
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

  if (loading) return <ExploreSkeleton />;

  return (
    <div className="pb-10">
      {/* ─── Situation Badges ─── */}
      <div className="px-5 pt-3 pb-1 flex flex-wrap gap-1.5">
        {traits.has("VITAL") && (
          <span className="bg-pastel-red-bg text-pastel-red-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-pastel-red-text animate-soft-pulse" />
            Assistance
          </span>
        )}
        {traits.has("WILD") && (
          <span className="bg-pastel-green-bg text-pastel-green-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-subtle">
            <HugeiconsIcon icon={Leaf01Icon} size={10} />
            Zone Sauvage
          </span>
        )}
        {quakes.length > 0 && Math.max(...quakes.map(q => q.magnitude)) >= 3 && (
          <span className="bg-pastel-yellow-bg text-pastel-yellow-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-subtle">
            <HugeiconsIcon icon={Alert02Icon} size={10} />
            Sismique
          </span>
        )}
        {weather.current.temperature > 30 && (
          <span className="bg-pastel-yellow-bg text-pastel-yellow-text px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-subtle">
            <HugeiconsIcon icon={SparklesIcon} size={10} />
            Chaleur
          </span>
        )}
        {!wiki && pois.length === 0 && (
          <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-subtle">
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
          <div key="narrative" className="px-5 pt-5">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle className="mb-0">Perspective</SectionTitle>
              <button 
                onClick={() => setActiveTab('meteo')}
                className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-full"
              >
                Météo détaillée
                <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              </button>
            </div>
            <div className="surface-soft rounded-2xl p-4">
              {narrative.map((insight, i) => (
                <NarrativeCard key={insight.category + i} insight={insight} index={i} />
              ))}
            </div>
          </div>
        );
      
      case "story":
        return (
          <div key="story" className="pt-5">
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
          <div key="isolated_brief" className="px-5 pt-5 animate-fade-in-up">
            <div className="surface-soft rounded-3xl p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-muted/30 to-transparent" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-14 h-14 bg-background rounded-full flex items-center justify-center shadow-warm border border-border/40 mb-5">
                  <HugeiconsIcon icon={Globe02Icon} size={28} className="text-muted-foreground" />
                </div>
                <h3 className="font-serif text-2xl text-foreground mb-3">L'essentiel du lieu</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px] mx-auto mb-5">
                  Ce point est déconnecté des infrastructures humaines. La nature impose son rythme.
                </p>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">Silence</p>
                    <p className="text-sm font-mono text-foreground">95-100%</p>
                  </div>
                  <div className="w-px h-8 bg-border/50" />
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1">Pollution</p>
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
          <div key="photos" className="px-5 pt-5 animate-fade-in-up">
            <SectionTitle icon={Image01Icon}>Documentation</SectionTitle>
            {/* Masonry 2+1 layout */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
              {photos.slice(0, 1).map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="col-span-2 row-span-2 block relative group rounded-2xl overflow-hidden">
                  <img src={p.thumbUrl} alt={p.title} className="w-full h-full min-h-[140px] object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
              {photos.slice(1, 3).map((p, i) => (
                <a key={i+1} href={p.url} target="_blank" rel="noopener noreferrer" className="block relative group rounded-2xl overflow-hidden">
                  <img src={p.thumbUrl} alt={p.title} className="w-full h-[68px] object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                </a>
              ))}
            </div>
            {photos.length > 3 && (
              <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                {photos.slice(3, 6).map((p, i) => (
                  <a key={i+3} href={p.url} target="_blank" rel="noopener noreferrer" className="block relative group rounded-2xl overflow-hidden">
                    <img src={p.thumbUrl} alt={p.title} className="w-full h-20 object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : null;

      case "wiki_brief":
        return wiki ? (
          <div key="wiki_brief" className="px-5 pt-5 animate-fade-in-up">
            <SectionTitle icon={BookOpen01Icon}>Synthèse Culturelle</SectionTitle>
            <div className="surface-soft rounded-2xl p-4">
              <div className="flex gap-3">
                {wiki.thumbnail && (
                  <img src={wiki.thumbnail} alt={wiki.title} className="w-16 h-16 rounded-xl object-cover border border-border/30 shrink-0" loading="lazy" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-foreground mb-0.5 truncate">{wiki.title}</h3>
                  {wiki.description && (
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">{wiki.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{wiki.extract}</p>
                </div>
              </div>
              
              {wiki.facts && Object.keys(wiki.facts).length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {wiki.facts.population && (
                    <MetricCell label="Population" value={formatPopulation(wiki.facts.population)} />
                  )}
                  {wiki.facts.area && (
                    <MetricCell label="Superficie" value={`${wiki.facts.area.toLocaleString("fr-FR")} km²`} />
                  )}
                  {wiki.facts.elevation && (
                    <MetricCell label="Altitude" value={`${wiki.facts.elevation} m`} />
                  )}
                </div>
              )}

              {wiki.url && (
                <a href={wiki.url} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  Lire la suite
                  <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
                </a>
              )}
            </div>
          </div>
        ) : null;

      case "events_brief":
        return naturalEvents.length > 0 ? (
          <div key="events_brief" className="px-5 pt-5 animate-fade-in-up">
            <SectionTitle icon={Alert02Icon}>Événements Naturels</SectionTitle>
            <div className="space-y-1.5">
              {naturalEvents.map((evt, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-pastel-red-bg/40 border border-pastel-red-text/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground mb-0.5">{evt.title}</p>
                    <p className="text-[10px] text-pastel-red-text uppercase tracking-widest">{evt.category}</p>
                  </div>
                  <span className="text-xs font-mono text-pastel-red-text ml-3 shrink-0">{evt.distanceKm} km</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;

      case "country":
        return country ? (
          <div key="country" className="px-5 pt-5 animate-fade-in-up">
            <SectionTitle icon={Globe02Icon}>Identité culturelle</SectionTitle>
            <div className="surface-soft rounded-2xl p-4">
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
                  <div className="mt-3 pt-3 border-t border-border/30">
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
                        <div className="bg-muted/40 rounded-xl px-2.5 py-1.5 flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">Police</span>
                          <span className="text-sm font-mono text-foreground">{country.emergency.police}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null;

      case "pois":
        return pois.length > 0 ? (
          <div key="pois" className="px-5 pt-5 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
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
            <div className="surface-soft rounded-2xl overflow-hidden">
              {pois.slice(0, 5).map((poi, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-border/30 last:border-0 ${poi.category === 'Hôpital' || poi.category === 'Pharmacie' ? 'bg-pastel-red-bg/20' : ''}`}>
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider mt-0.5 ${
                      poi.category === 'Hôpital' || poi.category === 'Pharmacie' 
                        ? 'bg-pastel-red-bg text-pastel-red-text font-semibold' 
                        : 'bg-muted/60 text-muted-foreground'
                    }`}>
                      {poi.category}
                    </span>
                    <span className="text-sm text-foreground truncate">{poi.name}</span>
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
          <div key="nature_brief" className="px-5 pt-5 animate-fade-in-up">
            <SectionTitle icon={Leaf01Icon}>Biodiversité</SectionTitle>
            <div className="bg-pastel-green-bg/30 rounded-2xl p-4 border border-pastel-green-text/8">
              <p className="text-sm text-foreground leading-relaxed">
                <strong className="font-mono text-pastel-green-text">{species.length} espèces</strong> répertoriées.
                {species[0] && ` Principale : ${species[0].vernacularName || species[0].scientificName} (${species[0].count} obs.).`}
              </p>
              <button
                onClick={() => onLayerSelect?.('nature', species)}
                className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-pastel-green-text hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={Location01Icon} size={11} />
                Voir sur la carte
              </button>
            </div>
          </div>
        ) : null;

      case "quakes_brief": {
        if (quakes.length === 0) return null;
        const maxMag = Math.max(...quakes.map(q => q.magnitude));
        return (
          <div key="quakes_brief" className="px-5 pt-5 animate-fade-in-up">
            <SectionTitle icon={Alert02Icon}>Activité sismique</SectionTitle>
            <div className="bg-pastel-red-bg/30 rounded-2xl p-4 border border-pastel-red-text/8">
              <p className="text-sm text-foreground leading-relaxed">
                <strong className="font-mono text-pastel-red-text">{quakes.length} secousses</strong> (30j, 300km).
                Max : <strong className="font-mono text-pastel-red-text">M{maxMag.toFixed(1)}</strong>.
              </p>
              <button
                onClick={() => onLayerSelect?.('quakes', quakes)}
                className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-pastel-red-text hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={Location01Icon} size={11} />
                Voir sur la carte
              </button>
            </div>
          </div>
        );
      }

      case "navigation":
        return (
          <div key="navigation" className="px-5 pt-5 pb-4 animate-fade-in-up">
            <SectionTitle icon={Navigation03Icon}>Navigation</SectionTitle>
            <div className="flex gap-2">
              <a href={generateGoogleMapsLink(lat, lon)} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-card border border-border/40 shadow-subtle px-3 py-3 text-xs font-medium uppercase tracking-widest text-foreground hover:bg-secondary transition-all"
              >
                Google Maps
              </a>
              <a href={generateAppleMapsLink(lat, lon, locationName)} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-card border border-border/40 shadow-subtle px-3 py-3 text-xs font-medium uppercase tracking-widest text-foreground hover:bg-secondary transition-all"
              >
                Apple Maps
              </a>
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
        <ExploreSkeleton />
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

function AutourTab({ pois, loading, lat, lon, traits }: {
  pois: NearbyPOI[];
  loading: boolean;
  lat: number;
  lon: number;
  traits: Set<SituationTrait>;
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const availableCategories = useMemo(() => {
    const cats = new Set(pois.map(p => p.category));
    const chips = [{ key: "all", label: "Tout" }];
    const seen = new Set<string>();
    
    POI_CATEGORIES.forEach(c => {
      if (c.key === "all" || c.key === "other") return;
      if (cats.has(c.key) && !seen.has(c.label)) {
        chips.push(c);
        seen.add(c.label);
      }
    });
    
    const knownCats = new Set(POI_CATEGORIES.map(c => c.key));
    const hasOther = pois.some(p => !knownCats.has(p.category));
    if (hasOther) chips.push({ key: "other", label: "Autres" });
    
    return chips;
  }, [pois]);

  const filteredPois = useMemo(() => {
    if (activeFilter === "all") return pois;
    if (activeFilter === "other") {
      const knownCats = new Set(POI_CATEGORIES.map(c => c.key));
      return pois.filter(p => !knownCats.has(p.category));
    }
    const matchingKeys = POI_CATEGORIES
      .filter(c => c.label === POI_CATEGORIES.find(pc => pc.key === activeFilter)?.label)
      .map(c => c.key);
    return pois.filter(p => matchingKeys.includes(p.category));
  }, [pois, activeFilter]);

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
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-soft"
                  : "bg-transparent text-muted-foreground border-border/40 hover:bg-muted/50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <AutourSkeleton />
        ) : pois.length === 0 ? (
          <div className="surface-soft rounded-2xl p-5 mt-2">
            <p className="text-sm text-foreground">Aucun lieu d'intérêt trouvé.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Essayez un endroit plus peuplé.</p>
          </div>
        ) : filteredPois.length === 0 ? (
          <div className="surface-soft rounded-2xl p-5 mt-2">
            <p className="text-sm text-foreground">Aucun résultat pour ce filtre.</p>
          </div>
        ) : (
          <div className="surface-soft rounded-2xl overflow-hidden mt-2">
            {filteredPois.map((poi, i) => {
              const isEmergency = poi.category === 'Hôpital' || poi.category === 'Pharmacie' || poi.category === 'Police';
              return (
                <a
                  key={i}
                  href={generateGoogleMapsLink(poi.lat || lat, poi.lon || lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between py-3 px-4 border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors ${
                    isEmergency && traits.has("VITAL") ? 'bg-pastel-red-bg/15' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider mt-0.5 ${
                      isEmergency
                        ? 'bg-pastel-red-bg text-pastel-red-text font-semibold'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}>
                      {poi.category}
                    </span>
                    <span className="text-sm text-foreground truncate block">{poi.name}</span>
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

// ─── Loading Skeletons ───────────────────────────────────────────────
function ExploreSkeleton() {
  return (
    <div className="px-5 py-6 space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-1/3 bg-muted rounded-full" />
        <div className="h-24 w-full bg-muted/60 rounded-2xl" />
        <div className="h-24 w-full bg-muted/60 rounded-2xl" />
      </div>
      <div className="h-52 w-full bg-muted/40 rounded-2xl" />
      <div className="space-y-3">
        <div className="h-3 w-1/4 bg-muted rounded-full" />
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-20 bg-muted/50 rounded-2xl col-span-2 row-span-2" />
          <div className="h-16 bg-muted/50 rounded-2xl" />
          <div className="h-16 bg-muted/50 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function AutourSkeleton() {
  return (
    <div className="space-y-0 py-4 animate-pulse surface-soft rounded-2xl overflow-hidden mt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-3 px-4 border-b border-border/20 last:border-0">
          <div className="flex gap-3 items-center">
            <div className="h-5 w-14 bg-muted rounded-full" />
            <div className="h-4 w-28 bg-muted/60 rounded-full" />
          </div>
          <div className="h-3 w-8 bg-muted/40 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Shared primitives ───────────────────────────────────────────────
function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`pt-5 pb-4 ${className || ''}`}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function SectionTitle({ children, icon, className }: { children: React.ReactNode; icon?: any; className?: string }) {
  return (
    <h2 className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 mb-3 ${className || ''}`}>
      {icon && <HugeiconsIcon icon={icon} size={12} className="text-muted-foreground/50" />}
      {children}
    </h2>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-3 border border-border/20">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-sm font-mono mt-0.5 text-foreground">{value}</p>
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
