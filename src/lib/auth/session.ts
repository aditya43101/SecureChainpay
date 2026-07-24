import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  return redisClient;
}

export async function createSession(userId: string, sessionId: string, ttlSeconds: number = 86400): Promise<void> {
  const client = await getRedisClient();
  await client.set(`session:${userId}:${sessionId}`, 'active', {
    EX: ttlSeconds
  });
}

export async function verifySession(userId: string, sessionId: string): Promise<boolean> {
  const client = await getRedisClient();
  const session = await client.get(`session:${userId}:${sessionId}`);
  return session === 'active';
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(`session:${userId}:${sessionId}`);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const client = await getRedisClient();
  const keys = await client.keys(`session:${userId}:*`);
  if (keys.length > 0) {
    await client.del(keys);
  }
}
