import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAuthToken, type TokenPayload } from '../auth/security.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

/**
 * Guard Fastify que exige um token JWT Bearer válido.
 * Anexa o payload decodificado em `request.user`.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'NAO_AUTORIZADO', message: 'Token ausente.' });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    reply.status(401).send({ error: 'TOKEN_INVALIDO', message: 'Sessão inválida ou expirada.' });
    return;
  }

  req.user = decoded;
}

/**
 * Guard Fastify de RBAC hierárquico.
 * Valida se o usuário autenticado possui ao menos um dos papéis informados.
 */
export function requireRole(allowedRoles: ('ADMIN' | 'TEACHER' | 'STUDENT')[]) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user) {
      await requireAuth(req, reply);
      if (reply.sent) return;
    }

    if (!req.user || !allowedRoles.includes(req.user.role)) {
      reply.status(403).send({
        error: 'ACESSO_NEGADO',
        message: 'Você não tem permissão para realizar esta operação.'
      });
      return;
    }
  };
}
