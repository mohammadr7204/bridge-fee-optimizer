// Affiliate click tracking API

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { bridge, fromChain, toChain, amount, url } = req.body || req.query;

  if (!bridge || !url) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Generate tracking ID
  const trackingId = `bc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log the click (in production, this would go to a database)
  const clickData = {
    trackingId,
    bridge,
    fromChain,
    toChain,
    amount: parseFloat(amount) || 0,
    url,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    referer: req.headers.referer
  };

  // In production, save to database
  console.log('Affiliate click tracked:', clickData);

  // Build redirect URL with tracking
  let redirectUrl = url;
  const separator = url.includes('?') ? '&' : '?';
  redirectUrl += `${separator}ref=bridgecompare&tid=${trackingId}`;

  // Add UTM parameters for better tracking
  redirectUrl += `&utm_source=bridgecompare&utm_medium=comparison&utm_campaign=${bridge.toLowerCase()}`;

  res.status(200).json({
    success: true,
    trackingId,
    redirectUrl,
    message: 'Click tracked successfully'
  });
}