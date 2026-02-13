# ⚡ Custom Actions API Reference

Complete reference for building backend APIs that ChatGPT GPTs can call.

---

## How Actions Work

```
User Message → GPT reads instructions → GPT decides to call action →
GPT constructs request from OpenAPI spec → Backend processes request →
Backend returns JSON → GPT interprets response → GPT replies to user
```

Key insight: **GPT reads the `description` fields in your OpenAPI spec to decide WHEN and HOW to call your API.** Descriptions are not documentation — they are instructions to the AI.

---

## OpenAPI Spec Requirements

### Mandatory Fields

| Field | Requirement |
|---|---|
| `openapi` | Must be `"3.1.0"` (3.0.x also works but 3.1.0 preferred) |
| `info.title` | Name of your API |
| `info.description` | What the API does — GPT reads this to understand the overall purpose |
| `servers[0].url` | Your production HTTPS URL |
| `paths` | At least one endpoint |
| `operationId` | Required on every operation — must be unique, descriptive verb phrase |

### Description Writing Rules

Descriptions are the most important part of your spec. GPT uses them to:
1. Decide **when** to call an endpoint
2. Understand **what parameters** to send
3. Interpret **what the response means**

#### Good vs Bad Descriptions

| Location | ❌ Bad | ✅ Good |
|---|---|---|
| Endpoint | `"Gets products"` | `"Search the product catalog. Call this when the user wants to find, browse, or filter products by name, category, or price range."` |
| Parameter | `"The query"` | `"Search keywords from the user's message. Extract the main product name or category. Example: 'red running shoes', 'laptop under $500'"` |
| Response field | `"The price"` | `"Product price in USD. Always display this to the user formatted as currency."` |

---

## Authentication Methods

### No Authentication

Best for: Public data, read-only APIs

```yaml
# No auth section needed in OpenAPI spec
# Configure in GPT Builder: Authentication → None
```

### API Key Authentication

Best for: Simple access control, rate limiting

```yaml
# In OpenAPI spec:
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

security:
  - ApiKeyAuth: []
```

GPT Builder configuration:
- Authentication Type: **API Key**
- API Key: `your-secret-key`
- Auth Type: **Custom** → Header name: `X-API-Key`

### OAuth 2.0

Best for: User-specific data, third-party API access

```yaml
components:
  securitySchemes:
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://your-app.com/oauth/authorize
          tokenUrl: https://your-app.com/oauth/token
          scopes:
            read: Read access
            write: Write access
```

GPT Builder configuration:
- Authentication Type: **OAuth**
- Client ID: `your-client-id`
- Client Secret: `your-client-secret`
- Authorization URL: `https://your-app.com/oauth/authorize`
- Token URL: `https://your-app.com/oauth/token`
- Scope: `read write`

---

## CORS Configuration

Actions are called from `https://chat.openai.com`. Your backend MUST return these headers:

```
Access-Control-Allow-Origin: https://chat.openai.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
```

### Preflight (OPTIONS) Handler

Every endpoint must handle OPTIONS requests:

```typescript
// Next.js example
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://chat.openai.com',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

---

## Response Format Best Practices

### Do: Return flat, descriptive JSON

```json
{
  "results": [
    {
      "product_name": "Nike Air Max 90",
      "price_usd": 129.99,
      "in_stock": true,
      "description": "Classic running shoe with visible Air cushioning",
      "product_url": "https://example.com/products/nike-air-max-90"
    }
  ],
  "total_results": 42,
  "message": "Found 42 products matching 'running shoes'"
}
```

### Don't: Return deeply nested or coded responses

```json
{
  "d": {
    "r": [{ "n": "Nike Air Max 90", "p": 12999, "s": 1 }]
  },
  "m": { "t": 42, "pg": 1 }
}
```

### Error Response Format

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "No product found with ID 12345. Please check the product ID and try again.",
    "suggestion": "Try searching by product name instead using the searchProducts endpoint."
  }
}
```

GPT reads the `message` and `suggestion` fields to formulate its response to the user.

---

## Rate Limiting

Implement rate limiting to protect your backend:

```typescript
// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);

  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) return false;
  record.count++;
  return true;
}
```

Return `429 Too Many Requests` with:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please wait 60 seconds before trying again.",
    "retry_after_seconds": 60
  }
}
```

---

## Testing Actions

### 1. Validate OpenAPI Spec

```bash
npx @apidevtools/swagger-cli validate openapi.yaml
```

### 2. Test Endpoints with curl

```bash
# GET endpoint
curl -H "X-API-Key: your-key" https://your-api.com/products?q=shoes

# POST endpoint
curl -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"query": "shoes", "max_price": 100}' \
  https://your-api.com/search
```

### 3. Test in GPT Builder

1. Open GPT Builder → Configure → Actions
2. Click **Test** next to each endpoint
3. Verify the response appears correctly
4. Check that GPT interprets the response as expected

---

## Common Pitfalls

| Pitfall | Impact | Solution |
|---|---|---|
| Missing `operationId` | GPT can't call the endpoint | Add unique operationId to every operation |
| Vague descriptions | GPT calls wrong endpoint or at wrong time | Write descriptions as instructions to the AI |
| Nested response objects | GPT misinterprets data | Flatten responses to max 2 levels |
| No error messages | GPT says "something went wrong" | Return descriptive error messages GPT can relay |
| HTTP instead of HTTPS | Action fails silently | Always use HTTPS in production |
| Missing CORS | Browser blocks the request | Add CORS headers for chat.openai.com |
| Too many endpoints (>30) | GPT performance degrades | Consolidate into fewer, more flexible endpoints |
| Large response payloads | Slow responses, context overflow | Paginate results, limit to top 10 |
