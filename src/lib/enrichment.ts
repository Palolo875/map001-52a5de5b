// Enrichment APIs — all free, no API key required

// ─── Wikipedia / Wikimedia ───────────────────────────────────────────
export interface WikiSummary {
  title: string;
  extract: string;
  thumbnail?: string;
  url: string;
  description?: string;
  wikidataId?: string;
  facts?: {
    population?: number;
    elevation?: number;
    area?: number; // km²
  };
}

export async function fetchWikipediaSummary(lat: number, lon: number, locationName: string): Promise<WikiSummary | null> {
  try {
    const geoRes = await fetch(
      `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=3&format=json&origin=*`
    );
    const geoData = await geoRes.json();
    const pages = geoData?.query?.geosearch || [];
    
    let pageTitle = pages.length > 0 ? pages[0].title : null;
    if (!pageTitle) {
      const searchRes = await fetch(
        `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(locationName)}&limit=1&format=json&origin=*`
      );
      const searchData = await searchRes.json();
      if (searchData[1]?.length > 0) pageTitle = searchData[1][0];
    }

    if (!pageTitle) return null;

    const summaryRes = await fetch(
      `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
    );
    if (!summaryRes.ok) return null;
    const summary = await summaryRes.json();

    let facts;
    if (summary.wikibase_item) {
      try {
        const wdRes = await fetch(
          `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${summary.wikibase_item}&property=P1082|P2044|P2046&format=json&origin=*`
        );
        const wdData = await wdRes.json();
        const claims = wdData?.claims || {};
        facts = {};
        
        if (claims.P1082?.[0]?.mainsnak?.datavalue?.value?.amount) {
          facts.population = parseInt(claims.P1082[0].mainsnak.datavalue.value.amount.replace('+', ''));
        }
        if (claims.P2044?.[0]?.mainsnak?.datavalue?.value?.amount) {
          facts.elevation = parseFloat(claims.P2044[0].mainsnak.datavalue.value.amount.replace('+', ''));
        }
        if (claims.P2046?.[0]?.mainsnak?.datavalue?.value?.amount) {
          facts.area = parseFloat(claims.P2046[0].mainsnak.datavalue.value.amount.replace('+', ''));
        }
      } catch (e) {
        console.error("Failed fetching Wikidata facts:", e);
      }
    }

    return {
      title: summary.title,
      extract: summary.extract || "",
      thumbnail: summary.thumbnail?.source,
      url: summary.content_urls?.desktop?.page || "",
      description: summary.description,
      wikidataId: summary.wikibase_item,
      facts,
    };
  } catch {
    return null;
  }
}

// ─── Wikimedia Commons photos ────────────────────────────────────────
export interface WikimediaPhoto {
  title: string;
  url: string;
  thumbUrl: string;
  lat: number;
  lon: number;
}

export async function fetchWikimediaPhotos(lat: number, lon: number, limit = 6): Promise<WikimediaPhoto[]> {
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=5000&gslimit=${limit}&gsnamespace=6&format=json&origin=*`
    );
    const data = await res.json();
    const files = data?.query?.geosearch || [];

    const photos: WikimediaPhoto[] = [];
    const filterRegex = /(marathon|course|sign|logo|map|flag|flagge|carte|panneau|blason|icon)/i;
    for (const file of files) {
      if (filterRegex.test(file.title)) continue;
      try {
        const infoRes = await fetch(
          `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(file.title)}&prop=imageinfo&iiprop=url|thumbmime&iiurlwidth=400&format=json&origin=*`
        );
        const infoData = await infoRes.json();
        const pages = infoData?.query?.pages;
        const pageData = pages ? Object.values(pages)[0] as any : null;
        const ii = pageData?.imageinfo?.[0];
        if (ii) {
          photos.push({
            title: file.title.replace("File:", "").replace(/\.\w+$/, ""),
            url: ii.url,
            thumbUrl: ii.thumburl || ii.url,
            lat: file.lat,
            lon: file.lon,
          });
        }
      } catch {}
    }
    return photos;
  } catch {
    return [];
  }
}

// ─── Countries Dataset (DATASET_FIRST) ───────────────────────────────
let countriesCache: any[] | null = null;

async function getCountriesDataset(): Promise<any[] | null> {
  if (countriesCache) return countriesCache;
  try {
    const res = await fetch('/datasets/countries.json');
    if (!res.ok) return null;
    countriesCache = await res.json();
    return countriesCache;
  } catch {
    return null;
  }
}

export interface CountryInfo {
  name: string;
  nativeName: string;
  flag: string;
  capital: string;
  population: number;
  area: number;
  region: string;
  subregion: string;
  languages: string[];
  currencies: { code: string; name: string; symbol: string }[];
  timezones: string[];
  callingCode: string;
  tld: string;
  borders: string[];
  emergency?: {
    all: string;
    police?: string;
    ambulance?: string;
    fire?: string;
  };
}

export async function fetchCountryInfo(lat: number, lon: number): Promise<CountryInfo | null> {
  try {
    const geoRes = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=fr&limit=1`
    );
    const geoData = await geoRes.json();
    const countryCode = geoData?.features?.[0]?.properties?.countrycode;
    if (!countryCode) return null;

    const allList = await getCountriesDataset();
    if (!allList) return null;
    const c = allList.find((country: any) => country.cca2 === countryCode);
    if (!c) return null;

    const emergencyList = await getEmergencyDataset();
    const emm = emergencyList?.find((e: any) => e.countryCode === countryCode);

    const langNames = new Intl.DisplayNames(['fr'], { type: 'language' });
    const langs = c.languages 
      ? Object.keys(c.languages).map(code => {
          try {
            return langNames.of(code) || c.languages[code];
          } catch {
            return c.languages[code];
          }
        })
      : [];
    const currs = c.currencies
      ? Object.entries(c.currencies).map(([code, v]: [string, any]) => ({
          code,
          name: v.name || "",
          symbol: v.symbol || "",
        }))
      : [];

    return {
      name: c.name?.common || "",
      nativeName: c.name?.nativeName ? Object.values(c.name.nativeName as Record<string, any>)[0]?.common || "" : "",
      flag: c.flags?.svg || c.flags?.png || "",
      capital: c.capital?.[0] || "",
      population: c.population || 0,
      area: c.area || 0,
      region: c.region || "",
      subregion: c.subregion || "",
      languages: langs,
      currencies: currs,
      timezones: c.timezones || [],
      callingCode: c.idd?.root ? `${c.idd.root}${c.idd.suffixes?.[0] || ""}` : "",
      tld: c.tld?.[0] || "",
      borders: c.borders || [],
      emergency: emm?.emergency,
    };
  } catch {
    return null;
  }
}

// ─── Emergency Dataset ───────────────────────────────────────────────
let emergencyCache: any[] | null = null;
async function getEmergencyDataset(): Promise<any[] | null> {
  if (emergencyCache) return emergencyCache;
  try {
    const res = await fetch('/datasets/emergency.json');
    if (!res.ok) return null;
    emergencyCache = await res.json();
    return emergencyCache;
  } catch {
    return null;
  }
}

// ─── Overpass (OSM) — nearby POIs ────────────────────────────────────
export interface NearbyPOI {
  name: string;
  type: string;
  category: string;
  distance: number;
  lat: number;
  lon: number;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const overpassCategories: Record<string, { query: string; label: string }> = {
  transport: { query: `node["public_transport"="station"]`, label: "Transport" },
  hospital: { query: `node["amenity"="hospital"]`, label: "Hôpital" },
  pharmacy: { query: `node["amenity"="pharmacy"]`, label: "Pharmacie" },
  restaurant: { query: `node["amenity"="restaurant"]`, label: "Restaurant" },
  hotel: { query: `node["tourism"="hotel"]`, label: "Hôtel" },
  museum: { query: `node["tourism"="museum"]`, label: "Musée" },
  park: { query: `node["leisure"="park"]`, label: "Parc" },
  worship: { query: `node["amenity"="place_of_worship"]`, label: "Lieu de culte" },
};

async function fetchLocalOverturePOIs(lat: number, lon: number, radiusM: number): Promise<NearbyPOI[] | null> {
  return null;
}

export async function fetchNearbyPOIs(lat: number, lon: number, radiusM = 2000): Promise<NearbyPOI[]> {
  try {
    const localPOIs = await fetchLocalOverturePOIs(lat, lon, radiusM);
    if (localPOIs && localPOIs.length > 0) return localPOIs;

    const queries = Object.entries(overpassCategories)
      .map(([, v]) => `${v.query}(around:${radiusM},${lat},${lon});`)
      .join("");

    const query = `[out:json][timeout:10];(${queries});out body 50;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = await res.json();

    const pois: NearbyPOI[] = (data.elements || [])
      .filter((e: any) => e.tags?.name)
      .map((e: any) => {
        const tags = e.tags;
        let category = "Lieu";
        if (tags.public_transport) category = "Transport";
        else if (tags.amenity === "hospital") category = "Hôpital";
        else if (tags.amenity === "pharmacy") category = "Pharmacie";
        else if (tags.amenity === "restaurant") category = "Restaurant";
        else if (tags.tourism === "hotel") category = "Hôtel";
        else if (tags.tourism === "museum") category = "Musée";
        else if (tags.leisure === "park") category = "Parc";
        else if (tags.amenity === "place_of_worship") category = "Lieu de culte";

        return {
          name: tags.name,
          type: tags.amenity || tags.tourism || tags.leisure || tags.public_transport || "",
          category,
          distance: Math.round(haversine(lat, lon, e.lat, e.lon)),
          lat: e.lat,
          lon: e.lon,
        };
      })
      .sort((a: NearbyPOI, b: NearbyPOI) => a.distance - b.distance)
      .slice(0, 20);

    return pois;
  } catch {
    return [];
  }
}

// ─── USGS Earthquake ─────────────────────────────────────────────────
export interface Earthquake {
  title: string;
  magnitude: number;
  depth: number;
  place: string;
  time: number;
  distance: number;
  url: string;
  lat: number;
  lon: number;
}

export async function fetchEarthquakes(lat: number, lon: number, radiusKm = 300, days = 30): Promise<Earthquake[]> {
  try {
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const res = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm}&minmagnitude=2&orderby=time&limit=10`
    );
    const data = await res.json();

    return (data.features || []).map((f: any) => ({
      title: f.properties.title,
      magnitude: f.properties.mag,
      depth: f.geometry.coordinates[2] || 0,
      place: f.properties.place,
      time: f.properties.time,
      distance: Math.round(haversine(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) / 1000),
      url: f.properties.url,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
  } catch {
    return [];
  }
}

// ─── EONET NASA (Natural Events) ────────────────────────────────────
export interface NaturalEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  distanceKm: number;
  lat: number;
  lon: number;
}

export async function fetchEONETEvents(lat: number, lon: number, radiusKm = 500): Promise<NaturalEvent[]> {
  try {
    const res = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30`);
    if (!res.ok) return [];
    
    const data = await res.json();
    const result: NaturalEvent[] = [];
    
    for (const event of data.events || []) {
      const geom = event.geometry?.[0];
      if (geom && geom.coordinates) {
        let eLon, eLat;
        if (geom.type === "Point") {
          [eLon, eLat] = geom.coordinates;
        } else if (geom.type === "Polygon" && Array.isArray(geom.coordinates[0])) {
          [eLon, eLat] = geom.coordinates[0][0];
        } else {
          continue;
        }

        const dist = Math.round(haversine(lat, lon, eLat, eLon) / 1000);
        if (dist <= radiusKm) {
          result.push({
            id: event.id,
            title: event.title,
            category: event.categories?.[0]?.title || "Natural Event",
            date: geom.date,
            distanceKm: dist,
            lat: eLat,
            lon: eLon,
          });
        }
      }
    }
    
    return result.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch {
    return [];
  }
}

// ─── GBIF (biodiversity) ────────────────────────────────────────────
export interface GBIFSpecies {
  scientificName: string;
  vernacularName: string;
  kingdom: string;
  count: number;
  occurrences: { lat: number; lon: number }[];
}

const translateTaxonomy = (kingdom: string, className: string) => {
  if (className === "Aves") return "Oiseaux";
  if (className === "Mammalia") return "Mammifères";
  if (className === "Insecta") return "Insectes";
  if (className === "Magnoliopsida") return "Plantes à fleurs";
  if (className === "Amphibia") return "Amphibiens";
  if (className === "Reptilia") return "Reptiles";
  if (className === "Gastropoda" || className === "Bivalvia") return "Mollusques";
  if (kingdom === "Plantae") return "Plantes";
  if (kingdom === "Fungi") return "Champignons";
  if (kingdom === "Animalia") return "Animaux";
  return kingdom || "Inconnu";
};

export async function fetchGBIFSpecies(lat: number, lon: number): Promise<GBIFSpecies[]> {
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${(lat - 0.1).toFixed(2)},${(lat + 0.1).toFixed(2)}&decimalLongitude=${(lon - 0.1).toFixed(2)},${(lon + 0.1).toFixed(2)}&limit=50&hasCoordinate=true&hasGeospatialIssue=false`
    );
    const data = await res.json();

    const speciesMap = new Map<string, GBIFSpecies>();
    for (const r of data.results || []) {
      if (!r.species) continue;
      const key = r.species;
      if (speciesMap.has(key)) {
        const s = speciesMap.get(key)!;
        s.count++;
        if (r.decimalLatitude && r.decimalLongitude) {
          s.occurrences.push({ lat: r.decimalLatitude, lon: r.decimalLongitude });
        }
      } else {
        speciesMap.set(key, {
          scientificName: r.species,
          vernacularName: r.vernacularName || "",
          kingdom: translateTaxonomy(r.kingdom, r.class),
          count: 1,
          occurrences: (r.decimalLatitude && r.decimalLongitude) ? [{ lat: r.decimalLatitude, lon: r.decimalLongitude }] : [],
        });
      }
    }

    return Array.from(speciesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  } catch {
    return [];
  }
}

// ─── iNaturalist (biodiversity) ──────────────────────────────────────
export async function fetchINaturalistSpecies(lat: number, lon: number): Promise<GBIFSpecies[]> {
  try {
    const res = await fetch(
      `https://api.inaturalist.org/v1/observations?lat=${lat}&lng=${lon}&radius=2&per_page=30&order=desc&order_by=created_at`
    );
    const data = await res.json();
    const speciesMap = new Map<string, GBIFSpecies>();

    for (const obs of data.results || []) {
      if (!obs.taxon) continue;
      const key = obs.taxon.name;
      if (speciesMap.has(key)) {
        const s = speciesMap.get(key)!;
        s.count++;
      } else {
        speciesMap.set(key, {
          scientificName: obs.taxon.name,
          vernacularName: obs.taxon.preferred_common_name || obs.taxon.name,
          kingdom: obs.taxon.iconic_taxon_name || "Lieu",
          count: 1,
          occurrences: obs.location ? [{ lat: parseFloat(obs.location.split(',')[0]), lon: parseFloat(obs.location.split(',')[1]) }] : [],
        });
      }
    }
    return Array.from(speciesMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  } catch {
    return [];
  }
}

// ─── Deep Links — universal navigation ──────────────────────────────
export function generateDeepLink(lat: number, lon: number, label?: string): string {
  const encodedLabel = label ? encodeURIComponent(label) : "";
  return `geo:${lat},${lon}?q=${lat},${lon}(${encodedLabel})`;
}

export function generateGoogleMapsLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export function generateAppleMapsLink(lat: number, lon: number, label?: string): string {
  return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d${label ? `&q=${encodeURIComponent(label)}` : ""}`;
}

export function generateWazeLink(lat: number, lon: number): string {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

export function generateOsmAndLink(lat: number, lon: number): string {
  return `https://osmand.net/go?lat=${lat}&lon=${lon}&z=15`;
}

export interface NavigationOption {
  label: string;
  url: string;
  icon?: string;
}

export function getNavigationOptions(lat: number, lon: number, label?: string): NavigationOption[] {
  return [
    { label: "App native", url: generateDeepLink(lat, lon, label) },
    { label: "Google Maps", url: generateGoogleMapsLink(lat, lon) },
    { label: "Apple Maps", url: generateAppleMapsLink(lat, lon, label) },
    { label: "Waze", url: generateWazeLink(lat, lon) },
    { label: "OsmAnd", url: generateOsmAndLink(lat, lon) },
  ];
}
