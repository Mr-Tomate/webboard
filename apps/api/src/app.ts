import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import { healthRoutes } from './routes/health.js';
import { workspaceRoutes } from './routes/workspaces.js';

export async function buildApp(prismaClient: PrismaClient): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(healthRoutes);
  await app.register(workspaceRoutes, { prisma: prismaClient });

  return app;
}
