import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { PrismaClient } from '@prisma/client';
import { healthRoutes } from './routes/health.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { challengeRoutes } from './routes/challenges.js';
import { TelemetryRoomManager } from './telemetry/room-manager.js';

export interface AppOptions {
  prisma: PrismaClient;
  roomManager?: TelemetryRoomManager;
}

export async function buildApp(
  optionsOrPrisma: PrismaClient | AppOptions
): Promise<FastifyInstance> {
  const prisma =
    'prisma' in optionsOrPrisma ? optionsOrPrisma.prisma : optionsOrPrisma;
  const roomManager =
    'roomManager' in optionsOrPrisma && optionsOrPrisma.roomManager
      ? optionsOrPrisma.roomManager
      : new TelemetryRoomManager();

  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(websocket);

  await app.register(healthRoutes);
  await app.register(workspaceRoutes, { prisma, roomManager });
  await app.register(challengeRoutes, { prisma });
  await app.register(telemetryRoutes, { roomManager });

  return app;
}
