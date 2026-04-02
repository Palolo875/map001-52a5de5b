import { describe, expect, it } from "vitest";
import { analyzeSituation, calculateModuleWeights, detectSituations } from "@/lib/priorities";

function baseContext() {
  return {
    locationName: "Lieu inconnu",
    weather: {
      elevation: 120,
      current: {
        isDay: true,
        windGusts: 12,
        precipitation: 0,
        uvIndex: 3,
        weatherCode: 1,
      },
    },
    pois: [],
    quakes: [],
    wiki: null,
    zoomLevel: 12,
    poiCount: 0,
    species: [],
  };
}

describe("situational intelligence engine", () => {
  it("classifies alpine natural contexts with explicit reasons", () => {
    const profile = analyzeSituation({
      ...baseContext(),
      locationName: "Sommet du Mont Blanc",
      weather: {
        ...baseContext().weather,
        elevation: 3200,
      },
      wiki: {
        extract: "Le sommet alpin domine un ecosysteme de haute montagne.",
        description: "sommet historique",
      },
      species: new Array(15).fill({ scientificName: "species" }),
      poiCount: 2,
    });

    expect(profile.domain?.value).toBe("NATURE");
    expect(profile.archetype?.value).toBe("ALPINE");
    expect(profile.traits.has("WILD")).toBe(true);
    expect(profile.signals.some((signal) => signal.value === "HIGH_ALTITUDE")).toBe(true);
    expect(profile.domain?.reasons.length).toBeGreaterThan(0);
  });

  it("promotes cultural contexts from place naming and encyclopedia signals", () => {
    const profile = analyzeSituation({
      ...baseContext(),
      locationName: "Musée du Louvre",
      pois: [{ category: "Restaurant", type: "restaurant" }],
      poiCount: 1,
      wiki: {
        extract: "Le musee conserve une collection patrimoniale majeure de l'histoire de l'art.",
        description: "monument historique",
      },
    });

    expect(profile.domain?.value).toBe("CULTURAL");
    expect(profile.archetype?.value).toBe("MUSEUM_DISTRICT");
    expect(profile.traits.has("CULTURAL")).toBe(true);
  });

  it("keeps emergency and hostile traits as dynamic modifiers", () => {
    const traits = detectSituations({
      ...baseContext(),
      locationName: "Hospital Central",
      weather: {
        ...baseContext().weather,
        current: {
          ...baseContext().weather.current,
          windGusts: 85,
          weatherCode: 95,
        },
      },
      quakes: [{ magnitude: 5.2, distance: 22 }],
      poiCount: 4,
    });

    expect(traits.has("VITAL")).toBe(true);
    expect(traits.has("HOSTILE")).toBe(true);
  });

  it("reorders modules for critical contexts", () => {
    const weights = calculateModuleWeights(new Set(["VITAL", "HOSTILE"]));

    expect(weights[0].id).toBe("narrative");
    expect(weights.some((module) => module.id === "navigation")).toBe(true);
    expect(weights.find((module) => module.id === "story")?.weight).toBeLessThan(
      weights.find((module) => module.id === "pois")?.weight ?? 0
    );
  });
});
