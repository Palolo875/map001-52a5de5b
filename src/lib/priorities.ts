// ─── Situational Intelligence Engine (SIS) ──────────────────────────
// Atlas V2 introduces a richer context model:
//   - Macro domain: broad environmental context
//   - Archetype: more precise sub-context
//   - Signals: dynamic modifiers that affect ranking and UI behavior
//
// The current UI still consumes legacy SituationTrait values, so this
// module exposes a richer profile while keeping backward compatibility.

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

export type MacroDomain =
  | "NATURE"
  | "URBAN"
  | "MARITIME"
  | "CULTURAL"
  | "TRANSIT"
  | "ISOLATED";

export type Archetype =
  | "SAVANNAH"
  | "DESERT"
  | "JUNGLE"
  | "ALPINE"
  | "FOREST"
  | "COASTAL"
  | "OPEN_OCEAN"
  | "HISTORIC_CORE"
  | "MUSEUM_DISTRICT"
  | "CIVIC_CENTER"
  | "AIRPORT_HUB"
  | "STATION_DISTRICT"
  | "REMOTE_FRONTIER";

export type SituationalSignal =
  | "EMERGENCY_SERVICES"
  | "EXTREME_WEATHER"
  | "HIGH_BIODIVERSITY"
  | "NIGHT_TIME"
  | "HISTORICAL_SIGNIFICANCE"
  | "HIGH_ALTITUDE"
  | "LOW_DENSITY"
  | "COASTAL_ACCESS"
  | "TRANSIT_PRESSURE"
  | "FOREIGN_CONTEXT"
  | "MACRO_VIEW";

export interface ModulePriority {
  id: string;
  weight: number;
}

export interface DetectionContext {
  locationName: string;
  weather: any;
  pois: any[];
  quakes: any[];
  wiki: any;
  species?: any[];
  zoomLevel?: number;
  poiCount?: number;
}

export interface SituationReason {
  code: string;
  message: string;
  weight: number;
}

export interface ScoredValue<T extends string> {
  value: T;
  confidence: number;
  reasons: SituationReason[];
}

export interface SituationProfile {
  domain: ScoredValue<MacroDomain> | null;
  archetype: ScoredValue<Archetype> | null;
  signals: Array<ScoredValue<SituationalSignal>>;
  traits: Set<SituationTrait>;
  moduleWeights: ModulePriority[];
}

export type ModuleId =
  | "narrative"
  | "story"
  | "photos"
  | "country"
  | "pois"
  | "navigation"
  | "events_brief"
  | "quakes_brief"
  | "nature_brief"
  | "wiki_brief"
  | "isolated_brief";

const TRAIT_MODIFIERS: Record<SituationTrait, Partial<Record<ModuleId, number>>> = {
  VITAL: {
    pois: +200,
    navigation: +180,
    narrative: +50,
    story: -60,
    photos: -40,
    wiki_brief: -30,
    nature_brief: -50,
  },
  ATLAS: {
    country: +120,
    wiki_brief: +40,
    story: +20,
    pois: -30,
    nature_brief: -10,
  },
  WILD: {
    narrative: +60,
    nature_brief: +80,
    photos: +30,
    pois: -20,
    country: -20,
  },
  URBAN: {
    pois: +60,
    narrative: +30,
    navigation: +20,
    quakes_brief: -10,
    nature_brief: -10,
  },
  CULTURAL: {
    wiki_brief: +80,
    photos: +50,
    story: +30,
  },
  TRANSIT: {
    pois: +100,
    navigation: +70,
    story: -30,
    nature_brief: -30,
  },
  MARITIME: {
    narrative: +50,
    nature_brief: +40,
    pois: -20,
  },
  ISOLATED: {
    isolated_brief: +200,
    navigation: +20,
  },
  NOCTURNE: {
    pois: +40,
    photos: -30,
    nature_brief: -20,
    wiki_brief: -20,
  },
  HOSTILE: {
    narrative: +300,
    events_brief: +150,
    pois: +100,
    story: -100,
    photos: -100,
    wiki_brief: -100,
  },
  FOREIGN: {
    country: +150,
    wiki_brief: +20,
  },
};

type SignalAccumulator = Record<SituationalSignal, SituationReason[]>;
type DomainAccumulator = Record<MacroDomain, SituationReason[]>;
type ArchetypeAccumulator = Record<Archetype, SituationReason[]>;

const SITUATIONAL_SIGNALS: SituationalSignal[] = [
  "EMERGENCY_SERVICES",
  "EXTREME_WEATHER",
  "HIGH_BIODIVERSITY",
  "NIGHT_TIME",
  "HISTORICAL_SIGNIFICANCE",
  "HIGH_ALTITUDE",
  "LOW_DENSITY",
  "COASTAL_ACCESS",
  "TRANSIT_PRESSURE",
  "FOREIGN_CONTEXT",
  "MACRO_VIEW",
];

const MACRO_DOMAINS: MacroDomain[] = [
  "NATURE",
  "URBAN",
  "MARITIME",
  "CULTURAL",
  "TRANSIT",
  "ISOLATED",
];

const ARCHETYPES: Archetype[] = [
  "SAVANNAH",
  "DESERT",
  "JUNGLE",
  "ALPINE",
  "FOREST",
  "COASTAL",
  "OPEN_OCEAN",
  "HISTORIC_CORE",
  "MUSEUM_DISTRICT",
  "CIVIC_CENTER",
  "AIRPORT_HUB",
  "STATION_DISTRICT",
  "REMOTE_FRONTIER",
];

function createAccumulator<T extends string>(keys: readonly T[]): Record<T, SituationReason[]> {
  return keys.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<T, SituationReason[]>);
}

function addReason<T extends string>(
  acc: Record<T, SituationReason[]>,
  key: T,
  code: string,
  message: string,
  weight: number
) {
  acc[key].push({ code, message, weight });
}

function totalWeight(reasons: SituationReason[]): number {
  return reasons.reduce((sum, reason) => sum + reason.weight, 0);
}

function clampConfidence(score: number, threshold: number, ceiling = threshold + 6): number {
  if (score <= 0) return 0;
  if (score <= threshold) return Math.max(0.15, score / threshold * 0.6);
  const ratio = Math.min(1, (score - threshold) / Math.max(1, ceiling - threshold));
  return Math.min(0.98, 0.6 + ratio * 0.38);
}

function selectTopScored<T extends string>(
  acc: Record<T, SituationReason[]>,
  threshold: number
): ScoredValue<T> | null {
  const ranked = Object.entries(acc)
    .map(([value, reasons]) => ({
      value: value as T,
      reasons,
      score: totalWeight(reasons),
    }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;

  const top = ranked[0];
  return {
    value: top.value,
    confidence: clampConfidence(top.score, threshold),
    reasons: top.reasons,
  };
}

function selectSignals(
  acc: SignalAccumulator,
  threshold: number
): Array<ScoredValue<SituationalSignal>> {
  return Object.entries(acc)
    .map(([value, reasons]) => ({
      value: value as SituationalSignal,
      reasons,
      score: totalWeight(reasons),
    }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      value: item.value,
      confidence: clampConfidence(item.score, threshold),
      reasons: item.reasons,
    }));
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAnyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function deriveTraits(
  domain: ScoredValue<MacroDomain> | null,
  archetype: ScoredValue<Archetype> | null,
  signals: Array<ScoredValue<SituationalSignal>>,
  ctx: DetectionContext
): Set<SituationTrait> {
  const traits = new Set<SituationTrait>();
  const signalSet = new Set(signals.map((signal) => signal.value));
  const elevation = ctx.weather?.elevation ?? 0;

  if (ctx.zoomLevel !== undefined && ctx.zoomLevel <= 9) {
    traits.add("ATLAS");
  }

  switch (domain?.value) {
    case "NATURE":
      traits.add("WILD");
      break;
    case "URBAN":
      traits.add("URBAN");
      break;
    case "MARITIME":
      traits.add("MARITIME");
      break;
    case "CULTURAL":
      traits.add("CULTURAL");
      break;
    case "TRANSIT":
      traits.add("TRANSIT");
      break;
    case "ISOLATED":
      traits.add("ISOLATED");
      break;
  }

  if (signalSet.has("EMERGENCY_SERVICES")) {
    traits.add("VITAL");
  }

  if (signalSet.has("NIGHT_TIME")) {
    traits.add("NOCTURNE");
  }

  if (signalSet.has("FOREIGN_CONTEXT")) {
    traits.add("FOREIGN");
  }

  if (signalSet.has("EXTREME_WEATHER")) {
    traits.add("HOSTILE");
  }

  if (
    archetype?.value === "HISTORIC_CORE" ||
    archetype?.value === "MUSEUM_DISTRICT" ||
    signalSet.has("HISTORICAL_SIGNIFICANCE")
  ) {
    traits.add("CULTURAL");
  }

  if (
    domain?.value === "NATURE" &&
    (signalSet.has("HIGH_ALTITUDE") || elevation > 2000 || archetype?.value === "ALPINE")
  ) {
    traits.add("WILD");
  }

  return traits;
}

function scoreSignals(ctx: DetectionContext): SignalAccumulator {
  const signals = createAccumulator(SITUATIONAL_SIGNALS);
  const name = normalize(ctx.locationName || "");
  const poiCount = ctx.poiCount ?? ctx.pois?.length ?? 0;
  const current = ctx.weather?.current;
  const wikiExtract = normalize(ctx.wiki?.extract || "");
  const wikiDescription = normalize(ctx.wiki?.description || "");

  const emergencyKeywords = [
    "hopital",
    "hospital",
    "urgences",
    "emergency",
    "police",
    "pompier",
    "secours",
    "samu",
  ];
  if (hasAnyKeyword(name, emergencyKeywords)) {
    addReason(signals, "EMERGENCY_SERVICES", "name:emergency", "Le nom du lieu evoque un service d'urgence.", 4);
  }
  if (ctx.quakes?.some((quake: any) => quake.magnitude >= 4.5 && quake.distance < 50)) {
    addReason(signals, "EMERGENCY_SERVICES", "quakes:major-nearby", "Un seisme significatif est detecte a proximite.", 3);
  }

  const isExtremeWeather =
    (current?.windGusts ?? 0) >= 70 ||
    (current?.precipitation ?? 0) >= 15 ||
    (current?.uvIndex ?? 0) >= 9 ||
    [95, 96, 99].includes(current?.weatherCode);
  if (isExtremeWeather) {
    addReason(signals, "EXTREME_WEATHER", "weather:severe", "Les conditions meteo sont potentiellement hostiles.", 4);
  }

  const speciesCount = Array.isArray(ctx.species) ? ctx.species.length : 0;
  if (speciesCount >= 12) {
    addReason(signals, "HIGH_BIODIVERSITY", "nature:species-density", "La densite d'especes connues est elevee.", 3);
  }
  if (hasAnyKeyword(wikiExtract, ["ecosysteme", "biodiversite", "reserve naturelle", "faune", "corail"])) {
    addReason(signals, "HIGH_BIODIVERSITY", "wiki:biodiversity", "Le texte encyclopedique confirme un contexte biodiversite.", 2);
  }

  if (current?.isDay === false) {
    addReason(signals, "NIGHT_TIME", "weather:night", "Le lieu est actuellement dans sa phase nocturne.", 3);
  }

  if (hasAnyKeyword(name, ["musee", "museum", "monument", "chateau", "cathedrale", "palais", "opera"])) {
    addReason(signals, "HISTORICAL_SIGNIFICANCE", "name:cultural", "Le nom du lieu indique un site culturel ou patrimonial.", 4);
  }
  if (hasAnyKeyword(wikiDescription, ["histor", "monument", "patrimoine"])) {
    addReason(signals, "HISTORICAL_SIGNIFICANCE", "wiki:historical", "La description Wikipedia indique une forte valeur historique.", 3);
  }

  if ((ctx.weather?.elevation ?? 0) >= 1200) {
    addReason(signals, "HIGH_ALTITUDE", "terrain:elevation", "L'altitude du lieu est elevee.", 3);
  }

  if (poiCount <= 3) {
    addReason(signals, "LOW_DENSITY", "poi:scarce", "Le nombre de POI detectes est tres faible.", 3);
  }

  if (hasAnyKeyword(name, ["plage", "marina", "littoral", "cote", "baie", "ocean", "ocean ", "mer "])) {
    addReason(signals, "COASTAL_ACCESS", "name:coast", "Le nom du lieu evoque un environnement cotier ou marin.", 4);
  }

  const transitPoiCount = (ctx.pois || []).filter(
    (poi: any) => poi.category === "Transport" || poi.type === "station" || poi.type === "aerodrome"
  ).length;
  if (transitPoiCount >= 2) {
    addReason(signals, "TRANSIT_PRESSURE", "poi:transit-density", "La densite d'equipements de transport est elevee.", 3);
  }
  if (hasAnyKeyword(name, ["gare", "aeroport", "airport", "station", "terminal", "metro", "tramway", "quai"])) {
    addReason(signals, "TRANSIT_PRESSURE", "name:transit", "Le nom du lieu indique un noeud de transport.", 4);
  }

  if (ctx.zoomLevel !== undefined && ctx.zoomLevel <= 7) {
    addReason(signals, "MACRO_VIEW", "zoom:macro", "La carte est observee a une echelle macro.", 4);
  } else if (ctx.zoomLevel !== undefined && ctx.zoomLevel <= 9 && !name.includes(",") && poiCount < 3) {
    addReason(signals, "MACRO_VIEW", "zoom:regional", "La vue correspond davantage a une region qu'a un lieu precis.", 3);
  }

  if (ctx.wiki?.facts?.population && ctx.wiki.facts.population > 1_000_000 && poiCount < 5) {
    addReason(signals, "FOREIGN_CONTEXT", "wiki:country-scale", "Le contexte semble large et peu localise.", 2);
  }

  return signals;
}

function scoreDomains(ctx: DetectionContext, signals: SignalAccumulator): DomainAccumulator {
  const domains = createAccumulator(MACRO_DOMAINS);
  const name = normalize(ctx.locationName || "");
  const poiCount = ctx.poiCount ?? ctx.pois?.length ?? 0;
  const wikiExtract = normalize(ctx.wiki?.extract || "");
  const elevation = ctx.weather?.elevation ?? 0;

  if (totalWeight(signals.LOW_DENSITY) > 0 && !ctx.wiki && !name.includes(",")) {
    addReason(domains, "ISOLATED", "context:no-anchor", "Le lieu semble sans ancrage urbain ni culturel.", 4);
  }
  if (poiCount === 0) {
    addReason(domains, "ISOLATED", "poi:none", "Aucun POI n'a ete detecte dans le rayon courant.", 3);
  }

  if (hasAnyKeyword(name, ["parc national", "reserve", "foret", "sommet", "mont ", "pic ", "col ", "refuge", "sentier", "randonnee"])) {
    addReason(domains, "NATURE", "name:nature", "Le nom du lieu correspond a un environnement naturel.", 4);
  }
  if (totalWeight(signals.HIGH_ALTITUDE) > 0) {
    addReason(domains, "NATURE", "signal:altitude", "L'altitude elevee renforce le contexte naturel.", 2);
  }
  if (totalWeight(signals.HIGH_BIODIVERSITY) > 0) {
    addReason(domains, "NATURE", "signal:biodiversity", "La biodiversite renforce le domaine nature.", 3);
  }
  if (elevation > 2500 && poiCount < 20) {
    addReason(domains, "NATURE", "terrain:very-high", "Le terrain est tres eleve et peu dense.", 3);
  }

  const urbanPoiCount = (ctx.pois || []).filter((poi: any) =>
    ["Restaurant", "Hotel", "Hôtel", "Commerce", "Banque", "Supermarche", "Supermarché"].includes(poi.category)
  ).length;
  if (urbanPoiCount >= 5) {
    addReason(domains, "URBAN", "poi:urban-density", "La densite de services urbains est forte.", 4);
  }
  if (poiCount >= 15 && elevation < 1500) {
    addReason(domains, "URBAN", "poi:overall-density", "Le nombre total de POI suggere un tissu urbain.", 3);
  }
  if (hasAnyKeyword(name, ["mairie", "bibliotheque", "mediatheque", "prefecture", "poste"])) {
    addReason(domains, "URBAN", "name:civic", "Le lieu semble etre un equipement civique urbain.", 3);
  }

  if (totalWeight(signals.COASTAL_ACCESS) > 0) {
    addReason(domains, "MARITIME", "signal:coastal", "Les signaux cotiers orientent vers le maritime.", 4);
  }
  if (hasAnyKeyword(wikiExtract, ["ocean", "mer", "coti", "port", "maritime", "recif", "corail"])) {
    addReason(domains, "MARITIME", "wiki:maritime", "Le contexte encyclopedique confirme une dimension maritime.", 2);
  }

  if (totalWeight(signals.HISTORICAL_SIGNIFICANCE) > 0) {
    addReason(domains, "CULTURAL", "signal:historical", "Le lieu porte un fort signal culturel ou patrimonial.", 4);
  }
  if (ctx.wiki?.extract && ctx.wiki.extract.length > 500) {
    addReason(domains, "CULTURAL", "wiki:rich", "Le contenu encyclopedique est suffisamment riche pour justifier un domaine culturel.", 2);
  }

  if (totalWeight(signals.TRANSIT_PRESSURE) > 0) {
    addReason(domains, "TRANSIT", "signal:transit", "Le lieu se comporte comme un noeud de mobilite.", 4);
  }

  return domains;
}

function scoreArchetypes(
  ctx: DetectionContext,
  domain: ScoredValue<MacroDomain> | null,
  signals: SignalAccumulator
): ArchetypeAccumulator {
  const archetypes = createAccumulator(ARCHETYPES);
  const name = normalize(ctx.locationName || "");
  const wikiExtract = normalize(ctx.wiki?.extract || "");
  const elevation = ctx.weather?.elevation ?? 0;
  const poiCount = ctx.poiCount ?? ctx.pois?.length ?? 0;

  if (domain?.value === "NATURE") {
    if (elevation >= 2000 || hasAnyKeyword(name, ["sommet", "mont ", "pic ", "alpes", "glacier"])) {
      addReason(archetypes, "ALPINE", "terrain:alpine", "Le relief correspond a un contexte alpin.", 4);
    }
    if (hasAnyKeyword(name, ["desert", "dune", "erg"])) {
      addReason(archetypes, "DESERT", "name:desert", "Le nom indique un biotope desertique.", 4);
    }
    if (hasAnyKeyword(name, ["foret", "forest", "bois"])) {
      addReason(archetypes, "FOREST", "name:forest", "Le nom indique un couvert forestier.", 4);
    }
    if (hasAnyKeyword(wikiExtract, ["savane", "savannah"])) {
      addReason(archetypes, "SAVANNAH", "wiki:savannah", "Le texte mentionne un biome de savane.", 4);
    }
    if (hasAnyKeyword(wikiExtract, ["jungle", "foret tropicale", "rainforest"])) {
      addReason(archetypes, "JUNGLE", "wiki:jungle", "Le texte mentionne un biome tropical dense.", 4);
    }
  }

  if (domain?.value === "MARITIME") {
    if (poiCount === 0 && !ctx.wiki) {
      addReason(archetypes, "OPEN_OCEAN", "context:open-ocean", "Le contexte ressemble a une zone maritime ouverte.", 4);
    } else {
      addReason(archetypes, "COASTAL", "context:coastal", "Le lieu semble accessible depuis le littoral.", 3);
    }
  }

  if (domain?.value === "CULTURAL") {
    if (hasAnyKeyword(name, ["musee", "museum"])) {
      addReason(archetypes, "MUSEUM_DISTRICT", "name:museum", "Le lieu est associe a une fonction museale.", 4);
    }
    if (hasAnyKeyword(name, ["cathedrale", "chateau", "monument", "palais", "vieille ville"])) {
      addReason(archetypes, "HISTORIC_CORE", "name:historic", "Le lieu evoque un coeur historique.", 4);
    }
  }

  if (domain?.value === "URBAN") {
    if (hasAnyKeyword(name, ["mairie", "prefecture", "hotel de ville"])) {
      addReason(archetypes, "CIVIC_CENTER", "name:civic-center", "Le lieu semble faire partie d'un centre civique.", 4);
    }
  }

  if (domain?.value === "TRANSIT") {
    if (hasAnyKeyword(name, ["aeroport", "airport", "terminal"])) {
      addReason(archetypes, "AIRPORT_HUB", "name:airport", "Le lieu correspond a un hub aeroportuaire.", 4);
    }
    if (hasAnyKeyword(name, ["gare", "station", "metro", "tramway", "quai"])) {
      addReason(archetypes, "STATION_DISTRICT", "name:station", "Le lieu correspond a un pole gare/station.", 4);
    }
  }

  if (domain?.value === "ISOLATED" || (totalWeight(signals.LOW_DENSITY) > 0 && elevation > 800)) {
    addReason(archetypes, "REMOTE_FRONTIER", "context:remote", "Le lieu semble isole et peu equipe.", 3);
  }

  return archetypes;
}

export function calculateModuleWeights(traits: Set<SituationTrait>): ModulePriority[] {
  const modules: ModulePriority[] = [
    { id: "narrative", weight: 100 },
    { id: "story", weight: 85 },
    { id: "photos", weight: 70 },
    { id: "wiki_brief", weight: 55 },
    { id: "country", weight: 45 },
    { id: "events_brief", weight: 40 },
    { id: "pois", weight: 35 },
    { id: "nature_brief", weight: 25 },
    { id: "quakes_brief", weight: 15 },
    { id: "navigation", weight: 10 },
    { id: "isolated_brief", weight: 5 },
  ];

  return modules
    .map((module) => {
      let weight = module.weight;
      traits.forEach((trait) => {
        const modifiers = TRAIT_MODIFIERS[trait];
        if (modifiers && module.id in modifiers) {
          weight += modifiers[module.id as ModuleId] || 0;
        }
      });
      return { ...module, weight };
    })
    .sort((a, b) => b.weight - a.weight);
}

export function analyzeSituation(ctx: DetectionContext): SituationProfile {
  const signalAcc = scoreSignals(ctx);
  const domainAcc = scoreDomains(ctx, signalAcc);
  const domain = selectTopScored(domainAcc, 4);
  const archetypeAcc = scoreArchetypes(ctx, domain, signalAcc);
  const archetype = selectTopScored(archetypeAcc, 4);
  const signals = selectSignals(signalAcc, 3);
  const traits = deriveTraits(domain, archetype, signals, ctx);

  return {
    domain,
    archetype,
    signals,
    traits,
    moduleWeights: calculateModuleWeights(traits),
  };
}

export function detectSituations(ctx: DetectionContext): Set<SituationTrait> {
  return analyzeSituation(ctx).traits;
}

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
