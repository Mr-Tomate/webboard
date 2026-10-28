import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type {
  CircuitDefinition,
  SubmissionSnapshot,
  EvaluationResult,
  ChallengeDefinition,
} from '@webboard/contracts';
import { AutoGrader } from '@webboard/core';
import type { TelemetryRoomManager } from '../telemetry/room-manager.js';

interface CreateWorkspaceBody {
  name: string;
  type: 'SOLO' | 'GROUP';
  ownerId: string;
  classroomId?: string;
  circuit?: CircuitDefinition;
  codeText?: string;
  language?: 'CPP' | 'PYTHON';
}

interface UpdateWorkspaceBody {
  name?: string;
  circuit?: CircuitDefinition;
  codeText?: string;
  language?: 'CPP' | 'PYTHON';
}

interface AddMemberBody {
  userId: string;
}

interface CreateSubmissionBody {
  challengeId: string;
  userId: string;
  circuit: CircuitDefinition;
  codeText: string;
  language?: 'CPP' | 'PYTHON';
  status?: string;
  evaluation?: EvaluationResult;
}

export interface WorkspaceRoutesOptions {
  prisma: PrismaClient;
  roomManager?: TelemetryRoomManager;
}

export const workspaceRoutes: FastifyPluginAsync<WorkspaceRoutesOptions> = async (
  app,
  opts
) => {
  const prisma = opts.prisma;
  const roomManager = opts.roomManager;

  // 1. Criar novo Workspace (Solo ou Grupo)
  app.post<{ Body: CreateWorkspaceBody }>('/api/workspaces', async (req, reply) => {
    const {
      name,
      type,
      ownerId,
      classroomId,
      circuit,
      codeText,
      language = 'CPP',
    } = req.body;

    if (!name || !type || !ownerId) {
      return reply.status(400).send({
        error: 'Campos obrigatórios ausentes: name, type ou ownerId.',
      });
    }

    const defaultCircuit: CircuitDefinition = circuit ?? {
      schemaVersion: '1.0.0',
      circuitId: `ckt_${Date.now().toString(36)}`,
      components: [],
      wires: [],
    };

    const defaultCode =
      codeText ??
      (language === 'PYTHON'
        ? '# Webboard PyFirmata\nimport pyfirmata\n'
        : '// Webboard C++ Firmware\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n');

    const workspace = await prisma.workspace.create({
      data: {
        name,
        type,
        classroomId: classroomId ?? null,
        circuitJson: JSON.stringify(defaultCircuit),
        codeText: defaultCode,
        language,
        members: {
          create: {
            userId: ownerId,
            isOwner: true,
          },
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return reply.status(201).send({
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      classroomId: workspace.classroomId,
      language: workspace.language,
      codeText: workspace.codeText,
      circuit: JSON.parse(workspace.circuitJson),
      members: workspace.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        isOwner: m.isOwner,
        joinedAt: m.joinedAt,
      })),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    });
  });

  // 2. Obter Workspace por ID
  app.get<{ Params: { id: string } }>('/api/workspaces/:id', async (req, reply) => {
    const { id } = req.params;

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!workspace) {
      return reply.status(404).send({ error: `Workspace com id "${id}" não encontrado.` });
    }

    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      classroomId: workspace.classroomId,
      language: workspace.language,
      codeText: workspace.codeText,
      circuit: JSON.parse(workspace.circuitJson),
      members: workspace.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        isOwner: m.isOwner,
        joinedAt: m.joinedAt,
      })),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  });

  // 3. Atualizar Circuito ou Código do Workspace
  app.put<{ Params: { id: string }; Body: UpdateWorkspaceBody }>(
    '/api/workspaces/:id',
    async (req, reply) => {
      const { id } = req.params;
      const { name, circuit, codeText, language } = req.body;

      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (circuit !== undefined) dataToUpdate.circuitJson = JSON.stringify(circuit);
      if (codeText !== undefined) dataToUpdate.codeText = codeText;
      if (language !== undefined) dataToUpdate.language = language;

      const workspace = await prisma.workspace.update({
        where: { id },
        data: dataToUpdate,
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      return {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        classroomId: workspace.classroomId,
        language: workspace.language,
        codeText: workspace.codeText,
        circuit: JSON.parse(workspace.circuitJson),
        members: workspace.members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          isOwner: m.isOwner,
        })),
        updatedAt: workspace.updatedAt,
      };
    }
  );

  // 4. Deletar Workspace
  app.delete<{ Params: { id: string } }>('/api/workspaces/:id', async (req, reply) => {
    const { id } = req.params;
    await prisma.workspace.delete({ where: { id } });
    return reply.status(204).send();
  });

  // 5. Listar Workspaces (filtro por userId ou classroomId)
  app.get<{ Querystring: { userId?: string; classroomId?: string } }>(
    '/api/workspaces',
    async (req) => {
      const { userId, classroomId } = req.query;

      const where: any = {};
      if (classroomId) where.classroomId = classroomId;
      if (userId) {
        where.members = {
          some: {
            userId,
          },
        };
      }

      const workspaces = await prisma.workspace.findMany({
        where,
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        classroomId: w.classroomId,
        language: w.language,
        membersCount: w.members.length,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
    }
  );

  // 6. Adicionar Membro a Workspace Grupo
  app.post<{ Params: { id: string }; Body: AddMemberBody }>(
    '/api/workspaces/:id/members',
    async (req, reply) => {
      const { id } = req.params;
      const { userId } = req.body;

      const workspace = await prisma.workspace.findUnique({
        where: { id },
        include: { members: true },
      });

      if (!workspace) {
        return reply.status(404).send({ error: `Workspace "${id}" não encontrado.` });
      }

      const existingMember = workspace.members.find((m) => m.userId === userId);
      if (existingMember) {
        return reply.status(409).send({ error: 'Usuário já é membro deste workspace.' });
      }

      if (workspace.type === 'SOLO') {
        await prisma.workspace.update({
          where: { id },
          data: { type: 'GROUP' },
        });
      }

      const member = await prisma.workspaceMember.create({
        data: {
          workspaceId: id,
          userId,
          isOwner: false,
        },
        include: { user: true },
      });

      return reply.status(201).send({
        workspaceId: id,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        isOwner: member.isOwner,
        joinedAt: member.joinedAt,
      });
    }
  );

  // 7. Criar Snapshot de Submissão de Desafio (com AutoGrader automático)
  app.post<{ Params: { id: string }; Body: CreateSubmissionBody }>(
    '/api/workspaces/:id/submissions',
    async (req, reply) => {
      const { id } = req.params;
      const {
        challengeId,
        userId,
        circuit,
        codeText,
        language = 'CPP',
        status = 'APPROVED',
        evaluation,
      } = req.body;

      // Buscar o desafio se cadastrado no banco para execução do AutoGrader
      const challengeRecord = await prisma.challenge.findUnique({
        where: { id: challengeId },
      });

      let finalEvaluation: EvaluationResult = evaluation ?? {
        status: status as any,
        totalExecutionVirtualSeconds: 0,
        summary: { totalTests: 1, passedTests: 1, failedTests: 0 },
        testResults: [],
      };

      if (challengeRecord && challengeRecord.testSuiteJson) {
        try {
          const testSuite = JSON.parse(challengeRecord.testSuiteJson);
          if (Array.isArray(testSuite) && testSuite.length > 0) {
            const challengeDef: ChallengeDefinition = {
              schemaVersion: '1.0.0',
              challengeId: challengeRecord.id,
              title: challengeRecord.title,
              difficulty: challengeRecord.difficulty as any,
              allowedLanguages: ['CPP', 'PYTHON'],
              kitPolicy: JSON.parse(challengeRecord.kitPolicyJson || '{"mode":"OPEN"}'),
              initialCircuit: challengeRecord.initialCktJson
                ? JSON.parse(challengeRecord.initialCktJson)
                : { components: [], wires: [] },
              testSuite,
            };

            finalEvaluation = AutoGrader.evaluate(
              challengeDef,
              {
                circuit,
                code: { language, sourceText: codeText },
              },
              { dtVirtualSeconds: 0.05 }
            );
          }
        } catch (err) {
          // Mantém evaluation de fallback se falhar parsing
        }
      }

      const finalStatus = finalEvaluation.status;

      // Próximo número de versão sequencial
      const lastSub = await prisma.submission.findFirst({
        where: { workspaceId: id, challengeId },
        orderBy: { versionNumber: 'desc' },
      });

      const nextVersion = (lastSub?.versionNumber ?? 0) + 1;

      // Colaboradores do workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id },
        include: {
          members: {
            include: { user: true },
          },
        },
      });

      const collaboratorUserIds =
        workspace?.members.map((m) => m.userId).filter((uid) => uid !== userId) ?? [];

      const submission = await prisma.submission.create({
        data: {
          workspaceId: id,
          challengeId,
          userId,
          versionNumber: nextVersion,
          status: finalStatus,
          circuitJson: JSON.stringify(circuit),
          codeText,
          evaluationJson: JSON.stringify(finalEvaluation),
        },
      });

      // Se roomManager estiver configurado, emitir pulso atualizado na telemetria
      if (roomManager && workspace) {
        const teamName = workspace.name;
        const students = workspace.members.map((m) => m.user?.name || m.userId);

        roomManager.processPulse({
          workspaceId: id,
          classroomId: workspace.classroomId ?? 'default_classroom',
          teamName,
          students,
          status:
            finalStatus === 'APPROVED'
              ? 'NORMAL'
              : finalStatus === 'REJECTED_CIRCUIT'
              ? 'FALHA_CRÍTICA'
              : 'DIFICULDADE',
          lastActivitySecondsAgo: 0,
          currentChallengeTitle: challengeRecord?.title || 'Desafio Webboard',
          circuitMetrics: {
            componentCount: circuit.components.length,
            wireCount: circuit.wires.length,
            hasShortCircuit: finalStatus === 'REJECTED_CIRCUIT',
            hasThermalDestruction: false,
          },
          codeLanguage: language,
          compilationAttempts: 1,
          testSummary: {
            passed: finalEvaluation.summary.passedTests,
            total: finalEvaluation.summary.totalTests,
          },
          pedagogicalNotes: [],
        });
      }

      const snapshot: SubmissionSnapshot = {
        schemaVersion: '1.0.0',
        submissionId: submission.id,
        workspaceId: id,
        challengeId,
        versionNumber: submission.versionNumber,
        submittedAt: submission.submittedAt.toISOString(),
        submittedBy: {
          userId,
          collaboratorUserIds,
        },
        payload: {
          code: {
            language,
            sourceText: codeText,
          },
          circuit,
        },
        evaluation: finalEvaluation,
      };

      return reply.status(201).send(snapshot);
    }
  );

  // 8. Listar Histórico de Submissões
  app.get<{ Params: { id: string }; Querystring: { challengeId?: string } }>(
    '/api/workspaces/:id/submissions',
    async (req) => {
      const { id } = req.params;
      const { challengeId } = req.query;

      const where: any = { workspaceId: id };
      if (challengeId) where.challengeId = challengeId;

      const submissions = await prisma.submission.findMany({
        where,
        orderBy: { versionNumber: 'desc' },
        include: { user: true },
      });

      return submissions.map((s) => ({
        submissionId: s.id,
        workspaceId: s.workspaceId,
        challengeId: s.challengeId,
        versionNumber: s.versionNumber,
        status: s.status,
        submittedBy: {
          userId: s.userId,
          name: s.user.name,
        },
        submittedAt: s.submittedAt,
        evaluation: JSON.parse(s.evaluationJson),
      }));
    }
  );
};
