export interface SearchIntent {
  id: string;
  label: string;
  emoji: string;
  overpassKey: string;
  aliases: string[];
  emptyStateHint: string;
}

export const SEARCH_INTENTS: SearchIntent[] = [
  {
    id: "park",
    label: "Parcs",
    emoji: "🌲",
    overpassKey: "park",
    aliases: ["parc", "parcs", "park", "parks", "nature", "jardin", "jardins"],
    emptyStateHint: "Explorer les parcs et espaces verts proches",
  },
  {
    id: "museum",
    label: "Musées",
    emoji: "🏛️",
    overpassKey: "museum",
    aliases: ["musee", "musée", "musees", "musées", "museum", "museums", "culture"],
    emptyStateHint: "Voir les musées et lieux culturels autour de vous",
  },
  {
    id: "restaurant",
    label: "Restaurants",
    emoji: "☕",
    overpassKey: "restaurant",
    aliases: ["restaurant", "restaurants", "cafe", "café", "cafes", "cafés", "manger"],
    emptyStateHint: "Trouver un lieu pour manger ou prendre un café",
  },
  {
    id: "hotel",
    label: "Hôtels",
    emoji: "🛏️",
    overpassKey: "hotel",
    aliases: ["hotel", "hôtel", "hotels", "hôtels", "hebergement", "hébergement", "sejour", "séjour"],
    emptyStateHint: "Repérer les hébergements à proximité",
  },
  {
    id: "transport",
    label: "Transports",
    emoji: "🚇",
    overpassKey: "transport",
    aliases: ["transport", "transports", "gare", "station", "metro", "métro", "tram", "bus"],
    emptyStateHint: "Afficher les points de mobilité à proximité",
  },
  {
    id: "hospital",
    label: "Santé",
    emoji: "🆘",
    overpassKey: "hospital",
    aliases: ["hopital", "hôpital", "hopitaux", "hôpitaux", "sante", "santé", "urgence", "urgences"],
    emptyStateHint: "Accéder rapidement aux services de santé autour de vous",
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function matchIntent(query: string): SearchIntent | null {
  const normalized = normalize(query);
  if (!normalized) return null;

  return (
    SEARCH_INTENTS.find((intent) =>
      intent.aliases.some((alias) => normalized.includes(normalize(alias)))
    ) || null
  );
}

export function getIntentById(id: string): SearchIntent | null {
  return SEARCH_INTENTS.find((intent) => intent.id === id) || null;
}
