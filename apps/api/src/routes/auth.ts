import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type {
  RegisterPayload,
  LoginPayload,
  JoinClassroomPayload,
  CreateClassroomPayload
} from '@webboard/contracts';
import { AuthService } from '../modules/auth/auth.service.js';
import { requireAuth, requireRole } from '../core/guards.js';
import { HttpError } from '../core/errors.js';

interface AuthRouteOptions {
  prisma: PrismaClient;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (fastify, options) => {
  const authService = new AuthService(options.prisma);

  // Tratamento declarativo de erros de domínio HttpError
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message
      });
    }
    return reply.send(error);
  });

  // 1. Registro de Conta (Aluno, Professor ou Instituição)
  fastify.post<{ Body: RegisterPayload }>('/api/auth/register', async (req, reply) => {
    const result = await authService.register(req.body);
    return reply.status(201).send(result);
  });

  // 2. Login com Email e Senha
  fastify.post<{ Body: LoginPayload }>('/api/auth/login', async (req, reply) => {
    const result = await authService.login(req.body);
    return reply.send(result);
  });

  // 3. Identidade do Usuário Logado (Perfil e Turmas)
  fastify.get('/api/auth/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const result = await authService.getProfile(req.user!.userId);
    return reply.send(result);
  });

  // 4. Ingressar em Turma via Código Convite
  fastify.post<{ Body: JoinClassroomPayload }>(
    '/api/auth/join-classroom',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const result = await authService.joinClassroom(
        req.user!.userId,
        req.user!.role,
        req.body?.classroomCode
      );
      return reply.send(result);
    }
  );

  // 5. Criar Nova Turma (Restrito a Professores ou Administradores via Guard RBAC)
  fastify.post<{ Body: CreateClassroomPayload }>(
    '/api/classrooms',
    { preHandler: [requireRole(['TEACHER', 'ADMIN'])] },
    async (req, reply) => {
      const result = await authService.createClassroom(
        req.user!.userId,
        req.user!.tenantId,
        req.body?.name
      );
      return reply.status(201).send(result);
    }
  );
};
