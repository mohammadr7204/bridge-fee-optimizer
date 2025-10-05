// Health check endpoint for monitoring

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  };

  // Check if APIs are accessible
  const apiChecks = [];
  
  try {
    const stargateCheck = await fetch('https://api.stargate.finance/api/health', {
      signal: AbortSignal.timeout(5000)
    }).then(r => r.ok).catch(() => false);
    apiChecks.push({ name: 'Stargate', status: stargateCheck ? 'up' : 'down' });
  } catch (e) {
    apiChecks.push({ name: 'Stargate', status: 'down' });
  }

  try {
    const acrossCheck = await fetch('https://app.across.to/api/health', {
      signal: AbortSignal.timeout(5000)
    }).then(r => r.ok).catch(() => false);
    apiChecks.push({ name: 'Across', status: acrossCheck ? 'up' : 'down' });
  } catch (e) {
    apiChecks.push({ name: 'Across', status: 'down' });
  }

  health.apis = apiChecks;
  health.status = apiChecks.some(api => api.status === 'up') ? 'healthy' : 'degraded';

  res.status(200).json(health);
}