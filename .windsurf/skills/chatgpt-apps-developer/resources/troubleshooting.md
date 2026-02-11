# 🔧 Troubleshooting Guide

Common issues when building ChatGPT Apps and how to fix them.

---

## Custom GPT Issues

### GPT Ignores Instructions

**Symptoms**: GPT doesn't follow system prompt rules, gives generic responses

**Causes & Fixes**:

| Cause | Fix |
|---|---|
| Instructions too long (>6000 chars) | Prioritize: put critical rules in first 2000 chars |
| Instructions too vague | Use explicit "ALWAYS" / "NEVER" / "MUST" language |
| Conflicting instructions | Review for contradictions, remove duplicates |
| Knowledge files override instructions | Add "Instructions take priority over knowledge files" |

**Test**: Ask the GPT to do something your instructions prohibit. If it complies, instructions are too weak.

### GPT Doesn't Call Actions

**Symptoms**: GPT answers from its own knowledge instead of calling the action

**Fixes**:
1. Add to instructions: `"NEVER answer questions about [TOPIC] from your own knowledge. ALWAYS use the [action_name] action."`
2. Check that the action's `description` field clearly states when to call it
3. Verify the OpenAPI spec is valid: `npx @apidevtools/swagger-cli validate openapi.yaml`
4. Test the action in GPT Builder → Actions → Test

### GPT Calls Wrong Action

**Symptoms**: GPT calls `searchProducts` when it should call `getProductDetails`

**Fixes**:
1. Make `description` fields more distinct between endpoints
2. Add negative instructions: "Do NOT call searchProducts when the user provides a specific product ID"
3. Reduce the number of endpoints (consolidate similar ones)

### Knowledge File Retrieval is Poor

**Symptoms**: GPT says "I don't have information about X" when it's in the knowledge files

**Fixes**:
1. Use Markdown files with clear headings (best retrieval format)
2. Split large files into topic-specific smaller files
3. Add a "table of contents" file listing what's in each knowledge file
4. Repeat key terms in headings and first paragraphs

---

## Custom Action Issues

### "Action failed" Error in GPT UI

**Diagnostic Steps**:

```
1. Check backend logs for the request
2. Test the endpoint directly with curl
3. Verify the response is valid JSON
4. Check Content-Type header is application/json
5. Verify CORS headers are present
6. Check authentication configuration
```

**Common Causes**:

| Cause | Symptom | Fix |
|---|---|---|
| Backend returned HTML (not JSON) | Action fails silently | Ensure API returns JSON, not error pages |
| Missing CORS headers | Browser blocks request | Add `Access-Control-Allow-Origin: https://chat.openai.com` |
| SSL/TLS error | Action fails on HTTPS | Ensure valid SSL certificate (Let's Encrypt works) |
| Timeout (>30s) | Action fails after delay | Optimize backend response time |
| Response too large | Action fails or truncates | Limit response to <100KB, paginate results |

### "Could not parse OpenAPI spec" Error

**Fixes**:
1. Validate: `npx @apidevtools/swagger-cli validate openapi.yaml`
2. Use `openapi: "3.1.0"` (not 3.0.x for best compatibility)
3. Ensure every operation has a unique `operationId`
4. Remove unsupported features: `callbacks`, `webhooks`, `links`
5. Check for YAML syntax errors (indentation, special characters)

### Authentication Not Working

**API Key Auth**:
```
1. In GPT Builder: Authentication → API Key
2. Auth Type: Custom
3. Header name must match your backend expectation (e.g., X-API-Key)
4. The key value must match exactly (no extra spaces)
```

**OAuth**:
```
1. Verify authorization URL is accessible from browser
2. Verify token URL returns valid JSON with access_token
3. Check redirect URI: https://chat.openai.com/aip/g-{gpt_id}/oauth/callback
4. Ensure scopes match between GPT config and OAuth server
5. Test the full OAuth flow in an incognito browser window
```

### CORS Errors

**Required Headers** (on EVERY response, including errors):
```
Access-Control-Allow-Origin: https://chat.openai.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
```

**Checklist**:
- [ ] OPTIONS (preflight) handler returns 204 with CORS headers
- [ ] All success responses include CORS headers
- [ ] All error responses include CORS headers
- [ ] No wildcard `*` for origin (must be exact `https://chat.openai.com`)

---

## Assistants API Issues

### Run Status: "failed"

**Check `run.last_error`**:

| Error Type | Cause | Fix |
|---|---|---|
| `server_error` | OpenAI internal error | Retry with exponential backoff |
| `rate_limit_exceeded` | Too many concurrent runs | Queue runs, implement backoff |
| `invalid_prompt` | Instructions + messages too long | Shorten instructions or summarize thread |

### Function Calling Returns Wrong Arguments

**Fixes**:
1. Add more detail to function `description`
2. Add `description` to every parameter
3. Use `enum` for constrained values
4. Add examples in descriptions: `"City name (e.g., 'Tokyo', 'New York')"`
5. Reduce the number of functions (model gets confused with >10)

### Code Interpreter Errors

**Common Issues**:

| Issue | Fix |
|---|---|
| `ModuleNotFoundError` | Use only pre-installed packages (pandas, numpy, matplotlib, etc.) |
| File not accessible | Attach file to the message, not just the assistant |
| Timeout (300s) | Break large computations into smaller steps |
| Chart not displayed | Ensure matplotlib saves to file: `plt.savefig('chart.png')` |

### File Search Returns No Results

**Fixes**:
1. Wait for file indexing to complete (check file status)
2. Use supported formats: PDF, MD, TXT, DOCX, HTML, JSON
3. Files must have actual text content (not just images)
4. Check vector store status: `client.beta.vectorStores.retrieve(id)`
5. Ensure file is attached to the correct vector store

---

## Performance Optimization

### Reducing Latency

| Technique | Impact | Implementation |
|---|---|---|
| Use `gpt-4o-mini` | 2-3x faster | Change `model` parameter |
| Stream responses | Perceived 5x faster | Use `.stream()` instead of `.createAndPoll()` |
| Limit tools | Faster tool selection | Remove unused tools from assistant |
| Shorter instructions | Faster processing | Compress instructions, remove redundancy |
| Edge deployment | Lower network latency | Use Cloudflare Workers or Vercel Edge |

### Reducing Costs

| Technique | Savings | Trade-off |
|---|---|---|
| `gpt-4o-mini` over `gpt-4o` | ~90% | Slightly lower quality for complex tasks |
| Set `max_completion_tokens` | Variable | May truncate long responses |
| Summarize threads periodically | ~50% on long conversations | Loses some context detail |
| Clean up vector stores | Storage costs | Must re-upload if needed |
| Batch operations in single runs | Code Interpreter session costs | More complex prompts |

---

## Debugging Checklist

When something doesn't work, go through this checklist in order:

```
□ 1. Is the OpenAPI spec valid? (swagger-cli validate)
□ 2. Does the endpoint work with curl?
□ 3. Are CORS headers present on all responses?
□ 4. Is authentication configured correctly?
□ 5. Is the response valid JSON with correct Content-Type?
□ 6. Is the response under 100KB?
□ 7. Does the endpoint respond within 30 seconds?
□ 8. Are description fields clear and specific?
□ 9. Do instructions explicitly mention when to call actions?
□ 10. Have you tested in GPT Builder's action test panel?
```
