import type { PrismaClient } from '@prisma/client';
import type {
  CircuitDefinition,
  SubmissionSnapshot,
  EvaluationResult,
  ChallengeDefinition,
} from '@webboard/contracts';
import { AutoGrader } from '@webboard/core';
import type { TelemetryRoomManager } from '../../telemetry/room-manager.js';
import { BadRequestError, NotFoundError } from '../../core/errors.js';

export interface SubmitChallengeInput {
  workspaceId: string;
  challengeId: string;
  userId: string;
  circuit: CircuitDefinition;
  codeText: string;
  language?: 'CPP' | 'PYTHON';
  status?: string;
  evaluation?: EvaluationResult;
}

export class SubmissionService {
  constructor(private readonly prisma: PrismaClient) {}

  async submit(
    input: SubmitChallengeInput,
    roomManager?: TelemetryRoomManager
  ): Promise<SubmissionSnapshot> {
    const {
      workspaceId,
      challengeId,
      userId,
      circuit,
      codeText,
      language = 'CPP',
      status,
      evaluation,
    } = input;

    if (!challengeId || !userId || !circuit || codeText === undefined) {
      throw new BadRequestError(
        'Campos obrigatórios ausentes: challengeId, userId, circuit ou codeText.'
      );
    }

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      throw new NotFoundError('Workspace não encontrado.');
    }

    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) {
      throw new NotFoundError('Desafio não encontrado.');
    }

    let finalEvaluation: EvaluationResult;
    let finalStatus: string;

    if (evaluation) {
      finalEvaluation = evaluation;
      finalStatus = status ?? evaluation.status;
    } else {
      const challengeDef: ChallengeDefinition = {
        schemaVersion: '1.0.0',
        challengeId: challenge.id,
        title: challenge.title,
        description: challenge.description,
        difficulty: challenge.difficulty as any,
        allowedLanguages: ['CPP', 'PYTHON'],
        kitPolicy: JSON.parse(challenge.kitPolicyJson),
        initialCircuit: challenge.initialCktJson
          ? JSON.parse(challenge.initialCktJson)
          : { components: [], wires: [] },
        testSuite: JSON.parse(challenge.testSuiteJson),
      };

      finalEvaluation = AutoGrader.evaluate(challengeDef, {
        circuit,
        code: {
          language: language as any,
          sourceText: codeText,
        },
      });
      finalStatus = finalEvaluation.status;
    }

    const lastSubmission = await this.prisma.submission.findFirst({
      where: { workspaceId, challengeId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (lastSubmission?.versionNumber ?? 0) + 1;

    const submission = await this.prisma.submission.create({
      data: {
        workspaceId,
        challengeId,
        userId,
        versionNumber: nextVersion,
        status: finalStatus,
        circuitJson: JSON.stringify(circuit),
        codeText,
        evaluationJson: JSON.stringify(finalEvaluation),
      },
      include: {
        user: true,
      },
    });

    const allMembers = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
    });
    const collaboratorUserIds = allMembers
      .map((m) => m.userId)
      .filter((uid) => uid !== userId);

    // Emissão de telemetria isolada e garantida
    if (roomManager && workspace) {
      const teamName = workspace.name;
      const students = allMembers.map((m) => m.user?.name || m.userId);

      roomManager.processPulse({
        workspaceId,
        classroomId: workspace.classroomId ?? 'default_classroom',
        teamName,
        students: students.length > 0 ? students : [submission.user?.name || userId],
        status:
          finalStatus === 'APPROVED'
            ? 'NORMAL'
            : finalStatus === 'REJECTED_CIRCUIT'
            ? 'FALHA_CRÍTICA'
            : 'DIFICULDADE',
        lastActivitySecondsAgo: 0,
        currentChallengeTitle: challenge.title || 'Desafio Webboard',
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

    return {
      schemaVersion: '1.0.0',
      submissionId: submission.id,
      workspaceId: submission.workspaceId,
      challengeId: submission.challengeId,
      versionNumber: submission.versionNumber,
      submittedAt: submission.submittedAt.toISOString(),
      submittedBy: {
        userId: submission.user.id,
        collaboratorUserIds,
      },
      payload: {
        code: {
          language: language as any,
          sourceText: codeText,
        },
        circuit: {
          components: circuit.components,
          wires: circuit.wires,
        },
      },
      evaluation: finalEvaluation,
    };
  }

  async listByWorkspace(workspaceId: string, challengeId?: string) {
    const where: any = { workspaceId };
    if (challengeId) where.challengeId = challengeId;

    const submissions = await this.prisma.submission.findMany({
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
}
