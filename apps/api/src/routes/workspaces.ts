import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { TelemetryRoomManager } from '../telemetry/room-manager.js';
import {
  WorkspaceService,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from '../modules/workspaces/workspace.service.js';
import {
  SubmissionService,
  type SubmitChallengeInput,
} from '../modules/workspaces/submission.service.js';
import { requireAuth } from '../core/guards.js';
import { HttpError } from '../core/errors.js';

export interface WorkspaceRoutesOptions {
  prisma: PrismaClient;
  roomManager?: TelemetryRoomManager;
}

export const workspaceRoutes: FastifyPluginAsync<WorkspaceRoutesOptions> = async (app, opts) => {
  const workspaceService = new WorkspaceService(opts.prisma);
  const submissionService = new SubmissionService(opts.prisma);
  const roomManager = opts.roomManager;

  // Tratamento declarativo de erros de domínio HttpError
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }
    return reply.send(error);
  });

  // 1. Criar novo Workspace (Solo ou Grupo)
  app.post<{ Body: CreateWorkspaceInput }>('/api/workspaces', async (req, reply) => {
    const result = await workspaceService.create(req.body);
    return reply.status(201).send(result);
  });

  // 2. Buscar Workspace por ID (Restauração de Circuito e Código)
  app.get<{ Params: { id: string } }>('/api/workspaces/:id', async (req) => {
    return workspaceService.getById(req.params.id);
  });

  // 3. Atualizar Estado do Workspace (Snapshot de Circuito e Código)
  app.put<{ Params: { id: string }; Body: UpdateWorkspaceInput }>(
    '/api/workspaces/:id',
    async (req) => {
      return workspaceService.update(req.params.id, req.body);
    }
  );

  // 4. Adicionar Membro a Workspace em Grupo (RN-GRP-01)
  app.post<{ Params: { id: string }; Body: { userId: string } }>(
    '/api/workspaces/:id/members',
    async (req, reply) => {
      const result = await workspaceService.addMember(req.params.id, req.body.userId);
      return reply.status(201).send(result);
    }
  );

  // 5. Remover Membro do Workspace
  app.delete<{ Params: { id: string; userId: string } }>(
    '/api/workspaces/:id/members/:userId',
    async (req, reply) => {
      await workspaceService.removeMember(req.params.id, req.params.userId);
      return reply.status(204).send();
    }
  );

  // 6. Excluir Workspace Completo
  app.delete<{ Params: { id: string } }>('/api/workspaces/:id', async (req, reply) => {
    await workspaceService.delete(req.params.id);
    return reply.status(204).send();
  });

  // 7. Submeter Desafio para Avaliação Oficial (AutoGrader)
  app.post<{ Params: { id: string }; Body: Omit<SubmitChallengeInput, 'workspaceId'> }>(
    '/api/workspaces/:id/submissions',
    async (req, reply) => {
      const result = await submissionService.submit(
        { workspaceId: req.params.id, ...req.body },
        roomManager
      );
      return reply.status(201).send(result);
    }
  );

  // 8. Listar Histórico de Submissões
  app.get<{ Params: { id: string }; Querystring: { challengeId?: string } }>(
    '/api/workspaces/:id/submissions',
    async (req) => {
      return submissionService.listByWorkspace(req.params.id, req.query.challengeId);
    }
  );

  // 9. Listar Workspaces do Usuário Autenticado
  app.get('/api/workspaces/my', { preHandler: [requireAuth] }, async (req) => {
    return workspaceService.listByUser(req.user!.userId);
  });
};
