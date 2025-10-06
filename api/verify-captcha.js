// CAPTCHA verification endpoint
import { verify } from 'hcaptcha';

export default async function handler(req, res) {
  // Security headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'CAPTCHA token is required'
    });
  }

  try {
    const secret = process.env.HCAPTCHA_SECRET_KEY;
    
    if (!secret) {
      console.error('HCAPTCHA_SECRET_KEY not configured');
      // In development, allow bypassing
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({ success: true, bypass: true });
      }
      throw new Error('CAPTCHA configuration error');
    }

    // Verify the token with hCaptcha
    const result = await verify(secret, token);

    if (result.success) {
      // Generate a session token for rate limiting
      const sessionToken = generateSessionToken();
      
      res.status(200).json({
        success: true,
        sessionToken,
        expiresIn: 3600 // 1 hour
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'CAPTCHA verification failed'
      });
    }
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification service unavailable'
    });
  }
}

function generateSessionToken() {
  // Generate a secure random token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}