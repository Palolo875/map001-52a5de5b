import type { WeatherData } from "@/lib/weather";
import { getWeatherDescription } from "@/lib/weather";

interface DailyForecastProps {
  daily: WeatherData["daily"];
}

const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function DailyForecast({ daily }: DailyForecastProps) {
  return (
    <div className="surface-soft rounded-2xl overflow-hidden">
      {daily.time.map((date, i) => {
        const d = new Date(date);
        const dayLabel = i === 0 ? "Auj." : dayNames[d.getDay()];
        const maxT = Math.round(daily.temperatureMax[i]);
        const minT = Math.round(daily.temperatureMin[i]);
        const precip = daily.precipitationProbabilityMax[i];

        return (
          <div
            key={date}
            className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 last:border-0 animate-fade-in-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-sm text-foreground w-10">{dayLabel}</span>
            <span className="text-[11px] text-muted-foreground/50 flex-1 truncate px-2 italic">
              {getWeatherDescription(daily.weatherCode[i])}
            </span>
            {precip > 0 && (
              <span className="text-[10px] font-mono text-pastel-blue-text/70 mr-3">{precip}%</span>
            )}
            <div className="flex gap-2 font-mono text-sm">
              <span className="text-muted-foreground/50">{minT}°</span>
              <span className="text-foreground">{maxT}°</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
