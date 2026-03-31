// ─── Geocoding Service Layer ─────────────────────────────────────────
// Architecture: Local Index (DATASET_FIRST) → Photon (fallback) → Nominatim (last resort)
// source-audit.md: Photon is FALLBACK_ONLY at maturity

export interface GeoResult {
  name: string;
  country: string;
  state?: string;
  city?: string;
  lat: number;
  lon: number;
  type: string;
}

// ─── In-memory cache for reverse geocode ─────────────────────────────
const reverseCache = new Map<string, { name: string; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

// ─── Forward Search ──────────────────────────────────────────────────
// DATASET_FIRST: first query our own local geonames_lite index (offline/instant)
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!query || query.length < 2) return [];
  
  try {
    // 1. DATASET_FIRST: Local index search
    const localResults = await searchLocalGeonames(query);
    if (localResults.length > 5) {
      return localResults.slice(0, 5); 
    }

    // 2. FALLBACK_ONLY: External APIs (Photon)
    const external = await searchPhoton(query);
    return [...localResults, ...external].slice(0, 5);
  } catch {
    // Fallback to Nominatim if Photon is down
    return await searchNominatim(query);
  }
}

// ─── Local Index Search ──────────────────────────────────────────────
let localIndexCache: any[] | null = null;
async function searchLocalGeonames(query: string): Promise<GeoResult[]> {
  try {
    if (!localIndexCache) {
      const res = await fetch('/datasets/geonames_lite.json');
      if (res.ok) localIndexCache = await res.json();
    }
    
    if (!localIndexCache) return [];

    const normQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (localIndexCache || [])
      .filter(city => {
        const normName = city.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normName.includes(normQuery);
      })
      .map(city => ({
        ...city,
        type: "city"
      }));
  } catch {
    return [];
  }
}

async function searchPhoton(query: string): Promise<GeoResult[]> {
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=fr`
  );
  if (!res.ok) throw new Error("Photon unavailable");
  const data = await res.json();

  return (data.features || []).map((f: any) => ({
    name: f.properties.name || f.properties.city || "Lieu inconnu",
    country: f.properties.country || "",
    state: f.properties.state,
    city: f.properties.city,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    type: f.properties.osm_value || f.properties.type || "",
  }));
}

async function searchNominatim(query: string): Promise<GeoResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=fr`,
    { headers: { "User-Agent": "AtlasNav/1.0" } }
  );
  if (!res.ok) return [];
  const data = await res.json();

  return (data || []).map((r: any) => ({
    name: r.display_name?.split(",")[0] || "Lieu inconnu",
    country: r.display_name?.split(",").pop()?.trim() || "",
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    type: r.type || "",
  }));
}

// ─── Reverse Geocode ─────────────────────────────────────────────────
// Chain: Cache → Photon → Nominatim
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key = cacheKey(lat, lon);
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.name;
  }

  let name = "Lieu inconnu";

  try {
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=fr&limit=1`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.features?.length > 0) {
        const p = data.features[0].properties;
        name = p.city || p.name || p.county || "Lieu inconnu";
      }
    }
  } catch {}

  if (name === "Lieu inconnu") {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`,
        { headers: { "User-Agent": "AtlasNav/1.0" } }
      );
      if (res.ok) {
        const data = await res.json();
        name = data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(",")[0] || "Lieu inconnu";
      }
    } catch {}
  }

  reverseCache.set(key, { name, ts: Date.now() });
  return name;
}
