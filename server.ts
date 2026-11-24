import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { connectMongo, getMongoStatus } from './server/db/mongo.ts';
import { adminRouter } from './server/routes/adminRoutes.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { publicRouter } from './server/routes/publicRoutes.ts';
import { startScheduler } from './server/services/schedulerService.ts';

async function startServer(): Promise<void> {
  await connectMongo();
  startScheduler();

  const app = express();
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      process.env.APP_URL?.trim(),
      process.env.FRONTEND_URL?.trim(),
      process.env.CORS_ORIGIN?.trim(),
    ].filter((value): value is string => Boolean(value));
    const allowed = !origin || allowedOrigins.includes(origin);

    if (origin && allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(allowed ? 204 : 403);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'titanx-api',
      database: 'mongodb',
      mongo: getMongoStatus(),
    });
  });

  app.use('/api/public', publicRouter);
  app.use('/api/webhooks', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  const isProd = process.env.NODE_ENV === 'production';
  const separateFrontend = process.env.SEPARATE_FRONTEND === 'true';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!separateFrontend && (!isProd || !fs.existsSync(distDir))) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || (process.env.SEPARATE_FRONTEND === 'true' ? 3001 : 3000));
  app.listen(port, '0.0.0.0', () => {
    console.log(`TITAN X server running on http://0.0.0.0:${port}`);
  });
}

void startServer();
