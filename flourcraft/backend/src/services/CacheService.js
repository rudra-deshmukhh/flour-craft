const Redis = require('redis');
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.client = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.isConnected = false;
    this.setupEventListeners();
    this.connect();

    // Cache TTL configurations (in seconds)
    this.TTL = {
      // Analytics data
      ORDERS_BY_HOUR: 300,     // 5 minutes
      SALES_TOTALS: 600,       // 10 minutes
      TOP_PRODUCTS: 900,       // 15 minutes
      SUBSCRIPTIONS: 1800,     // 30 minutes
      STOCK_LEVELS: 300,       // 5 minutes
      DELIVERY_METRICS: 600,   // 10 minutes
      
      // Dashboard data
      DASHBOARD_SUMMARY: 180,  // 3 minutes
      REALTIME_INSIGHTS: 60,   // 1 minute
      
      // User sessions
      USER_SESSION: 3600,      // 1 hour
      
      // API rate limiting
      RATE_LIMIT: 3600,        // 1 hour
      
      // General purpose
      SHORT: 300,              // 5 minutes
      MEDIUM: 1800,            // 30 minutes
      LONG: 7200,              // 2 hours
      VERY_LONG: 86400         // 24 hours
    };

    // Cache key prefixes
    this.PREFIXES = {
      ANALYTICS: 'analytics',
      DASHBOARD: 'dashboard',
      USER: 'user',
      SESSION: 'session',
      RATE_LIMIT: 'rate_limit',
      TEMP: 'temp'
    };
  }

  async connect() {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
    }
  }

  setupEventListeners() {
    this.client.on('error', (error) => {
      console.error('Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis connecting...');
    });

    this.client.on('ready', () => {
      console.log('Redis ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('Redis connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  // Generate cache key with prefix and hash for long keys
  generateKey(prefix, identifier, params = {}) {
    const baseKey = `${prefix}:${identifier}`;
    
    if (Object.keys(params).length === 0) {
      return baseKey;
    }

    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});

    const paramString = JSON.stringify(sortedParams);
    
    // Use hash for long parameter strings
    if (paramString.length > 50) {
      const hash = crypto.createHash('md5').update(paramString).digest('hex');
      return `${baseKey}:${hash}`;
    }

    return `${baseKey}:${paramString}`;
  }

  // Get data from cache
  async get(key) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set data in cache
  async set(key, data, ttl = this.TTL.MEDIUM) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache set');
      return false;
    }

    try {
      const serializedData = JSON.stringify(data);
      await this.client.setEx(key, ttl, serializedData);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Delete data from cache
  async del(key) {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache delete');
      return false;
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Delete multiple keys
  async delMultiple(keys) {
    if (!this.isConnected || keys.length === 0) {
      return 0;
    }

    try {
      return await this.client.del(keys);
    } catch (error) {
      console.error('Cache delete multiple error:', error);
      return 0;
    }
  }

  // Get or set pattern - execute function if cache miss
  async getOrSet(key, fetchFunction, ttl = this.TTL.MEDIUM) {
    try {
      // Try to get from cache first
      let data = await this.get(key);
      
      if (data !== null) {
        return data;
      }

      // Cache miss - execute function
      data = await fetchFunction();
      
      // Store in cache for next time
      await this.set(key, data, ttl);
      
      return data;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // If cache fails, just execute the function
      return await fetchFunction();
    }
  }

  // Check if key exists
  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Get keys matching pattern
  async keys(pattern) {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  // Clear all keys matching pattern
  async clearPattern(pattern) {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        return await this.delMultiple(keys);
      }
      return 0;
    } catch (error) {
      console.error('Cache clear pattern error:', error);
      return 0;
    }
  }

  // Set with expiration at specific time
  async setExpireAt(key, data, expireAt) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const serializedData = JSON.stringify(data);
      await this.client.set(key, serializedData);
      await this.client.expireAt(key, Math.floor(expireAt.getTime() / 1000));
      return true;
    } catch (error) {
      console.error('Cache setExpireAt error:', error);
      return false;
    }
  }

  // Increment counter
  async increment(key, amount = 1, ttl = this.TTL.MEDIUM) {
    if (!this.isConnected) {
      return amount;
    }

    try {
      const result = await this.client.incrBy(key, amount);
      
      // Set TTL only if this is a new key
      if (result === amount) {
        await this.client.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return amount;
    }
  }

  // Hash operations
  async hSet(key, field, value, ttl = this.TTL.MEDIUM) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.client.hSet(key, field, serializedValue);
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error('Cache hSet error:', error);
      return false;
    }
  }

  async hGet(key, field) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const data = await this.client.hGet(key, field);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Cache hGet error:', error);
      return null;
    }
  }

  async hGetAll(key) {
    if (!this.isConnected) {
      return {};
    }

    try {
      const data = await this.client.hGetAll(key);
      const result = {};
      
      for (const [field, value] of Object.entries(data)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Cache hGetAll error:', error);
      return {};
    }
  }

  // List operations
  async lPush(key, ...values) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const serializedValues = values.map(v => JSON.stringify(v));
      return await this.client.lPush(key, ...serializedValues);
    } catch (error) {
      console.error('Cache lPush error:', error);
      return 0;
    }
  }

  async lRange(key, start = 0, stop = -1) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const data = await this.client.lRange(key, start, stop);
      return data.map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
    } catch (error) {
      console.error('Cache lRange error:', error);
      return [];
    }
  }

  // Set operations
  async sAdd(key, ...members) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const serializedMembers = members.map(m => JSON.stringify(m));
      return await this.client.sAdd(key, ...serializedMembers);
    } catch (error) {
      console.error('Cache sAdd error:', error);
      return 0;
    }
  }

  async sMembers(key) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const data = await this.client.sMembers(key);
      return data.map(item => {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
    } catch (error) {
      console.error('Cache sMembers error:', error);
      return [];
    }
  }

  // Rate limiting
  async isRateLimited(identifier, limit = 100, window = 3600) {
    const key = this.generateKey(this.PREFIXES.RATE_LIMIT, identifier);
    const current = await this.increment(key, 1, window);
    return current > limit;
  }

  // Analytics specific methods
  async cacheAnalytics(type, params, data, customTTL = null) {
    const key = this.generateKey(this.PREFIXES.ANALYTICS, type, params);
    const ttl = customTTL || this.TTL[type.toUpperCase()] || this.TTL.MEDIUM;
    return await this.set(key, data, ttl);
  }

  async getAnalytics(type, params) {
    const key = this.generateKey(this.PREFIXES.ANALYTICS, type, params);
    return await this.get(key);
  }

  async clearAnalyticsCache(type = null) {
    const pattern = type ? 
      `${this.PREFIXES.ANALYTICS}:${type}:*` : 
      `${this.PREFIXES.ANALYTICS}:*`;
    return await this.clearPattern(pattern);
  }

  // Dashboard specific methods
  async cacheDashboard(identifier, data, ttl = this.TTL.DASHBOARD_SUMMARY) {
    const key = this.generateKey(this.PREFIXES.DASHBOARD, identifier);
    return await this.set(key, data, ttl);
  }

  async getDashboard(identifier) {
    const key = this.generateKey(this.PREFIXES.DASHBOARD, identifier);
    return await this.get(key);
  }

  // Session management
  async setSession(sessionId, userData, ttl = this.TTL.USER_SESSION) {
    const key = this.generateKey(this.PREFIXES.SESSION, sessionId);
    return await this.set(key, userData, ttl);
  }

  async getSession(sessionId) {
    const key = this.generateKey(this.PREFIXES.SESSION, sessionId);
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = this.generateKey(this.PREFIXES.SESSION, sessionId);
    return await this.del(key);
  }

  // Cache warming - preload frequently accessed data
  async warmCache(warmingFunctions) {
    console.log('🔥 Starting cache warming...');
    
    const promises = warmingFunctions.map(async ({ key, fetchFunction, ttl }) => {
      try {
        const exists = await this.exists(key);
        if (!exists) {
          const data = await fetchFunction();
          await this.set(key, data, ttl);
          console.log(`✅ Warmed cache for: ${key}`);
        }
      } catch (error) {
        console.error(`❌ Failed to warm cache for ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log('🔥 Cache warming completed');
  }

  // Cache health check
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'error', message: 'Redis not connected' };
      }

      const testKey = 'health_check_' + Date.now();
      await this.set(testKey, { test: true }, 10);
      const retrieved = await this.get(testKey);
      await this.del(testKey);

      if (retrieved && retrieved.test) {
        return { status: 'healthy', message: 'Redis working correctly' };
      } else {
        return { status: 'error', message: 'Redis read/write test failed' };
      }
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Get cache statistics
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.client.info();
      const stats = {};
      
      // Parse Redis info response
      info.split('\r\n').forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      });

      return {
        connected: this.isConnected,
        memory: {
          used: stats.used_memory_human,
          peak: stats.used_memory_peak_human,
          rss: stats.used_memory_rss_human
        },
        connections: {
          connected_clients: stats.connected_clients,
          total_connections_received: stats.total_connections_received
        },
        operations: {
          total_commands_processed: stats.total_commands_processed,
          instantaneous_ops_per_sec: stats.instantaneous_ops_per_sec
        },
        keyspace: stats.db0 || 'No keys'
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  // Graceful shutdown
  async disconnect() {
    try {
      if (this.isConnected) {
        await this.client.quit();
        console.log('Redis disconnected gracefully');
      }
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }
}

// Export singleton instance
module.exports = new CacheService();