// Error tracking with Sentry integration
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry
if (process.env.SENTRY_DSN && process.env.ENABLE_ERROR_TRACKING === 'true') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new ProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove API keys from URLs
        if (event.request.url) {
          event.request.url = event.request.url.replace(/apiKey=[^&]*/g, 'apiKey=REDACTED');
        }
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }
      return event;
    },
  });
}

export function captureError(error, context = {}) {
  console.error('Error captured:', error);
  
  if (process.env.ENABLE_ERROR_TRACKING === 'true' && Sentry) {
    Sentry.captureException(error, {
      extra: context,
      tags: {
        component: context.component || 'unknown',
        severity: context.severity || 'error'
      }
    });
  }
  
  // Also log to custom error tracking if needed
  logErrorToCustomSystem(error, context);
}

export function captureMessage(message, level = 'info', context = {}) {
  console.log(`[${level.toUpperCase()}]`, message);
  
  if (process.env.ENABLE_ERROR_TRACKING === 'true' && Sentry) {
    Sentry.captureMessage(message, level, {
      extra: context
    });
  }
}

export function setUserContext(user) {
  if (Sentry) {
    Sentry.setUser({
      id: user.id,
      ip_address: user.ip ? maskIP(user.ip) : undefined,
      // Don't send email or other PII
    });
  }
}

export function addBreadcrumb(breadcrumb) {
  if (Sentry) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

export function withErrorTracking(handler) {
  return async (req, res) => {
    try {
      // Add breadcrumb for API call
      addBreadcrumb({
        category: 'api',
        message: `${req.method} ${req.url}`,
        level: 'info',
        data: {
          method: req.method,
          url: req.url,
          query: req.query
        }
      });
      
      return await handler(req, res);
    } catch (error) {
      captureError(error, {
        component: 'api',
        endpoint: req.url,
        method: req.method,
        query: req.query
      });
      
      // Return user-friendly error
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred',
        message: 'Our team has been notified and is working on a fix',
        requestId: Sentry?.lastEventId() || generateRequestId()
      });
    }
  };
}

function logErrorToCustomSystem(error, context) {
  // Implement custom error logging if needed
  // Could send to a database, webhook, etc.
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    environment: process.env.NODE_ENV
  };
  
  // In production, you might send this to a logging service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to webhook or logging service
    // sendToLoggingService(errorLog);
  }
}

function maskIP(ip) {
  // Mask last octet for privacy
  const parts = ip.split('.');
  if (parts.length === 4) {
    parts[3] = 'xxx';
  }
  return parts.join('.');
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default {
  captureError,
  captureMessage,
  setUserContext,
  addBreadcrumb,
  withErrorTracking
};