import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { WeatherData } from "@/lib/weather";

interface TemperatureAreaProps {
  hourly: WeatherData["hourly"];
}

export default function TemperatureArea({ hourly }: TemperatureAreaProps) {
  const data = useMemo(() => {
    const now = new Date();
    const currentHourIndex = hourly.time.findIndex((t) => new Date(t) >= now);
    const start = Math.max(0, currentHourIndex);
    const items = hourly.time.slice(start, start + 24);

    return items.map((time, i) => {
      const idx = start + i;
      const date = new Date(time);
      const hour = date.getHours().toString().padStart(2, "0") + "h";
      
      return {
        time: i === 0 ? "Mnt" : hour,
        fullTime: date,
        temp: Math.round(hourly.temperature[idx]),
        precip: hourly.precipitation[idx]
      };
    });
  }, [hourly]);

  const minTemp = Math.min(...data.map(d => d.temp));
  const maxTemp = Math.max(...data.map(d => d.temp));

  return (
    <div className="h-[140px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.12}/>
              <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace", opacity: 0.5 }} 
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis hide domain={[minTemp - 2, maxTemp + 2]} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload;
                return (
                  <div className="surface-soft rounded-xl p-2.5 text-xs flex flex-col gap-1">
                    <span className="text-muted-foreground/50 font-mono">{d.time}</span>
                    <span className="font-mono text-foreground">{d.temp}°C</span>
                    {d.precip > 0 && (
                      <span className="text-pastel-blue-text/70 font-mono">{d.precip.toFixed(1)} mm</span>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area 
            type="monotone" 
            dataKey="temp" 
            stroke="hsl(var(--foreground))" 
            strokeWidth={1.5}
            fillOpacity={1} 
            fill="url(#tempGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
