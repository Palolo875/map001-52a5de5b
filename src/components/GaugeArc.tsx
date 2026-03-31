import { useMemo } from 'react';
import * as d3 from 'd3';

interface GaugeArcProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  valueLabel?: string;
  size?: number;
  thickness?: number;
  colorStops?: { offset: string; color: string }[];
}

export default function GaugeArc({
  value,
  min = 0,
  max = 100,
  label,
  valueLabel,
  size = 140,
  thickness = 12,
  colorStops = [
    { offset: "0%", color: "#93b399" }, // Pastel green
    { offset: "50%", color: "#e6c875" }, // Pastel yellow
    { offset: "100%", color: "#d9a0a0" } // Pastel red
  ]
}: GaugeArcProps) {
  const clampedValue = Math.max(min, Math.min(max, value));
  const percent = (clampedValue - min) / (max - min);

  const arcGenerator = useMemo(() => {
    return d3.arc()
      .innerRadius(size / 2 - thickness)
      .outerRadius(size / 2)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2)
      .cornerRadius(thickness / 2);
  }, [size, thickness]);

  const backgroundArc = arcGenerator({} as any);

  // Calculate needle position
  const angle = -Math.PI / 2 + percent * Math.PI;
  const needleLength = size / 2 - thickness - 4;
  
  const needleX = Math.sin(angle) * needleLength;
  const needleY = -Math.cos(angle) * needleLength;

  const gradientId = `gauge-gradient-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size / 2 + 30 }}>
      <svg width={size} height={size / 2 + 10} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {colorStops.map((stop, i) => (
              <stop key={i} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>
        
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          {/* Background Arc */}
          <path d={backgroundArc || undefined} fill={`url(#${gradientId})`} opacity={0.3} />
          
          {/* Foreground Arc (Active value) */}
          <path 
            d={d3.arc()
              .innerRadius(size / 2 - thickness)
              .outerRadius(size / 2)
              .startAngle(-Math.PI / 2)
              .endAngle(angle)
              .cornerRadius(thickness / 2)({} as any) || undefined
            } 
            fill={`url(#${gradientId})`} 
          />

          {/* Needle / Marker */}
          <circle cx={needleX} cy={needleY} r={thickness / 1.5} fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth={2} />
          
          {/* Base of the needle */}
          <circle cx={0} cy={0} r={4} fill="hsl(var(--foreground))" />
        </g>
      </svg>
      
      <div className="absolute bottom-0 flex flex-col items-center text-center">
        <span className="font-mono text-xl font-medium leading-none text-foreground">
          {valueLabel || value.toString()}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
          {label}
        </span>
      </div>
    </div>
  );
}
