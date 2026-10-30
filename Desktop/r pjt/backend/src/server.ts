import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import blockchainRoutes from './routes/blockchainRoutes';
import lifecycleRoutes from './routes/lifecycleRoutes';
import publicRoutes from './routes/publicRoutes';
import intelligenceRoutes from './routes/intelligenceRoutes';
import twinRoutes from './routes/twinRoutes';
import ecosystemRoutes from './routes/ecosystemRoutes';
import garageRoutes from './routes/garageRoutes';
import privacyRoutes from './routes/privacyRoutes';
import adminRoutes from './routes/adminRoutes';
import fraudGraphRoutes from './routes/fraudGraphRoutes';
import investigationAgentRoutes from './routes/investigationAgentRoutes';
import privacyVerificationRoutes from './routes/privacyVerificationRoutes';
import path from 'path';
import { prisma } from './lib/prisma';
import { investigationOrchestrator } from './services/agent/investigationOrchestrator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 1. Security headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// 4. Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Health check
const healthHandler = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Blockchain Vehicle Passport Enterprise API',
    version: '1.0.0',
    network: 'Automotive Verification Ledger',
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// 6. Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', intelligenceRoutes);
app.use('/api/vehicles', twinRoutes);
app.use('/api/vehicles', ecosystemRoutes);
app.use('/api/vehicles/:vehicleId/disclosures', privacyRoutes);
app.use('/api/vehicles', lifecycleRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/garages', garageRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/admin/intelligence', adminRoutes);
app.use('/api/intelligence/graph', fraudGraphRoutes);
app.use('/api/investigations', investigationAgentRoutes);
app.use('/api/privacy', privacyVerificationRoutes);

// Recover any runs left pending across server restart
investigationOrchestrator.recoverStaleRuns().catch((err) => {
  console.warn('[Server] Stale investigation recovery warning:', err.message);
});

// Safe static uploads serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// 7. 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// 8. Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// 9. Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Vehicle Passport API Server running on port ${PORT}`);
  console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nGracefully shutting down...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('PostgreSQL Prisma connection closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
