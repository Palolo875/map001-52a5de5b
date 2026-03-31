import { useMemo } from "react";
import type { WeatherData } from "@/lib/weather";
import { getWeatherDescription, getWindDirection } from "@/lib/weather";
import { generateNarrative } from "@/lib/narrative";
import NarrativeCard from "./NarrativeCard";
import HourlyForecast from "./HourlyForecast";
import DailyForecast from "./DailyForecast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

interface WeatherPanelProps {
  weather: WeatherData;
  locationName: string;
  onClose: () => void;
}

export default function WeatherPanel({ weather, locationName, onClose }: WeatherPanelProps) {
  const { current } = weather;
  const narrative = useMemo(() => generateNarrative(weather, locationName), [weather, locationName]);

  return (
    <div className="h-full flex flex-col bg-overlay overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-serif truncate">{locationName}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">{getWeatherDescription(current.weatherCode)}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3">
          <HugeiconsIcon icon={Cancel01Icon} size={18} />
        </button>
      </div>

      {/* Temperature hero */}
      <div className="px-5 pb-4 border-b border-border">
        <div className="flex items-end gap-2">
          <span className="text-6xl font-serif tracking-tight leading-none">{Math.round(current.temperature)}</span>
          <span className="text-2xl text-muted-foreground font-serif mb-1">°C</span>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground font-mono">
          <span>Ressenti {current.apparentTemperature.toFixed(1)}°C</span>
          <span>Humidité {current.humidity}%</span>
          <span>{current.windSpeed.toFixed(0)} km/h {getWindDirection(current.windDirection)}</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Narrative Hub */}
        <div className="px-5 pt-4 pb-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">Analyse contextuelle</h2>
          <div>
            {narrative.map((insight, i) => (
              <NarrativeCard key={insight.category + i} insight={insight} index={i} />
            ))}
          </div>
        </div>

        {/* Hourly */}
        <div className="px-5 pt-4 pb-2 border-t border-border">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">Prochaines heures</h2>
          <HourlyForecast hourly={weather.hourly} />
        </div>

        {/* Daily */}
        <div className="px-5 pt-4 pb-6 border-t border-border">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">7 prochains jours</h2>
          <DailyForecast daily={weather.daily} />
        </div>

        {/* Detailed metrics bento */}
        <div className="px-5 pb-6 border-t border-border pt-4">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">Données détaillées</h2>
          <div className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden">
            <MetricCell label="Pression" value={`${current.pressure.toFixed(0)} hPa`} />
            <MetricCell label="Visibilité" value={`${(current.visibility / 1000).toFixed(1)} km`} />
            <MetricCell label="Point de rosée" value={`${current.dewPoint.toFixed(1)}°C`} />
            <MetricCell label="Couverture nuageuse" value={`${current.cloudCover}%`} />
            <MetricCell label="UV Index" value={current.uvIndex.toFixed(1)} />
            <MetricCell label="Altitude" value={`${weather.elevation.toFixed(0)}m`} />
            {weather.airQuality && (
              <>
                <MetricCell label="AQI" value={weather.airQuality.aqi.toString()} />
                <MetricCell label="PM2.5" value={`${weather.airQuality.pm25.toFixed(1)} µg/m³`} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-mono mt-1 text-foreground">{value}</p>
    </div>
  );
}
