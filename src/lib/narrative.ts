// Data Storytelling — Narrative Hub
// Generates contextual "Signal + Preuve" insights

import type { WeatherData } from "./weather";
import { getAQILevel, getUVLevel, getWindDirection } from "./weather";

import { type SituationTrait } from "./priorities";

export interface NarrativeInsight {
  signal: string;
  proof: string;
  category: "comfort" | "air" | "uv" | "wind" | "visibility" | "altitude" | "precipitation" | "pressure" | "assistance";
  severity: "info" | "warning" | "alert";
  pastel: "green" | "blue" | "yellow" | "red";
}

export function generateNarrative(weather: WeatherData, locationName: string, traits?: Set<SituationTrait>): NarrativeInsight[] {
  const insights: NarrativeInsight[] = [];
  const { current, elevation, airQuality } = weather;

  // 1. Situational Signals (Priority 1)
  if (traits?.has("VITAL")) {
    insights.push({
      signal: `Zone de service prioritaire. Contacts d'urgence activés pour ${locationName}.`,
      proof: "Appel direct disponible (112)",
      category: "assistance",
      severity: "alert",
      pastel: "red",
    });
  }

  if (traits?.has("ATLAS")) {
    insights.push({
      signal: `Vue d'ensemble du territoire. Données culturelles et macro-économiques en priorité.`,
      proof: "Échelle pays / région",
      category: "visibility",
      severity: "info",
      pastel: "blue",
    });
  }

  if (traits?.has("WILD")) {
    insights.push({
      signal: `Zone naturelle. Vérifiez les conditions météo avant de vous engager.`,
      proof: `Altitude ${weather.elevation?.toFixed(0) || "—"}m`,
      category: "altitude",
      severity: "warning",
      pastel: "yellow",
    });
  }

  if (traits?.has("MARITIME")) {
    insights.push({
      signal: `Zone maritime. Conditions de vent et de houle à surveiller.`,
      proof: `Vent ${current.windSpeed.toFixed(0)} km/h ${getWindDirection(current.windDirection)}`,
      category: "wind",
      severity: current.windSpeed > 40 ? "alert" : "info",
      pastel: current.windSpeed > 40 ? "red" : "blue",
    });
  }

  // Thermal comfort
  const tempDiff = Math.abs(current.temperature - current.apparentTemperature);
  if (current.apparentTemperature < 0) {
    insights.push({
      signal: "Froid ressenti intense. Couvrez les extrémités.",
      proof: `Ressenti ${current.apparentTemperature.toFixed(1)}°C`,
      category: "comfort",
      severity: "alert",
      pastel: "blue",
    });
  } else if (current.apparentTemperature > 35) {
    insights.push({
      signal: "Chaleur accablante. Hydratez-vous régulièrement, restez à l'ombre.",
      proof: `Ressenti ${current.apparentTemperature.toFixed(1)}°C`,
      category: "comfort",
      severity: "alert",
      pastel: "red",
    });
  } else if (tempDiff > 5) {
    insights.push({
      signal: `Le vent modifie la perception thermique de ${tempDiff.toFixed(0)}°C.`,
      proof: `Réel ${current.temperature.toFixed(1)}°C — Ressenti ${current.apparentTemperature.toFixed(1)}°C`,
      category: "comfort",
      severity: "warning",
      pastel: "yellow",
    });
  } else {
    const comfortMsg = current.temperature > 18 && current.temperature < 28
      ? "Température agréable. Conditions idéales pour explorer."
      : current.temperature <= 18
        ? "Temps frais. Prévoyez une couche supplémentaire."
        : "Chaleur modérée. Pensez à vous hydrater.";
    insights.push({
      signal: comfortMsg,
      proof: `${current.temperature.toFixed(1)}°C — Ressenti ${current.apparentTemperature.toFixed(1)}°C`,
      category: "comfort",
      severity: "info",
      pastel: "green",
    });
  }

  // Air quality
  if (airQuality) {
    const aql = getAQILevel(airQuality.aqi);
    const aqSignal = airQuality.aqi <= 40
      ? "L'air est pur. Conditions idéales pour les activités en extérieur."
      : airQuality.aqi <= 60
        ? "Qualité de l'air acceptable. Les personnes sensibles devraient limiter l'effort."
        : "Air pollué. Réduisez les activités en extérieur.";
    insights.push({
      signal: aqSignal,
      proof: `AQI ${airQuality.aqi} — PM2.5 ${airQuality.pm25.toFixed(1)} µg/m³`,
      category: "air",
      severity: aql.color === "red" ? "alert" : aql.color === "yellow" ? "warning" : "info",
      pastel: aql.color,
    });
  }

  // UV
  const uvl = getUVLevel(current.uvIndex);
  if (current.uvIndex > 2) {
    const uvSignal = current.uvIndex <= 5
      ? "Rayonnement UV modéré. Protection solaire recommandée."
      : current.uvIndex <= 7
        ? "UV élevés. Crème solaire et lunettes indispensables."
        : "UV très élevés. Évitez l'exposition directe entre 11h et 16h.";
    insights.push({
      signal: uvSignal,
      proof: `UV ${current.uvIndex.toFixed(1)} — ${uvl.label}`,
      category: "uv",
      severity: uvl.color === "red" ? "alert" : "warning",
      pastel: uvl.color,
    });
  }

  // Wind
  if (current.windSpeed > 30) {
    insights.push({
      signal: "Vents forts. Sécurisez vos effets légers, prudence en déplacement.",
      proof: `${current.windSpeed.toFixed(0)} km/h ${getWindDirection(current.windDirection)} — Rafales ${current.windGusts.toFixed(0)} km/h`,
      category: "wind",
      severity: current.windSpeed > 50 ? "alert" : "warning",
      pastel: current.windSpeed > 50 ? "red" : "yellow",
    });
  } else {
    insights.push({
      signal: current.windSpeed < 10
        ? "Vent calme. Conditions stables."
        : `Brise légère de ${getWindDirection(current.windDirection)}. Agréable.`,
      proof: `${current.windSpeed.toFixed(0)} km/h ${getWindDirection(current.windDirection)}`,
      category: "wind",
      severity: "info",
      pastel: "green",
    });
  }

  // Visibility
  if (current.visibility < 5000) {
    insights.push({
      signal: "Visibilité réduite. Prudence sur la route.",
      proof: `${(current.visibility / 1000).toFixed(1)} km`,
      category: "visibility",
      severity: current.visibility < 1000 ? "alert" : "warning",
      pastel: current.visibility < 1000 ? "red" : "yellow",
    });
  }

  // Altitude / Hypoxic stress
  if (elevation > 2500) {
    insights.push({
      signal: "Altitude élevée. L'oxygénation est réduite. Hydratez-vous davantage et montez progressivement.",
      proof: `Altitude ${elevation.toFixed(0)}m`,
      category: "altitude",
      severity: elevation > 4000 ? "alert" : "warning",
      pastel: elevation > 4000 ? "red" : "yellow",
    });
  }

  // Precipitation
  if (current.precipitation > 0) {
    insights.push({
      signal: current.precipitation > 5
        ? "Précipitations importantes en cours. Équipez-vous en conséquence."
        : "Légères précipitations. Un parapluie suffit.",
      proof: `${current.precipitation.toFixed(1)} mm/h`,
      category: "precipitation",
      severity: current.precipitation > 5 ? "warning" : "info",
      pastel: current.precipitation > 5 ? "blue" : "green",
    });
  }

  // Pressure trend
  if (current.pressure < 1000) {
    insights.push({
      signal: "Pression atmosphérique basse. Dégradation météo probable.",
      proof: `${current.pressure.toFixed(0)} hPa`,
      category: "pressure",
      severity: "warning",
      pastel: "yellow",
    });
  }

  // Dew point comfort
  if (current.dewPoint > 20) {
    insights.push({
      signal: "Air très humide et oppressant. L'évaporation de la sueur est limitée.",
      proof: `Point de rosée ${current.dewPoint.toFixed(1)}°C`,
      category: "comfort",
      severity: "warning",
      pastel: "yellow",
    });
  }

  return insights;
}
