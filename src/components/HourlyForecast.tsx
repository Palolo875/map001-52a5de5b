import type { WeatherData } from "@/lib/weather";
import { getWeatherDescription } from "@/lib/weather";

interface HourlyForecastProps {
  hourly: WeatherData["hourly"];
}

export default function HourlyForecast({ hourly }: HourlyForecastProps) {
  const now = new Date();
  const currentHourIndex = hourly.time.findIndex((t) => new Date(t) >= now);
  const start = Math.max(0, currentHourIndex);
  const items = hourly.time.slice(start, start + 24);

  return (
    <div className="flex gap-0 overflow-x-auto pb-2 -mx-1 scrollbar-none hide-scrollbar">
      {items.map((time, i) => {
        const idx = start + i;
        const date = new Date(time);
        const hour = date.getHours().toString().padStart(2, "0") + "h";
        const temp = Math.round(hourly.temperature[idx]);
        const precip = hourly.precipitation[idx];

        return (
          <div
            key={time}
            className="flex flex-col items-center shrink-0 px-3 py-2 min-w-[50px] animate-fade-in-up"
            style={{ animationDelay: `${i * 25}ms` }}
          >
            <span className="text-[10px] text-muted-foreground/50 font-mono">{i === 0 ? "Mnt" : hour}</span>
            <span className="text-sm font-mono mt-2 text-foreground">{temp}°</span>
            {precip > 0 && (
              <span className="text-[10px] text-pastel-blue-text/70 font-mono mt-1">{precip.toFixed(1)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
