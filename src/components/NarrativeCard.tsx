import type { NarrativeInsight } from "@/lib/narrative";
import { cn } from "@/lib/utils";

interface NarrativeCardProps {
  insight: NarrativeInsight;
  index: number;
}

const pastelMap = {
  green: { bg: "bg-pastel-green-bg/50", text: "text-pastel-green-text" },
  blue: { bg: "bg-pastel-blue-bg/50", text: "text-pastel-blue-text" },
  yellow: { bg: "bg-pastel-yellow-bg/50", text: "text-pastel-yellow-text" },
  red: { bg: "bg-pastel-red-bg/50", text: "text-pastel-red-text" },
};

const categoryLabels: Record<string, string> = {
  comfort: "Confort",
  air: "Air",
  uv: "UV",
  wind: "Vent",
  visibility: "Visibilité",
  altitude: "Altitude",
  precipitation: "Précipitations",
  pressure: "Pression",
};

export default function NarrativeCard({ insight, index }: NarrativeCardProps) {
  const colors = pastelMap[insight.pastel];

  return (
    <div
      className="animate-fade-in-up border-b border-border/20 py-3.5 last:border-0 last:pb-0 first:pt-0"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest", colors.bg, colors.text)}>
          {categoryLabels[insight.category]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-relaxed text-foreground">{insight.signal}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">{insight.proof}</p>
        </div>
      </div>
    </div>
  );
}
