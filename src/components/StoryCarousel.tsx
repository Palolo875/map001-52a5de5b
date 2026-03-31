import useEmblaCarousel from "embla-carousel-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Leaf01Icon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import type { Earthquake, GBIFSpecies, WikiSummary, NaturalEvent } from "@/lib/enrichment";

interface StoryCarouselProps {
  quakes: Earthquake[];
  species: GBIFSpecies[];
  wiki: WikiSummary | null;
  naturalEvents: NaturalEvent[];
  onSelectStory: (id: string) => void;
}

export default function StoryCarousel({ quakes, species, wiki, naturalEvents, onSelectStory }: StoryCarouselProps) {
  const [emblaRef] = useEmblaCarousel({
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  });

  const hasQuakes = quakes.some(q => q.magnitude >= 3);
  const topSpecies = species.slice(0, 3);
  const hasNature = topSpecies.length > 0;
  const hasWiki = !!wiki?.extract;
  const hasEvents = naturalEvents.length > 0;

  if (!hasQuakes && !hasNature && !hasWiki && !hasEvents) return null;

  return (
    <div className="w-full pb-4 animate-fade-in-up">
      <div className="px-5 mb-3">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 flex items-center gap-2">
          À la une
        </h2>
      </div>
      
      <div className="overflow-hidden px-1" ref={emblaRef}>
        <div className="flex touch-pan-y gap-3">
          
          {hasEvents && (
            <div className="flex-[0_0_82%] min-w-0 pl-4 first:pl-5 last:pr-5">
              <div className="relative h-[260px] rounded-3xl overflow-hidden select-none bg-pastel-red-bg border border-pastel-red-text/15 shadow-warm flex flex-col justify-end p-5">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-pastel-red-text/60 animate-soft-pulse" />
                <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-pastel-red-text to-transparent" />
                <div className="relative z-10">
                  <span className="text-pastel-red-text text-[9px] uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold">
                    <HugeiconsIcon icon={Alert02Icon} size={11} />
                    Alerte NASA
                  </span>
                  <span className="text-foreground font-serif text-2xl leading-tight mb-2 block tracking-tight">
                    {naturalEvents[0].title}
                  </span>
                  <p className="text-foreground/70 text-[13px] leading-relaxed">
                    Événement <strong className="text-pastel-red-text font-medium">{naturalEvents[0].category.toLowerCase()}</strong> à {naturalEvents[0].distanceKm} km.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {hasWiki && wiki && (
            <div className="flex-[0_0_82%] min-w-0 pl-4 first:pl-5 last:pr-5">
              <div className="relative h-[260px] rounded-3xl overflow-hidden select-none shadow-warm">
                {wiki.thumbnail && (
                  <img src={wiki.thumbnail} alt={wiki.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5" />
                <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col">
                  <span className="text-white/60 text-[9px] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <HugeiconsIcon icon={BookOpen01Icon} size={11} />
                    Histoire & Culture
                  </span>
                  <span className="text-white font-serif text-xl leading-tight mb-2 tracking-tight">
                    {wiki.title}
                  </span>
                  <p className="text-white/55 text-[12px] line-clamp-3 leading-relaxed">
                    {wiki.extract}
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasNature && (
            <div className="flex-[0_0_82%] min-w-0 pl-4 first:pl-5 last:pr-5">
              <div className="relative h-[260px] rounded-3xl overflow-hidden select-none bg-pastel-green-bg border border-pastel-green-text/10 shadow-warm flex flex-col justify-end p-5">
                <div className="absolute inset-0 opacity-[0.1] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-pastel-green-text to-transparent" />
                <div className="relative z-10">
                  <span className="text-pastel-green-text text-[9px] uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold">
                    <HugeiconsIcon icon={Leaf01Icon} size={11} />
                    Biodiversité
                  </span>
                  <span className="text-foreground font-serif text-4xl leading-tight mb-2 block tracking-tight">
                    {species.length} <span className="text-xl">espèces</span>
                  </span>
                  <p className="text-foreground/70 text-[13px] leading-relaxed">
                    Dont <strong className="text-pastel-green-text font-medium">{topSpecies.map(s => s.vernacularName || s.scientificName).join(', ')}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasQuakes && (
            <div className="flex-[0_0_82%] min-w-0 pl-4 first:pl-5 last:pr-5">
              <div className="relative h-[260px] rounded-3xl overflow-hidden select-none bg-pastel-red-bg/60 border border-pastel-red-text/10 shadow-warm flex flex-col justify-end p-5">
                <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-pastel-red-text to-transparent" />
                <div className="relative z-10">
                  <span className="text-pastel-red-text text-[9px] uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold">
                    <HugeiconsIcon icon={Alert02Icon} size={11} />
                    Sismique
                  </span>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-foreground font-serif text-5xl leading-tight tracking-tight">
                      M{Math.max(...quakes.map(q => q.magnitude)).toFixed(1)}
                    </span>
                    <span className="text-pastel-red-text font-mono text-[10px]">max 30j</span>
                  </div>
                  <p className="text-foreground/70 text-[13px] leading-relaxed">
                    <strong className="text-pastel-red-text font-medium">{quakes.length} secousses</strong> enregistrées dans ce périmètre.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
