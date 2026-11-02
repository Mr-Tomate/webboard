import type { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import type {
  RegisterPayload,
  LoginPayload,
  AuthResponse,
  UserProfile,
  ClassroomSummary
} from '@webboard/contracts';
import { hashPassword, verifyPassword, signAuthToken } from '../../auth/security.js';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  NotFoundError
} from '../../core/errors.js';

interface UserDbRecord {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

function toUserProfile(user: UserDbRecord, tenantName?: string): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as any,
    tenantId: user.tenantId,
    tenantName,
    createdAt: user.createdAt.toISOString()
  };
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { name, email, password, role, institutionName, classroomCode } = payload;
    if (!name || !email || !password || !role) {
      throw new BadRequestError('Nome, email, senha e papel (role) são obrigatórios.', 'DADOS_INVALIDOS');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
    if (existingUser) {
      throw new ConflictError('Este endereço de email já possui uma conta no Webboard.', 'EMAIL_JA_CADASTRADO');
    }

    const tenantSlug = (institutionName || 'escola-padrao')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    let tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          name: institutionName || 'Escola Padrão Webboard',
          slug: tenantSlug
        }
      });
    }

    const passwordHash = await hashPassword(password);
    const userRaw = (await this.prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        tenantId: tenant.id
      } as any
    })) as unknown as UserDbRecord;

    let activeClassroom: ClassroomSummary | null = null;

    if (classroomCode) {
      const classroom = await this.prisma.classroom.findUnique({
        where: { code: classroomCode.toUpperCase().trim() }
      });

      if (classroom) {
        await this.prisma.classroomMember.create({
          data: {
            classroomId: classroom.id,
            userId: userRaw.id,
            role: role === 'TEACHER' ? 'TEACHER' : 'STUDENT'
          }
        });

        activeClassroom = {
          id: classroom.id,
          name: classroom.name,
          code: classroom.code,
          tenantId: classroom.tenantId,
          role: role === 'TEACHER' ? 'TEACHER' : 'STUDENT'
        };

        if (role === 'STUDENT') {
          const workspace = await this.prisma.workspace.create({
            data: {
              classroomId: classroom.id,
              name: `Bancada de ${userRaw.name}`,
              type: 'SOLO',
              circuitJson: '{"components":[],"wires":[]}',
              codeText: '// Digite aqui seu código Arduino C++\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n',
              language: 'CPP'
            }
          });

          await this.prisma.workspaceMember.create({
            data: {
              workspaceId: workspace.id,
              userId: userRaw.id,
              isOwner: true
            }
          });
        }
      }
    }

    const token = signAuthToken({
      userId: userRaw.id,
      role: userRaw.role as any,
      tenantId: userRaw.tenantId,
      classroomId: activeClassroom?.id
    });

    return {
      token,
      user: toUserProfile(userRaw, tenant.name),
      activeClassroom
    };
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { email, password } = payload;
    if (!email || !password) {
      throw new BadRequestError('Email e senha são obrigatórios.', 'DADOS_INVALIDOS');
    }

    const userWithRelations = (await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        tenant: true,
        classroomMembers: {
          include: { classroom: true },
          take: 1
        }
      }
    })) as (UserDbRecord & { tenant: any; classroomMembers: any[] }) | null;

    if (!userWithRelations) {
      throw new UnauthorizedError('Email ou senha incorretos.', 'CREDENCIAIS_INVALIDAS');
    }

    const isPasswordValid = await verifyPassword(password, userWithRelations.passwordHash || '');
    if (!isPasswordValid) {
      throw new UnauthorizedError('Email ou senha incorretos.', 'CREDENCIAIS_INVALIDAS');
    }

    const primaryMembership = userWithRelations.classroomMembers[0];
    const activeClassroom: ClassroomSummary | null = primaryMembership
      ? {
          id: primaryMembership.classroom.id,
          name: primaryMembership.classroom.name,
          code: primaryMembership.classroom.code,
          tenantId: primaryMembership.classroom.tenantId,
          role: primaryMembership.role as any
        }
      : null;

    const token = signAuthToken({
      userId: userWithRelations.id,
      role: userWithRelations.role as any,
      tenantId: userWithRelations.tenantId,
      classroomId: activeClassroom?.id
    });

    return {
      token,
      user: toUserProfile(userWithRelations, userWithRelations.tenant.name),
      activeClassroom
    };
  }

  async getProfile(userId: string): Promise<{
    user: UserProfile;
    classrooms: ClassroomSummary[];
    activeClassroom: ClassroomSummary | null;
  }> {
    const userWithRelations = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        classroomMembers: {
          include: { classroom: true }
        }
      }
    })) as (UserDbRecord & { tenant: any; classroomMembers: any[] }) | null;

    if (!userWithRelations) {
      throw new NotFoundError('Usuário não encontrado.', 'USUARIO_NAO_ENCONTRADO');
    }

    const classrooms: ClassroomSummary[] = userWithRelations.classroomMembers.map((m) => ({
      id: m.classroom.id,
      name: m.classroom.name,
      code: m.classroom.code,
      tenantId: m.classroom.tenantId,
      role: m.role as any
    }));

    return {
      user: toUserProfile(userWithRelations, userWithRelations.tenant.name),
      classrooms,
      activeClassroom: classrooms[0] || null
    };
  }

  async joinClassroom(
    userId: string,
    userRole: 'ADMIN' | 'TEACHER' | 'STUDENT',
    classroomCode: string
  ): Promise<{ success: boolean; classroom: ClassroomSummary }> {
    if (!classroomCode) {
      throw new BadRequestError('Código de turma é obrigatório.', 'CODIGO_OBRIGATORIO');
    }

    const classroom = await this.prisma.classroom.findUnique({
      where: { code: classroomCode.toUpperCase().trim() }
    });

    if (!classroom) {
      throw new NotFoundError('Código de turma inexistente. Verifique com seu professor.', 'TURMA_NAO_ENCONTRADA');
    }

    await this.prisma.classroomMember.upsert({
      where: {
        classroomId_userId: {
          classroomId: classroom.id,
          userId
        }
      },
      create: {
        classroomId: classroom.id,
        userId,
        role: userRole === 'TEACHER' ? 'TEACHER' : 'STUDENT'
      },
      update: {}
    });

    const existingWs = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: { classroomId: classroom.id }
      }
    });

    if (!existingWs) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const ws = await this.prisma.workspace.create({
        data: {
          classroomId: classroom.id,
          name: `Bancada de ${user?.name || 'Aluno'}`,
          type: 'SOLO',
          circuitJson: '{"components":[],"wires":[]}',
          codeText: '// Código Arduino C++\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n',
          language: 'CPP'
        }
      });

      await this.prisma.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId,
          isOwner: true
        }
      });
    }

    return {
      success: true,
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
        tenantId: classroom.tenantId,
        role: userRole === 'TEACHER' ? 'TEACHER' : 'STUDENT'
      }
    };
  }

  async createClassroom(
    userId: string,
    tenantId: string,
    name: string
  ): Promise<{ classroom: ClassroomSummary }> {
    if (!name) {
      throw new BadRequestError('Nome da turma é obrigatório.', 'NOME_OBRIGATORIO');
    }

    const code = `ROB-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const classroom = await this.prisma.classroom.create({
      data: {
        tenantId,
        name,
        code
      }
    });

    await this.prisma.classroomMember.create({
      data: {
        classroomId: classroom.id,
        userId,
        role: 'TEACHER'
      }
    });

    return {
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
        tenantId: classroom.tenantId,
        role: 'TEACHER'
      }
    };
  }
}
