
// ─── Situational Intelligence Engine (SIS) ──────────────────────────
// Detects contextual traits from location data and calculates
// module display priority for the ExploreTab.
//
// Design principles:
//   - Multiple signals must converge before activating a strong trait
//   - No single heuristic should dominate (altitude alone ≠ WILD)
//   - User intent is inferred, never assumed
//   - The default state is always "discovery" (neutral exploration)

export type SituationTrait = 
  | "VITAL" 
  | "ATLAS" 
  | "WILD" 
  | "URBAN" 
  | "CULTURAL" 
  | "TRANSIT"
  | "MARITIME"
  | "ISOLATED"
  | "NOCTURNE"
  | "HOSTILE"
  | "FOREIGN";

export interface ModulePriority {
  id: string;
  weight: number;
}

// ─── Module IDs ─────────────────────────────────────────────────────
// These correspond to the visual blocks rendered in ExploreTab.
export type ModuleId = 
  | "narrative"    // NarrativeHub — contextual signals (weather, alerts)
  | "story"        // StoryCarousel — visual storytelling
  | "photos"       // Wikimedia Commons photo grid
  | "country"      // Country identity card (flag, currency, language)
  | "pois"         // Nearby points of interest list
  | "navigation"   // Deep links to Google/Apple Maps
  | "events_brief" // NASA EONET natural events
  | "quakes_brief" // Compact seismic summary (replaces full Quakes tab)
  | "nature_brief" // Compact biodiversity summary (replaces full Nature tab)
  | "wiki_brief"   // Wikipedia excerpt inline
  | "isolated_brief"; // Graceful empty state for oceans/deserts

// ─── Weight Modifiers Matrix ─────────────────────────────────────────
// Instead of complex if/else chains, we define how each trait modifies
// the base weight of each module. 
// Null/undefined means no modification.
const TRAIT_MODIFIERS: Record<SituationTrait, Partial<Record<ModuleId, number>>> = {
  VITAL: {
    pois: +200,         // Hospitals/police → top
    navigation: +180,   // "Get me there NOW"
    narrative: +50,     // Alert signals stay high
    story: -60,         // Entertainment drops
    photos: -40,
    wiki_brief: -30,
    nature_brief: -50
  },
  ATLAS: {
    country: +120,      // Country card → top
    wiki_brief: +40,    // Cultural context rises
    story: +20,
    pois: -30,          // Local POIs less meaningful at country scale
    nature_brief: -10
  },
  WILD: {
    narrative: +60,     // Weather/UV/altitude warnings → critical
    nature_brief: +80,  // Biodiversity is the star
    photos: +30,        // Landscape photos
    pois: -20,          // Few POIs in wild areas anyway
    country: -20
  },
  URBAN: {
    pois: +60,          // Services are what matters
    narrative: +30,     // Air quality, comfort
    navigation: +20,    // Transit links
    quakes_brief: -10,
    nature_brief: -10
  },
  CULTURAL: {
    wiki_brief: +80,    // Wikipedia content is king
    photos: +50,        // Historical photos
    story: +30          // Rich storytelling
  },
  TRANSIT: {
    pois: +100,         // Nearby stations/stops
    navigation: +70,    // Route planning
    story: -30,
    nature_brief: -30
  },
  MARITIME: {
    narrative: +50,     // Wave/wind signals
    nature_brief: +40,  // Marine biodiversity
    pois: -20           // Few POIs at sea
  },
  ISOLATED: {
    isolated_brief: +200, // Tops the list just under narrative
    navigation: +20
  },
  NOCTURNE: {
    pois: +40,          // Hotels/Nightlife
    photos: -30,        // Visuals less relevant at night
    nature_brief: -20,
    wiki_brief: -20
  },
  HOSTILE: {
    narrative: +300,    // SURVIVAL MODE: Weather/Alerts must be at the very top
    events_brief: +150, // NASA/FEMA alerts
    pois: +100,         // Emergency services
    story: -100,        // Hide entertainment
    photos: -100,       // Hide visuals
    wiki_brief: -100    // Hide culture
  },
  FOREIGN: {
    country: +150,      // Language, Currency, Timezone are crucial
    wiki_brief: +20     // Context is helpful
  }
};

// ─── Weight Calculator ──────────────────────────────────────────────
// Higher weight = appears higher in the Explore tab.
// Base weights define the default "discovery" order.

export function calculateModuleWeights(traits: Set<SituationTrait>): ModulePriority[] {
  const modules: ModulePriority[] = [
    { id: "narrative",    weight: 100 },  // Signals always first by default
    { id: "story",        weight: 85 },   // Visual discovery hook
    { id: "photos",       weight: 70 },   // Visual context
    { id: "wiki_brief",   weight: 55 },   // Cultural knowledge
    { id: "country",      weight: 45 },   // Country identity
    { id: "events_brief", weight: 40 },   // Natural events
    { id: "pois",         weight: 35 },   // Nearby places
    { id: "nature_brief", weight: 25 },   // Biodiversity
    { id: "quakes_brief", weight: 15 },   // Seismic activity
    { id: "navigation",   weight: 10 },   // External nav links
    { id: "isolated_brief", weight: 5 },  // Empty state fallback
  ];

  return modules.map(m => {
    let w = m.weight;

    // Apply modifiers from active traits
    traits.forEach(trait => {
      const modifiers = TRAIT_MODIFIERS[trait];
      if (modifiers && m.id in modifiers) {
        w += modifiers[m.id as ModuleId] || 0;
      }
    });

    return { ...m, weight: w };
  }).sort((a, b) => b.weight - a.weight);
}


// ─── Situation Detection ────────────────────────────────────────────
// Each trait requires MULTIPLE converging signals to activate.
// This prevents false positives (e.g. clicking a hospital out of curiosity).

export interface DetectionContext {
  locationName: string;
  weather: any;
  pois: any[];
  quakes: any[];
  wiki: any;
  zoomLevel?: number;    // Map zoom: z5=country, z14=neighborhood
  poiCount?: number;     // Total POIs in radius (density proxy)
}

export function detectSituations(ctx: DetectionContext): Set<SituationTrait> {
  const traits = new Set<SituationTrait>();
  const name = (ctx.locationName || "").toLowerCase();
  const poiCount = ctx.poiCount ?? ctx.pois?.length ?? 0;
  const elevation = ctx.weather?.elevation ?? 0;
  const zoom = ctx.zoomLevel ?? 12; // Default to neighborhood level

  // ── 0. ISOLATED ──────────────────────────────────────────────────
  // No POIs and no cultural info
  if (poiCount === 0 && !ctx.wiki && !name.includes(",")) {
    traits.add("ISOLATED");
  }

  // ── 1. VITAL ─────────────────────────────────────────────────────
  // Requires: explicit emergency keyword in location name
  //   OR active major earthquake nearby
  // Does NOT activate just because there's a hospital in the POI list
  // (someone browsing near a hospital ≠ someone needing emergency help)
  
  const isExplicitEmergencySearch = (
    name.includes("hôpital") || 
    name.includes("hospital") ||
    name.includes("urgences") || 
    name.includes("emergency") ||
    name.includes("police") || 
    name.includes("pompier") ||
    name.includes("secours") ||
    name.includes("samu")
  );
  
  const hasMajorQuakeNearby = ctx.quakes?.some(
    (q: any) => q.magnitude >= 4.5 && q.distance < 50
  );
  
  if (isExplicitEmergencySearch || hasMajorQuakeNearby) {
    traits.add("VITAL");
  }

  // ── 2. ATLAS ─────────────────────────────────────────────────────
  // Primary trigger: map zoom level (user is looking at macro scale)
  // Secondary: location name suggests a country/region (no comma = broad)
  
  if (zoom <= 7) {
    // User is zoomed out to country/continent level
    traits.add("ATLAS");
  } else if (zoom <= 9 && !name.includes(",") && poiCount < 3) {
    // Zoomed to region level with no specific place
    traits.add("ATLAS");
  }

  // ── 3. WILD ──────────────────────────────────────────────────────
  // Requires: high altitude AND low POI density
  //   OR explicit nature keywords in name
  // This prevents cities at altitude (Mexico City, Denver) from triggering
  
  const hasNatureKeyword = (
    name.includes("parc national") ||
    name.includes("réserve") ||
    name.includes("forêt") ||
    name.includes("sommet") ||
    name.includes("mont ") ||
    name.includes("pic ") ||
    name.includes("col ") ||
    name.includes("refuge") ||
    name.includes("sentier") ||
    name.includes("randonnée")
  );
  
  const isHighAltitudeLowDensity = elevation > 1000 && poiCount < 8;
  const isVeryHighAltitude = elevation > 2500 && poiCount < 20;
  
  if (hasNatureKeyword || isHighAltitudeLowDensity || isVeryHighAltitude) {
    // Don't mark as WILD if it's clearly urban
    if (!traits.has("ATLAS")) {
      traits.add("WILD");
    }
  }

  // ── 4. URBAN ─────────────────────────────────────────────────────
  // Dense POI area OR explicit urban service keywords
  
  const urbanKeywords = ["mairie", "bibliothèque", "médiathèque", "préfecture", "poste"];
  const hasUrbanKeyword = urbanKeywords.some(k => name.includes(k));
  
  const urbanPOITypes = ["Restaurant", "Hôtel", "Commerce", "Banque", "Supermarché"];
  const urbanPOICount = (ctx.pois || []).filter(
    (p: any) => urbanPOITypes.includes(p.category)
  ).length;
  
  if (urbanPOICount >= 5 || hasUrbanKeyword || (poiCount >= 15 && !traits.has("WILD"))) {
    traits.add("URBAN");
  }

  // ── 5. CULTURAL ──────────────────────────────────────────────────
  // Museum/monument in name, or rich Wikipedia article
  
  const culturalKeywords = ["musée", "museum", "monument", "château", "cathédrale", 
    "basilique", "temple", "mosquée", "synagogue", "palais", "tour ", "opéra"];
  const hasCulturalKeyword = culturalKeywords.some(k => name.includes(k));
  
  const hasRichWiki = ctx.wiki?.extract && ctx.wiki.extract.length > 500;
  const wikiMentionsHistory = ctx.wiki?.description?.toLowerCase().includes("histor") ||
    ctx.wiki?.description?.toLowerCase().includes("monument") ||
    ctx.wiki?.description?.toLowerCase().includes("patrimoine");
  
  if (hasCulturalKeyword || (hasRichWiki && wikiMentionsHistory)) {
    traits.add("CULTURAL");
  }

  // ── 6. TRANSIT ───────────────────────────────────────────────────
  // Explicit transport POI or keyword only. NO movement detection.
  
  const transitKeywords = ["gare", "aéroport", "airport", "station", "terminal", 
    "port ", "quai", "métro", "tramway", "arrêt"];
  const hasTransitKeyword = transitKeywords.some(k => name.includes(k));
  
  const hasTransitPOI = ctx.pois?.some(
    (p: any) => p.category === "Transport" || p.type === "station" || p.type === "aerodrome"
  );
  
  if (hasTransitKeyword || hasTransitPOI) {
    traits.add("TRANSIT");
  }

  // ── 7. MARITIME ──────────────────────────────────────────────────
  // Sea/ocean/coast keywords or very few POIs at low altitude near water
  
  const maritimeKeywords = ["mer ", "océan", "ocean", "plage", "port ", "marina", 
    "phare", "côte", "littoral", "baie"];
  const hasMaritimeKeyword = maritimeKeywords.some(k => name.includes(k));
  
  if (hasMaritimeKeyword) {
    traits.add("MARITIME");
  }

  return traits;
}

// ── Legacy wrapper for backward compatibility ───────────────────────
// (used by LocationDrawer until we migrate all callers to DetectionContext)
export function detectSituationsLegacy(
  locationName: string,
  weather: any,
  pois: any[],
  quakes: any[],
  wiki: any,
  zoomLevel?: number
): Set<SituationTrait> {
  return detectSituations({
    locationName,
    weather,
    pois,
    quakes,
    wiki,
    zoomLevel,
    poiCount: pois?.length,
  });
}
