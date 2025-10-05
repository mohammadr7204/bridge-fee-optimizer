/**
 * Health Check API
 * 
 * Monitors system health and API availability.
 * Useful for uptime monitoring services and debugging.
 * 
 * GET /api/health
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : 'N/A',
      responseTime: `${Date.now() - startTime}ms`,
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'production',
      services: {
        api: 'operational',
        database: 'not_configured', // Will update when DB is added
        caching: 'operational'
      }
    };

    return res.status(200).json(health);

  } catch (error) {
    console.error('[HEALTH CHECK FAILED]', error);
    
    return res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}