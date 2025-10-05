# 🚀 BridgeCompare Deployment Guide

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Domain name (optional)

## Step 1: Fork & Clone

```bash
git clone https://github.com/mohammadr7204/bridge-fee-optimizer.git
cd bridge-fee-optimizer
```

## Step 2: Deploy to Vercel

### Option A: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mohammadr7204/bridge-fee-optimizer)

### Option B: Manual Deploy

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow prompts:
   - Set up and deploy: Yes
   - Which scope: Your account
   - Link to existing project: No
   - Project name: bridge-compare
   - Directory: ./
   - Override settings: No

## Step 3: Environment Variables

In Vercel Dashboard:
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add:
   - `NODE_ENV`: production
   - `AFFILIATE_ID`: bridgecompare

## Step 4: Custom Domain (Optional)

1. In Vercel Dashboard → Domains
2. Add your domain
3. Follow DNS instructions

## Step 5: Test Production

```bash
curl https://your-app.vercel.app/api/health
```

Should return:
```json
{
  "status": "healthy",
  "apis": [...],
  "version": "2.0.0"
}
```

## Step 6: Monitor & Analytics

### Vercel Analytics
1. Enable in Vercel Dashboard
2. Add to Environment Variables:
   - `VERCEL_ANALYTICS_ID`: your-id

### Error Monitoring
Check Vercel Functions logs for:
- API failures
- Click tracking
- Performance issues

## Troubleshooting

### CORS Issues
✅ Fixed by backend API proxy at `/api/quote.js`

### API Rate Limits
- Implemented 5-minute cache
- Distributed across multiple APIs
- Fallback data available

### Slow Performance
- Check Vercel Function logs
- Optimize API timeout settings
- Consider upgrading Vercel plan

## Production Checklist

- [ ] Backend APIs deployed
- [ ] CORS handling verified
- [ ] Click tracking active
- [ ] Health endpoint working
- [ ] Custom domain configured
- [ ] Analytics enabled
- [ ] Error monitoring setup
- [ ] SSL certificate active
- [ ] Performance optimized

## Maintenance

### Update Bridge APIs
1. Edit `/api/quote.js`
2. Test locally: `vercel dev`
3. Deploy: `vercel --prod`

### Monitor Performance
```bash
# Check API health
curl https://your-app.vercel.app/api/health

# Test quote endpoint
curl "https://your-app.vercel.app/api/quote?fromChain=ethereum&toChain=polygon&amount=100"

# Track clicks
curl -X POST "https://your-app.vercel.app/api/track-click" \
  -H "Content-Type: application/json" \
  -d '{"bridge":"stargate","url":"https://stargate.finance"}'
```

## Scaling

When you reach 10k+ users:
1. Upgrade Vercel plan
2. Add database for tracking
3. Implement Redis cache
4. Add CDN for assets
5. Enable regional edge functions

## Support

Issues? Check:
- [GitHub Issues](https://github.com/mohammadr7204/bridge-fee-optimizer/issues)
- [Vercel Docs](https://vercel.com/docs)
- Function logs in Vercel Dashboard