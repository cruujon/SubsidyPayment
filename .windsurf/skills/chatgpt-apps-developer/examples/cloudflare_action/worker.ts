/**
 * Cloudflare Worker — ChatGPT Custom Action Backend
 *
 * Deploy: wrangler deploy
 *
 * This example implements a weather lookup action for a Custom GPT.
 * Demonstrates: CORS, auth, error handling, structured responses.
 */

export interface Env {
  ACTION_API_KEY: string;
  WEATHER_API_KEY: string;
}

// --- CORS Headers ---
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://chat.openai.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, suggestion: string, status: number): Response {
  return jsonResponse({ error: { code, message, suggestion } }, status);
}

// --- Route Handler ---
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Serve OpenAPI spec
    if (url.pathname === '/.well-known/openapi.yaml') {
      return new Response(OPENAPI_SPEC, {
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/yaml' },
      });
    }

    // Serve privacy policy
    if (url.pathname === '/privacy') {
      return new Response(PRIVACY_POLICY, {
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/html' },
      });
    }

    // Authenticate
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== env.ACTION_API_KEY) {
      return errorResponse(
        'UNAUTHORIZED',
        'Invalid or missing API key.',
        'Check your GPT Action authentication settings.',
        401
      );
    }

    // Route: GET /api/weather
    if (url.pathname === '/api/weather' && request.method === 'GET') {
      return handleGetWeather(url, env);
    }

    // Route: GET /api/forecast
    if (url.pathname === '/api/forecast' && request.method === 'GET') {
      return handleGetForecast(url, env);
    }

    return errorResponse('NOT_FOUND', 'Endpoint not found.', 'Check the API documentation.', 404);
  },
};

// --- Handlers ---

async function handleGetWeather(url: URL, env: Env): Promise<Response> {
  const city = url.searchParams.get('city');
  if (!city) {
    return errorResponse(
      'MISSING_CITY',
      'Please specify a city name.',
      'Ask the user which city they want weather for.',
      400
    );
  }

  try {
    // Replace with your actual weather API call
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${env.WEATHER_API_KEY}&units=metric`
    );

    if (!weatherRes.ok) {
      if (weatherRes.status === 404) {
        return errorResponse(
          'CITY_NOT_FOUND',
          `Could not find weather data for "${city}".`,
          'Ask the user to check the city name spelling.',
          404
        );
      }
      throw new Error(`Weather API returned ${weatherRes.status}`);
    }

    const data = (await weatherRes.json()) as any;

    return jsonResponse({
      city: data.name,
      country: data.sys?.country,
      temperature_celsius: Math.round(data.main.temp),
      feels_like_celsius: Math.round(data.main.feels_like),
      humidity_percent: data.main.humidity,
      description: data.weather?.[0]?.description ?? 'Unknown',
      wind_speed_ms: data.wind?.speed,
      message: `Current weather in ${data.name}: ${Math.round(data.main.temp)}°C, ${data.weather?.[0]?.description}`,
    });
  } catch (error) {
    return errorResponse(
      'WEATHER_API_ERROR',
      'Failed to fetch weather data. Please try again in a moment.',
      'This is a temporary error. Suggest the user try again.',
      502
    );
  }
}

async function handleGetForecast(url: URL, env: Env): Promise<Response> {
  const city = url.searchParams.get('city');
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '3'), 5);

  if (!city) {
    return errorResponse(
      'MISSING_CITY',
      'Please specify a city name.',
      'Ask the user which city they want the forecast for.',
      400
    );
  }

  try {
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${env.WEATHER_API_KEY}&units=metric&cnt=${days * 8}`
    );

    if (!forecastRes.ok) {
      throw new Error(`Forecast API returned ${forecastRes.status}`);
    }

    const data = (await forecastRes.json()) as any;

    // Group by day
    const dailyForecasts = new Map<string, any[]>();
    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyForecasts.has(date)) dailyForecasts.set(date, []);
      dailyForecasts.get(date)!.push(item);
    }

    const forecast = Array.from(dailyForecasts.entries())
      .slice(0, days)
      .map(([date, items]) => ({
        date,
        high_celsius: Math.round(Math.max(...items.map((i: any) => i.main.temp_max))),
        low_celsius: Math.round(Math.min(...items.map((i: any) => i.main.temp_min))),
        description: items[Math.floor(items.length / 2)]?.weather?.[0]?.description ?? 'Unknown',
      }));

    return jsonResponse({
      city: data.city?.name ?? city,
      forecast,
      message: `${days}-day forecast for ${data.city?.name ?? city}`,
    });
  } catch (error) {
    return errorResponse(
      'FORECAST_API_ERROR',
      'Failed to fetch forecast data.',
      'Suggest the user try again in a moment.',
      502
    );
  }
}

// --- Static Content ---

const OPENAPI_SPEC = `
openapi: "3.1.0"
info:
  title: Weather GPT API
  description: Get current weather and forecasts for any city worldwide.
  version: "1.0.0"
servers:
  - url: https://weather-gpt.your-worker.workers.dev
paths:
  /api/weather:
    get:
      operationId: getCurrentWeather
      summary: Get current weather
      description: Get the current weather conditions for a city. Call this when the user asks about current weather, temperature, or conditions.
      parameters:
        - name: city
          in: query
          required: true
          schema:
            type: string
          description: "City name, e.g., 'Tokyo', 'New York', 'London'"
      responses:
        "200":
          description: Current weather data
  /api/forecast:
    get:
      operationId: getWeatherForecast
      summary: Get weather forecast
      description: Get a multi-day weather forecast. Call this when the user asks about future weather, upcoming conditions, or planning around weather.
      parameters:
        - name: city
          in: query
          required: true
          schema:
            type: string
          description: "City name"
        - name: days
          in: query
          required: false
          schema:
            type: integer
            default: 3
            maximum: 5
          description: "Number of days (1-5). Default 3."
      responses:
        "200":
          description: Forecast data
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
security:
  - ApiKeyAuth: []
`;

const PRIVACY_POLICY = `
<!DOCTYPE html>
<html>
<head><title>Privacy Policy</title></head>
<body>
<h1>Privacy Policy</h1>
<p>This API processes weather queries on behalf of a ChatGPT GPT.</p>
<ul>
  <li>We do not store personal data.</li>
  <li>City names are forwarded to OpenWeatherMap for processing.</li>
  <li>No cookies or tracking are used.</li>
</ul>
<p>Last updated: 2024-01-01</p>
</body>
</html>
`;
