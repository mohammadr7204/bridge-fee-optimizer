/**
 * Affiliate Click Tracking API
 * 
 * Records when users click on bridge affiliate links.
 * This is CRITICAL for proving conversions to bridges for revenue sharing.
 * 
 * POST /api/track-click
 * Body: { bridge, fromChain, toChain, amount, userId }
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { bridge, fromChain, toChain, amount, userId } = req.body;

    // Validation
    if (!bridge || !fromChain || !toChain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bridge, fromChain, toChain'
      });
    }

    const trackingId = generateTrackingId();
    const timestamp = new Date().toISOString();

    // Prepare click data
    const clickData = {
      trackingId,
      bridge: bridge.toLowerCase(),
      fromChain: fromChain.toLowerCase(),
      toChain: toChain.toLowerCase(),
      amount: parseFloat(amount) || 0,
      userId: userId || 'anonymous',
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
      referrer: req.headers['referer'] || req.headers['referrer'] || 'direct',
      timestamp
    };

    console.log('[CLICK TRACKED]', JSON.stringify(clickData, null, 2));

    // TODO: Store in database when configured
    // For now, logs go to Vercel logs (accessible in Vercel dashboard)
    /*
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO affiliate_clicks (
        tracking_id, bridge_name, from_chain, to_chain, 
        amount, user_id, user_agent, ip_address, created_at
      ) VALUES (
        ${trackingId}, ${clickData.bridge}, ${clickData.fromChain}, 
        ${clickData.toChain}, ${clickData.amount}, ${clickData.userId},
        ${clickData.userAgent}, ${clickData.ip}, NOW()
      )
    `;
    */

    // Generate affiliate URLs with tracking
    const affiliateUrls = {
      stargate: `https://stargate.finance/transfer?ref=bridgecompare&track=${trackingId}`,
      across: `https://across.to?ref=bridgecompare&track=${trackingId}`,
      hop: `https://app.hop.exchange/send?ref=bridgecompare&track=${trackingId}`
    };

    const affiliateUrl = affiliateUrls[bridge.toLowerCase()] 
      || `https://${bridge}.com?ref=bridgecompare&track=${trackingId}`;

    // Log for analytics monitoring
    console.log(`[AFFILIATE CLICK] ${bridge} | ${fromChain}→${toChain} | $${amount} | Track: ${trackingId}`);

    return res.status(200).json({
      success: true,
      trackingId,
      affiliateUrl,
      message: 'Click tracked successfully',
      timestamp
    });

  } catch (error) {
    console.error('[TRACK ERROR]', error.message, error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to track click',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Generate unique tracking ID
function generateTrackingId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `bc_${timestamp}_${randomStr}`;
}