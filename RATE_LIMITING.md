# Rate Limiting Documentation

## Overview

ScuttleWUTT implements **per-IP, per-scope rate limiting** across all API endpoints to protect against abuse, control costs (LLM API calls), and ensure fair resource allocation.

**Key Features:**
- ✅ In-memory sliding window counters
- ✅ Automatic cleanup of expired entries
- ✅ Per-endpoint scopes (prevents one endpoint from blocking another)
- ✅ Standard HTTP 429 responses with `Retry-After` headers
- ✅ Detailed logging of violations

---

## Configuration

Rate limits are configured via environment variables:

```bash
# Time window in milliseconds (default: 60000 = 1 minute)
RATE_LIMIT_WINDOW_MS=60000

# Maximum requests per window (default: 60 requests/minute)
RATE_LIMIT_MAX_REQUESTS=60
```

**Default Quota:** 60 requests per minute per IP address

---

## How It Works

### Request Flow

```
1. Request arrives at API endpoint
2. Extract client IP from headers (x-forwarded-for, x-real-ip, or fallback)
3. Create bucket key: `{scope}:{ip}:{path}`
4. Check/increment counter in bucket
5. If counter > limit → 429 response
   Else → process request normally
```

### Bucket Key Components

- **Scope**: Logical grouping (e.g., `api:consensus`, `api:alpha:post`)
- **IP Address**: Client identifier
- **Path**: Request path (e.g., `/api/consensus`)

**Example bucket key:** `api:consensus:192.168.1.100:/api/consensus`

### Automatic Cleanup

Expired bucket entries are removed every 5 minutes to prevent memory leaks:

```typescript
// Cleanup interval in src/lib/rate-limit.ts:14-27
setInterval(() => {
  const now = Date.now();
  for (const key of store.keys()) {
    if (store.get(key).resetTime < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

---

## API Endpoints & Scopes

Each endpoint enforces its own rate limit scope:

| Endpoint | Scope | Typical Use Case |
|----------|-------|------------------|
| `/api/ask` | `api:ask` | Single-model Q&A |
| `/api/consensus` | `api:consensus` | Multi-model consensus |
| `/api/compare` | `api:compare` | Model comparison |
| `/api/subscribe` | `api:subscribe` | Subscription creation |
| `/api/verify` (POST) | `api:verify:post` | Submit verification code |
| `/api/verify` (PUT) | `api:verify:resend` | Resend verification code |
| `/api/alpha` (GET) | `api:alpha:get` | List trackers |
| `/api/alpha` (POST) | `api:alpha:post` | Create tracker |
| `/api/alpha/[id]` (PUT) | `api:alpha:update` | Refresh tracker |
| `/api/alpha/[id]` (DELETE) | `api:alpha:delete` | Delete tracker |
| `/api/brand-trackers` (GET) | `api:brand-trackers:get` | List brand trackers |
| `/api/brand-trackers` (POST) | `api:brand-trackers:post` | Create brand tracker |
| `/api/brand-trackers/[id]` (GET) | `api:brand-trackers:get` | Get single tracker |
| `/api/brand-trackers/[id]` (PUT) | `api:brand-trackers:update` | Update tracker |
| `/api/brand-trackers/[id]` (DELETE) | `api:brand-trackers:delete` | Delete tracker |
| `/api/cron/send-updates` | `cron:send-updates` | Scheduled updates |

---

## Response Format

### Success (200 OK)

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709843280

{ "questionId": "q_...", ... }
```

**Headers:**
- `X-RateLimit-Limit`: Total requests allowed per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when counter resets

### Rate Limit Exceeded (429 Too Many Requests)

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "error": "Too many consensus requests. Please try later."
}
```

**Headers:**
- `Retry-After`: Seconds until rate limit resets

---

## Client Integration

### JavaScript/TypeScript Example

```typescript
async function callAPI(endpoint: string, body: any) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    console.warn(`Rate limited. Retry in ${retryAfter} seconds.`);

    // Option 1: Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return callAPI(endpoint, body);

    // Option 2: Return error to user
    throw new Error(`Rate limit exceeded. Try again in ${retryAfter}s.`);
  }

  return response.json();
}
```

### cURL Example

```bash
# First request succeeds
curl -X POST https://scuttlewutt.com/api/consensus \
  -H "Content-Type: application/json" \
  -d '{"question": "Best CRM for startups?"}'

# After 60 requests in 1 minute:
curl -X POST https://scuttlewutt.com/api/consensus \
  -H "Content-Type: application/json" \
  -d '{"question": "Best CRM for startups?"}' \
  -i

# HTTP/1.1 429 Too Many Requests
# Retry-After: 42
# {"error": "Too many consensus requests. Please try later."}
```

---

## Monitoring & Logging

### Log Entries

**Rate Limit Exceeded:**
```json
{
  "level": "WARN",
  "message": "Rate limit exceeded",
  "ip": "203.0.113.42",
  "path": "/api/consensus",
  "count": 61,
  "limit": 60,
  "scope": "api:consensus"
}
```

**Rate Limit Passed:**
```json
{
  "level": "DEBUG",
  "message": "Rate limit check passed",
  "ip": "203.0.113.42",
  "path": "/api/consensus",
  "count": 12,
  "limit": 60,
  "remaining": 48,
  "scope": "api:consensus"
}
```

### Recommended Alerts

Set up monitoring for:
- **High rate limit violations** (>100/hour per IP) → Possible abuse
- **Sustained rate limiting** (same IP hitting limits repeatedly) → Possible bot
- **Global rate limit percentage** (>80% of users hitting limits) → Quotas too low

---

## Scaling Considerations

### Current Implementation (In-Memory)

**Pros:**
- ✅ Zero external dependencies
- ✅ Fast (no network calls)
- ✅ Simple implementation

**Cons:**
- ❌ Doesn't survive server restarts
- ❌ Doesn't work across multiple instances (horizontal scaling)
- ❌ Memory usage grows with unique IPs

**Recommended for:** Single-instance deployments, MVP, development

### Production Alternative (Redis)

For multi-instance deployments, migrate to Redis-backed rate limiting:

```typescript
// Example with Upstash Redis
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: 'scuttlewutt:ratelimit',
});

export async function enforceRateLimit(request: Request, scope: string) {
  const ip = getClientIdentifier(request);
  const result = await ratelimit.limit(`${scope}:${ip}`);

  return {
    allowed: result.success,
    remaining: result.remaining,
    resetInMs: result.reset - Date.now(),
    limit: result.limit,
    resetTime: Math.ceil(result.reset / 1000),
  };
}
```

**Migration triggers:**
- Deploying to serverless (Vercel, Netlify)
- Running multiple instances behind load balancer
- Needing persistent rate limit state

---

## Tuning Guidelines

### Adjusting Limits

**Conservative (Stricter):**
```bash
RATE_LIMIT_WINDOW_MS=60000    # 1 minute window
RATE_LIMIT_MAX_REQUESTS=20    # 20 req/min
```
Use when: LLM API costs are high, abuse concerns, MVP launch

**Moderate (Default):**
```bash
RATE_LIMIT_WINDOW_MS=60000    # 1 minute window
RATE_LIMIT_MAX_REQUESTS=60    # 60 req/min
```
Use when: Normal operations, balanced cost/UX

**Generous (Looser):**
```bash
RATE_LIMIT_WINDOW_MS=60000    # 1 minute window
RATE_LIMIT_MAX_REQUESTS=180   # 180 req/min (3 req/sec)
```
Use when: Enterprise customers, low costs, high availability needs

### Cost Calculation

**Consensus endpoint** calls 3 LLM models per request:
- Claude Sonnet 4.5: ~$0.015/request
- GPT-4o: ~$0.010/request
- **Total: ~$0.025/consensus request**

At 60 req/min max:
- **Max cost:** 60 req × $0.025 = $1.50/minute
- **Max hourly:** $90/hour
- **Max daily:** $2,160/day

**Recommendation:** Set limits based on your monthly LLM budget.

---

## Testing Rate Limits

### Local Testing

```bash
# Bash script to test rate limits
for i in {1..65}; do
  echo "Request $i:"
  curl -X POST http://localhost:3000/api/consensus \
    -H "Content-Type: application/json" \
    -d '{"question": "Best CRM?"}' \
    -w "\nHTTP Status: %{http_code}\n\n" \
    -s -o /dev/null
  sleep 0.5
done
```

### Expected Output

```
Request 1-60: HTTP Status: 200
Request 61-65: HTTP Status: 429
```

### Reset Test

Wait 60 seconds, then:
```bash
curl -X POST http://localhost:3000/api/consensus \
  -H "Content-Type: application/json" \
  -d '{"question": "Best CRM?"}' \
  -i
```

Should return `200 OK` (counter reset).

---

## Frequently Asked Questions

### Why am I getting 429 errors in development?

The rate limiter is always active. If you're testing heavily:
1. Increase limits in `.env`: `RATE_LIMIT_MAX_REQUESTS=1000`
2. Restart the dev server to apply changes

### Can I disable rate limiting completely?

Not currently supported. Workaround: set very high limits:
```bash
RATE_LIMIT_MAX_REQUESTS=999999
```

### Do rate limits apply to authenticated users differently?

No. Currently all limits are IP-based regardless of authentication. Future enhancement could implement user-based quotas.

### What if my users are behind a corporate proxy?

Multiple users behind the same NAT will share the same IP and thus the same rate limit bucket. Consider:
1. Implementing user-based rate limits (requires authentication)
2. Increasing global limits
3. Using `X-Forwarded-For` header if you trust the proxy

### How do I monitor rate limit usage?

Check logs for `Rate limit exceeded` warnings. In production, pipe logs to monitoring services:
- **Datadog:** Search for `level:WARN "Rate limit exceeded"`
- **Sentry:** Alerts on 429 error spikes
- **Custom:** Parse logs and send to Slack/PagerDuty

---

## Security Implications

### DDoS Protection

Rate limiting provides **basic DDoS mitigation**:
- Prevents resource exhaustion from single IPs
- Limits cost exposure from malicious actors
- Slows down brute-force attacks

**Not a replacement for:** WAF, Cloudflare, enterprise DDoS protection

### API Key Brute-Force

Cron endpoints are protected by `CRON_SECRET`:
```bash
curl https://scuttlewutt.com/api/cron/send-updates \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Rate limiting adds an additional layer, limiting brute-force attempts to 60/min.

### Cost Control

Rate limits are the **primary defense** against runaway LLM API costs:
- Single IP cannot exceed 60 requests/min
- Max potential cost is calculable (see Cost Calculation above)
- Prevents accidental infinite loops or malicious API abuse

---

## Support

**Issues with rate limiting?**
- Check current limits: Review `X-RateLimit-*` headers
- Verify your IP: Check logs for your IP address
- Adjust limits: Update `.env` and restart server

**Need higher limits?**
- Open an issue explaining your use case
- Consider upgrading to Redis-backed rate limiting
- Contact support for enterprise quotas
