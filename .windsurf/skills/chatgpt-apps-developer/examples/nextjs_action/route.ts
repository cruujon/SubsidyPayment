/**
 * Next.js API Route — ChatGPT Custom Action Backend
 *
 * File: app/api/search/route.ts
 * Deploy: Vercel (vercel --prod)
 *
 * This example implements a product search action that a Custom GPT can call.
 */

import { NextRequest, NextResponse } from 'next/server';

// --- CORS Headers for ChatGPT ---
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://chat.openai.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

// --- Preflight Handler ---
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// --- Authentication Middleware ---
function authenticate(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === process.env.ACTION_API_KEY;
}

// --- Sample Data (replace with your database) ---
const PRODUCTS = [
  {
    id: 'prod_001',
    name: 'Wireless Noise-Canceling Headphones',
    description: 'Premium over-ear headphones with 30-hour battery life',
    price: 299.99,
    category: 'electronics',
    url: 'https://example.com/products/headphones',
  },
  {
    id: 'prod_002',
    name: 'Organic Cotton T-Shirt',
    description: 'Soft, sustainable basic tee in 12 colors',
    price: 29.99,
    category: 'clothing',
    url: 'https://example.com/products/tshirt',
  },
  {
    id: 'prod_003',
    name: 'Single-Origin Ethiopian Coffee',
    description: 'Light roast, fruity notes, 340g bag',
    price: 18.99,
    category: 'food',
    url: 'https://example.com/products/coffee',
  },
];

// --- Search Endpoint ---
export async function GET(request: NextRequest) {
  // Auth check
  if (!authenticate(request)) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing API key. Please check your authentication configuration.',
          suggestion: 'Verify the API key in your GPT Action settings.',
        },
      },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category');
  const maxPrice = searchParams.get('max_price')
    ? parseFloat(searchParams.get('max_price')!)
    : undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5'), 20);

  // Validate
  if (!query) {
    return NextResponse.json(
      {
        error: {
          code: 'MISSING_QUERY',
          message: 'Please provide a search query. What are you looking for?',
          suggestion: 'Ask the user what they want to search for.',
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Search (replace with your actual search logic)
  let results = PRODUCTS.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || p.category === category;
    const matchesPrice = !maxPrice || p.price <= maxPrice;
    return matchesQuery && matchesCategory && matchesPrice;
  });

  results = results.slice(0, limit);

  return NextResponse.json(
    {
      results: results.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        url: p.url,
      })),
      total_count: results.length,
      message:
        results.length > 0
          ? `Found ${results.length} products matching "${query}"`
          : `No products found matching "${query}". Try different keywords.`,
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
