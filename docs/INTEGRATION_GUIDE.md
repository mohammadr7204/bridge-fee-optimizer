# 📚 BridgeCompare Integration Guide

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Backend API │────▶│ Bridge APIs │
│  (index.html)│◀────│  (/api/*.js) │◀────│  (External) │
└─────────────┘     └──────────────┘     └─────────────┘
        │                    │
        │                    ▼
        │            ┌──────────────┐
        └───────────▶│   Analytics  │
                     │   Tracking   │
                     └──────────────┘
```

## API Endpoints

### 1. Quote Aggregation
**`GET /api/quote`**

Fetches and aggregates quotes from all bridge APIs.

```javascript
// Request
GET /api/quote?fromChain=ethereum&toChain=polygon&amount=100

// Response
{
  "success": true,
  "quotes": [
    {
      "name": "Stargate Finance",
      "logo": "S",
      "fee": 8.50,
      "gasEstimate": 3.20,
      "time": "2-3 min",
      "reliability": 99.8,
      "affiliateUrl": "https://stargate.finance?ref=bridgecompare",
      "source": "live"
    }
  ],
  "errors": [],
  "timestamp": "2025-10-05T12:00:00Z",
  "cached": false
}
```

### 2. Click Tracking
**`POST /api/track-click`**

Tracks affiliate clicks and generates tracking IDs.

```javascript
// Request
POST /api/track-click
{
  "bridge": "stargate",
  "fromChain": "ethereum",
  "toChain": "polygon",
  "amount": 100,
  "url": "https://stargate.finance"
}

// Response
{
  "success": true,
  "trackingId": "bc_1234567890_abc123",
  "redirectUrl": "https://stargate.finance?ref=bridgecompare&tid=bc_1234567890_abc123",
  "message": "Click tracked successfully"
}
```

### 3. Health Check
**`GET /api/health`**

Monitors system and API status.

```javascript
// Response
{
  "status": "healthy",
  "timestamp": "2025-10-05T12:00:00Z",
  "uptime": 3600,
  "environment": "production",
  "version": "2.0.0",
  "apis": [
    { "name": "Stargate", "status": "up" },
    { "name": "Across", "status": "up" },
    { "name": "Hop", "status": "down" }
  ]
}
```

## Frontend Integration

### Updated bridge-api.js

```javascript
class BridgeAPI {
  constructor() {
    this.baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : '';
  }

  async getAllQuotes(fromChain, toChain, amount) {
    try {
      const response = await fetch(`${this.baseUrl}/api/quote?` + new URLSearchParams({
        fromChain,
        toChain,
        amount: amount.toString()
      }));

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        quotes: data.quotes || [],
        errors: data.errors || []
      };
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
      return {
        quotes: [],
        errors: [{ bridge: 'API', error: error.message }]
      };
    }
  }

  async trackClick(bridge, url, fromChain, toChain, amount) {
    try {
      const response = await fetch(`${this.baseUrl}/api/track-click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bridge,
          url,
          fromChain,
          toChain,
          amount
        })
      });

      const data = await response.json();
      return data.redirectUrl;
    } catch (error) {
      console.error('Failed to track click:', error);
      return url; // Fallback to original URL
    }
  }
}
```

### Updated selectBridge function

```javascript
async function selectBridge(affiliateUrl, bridgeName) {
  // Track the click
  const trackedUrl = await bridgeAPI.trackClick(
    bridgeName,
    affiliateUrl,
    document.getElementById('fromChain').value,
    document.getElementById('toChain').value,
    document.getElementById('amount').value
  );
  
  // Open tracked URL
  window.open(trackedUrl, '_blank');
}
```

## Adding New Bridge APIs

### Step 1: Add to Backend

Edit `/api/quote.js`:

```javascript
// Add new bridge function
async function getNewBridgeQuote() {
  try {
    const response = await fetchWithTimeout('https://api.newbridge.com/quote');
    // Process response
    return {
      name: 'New Bridge',
      logo: 'N',
      fee: calculateFee(),
      gasEstimate: calculateGas(),
      time: estimateTime(),
      reliability: 99.5,
      affiliateUrl: buildAffiliateUrl(),
      source: 'live'
    };
  } catch (error) {
    throw error;
  }
}

// Add to quote aggregation
const promises = [
  getStargateQuote(),
  getAcrossQuote(),
  getHopQuote(),
  getNewBridgeQuote() // Add here
];
```

### Step 2: Test Locally

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev

# Test API
curl "http://localhost:3000/api/quote?fromChain=ethereum&toChain=polygon&amount=100"
```

### Step 3: Deploy

```bash
vercel --prod
```

## Error Handling

### API Failures
- Individual bridge failures don't break the entire request
- Failed APIs are reported in `errors` array
- Fallback data available if all APIs fail

### Rate Limiting
- 5-minute cache implemented
- Distributed load across multiple APIs
- Configurable timeout (10 seconds default)

### CORS Issues
✅ **SOLVED**: All external API calls go through backend

## Performance Optimization

### Caching Strategy
```javascript
// Backend implements 5-minute cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResult(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

### Parallel Requests
- All bridge APIs called simultaneously
- Promise.allSettled ensures partial failures don't break results
- 10-second timeout per API

## Security

### API Protection
- CORS headers configured
- Input validation on all endpoints
- Rate limiting ready (configurable)
- No sensitive data exposed

### Tracking Privacy
- User IPs anonymized
- No personal data stored
- Tracking IDs are random
- GDPR compliant

## Monitoring

### Logs to Watch
```bash
# Vercel Function Logs
vercel logs --follow

# Specific function
vercel logs api/quote.js

# Errors only
vercel logs --error
```

### Key Metrics
- API response times
- Success/failure rates
- Click-through rates
- User geography
- Popular routes

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - ✅ Fixed by backend proxy
   - Check vercel.json headers

2. **Slow Responses**
   - Check individual API performance
   - Adjust timeout settings
   - Enable caching

3. **Missing Quotes**
   - Verify API endpoints are active
   - Check error logs
   - Test with curl directly

4. **Tracking Not Working**
   - Verify track-click endpoint
   - Check browser console
   - Test with Postman

## Support

- [GitHub Issues](https://github.com/mohammadr7204/bridge-fee-optimizer/issues)
- [Vercel Support](https://vercel.com/support)
- [Bridge API Docs](https://docs.stargate.finance)