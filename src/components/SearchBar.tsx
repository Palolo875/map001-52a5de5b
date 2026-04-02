import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { searchPlaces, type GeoResult } from "@/lib/geocoder";
import { SEARCH_INTENTS, matchIntent, type SearchIntent } from "@/lib/search-intents";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Location01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

interface SearchBarProps {
  onSelect: (result: GeoResult) => void;
  onIntentSelect: (intent: SearchIntent) => void;
}

const RECENTS_KEY = "atlas-nav:recent-searches";

export default function SearchBar({ onSelect, onIntentSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<GeoResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENTS_KEY);
      if (!raw) return;
      setRecentSearches(JSON.parse(raw));
    } catch {}
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(true);
      return;
    }
    setLoading(true);
    try {
      const res = await searchPlaces(q);
      setResults(res);
      setIsOpen(res.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query, search]);

  const handleSelect = (r: GeoResult) => {
    setQuery(r.name);
    setIsOpen(false);
    setRecentSearches((prev) => {
      const next = [r, ...prev.filter((item) => item.name !== r.name || item.lat !== r.lat || item.lon !== r.lon)].slice(0, 4);
      try {
        window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    onSelect(r);
  };

  const handleIntentSelect = (intent: SearchIntent) => {
    setQuery(intent.label);
    setIsOpen(false);
    onIntentSelect(intent);
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const matchedIntent = useMemo(() => matchIntent(query), [query]);
  const filteredIntents = useMemo(() => {
    if (!query.trim()) return SEARCH_INTENTS.slice(0, 4);
    const normalized = query.toLowerCase();
    return SEARCH_INTENTS.filter((intent) =>
      intent.label.toLowerCase().includes(normalized) ||
      intent.aliases.some((alias) => alias.toLowerCase().includes(normalized))
    ).slice(0, 4);
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-2xl border border-border/30 bg-card/90 blur-calque px-3.5 py-2.5 shadow-soft transition-all focus-within:shadow-warm focus-within:border-border/50">
        <HugeiconsIcon icon={Search01Icon} size={15} className="text-muted-foreground/50 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher un lieu ou une intention..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
        {query && (
          <button onClick={clear} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} size={13} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-border/30 bg-card/95 blur-calque shadow-lifted overflow-hidden z-50">
          {!query.trim() && (
            <div className="p-3.5 border-b border-border/15">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/55 mb-2">Exploration rapide</p>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {SEARCH_INTENTS.slice(0, 4).map((intent) => (
                  <button
                    key={intent.id}
                    onClick={() => handleIntentSelect(intent)}
                    className="shrink-0 rounded-full border border-border/30 bg-muted/30 px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span className="mr-1.5">{intent.emoji}</span>
                    {intent.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!query.trim() && recentSearches.length > 0 && (
            <div className="border-b border-border/15">
              <p className="px-3.5 pt-3 text-[9px] uppercase tracking-[0.16em] text-muted-foreground/55">Récent</p>
              {recentSearches.map((r, i) => (
                <button
                  key={`${r.lat}-${r.lon}-${i}`}
                  onClick={() => handleSelect(r)}
                  className="flex items-start gap-3 w-full px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <HugeiconsIcon icon={Location01Icon} size={13} className="text-muted-foreground/40 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground/50 truncate">
                      {[r.state, r.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.trim() && filteredIntents.length > 0 && (
            <div className="border-b border-border/15">
              <p className="px-3.5 pt-3 text-[9px] uppercase tracking-[0.16em] text-muted-foreground/55">Intentions</p>
              {filteredIntents.map((intent) => (
                <button
                  key={intent.id}
                  onClick={() => handleIntentSelect(intent)}
                  className={`flex items-start gap-3 w-full px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors ${
                    matchedIntent?.id === intent.id ? "bg-muted/20" : ""
                  }`}
                >
                  <span className="text-sm leading-none mt-0.5">{intent.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{intent.label}</p>
                    <p className="text-[11px] text-muted-foreground/50 truncate">{intent.emptyStateHint}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div>
              <p className="px-3.5 pt-3 text-[9px] uppercase tracking-[0.16em] text-muted-foreground/55">Lieux</p>
              {results.map((r, i) => (
                <button
                  key={`${r.lat}-${r.lon}-${i}`}
                  onClick={() => handleSelect(r)}
                  className="flex items-start gap-3 w-full px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/15 last:border-0"
                >
                  <HugeiconsIcon icon={Location01Icon} size={13} className="text-muted-foreground/40 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground/50 truncate">
                      {[r.state, r.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="px-3.5 py-3 text-[11px] text-muted-foreground/60">Recherche en cours...</div>
          )}

          {query.trim() && !loading && results.length === 0 && filteredIntents.length === 0 && (
            <div className="px-3.5 py-3 text-[11px] text-muted-foreground/60">
              Aucun résultat. Essayez un lieu précis ou une catégorie comme “Parcs”.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
