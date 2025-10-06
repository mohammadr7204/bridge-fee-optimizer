// Rate limiter implementation with Redis/Upstash support
import { Redis } from '@upstash/redis';

export class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 60;
    this.keyPrefix = options.keyPrefix || 'ratelimit:';
    
    // Initialize Redis if available, fallback to in-memory
    if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
      });
      this.useRedis = true;
    } else {
      this.memoryStore = new Map();
      this.useRedis = false;
      console.warn('Rate limiter using in-memory store. Configure Redis for production.');
    }
  }

  async checkLimit(identifier) {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    try {
      if (this.useRedis) {
        // Redis implementation
        const requests = await this.redis.zrangebyscore(
          key,
          windowStart,
          now,
          { withscores: true }
        );
        
        // Clean old entries
        await this.redis.zremrangebyscore(key, '-inf', windowStart);
        
        if (requests.length >= this.maxRequests) {
          const oldestRequest = requests[0]?.score || windowStart;
          const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
          
          return {
            allowed: false,
            remaining: 0,
            retryAfter,
            resetAt: new Date(oldestRequest + this.windowMs).toISOString()
          };
        }
        
        // Add current request
        await this.redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
        await this.redis.expire(key, Math.ceil(this.windowMs / 1000));
        
        return {
          allowed: true,
          remaining: this.maxRequests - requests.length - 1,
          retryAfter: 0,
          resetAt: new Date(now + this.windowMs).toISOString()
        };
      } else {
        // In-memory fallback
        let requests = this.memoryStore.get(key) || [];
        
        // Filter out old requests
        requests = requests.filter(timestamp => timestamp > windowStart);
        
        if (requests.length >= this.maxRequests) {
          const oldestRequest = requests[0] || windowStart;
          const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
          
          return {
            allowed: false,
            remaining: 0,
            retryAfter,
            resetAt: new Date(oldestRequest + this.windowMs).toISOString()
          };
        }
        
        // Add current request
        requests.push(now);
        this.memoryStore.set(key, requests);
        
        // Clean up old keys periodically
        this.cleanupMemoryStore();
        
        return {
          allowed: true,
          remaining: this.maxRequests - requests.length,
          retryAfter: 0,
          resetAt: new Date(now + this.windowMs).toISOString()
        };
      }
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Allow request on error to avoid blocking users
      return {
        allowed: true,
        remaining: -1,
        retryAfter: 0,
        resetAt: new Date(now + this.windowMs).toISOString()
      };
    }
  }

  cleanupMemoryStore() {
    if (this.memoryStore.size > 1000) {
      // Remove old entries when store gets too large
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      for (const [key, requests] of this.memoryStore.entries()) {
        const activeRequests = requests.filter(timestamp => timestamp > windowStart);
        if (activeRequests.length === 0) {
          this.memoryStore.delete(key);
        } else {
          this.memoryStore.set(key, activeRequests);
        }
      }
    }
  }

  async reset(identifier) {
    const key = `${this.keyPrefix}${identifier}`;
    
    if (this.useRedis) {
      await this.redis.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }
}