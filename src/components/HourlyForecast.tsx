import type { WeatherData } from "@/lib/weather";

interface HourlyForecastProps {
  hourly: WeatherData["hourly"];
}

export default function HourlyForecast({ hourly }: HourlyForecastProps) {
  const now = new Date();
  const currentHourIndex = hourly.time.findIndex((t) => new Date(t) >= now);
  const start = Math.max(0, currentHourIndex);
  const items = hourly.time.slice(start, start + 24);

  // Calculate temp range for bar visualization
  const temps = items.map((_, i) => Math.round(hourly.temperature[start + i]));
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const range = maxTemp - minTemp || 1;

  return (
    <div className="flex gap-0 overflow-x-auto pb-2 -mx-1 scrollbar-none hide-scrollbar">
      {items.map((time, i) => {
        const idx = start + i;
        const date = new Date(time);
        const hour = date.getHours().toString().padStart(2, "0") + "h";
        const temp = temps[i];
        const precip = hourly.precipitation[idx];
        const barHeight = 4 + ((temp - minTemp) / range) * 28;

        return (
          <div
            key={time}
            className="flex flex-col items-center shrink-0 px-2.5 py-2 min-w-[46px] animate-fade-in-up"
            style={{ animationDelay: `${i * 20}ms` }}
          >
            <span className="text-[10px] text-muted-foreground/50 font-mono">{i === 0 ? "Mnt" : hour}</span>
            <span className="text-[13px] font-mono mt-1.5 text-foreground font-medium">{temp}°</span>
            {/* Mini bar */}
            <div className="w-[3px] rounded-full bg-border/40 mt-1.5 relative" style={{ height: '32px' }}>
              <div 
                className="absolute bottom-0 w-full rounded-full bg-foreground/30"
                style={{ height: `${barHeight}px` }}
              />
            </div>
            {precip > 0 && (
              <span className="text-[9px] text-pastel-blue-text/70 font-mono mt-1">{precip.toFixed(1)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
