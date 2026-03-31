import { useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Leaf01Icon, BookOpen01Icon, Cancel01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { Earthquake, GBIFSpecies, WikiSummary, NaturalEvent } from "@/lib/enrichment";

interface StoryCarouselProps {
  quakes: Earthquake[];
  species: GBIFSpecies[];
  wiki: WikiSummary | null;
  naturalEvents: NaturalEvent[];
  onSelectStory: (id: string) => void;
}

type StoryDetail = {
  type: "event" | "wiki" | "nature" | "quake";
  title: string;
} | null;

export default function StoryCarousel({ quakes, species, wiki, naturalEvents, onSelectStory }: StoryCarouselProps) {
  const [emblaRef] = useEmblaCarousel({
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  });
  const [detail, setDetail] = useState<StoryDetail>(null);

  const hasQuakes = quakes.some(q => q.magnitude >= 3);
  const topSpecies = species.slice(0, 3);
  const hasNature = topSpecies.length > 0;
  const hasWiki = !!wiki?.extract;
  const hasEvents = naturalEvents.length > 0;

  if (!hasQuakes && !hasNature && !hasWiki && !hasEvents) return null;

  return (
    <>
      <div className="w-full pb-3 animate-fade-in-up">
        <div className="px-5 mb-2">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 flex items-center gap-2">
            À la une
          </h2>
        </div>
        
        <div className="overflow-hidden px-1" ref={emblaRef}>
          <div className="flex touch-pan-y gap-2">
            
            {hasEvents && (
              <div className="flex-[0_0_72%] min-w-0 pl-4 first:pl-5 last:pr-5">
                <button
                  onClick={() => setDetail({ type: "event", title: naturalEvents[0].title })}
                  className="relative w-full h-[140px] rounded-2xl overflow-hidden select-none bg-pastel-red-bg border border-pastel-red-text/15 flex flex-col justify-end p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-pastel-red-text/60 animate-soft-pulse" />
                  <div className="relative z-10">
                    <span className="text-pastel-red-text text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1.5 font-semibold">
                      <HugeiconsIcon icon={Alert02Icon} size={10} />
                      Alerte NASA
                    </span>
                    <span className="text-foreground font-serif text-base leading-tight block tracking-tight line-clamp-2">
                      {naturalEvents[0].title}
                    </span>
                    <p className="text-foreground/60 text-[11px] mt-1">
                      {naturalEvents[0].category.toLowerCase()} · {naturalEvents[0].distanceKm} km
                    </p>
                  </div>
                </button>
              </div>
            )}
            
            {hasWiki && wiki && (
              <div className="flex-[0_0_72%] min-w-0 pl-4 first:pl-5 last:pr-5">
                <button
                  onClick={() => setDetail({ type: "wiki", title: wiki.title })}
                  className="relative w-full h-[140px] rounded-2xl overflow-hidden select-none text-left transition-transform active:scale-[0.98]"
                >
                  {wiki.thumbnail && (
                    <img src={wiki.thumbnail} alt={wiki.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
                  <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col">
                    <span className="text-white/60 text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <HugeiconsIcon icon={BookOpen01Icon} size={10} />
                      Histoire
                    </span>
                    <span className="text-white font-serif text-base leading-tight tracking-tight line-clamp-1">
                      {wiki.title}
                    </span>
                    <p className="text-white/50 text-[11px] line-clamp-2 leading-relaxed mt-0.5">
                      {wiki.extract}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {hasNature && (
              <div className="flex-[0_0_72%] min-w-0 pl-4 first:pl-5 last:pr-5">
                <button
                  onClick={() => {
                    setDetail({ type: "nature", title: `${species.length} espèces` });
                    onSelectStory("nature");
                  }}
                  className="relative w-full h-[140px] rounded-2xl overflow-hidden select-none bg-pastel-green-bg border border-pastel-green-text/10 flex flex-col justify-end p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <div className="relative z-10">
                    <span className="text-pastel-green-text text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1.5 font-semibold">
                      <HugeiconsIcon icon={Leaf01Icon} size={10} />
                      Biodiversité
                    </span>
                    <span className="text-foreground font-serif text-2xl leading-tight block tracking-tight">
                      {species.length} <span className="text-sm">espèces</span>
                    </span>
                    <p className="text-foreground/60 text-[11px] mt-0.5 line-clamp-1">
                      {topSpecies.map(s => s.vernacularName || s.scientificName).join(', ')}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {hasQuakes && (
              <div className="flex-[0_0_72%] min-w-0 pl-4 first:pl-5 last:pr-5">
                <button
                  onClick={() => {
                    setDetail({ type: "quake", title: "Activité sismique" });
                    onSelectStory("quakes");
                  }}
                  className="relative w-full h-[140px] rounded-2xl overflow-hidden select-none bg-pastel-red-bg/60 border border-pastel-red-text/10 flex flex-col justify-end p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <div className="relative z-10">
                    <span className="text-pastel-red-text text-[9px] uppercase tracking-widest mb-1 flex items-center gap-1.5 font-semibold">
                      <HugeiconsIcon icon={Alert02Icon} size={10} />
                      Sismique
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-foreground font-serif text-3xl leading-tight tracking-tight">
                        M{Math.max(...quakes.map(q => q.magnitude)).toFixed(1)}
                      </span>
                      <span className="text-pastel-red-text font-mono text-[9px]">max 30j</span>
                    </div>
                    <p className="text-foreground/60 text-[11px] mt-0.5">
                      {quakes.length} secousses enregistrées
                    </p>
                  </div>
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Detail overlay */}
      {detail && (
        <StoryDetailOverlay
          detail={detail}
          onClose={() => setDetail(null)}
          quakes={quakes}
          species={species}
          wiki={wiki}
          naturalEvents={naturalEvents}
        />
      )}
    </>
  );
}

function StoryDetailOverlay({ detail, onClose, quakes, species, wiki, naturalEvents }: {
  detail: NonNullable<StoryDetail>;
  onClose: () => void;
  quakes: Earthquake[];
  species: GBIFSpecies[];
  wiki: WikiSummary | null;
  naturalEvents: NaturalEvent[];
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in-up overflow-y-auto">
      <div className="px-5 pt-5 pb-8 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl tracking-tight">{detail.title}</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-muted-foreground" />
          </button>
        </div>

        {detail.type === "event" && naturalEvents.length > 0 && (
          <div className="space-y-3">
            {naturalEvents.map((evt, i) => (
              <div key={i} className="border-b border-border/20 pb-3 last:border-0">
                <p className="text-sm text-foreground font-medium">{evt.title}</p>
                <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span className="text-pastel-red-text font-medium">{evt.category}</span>
                  <span className="font-mono">{evt.distanceKm} km</span>
                  <span className="font-mono">{new Date(evt.date).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {detail.type === "wiki" && wiki && (
          <div>
            {wiki.thumbnail && (
              <img src={wiki.thumbnail} alt={wiki.title} className="w-full h-48 object-cover rounded-2xl mb-4" />
            )}
            {wiki.description && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">{wiki.description}</p>
            )}
            <p className="text-sm text-foreground leading-relaxed">{wiki.extract}</p>
            {wiki.facts && Object.keys(wiki.facts).length > 0 && (
              <div className="mt-4 flex gap-4 text-sm">
                {wiki.facts.population && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60">Population</p>
                    <p className="font-mono text-foreground">{wiki.facts.population.toLocaleString("fr-FR")}</p>
                  </div>
                )}
                {wiki.facts.area && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60">Superficie</p>
                    <p className="font-mono text-foreground">{wiki.facts.area.toLocaleString("fr-FR")} km²</p>
                  </div>
                )}
              </div>
            )}
            {wiki.url && (
              <a href={wiki.url} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
              >
                Lire sur Wikipédia <HugeiconsIcon icon={ArrowRight01Icon} size={10} />
              </a>
            )}
          </div>
        )}

        {detail.type === "nature" && species.length > 0 && (
          <div className="space-y-2">
            {species.slice(0, 15).map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/15 last:border-0">
                <div>
                  <p className="text-sm text-foreground">{s.vernacularName || s.scientificName}</p>
                  {s.vernacularName && <p className="text-[11px] text-muted-foreground/60 italic">{s.scientificName}</p>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground/50 bg-muted/40 px-2 py-0.5 rounded-full">{s.kingdom}</span>
                  <span className="text-xs font-mono text-muted-foreground ml-2">{s.count} obs.</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {detail.type === "quake" && quakes.length > 0 && (
          <div className="space-y-2">
            {quakes.map((q, i) => (
              <a key={i} href={q.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between py-2 border-b border-border/15 last:border-0 hover:bg-muted/20 transition-colors -mx-2 px-2 rounded-lg"
              >
                <div>
                  <p className="text-sm text-foreground">{q.place}</p>
                  <p className="text-[11px] text-muted-foreground/60 font-mono">
                    {new Date(q.time).toLocaleDateString("fr-FR")} · Prof. {q.depth.toFixed(0)} km
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`font-serif text-lg ${q.magnitude >= 4 ? 'text-pastel-red-text' : 'text-foreground'}`}>
                    M{q.magnitude.toFixed(1)}
                  </span>
                  <p className="text-[10px] font-mono text-muted-foreground/50">{q.distance} km</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
