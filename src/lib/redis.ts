// Redis client configuration for caching
import { Redis } from 'ioredis';

// Create Redis client instance
const createRedisClient = () => {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL);
  }

  // Default to localhost if no REDIS_URL is provided
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
  });
};

export const redis = createRedisClient();

// Export type for redis client if needed
export type { Redis };
