// Open-Meteo API integration

export interface WeatherData {
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    weatherCode: number;
    isDay: boolean;
    precipitation: number;
    cloudCover: number;
    pressure: number;
    visibility: number;
    uvIndex: number;
    dewPoint: number;
  };
  hourly: {
    time: string[];
    temperature: number[];
    precipitation: number[];
    weatherCode: number[];
    windSpeed: number[];
    humidity: number[];
    uvIndex: number[];
    cloudCover: number[];
  };
  daily: {
    time: string[];
    temperatureMax: number[];
    temperatureMin: number[];
    weatherCode: number[];
    precipitationSum: number[];
    windSpeedMax: number[];
    uvIndexMax: number[];
    sunrise: string[];
    sunset: string[];
    precipitationProbabilityMax: number[];
  };
  airQuality: {
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    so2: number;
    co: number;
  } | null;
  elevation: number;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const [weatherRes, aqRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,visibility,uv_index,dew_point_2m` +
      `&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,cloud_cover` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset,precipitation_probability_max` +
      `&timezone=auto&forecast_days=7`
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide`
    ).catch(() => null),
  ]);

  const weather = await weatherRes.json();
  const aq = aqRes ? await aqRes.json() : null;

  return {
    current: {
      temperature: weather.current.temperature_2m,
      apparentTemperature: weather.current.apparent_temperature,
      humidity: weather.current.relative_humidity_2m,
      windSpeed: weather.current.wind_speed_10m,
      windDirection: weather.current.wind_direction_10m,
      windGusts: weather.current.wind_gusts_10m,
      weatherCode: weather.current.weather_code,
      isDay: weather.current.is_day === 1,
      precipitation: weather.current.precipitation,
      cloudCover: weather.current.cloud_cover,
      pressure: weather.current.pressure_msl,
      visibility: weather.current.visibility,
      uvIndex: weather.current.uv_index,
      dewPoint: weather.current.dew_point_2m,
    },
    hourly: {
      time: weather.hourly.time,
      temperature: weather.hourly.temperature_2m,
      precipitation: weather.hourly.precipitation,
      weatherCode: weather.hourly.weather_code,
      windSpeed: weather.hourly.wind_speed_10m,
      humidity: weather.hourly.relative_humidity_2m,
      uvIndex: weather.hourly.uv_index,
      cloudCover: weather.hourly.cloud_cover,
    },
    daily: {
      time: weather.daily.time,
      temperatureMax: weather.daily.temperature_2m_max,
      temperatureMin: weather.daily.temperature_2m_min,
      weatherCode: weather.daily.weather_code,
      precipitationSum: weather.daily.precipitation_sum,
      windSpeedMax: weather.daily.wind_speed_10m_max,
      uvIndexMax: weather.daily.uv_index_max,
      sunrise: weather.daily.sunrise,
      sunset: weather.daily.sunset,
      precipitationProbabilityMax: weather.daily.precipitation_probability_max,
    },
    airQuality: aq?.current ? {
      aqi: aq.current.european_aqi,
      pm25: aq.current.pm2_5,
      pm10: aq.current.pm10,
      no2: aq.current.nitrogen_dioxide,
      o3: aq.current.ozone,
      so2: aq.current.sulphur_dioxide,
      co: aq.current.carbon_monoxide,
    } : null,
    elevation: weather.elevation,
  };
}

export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Ciel dégagé",
    1: "Principalement dégagé",
    2: "Partiellement nuageux",
    3: "Couvert",
    45: "Brouillard",
    48: "Brouillard givrant",
    51: "Bruine légère",
    53: "Bruine modérée",
    55: "Bruine dense",
    56: "Bruine verglaçante légère",
    57: "Bruine verglaçante dense",
    61: "Pluie légère",
    63: "Pluie modérée",
    65: "Pluie forte",
    66: "Pluie verglaçante légère",
    67: "Pluie verglaçante forte",
    71: "Neige légère",
    73: "Neige modérée",
    75: "Neige forte",
    77: "Grains de neige",
    80: "Averses légères",
    81: "Averses modérées",
    82: "Averses violentes",
    85: "Averses de neige légères",
    86: "Averses de neige fortes",
    95: "Orage",
    96: "Orage avec grêle légère",
    99: "Orage avec grêle forte",
  };
  return descriptions[code] || "Conditions inconnues";
}

export function getWeatherIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "sun" : "moon";
  if (code <= 2) return isDay ? "cloud-sun" : "cloud-moon";
  if (code === 3) return "cloud";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain-heavy";
  if (code <= 86) return "snow-heavy";
  return "thunderstorm";
}

export function getWindDirection(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return directions[Math.round(degrees / 45) % 8];
}

export function getUVLevel(uv: number): { label: string; color: "green" | "yellow" | "red" } {
  if (uv <= 2) return { label: "Faible", color: "green" };
  if (uv <= 5) return { label: "Modéré", color: "yellow" };
  if (uv <= 7) return { label: "Élevé", color: "yellow" };
  if (uv <= 10) return { label: "Très élevé", color: "red" };
  return { label: "Extrême", color: "red" };
}

export function getAQILevel(aqi: number): { label: string; color: "green" | "yellow" | "red" } {
  if (aqi <= 20) return { label: "Excellent", color: "green" };
  if (aqi <= 40) return { label: "Bon", color: "green" };
  if (aqi <= 60) return { label: "Modéré", color: "yellow" };
  if (aqi <= 80) return { label: "Médiocre", color: "yellow" };
  if (aqi <= 100) return { label: "Mauvais", color: "red" };
  return { label: "Très mauvais", color: "red" };
}
