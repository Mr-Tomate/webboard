import type { PrismaClient } from '@prisma/client';
import type { CircuitDefinition } from '@webboard/contracts';
import { BadRequestError, NotFoundError, ConflictError } from '../../core/errors.js';

export interface CreateWorkspaceInput {
  name: string;
  type: 'SOLO' | 'GROUP';
  ownerId: string;
  classroomId?: string;
  circuit?: CircuitDefinition;
  codeText?: string;
  language?: 'CPP' | 'PYTHON';
}

export interface UpdateWorkspaceInput {
  name?: string;
  circuit?: CircuitDefinition;
  codeText?: string;
  language?: 'CPP' | 'PYTHON';
}

export class WorkspaceService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateWorkspaceInput) {
    const { name, type, ownerId, classroomId, circuit, codeText, language = 'CPP' } = input;

    if (!name || !type || !ownerId) {
      throw new BadRequestError('Campos obrigatórios ausentes: name, type ou ownerId.');
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

    const workspace = await this.prisma.workspace.create({
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
        isOwner: m.isOwner,
      })),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async getById(id: string) {
    const workspace = await this.prisma.workspace.findUnique({
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
      throw new NotFoundError('Workspace não encontrado.');
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
        isOwner: m.isOwner,
      })),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async update(id: string, input: UpdateWorkspaceInput) {
    const { name, circuit, codeText, language } = input;

    const existing = await this.prisma.workspace.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Workspace não encontrado.');
    }

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(circuit && { circuitJson: JSON.stringify(circuit) }),
        ...(codeText !== undefined && { codeText }),
        ...(language && { language }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      classroomId: updated.classroomId,
      language: updated.language,
      codeText: updated.codeText,
      circuit: JSON.parse(updated.circuitJson),
      updatedAt: updated.updatedAt,
    };
  }

  async addMember(workspaceId: string, userId: string) {
    if (!userId) {
      throw new BadRequestError('userId é obrigatório.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace não encontrado.');
    }

    const alreadyMember = workspace.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      throw new ConflictError('Usuário já é membro deste workspace.');
    }

    if (workspace.type === 'SOLO') {
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { type: 'GROUP' },
      });
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        isOwner: false,
      },
      include: { user: true },
    });

    return {
      workspaceId: member.workspaceId,
      userId: member.userId,
      name: member.user.name,
      isOwner: member.isOwner,
      joinedAt: member.joinedAt,
    };
  }

  async removeMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Membro não encontrado no workspace.');
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.workspace.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Workspace não encontrado.');
    }

    await this.prisma.workspaceMember.deleteMany({ where: { workspaceId: id } });
    await this.prisma.submission.deleteMany({ where: { workspaceId: id } });
    await this.prisma.workspace.delete({ where: { id } });
  }

  async listByUser(userId: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        classroom: true,
        members: { include: { user: true } },
      },
    });

    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      type: ws.type,
      language: ws.language,
      classroomId: ws.classroomId,
      classroomName: ws.classroom?.name,
      updatedAt: ws.updatedAt.toISOString(),
      memberCount: ws.members.length,
    }));
  }
}
