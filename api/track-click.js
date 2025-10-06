// Enhanced affiliate click tracking with security
import { validateInput, sanitizeInput } from '../utils/validation.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { captureError } from '../utils/errorTracking.js';

const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 30 // Lower limit for click tracking
});

export default async function handler(req, res) {
  // Security headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Rate limiting
    const clientIp = getClientIp(req);
    const rateLimitResult = await rateLimiter.checkLimit(clientIp);
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({ 
        success: false,
        error: 'Too many clicks, please wait',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Get and validate input
    const params = req.method === 'POST' ? req.body : req.query;
    const { bridge, fromChain, toChain, amount, url, sessionToken } = params;

    // Validate required fields
    if (!bridge || !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Validate session token if CAPTCHA is enabled
    if (process.env.ENABLE_CAPTCHA === 'true' && !sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'Session verification required'
      });
    }

    // Sanitize inputs
    const sanitizedData = sanitizeInput({
      bridge: bridge.toLowerCase(),
      fromChain: fromChain?.toLowerCase(),
      toChain: toChain?.toLowerCase(),
      amount: parseFloat(amount) || 0,
      url: url
    });

    // Validate URL is from allowed bridges
    const allowedDomains = [
      'stargate.finance',
      'across.to',
      'hop.exchange',
      'app.hop.exchange'
    ];
    
    const urlObj = new URL(sanitizedData.url);
    if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bridge URL'
      });
    }

    // Generate tracking data
    const trackingId = generateTrackingId();
    const clickData = {
      trackingId,
      bridge: sanitizedData.bridge,
      fromChain: sanitizedData.fromChain,
      toChain: sanitizedData.toChain,
      amount: sanitizedData.amount,
      url: sanitizedData.url,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: maskIP(clientIp),
      referer: req.headers.referer,
      sessionToken: sessionToken ? hashToken(sessionToken) : null
    };

    // Store click data (in production, save to database)
    await storeClickData(clickData);

    // Build redirect URL with enhanced tracking
    let redirectUrl = sanitizedData.url;
    const separator = redirectUrl.includes('?') ? '&' : '?';
    
    // Add affiliate parameters
    const affiliateCode = getAffiliateCode(sanitizedData.bridge);
    redirectUrl += `${separator}ref=${affiliateCode}`;
    redirectUrl += `&tid=${trackingId}`;
    redirectUrl += `&source=bridgecompare`;
    
    // Add UTM parameters for analytics
    redirectUrl += `&utm_source=bridgecompare`;
    redirectUrl += `&utm_medium=comparison`;
    redirectUrl += `&utm_campaign=${sanitizedData.bridge}`;
    redirectUrl += `&utm_content=${sanitizedData.fromChain}_to_${sanitizedData.toChain}`;

    res.status(200).json({
      success: true,
      trackingId,
      redirectUrl,
      message: 'Click tracked successfully'
    });

  } catch (error) {
    captureError(error, {
      component: 'track-click',
      method: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Failed to track click',
      message: 'Please try again'
    });
  }
}

function getClientIp(req) {
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             '0.0.0.0';
  return ip.split(',')[0].trim();
}

function maskIP(ip) {
  // GDPR compliance - mask last octet
  const parts = ip.split('.');
  if (parts.length === 4) {
    parts[3] = '0';
  }
  return parts.join('.');
}

function generateTrackingId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const hash = Buffer.from(`${timestamp}${random}`).toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '').substr(0, 12);
  return `bc_${timestamp}_${hash}`;
}

function hashToken(token) {
  // Simple hash for storing session tokens
  // In production, use proper crypto hashing
  return Buffer.from(token).toString('base64').substr(0, 16);
}

function getAffiliateCode(bridge) {
  const codes = {
    stargate: process.env.STARGATE_AFFILIATE_CODE || 'bridgecompare',
    across: process.env.ACROSS_AFFILIATE_CODE || 'bridgecompare',
    hop: process.env.HOP_AFFILIATE_CODE || 'bridgecompare'
  };
  return codes[bridge.toLowerCase()] || 'bridgecompare';
}

async function storeClickData(data) {
  // In production, store in database
  // For now, log to console and analytics
  console.log('Click tracked:', {
    trackingId: data.trackingId,
    bridge: data.bridge,
    amount: data.amount,
    route: `${data.fromChain} -> ${data.toChain}`
  });
  
  // Send to analytics if configured
  if (process.env.GOOGLE_ANALYTICS_ID) {
    // Send event to GA4
    // Implementation depends on GA setup
  }
  
  return true;
}