// Cache manager with Redis/Upstash support and fallback to in-memory
import { Redis } from '@upstash/redis';

export class CacheManager {
  constructor(options = {}) {
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes default
    this.keyPrefix = options.keyPrefix || 'cache:';
    
    // Initialize Redis if available
    if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
      });
      this.useRedis = true;
      console.info('Cache using Redis/Upstash');
    } else if (process.env.REDIS_URL) {
      // Support for other Redis providers
      this.initializeRedis(process.env.REDIS_URL);
    } else {
      this.memoryCache = new Map();
      this.useRedis = false;
      console.warn('Cache using in-memory store. Configure Redis for production.');
    }
  }

  async initializeRedis(redisUrl) {
    try {
      const { createClient } = await import('redis');
      this.redisClient = createClient({ url: redisUrl });
      await this.redisClient.connect();
      this.useRedis = true;
      console.info('Cache using Redis');
    } catch (error) {
      console.error('Redis initialization failed:', error);
      this.memoryCache = new Map();
      this.useRedis = false;
    }
  }

  async get(key) {
    const fullKey = `${this.keyPrefix}${key}`;
    
    try {
      if (this.useRedis) {
        if (this.redis) {
          // Upstash Redis
          const data = await this.redis.get(fullKey);
          return data ? JSON.parse(data) : null;
        } else if (this.redisClient) {
          // Standard Redis
          const data = await this.redisClient.get(fullKey);
          return data ? JSON.parse(data) : null;
        }
      } else {
        // In-memory cache
        const cached = this.memoryCache.get(fullKey);
        if (cached) {
          if (cached.expiry > Date.now()) {
            return cached.data;
          } else {
            this.memoryCache.delete(fullKey);
          }
        }
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }
    
    return null;
  }

  async set(key, value, ttl = null) {
    const fullKey = `${this.keyPrefix}${key}`;
    const ttlSeconds = ttl || this.defaultTTL;
    
    try {
      const data = JSON.stringify(value);
      
      if (this.useRedis) {
        if (this.redis) {
          // Upstash Redis
          await this.redis.set(fullKey, data, { ex: ttlSeconds });
        } else if (this.redisClient) {
          // Standard Redis
          await this.redisClient.setEx(fullKey, ttlSeconds, data);
        }
      } else {
        // In-memory cache
        this.memoryCache.set(fullKey, {
          data: value,
          expiry: Date.now() + (ttlSeconds * 1000)
        });
        
        // Cleanup old entries if cache is too large
        if (this.memoryCache.size > 1000) {
          this.cleanup();
        }
      }
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async delete(key) {
    const fullKey = `${this.keyPrefix}${key}`;
    
    try {
      if (this.useRedis) {
        if (this.redis) {
          await this.redis.del(fullKey);
        } else if (this.redisClient) {
          await this.redisClient.del(fullKey);
        }
      } else {
        this.memoryCache.delete(fullKey);
      }
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async clear() {
    try {
      if (this.useRedis) {
        if (this.redis) {
          // Upstash doesn't support pattern deletion easily
          // Would need to implement scan and delete
          console.warn('Clear not fully implemented for Upstash');
        } else if (this.redisClient) {
          const keys = await this.redisClient.keys(`${this.keyPrefix}*`);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        }
      } else {
        this.memoryCache.clear();
      }
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  cleanup() {
    if (!this.useRedis) {
      const now = Date.now();
      for (const [key, value] of this.memoryCache.entries()) {
        if (value.expiry <= now) {
          this.memoryCache.delete(key);
        }
      }
    }
  }

  async getStats() {
    const stats = {
      type: this.useRedis ? 'redis' : 'memory',
      timestamp: new Date().toISOString()
    };

    if (!this.useRedis) {
      stats.entries = this.memoryCache.size;
      stats.memoryUsage = JSON.stringify([...this.memoryCache.entries()]).length;
    } else {
      stats.connected = true;
    }

    return stats;
  }
}