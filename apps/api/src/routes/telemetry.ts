import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import type { TelemetryRoomManager } from '../telemetry/room-manager.js';
import type { ClientToServerMessage, StudentWorkspacePulse } from '../telemetry/types.js';

export interface TelemetryRoutesOptions {
  roomManager: TelemetryRoomManager;
}

export const telemetryRoutes: FastifyPluginAsync<TelemetryRoutesOptions> = async (
  fastify,
  opts
) => {
  const { roomManager } = opts;

  // -------------------------------------------------------------
  // CANAL WEBSOCKET TEMPO REAL (TELEMETRIA & COLABORAÇÃO CONCORRENTE)
  // -------------------------------------------------------------
  fastify.get<{
    Querystring: {
      role?: 'student' | 'teacher';
      classroomId?: string;
      workspaceId?: string;
      userId?: string;
      userName?: string;
    };
  }>(
    '/ws/telemetry',
    { websocket: true },
    (socket: WebSocket, req) => {
      const {
        role = 'student',
        classroomId = 'default_classroom',
        workspaceId,
        userId,
        userName,
      } = req.query;

      if (role === 'teacher') {
        roomManager.registerTeacher(socket, classroomId);
      } else {
        if (!workspaceId) {
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              message: 'workspaceId é obrigatório para conexão de bancada do estudante.',
            })
          );
          socket.close(1008, 'Missing workspaceId');
          return;
        }
        roomManager.registerStudent(socket, workspaceId, classroomId, userId, userName);
      }

      socket.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString()) as ClientToServerMessage;

          if (msg.type === 'PULSE') {
            roomManager.processPulse({
              ...msg.payload,
              classroomId: msg.payload.classroomId || classroomId,
            });
          } else if (msg.type === 'FAULT_ALERT') {
            roomManager.processFaultAlert(classroomId, {
              workspaceId: msg.payload.workspaceId,
              teamName: 'Bancada Aluno',
              faultType: msg.payload.faultType,
              message: msg.payload.message,
            });
          } else if (msg.type === 'SEND_NOTE') {
            roomManager.addPedagogicalNote(classroomId, msg.payload.workspaceId, {
              author: msg.payload.author,
              text: msg.payload.text,
              targetComponentId: msg.payload.targetComponentId,
            });
          } else if (msg.type === 'LOCK_COMPONENT') {
            // Identidade (workspace/usuário) vem do handshake, nunca do payload
            roomManager.lockComponent(socket, msg.payload?.componentId);
          } else if (msg.type === 'UNLOCK_COMPONENT') {
            roomManager.unlockComponent(socket, msg.payload?.componentId);
          } else if (msg.type === 'CURSOR_MOVE') {
            roomManager.broadcastCursor(socket, msg.payload?.position);
          } else if (msg.type === 'CIRCUIT_MUTATION') {
            roomManager.broadcastMutation(socket, msg.payload?.action, msg.payload?.data);
          }
        } catch (err: any) {
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              message: `Mensagem malformatada: ${err.message}`,
            })
          );
        }
      });

      socket.on('close', () => {
        roomManager.unregister(socket);
      });
    }
  );

  // -------------------------------------------------------------
  // ROTAS REST COMPLEMENTARES (AUDITORIA E FALLBACK)
  // -------------------------------------------------------------
  fastify.get<{ Params: { classroomId: string } }>(
    '/api/classrooms/:classroomId/telemetry',
    async (request, reply) => {
      const { classroomId } = request.params;
      const workspaces = roomManager.getClassroomWorkspaces(classroomId);
      const summary = roomManager.computeClassroomSummary(classroomId);

      return reply.send({
        classroomId,
        workspaces,
        summary,
      });
    }
  );

  fastify.post<{
    Params: { workspaceId: string };
    Body: StudentWorkspacePulse;
  }>('/api/workspaces/:workspaceId/telemetry/pulse', async (request, reply) => {
    const { workspaceId } = request.params;
    const pulse = request.body;
    pulse.workspaceId = workspaceId;

    const { updatedPulse, summary } = roomManager.processPulse(pulse);
    return reply.status(200).send({
      success: true,
      updatedPulse,
      summary,
    });
  });

  fastify.post<{
    Params: { workspaceId: string };
    Body: {
      author: string;
      text: string;
      targetComponentId?: string;
      classroomId?: string;
    };
  }>('/api/workspaces/:workspaceId/notes', async (request, reply) => {
    const { workspaceId } = request.params;
    const {
      author,
      text,
      targetComponentId,
      classroomId = 'default_classroom',
    } = request.body;

    if (!author || !text) {
      return reply.status(400).send({
        error: 'author e text são obrigatórios para registrar nota pedagógica.',
      });
    }

    const note = roomManager.addPedagogicalNote(classroomId, workspaceId, {
      author,
      text,
      targetComponentId,
    });

    if (!note) {
      return reply.status(404).send({
        error: `Workspace ${workspaceId} não encontrado na turma ${classroomId}.`,
      });
    }

    return reply.status(201).send({
      success: true,
      note,
    });
  });

  // Obter locks ativos do workspace (para sincronização inicial de interface)
  fastify.get<{ Params: { workspaceId: string } }>(
    '/api/workspaces/:workspaceId/locks',
    async (request, reply) => {
      const { workspaceId } = request.params;
      const locks = roomManager.getWorkspaceLocks(workspaceId);
      return reply.send({ workspaceId, locks });
    }
  );

  // Obter membros presentes no workspace de grupo (fallback REST da presença)
  fastify.get<{ Params: { workspaceId: string } }>(
    '/api/workspaces/:workspaceId/presence',
    async (request, reply) => {
      const { workspaceId } = request.params;
      const members = roomManager.getWorkspacePresence(workspaceId);
      return reply.send({ workspaceId, members });
    }
  );
};
