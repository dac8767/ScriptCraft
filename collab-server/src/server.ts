/**
 * ScriptCraft auth server (formerly the OpenDraft "collab server").
 *
 * v6.40: the real-time collaboration half (Hocuspocus, Yjs documents, the
 * WebSocket upgrade path, /api/collab invite management, reset/close-document)
 * was REMOVED with the app's Collaborate feature. What remains is the
 * IDENTITY PROVIDER the app still depends on: /auth/* (register, login, 2FA,
 * devices, email verification, password reset, Google sign-in) — proxied by
 * the Python backend's /api/auth/* — plus /health.
 */
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { config } from './config';
import { initDB } from './db';
import { seedDemoUser } from './bootstrap/seedDemoUser';
import authRoutes from './routes/auth';
import { standardLimiter } from './middleware/rateLimit';

// ── Express app for REST API ──

const app = express();

// Trust proxy headers. In production (Cloud Run / load balancer) we trust
// every hop; in development the Python backend proxies /auth/* to us from
// the loopback interface, so we trust only loopback there. Without this,
// express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR whenever the
// backend forwards X-Forwarded-For.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
} else {
  app.set('trust proxy', 'loopback');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Tauri, mobile apps)
    if (!origin) return callback(null, true);

    // Allow explicitly configured origins
    if (config.corsOrigins.includes(origin)) return callback(null, true);

    // Allow any private/local network origin (192.168.*, 10.*, 172.16-31.*, localhost, 127.*)
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        host === 'localhost' ||
        host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        host === '::1' ||
        host === 'tauri.localhost'
      ) {
        return callback(null, true);
      }
    } catch { /* invalid URL, fall through to reject */ }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Request logger — logs all incoming HTTP requests
app.use((req, _res, next) => {
  console.log(`[http] ${req.method} ${req.path} from ${req.ip} origin=${req.headers.origin || 'none'}`);
  next();
});

app.use(standardLimiter);

// Auth routes
app.use('/auth', authRoutes);

// Health check with memory stats
app.get('/health', (_req, res) => {
  const mem = process.memoryUsage();

  res.json({
    status: 'ok',
    service: 'scriptcraft-auth',
    uptime: Math.round(process.uptime()),
    database: config.dbType,
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      external_mb: Math.round(mem.external / 1024 / 1024),
    },
  });
});

// ── Bootstrap: init DB then start HTTP(S) server ──

async function main(): Promise<void> {
  // Initialize database (async — needed for PostgreSQL)
  await initDB();
  // Seed the demo user once the schema exists. No-op unless SEED_DEMO_USER is set.
  await seedDemoUser();

  const HOST = config.host;
  const PORT = config.port;
  let httpServer: http.Server | https.Server;

  if (config.tlsCert && config.tlsKey) {
    const cert = fs.readFileSync(config.tlsCert);
    const key = fs.readFileSync(config.tlsKey);
    httpServer = https.createServer({ cert, key }, app);
    console.log('TLS enabled (https://)');
  } else {
    httpServer = http.createServer(app);
    console.log('TLS disabled (http://)');
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`ScriptCraft Auth Server running on ${HOST}:${PORT}`);
    console.log(`  REST API:  ${config.tlsCert ? 'https' : 'http'}://${HOST}:${PORT}`);
    console.log(`  Backend:   ${config.backendUrl}`);
    console.log(`  Database:  ${config.dbType}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
