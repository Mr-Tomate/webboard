import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { ChallengeDefinition } from '@webboard/contracts';

interface CreateChallengeBody {
  id?: string;
  title: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  kitPolicy: any;
  initialCircuit?: any;
  testSuite: any[];
}

export const challengeRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (
  app,
  opts
) => {
  const prisma = opts.prisma;

  // 1. Cadastrar Desafio Pedagógico
  app.post<{ Body: CreateChallengeBody }>('/api/challenges', async (req, reply) => {
    const { id, title, description, difficulty, kitPolicy, initialCircuit, testSuite } =
      req.body;

    if (!title || !description || !difficulty) {
      return reply.status(400).send({
        error: 'Campos obrigatórios: title, description e difficulty.',
      });
    }

    const challenge = await prisma.challenge.create({
      data: {
        ...(id ? { id } : {}),
        title,
        description,
        difficulty,
        kitPolicyJson: JSON.stringify(
          kitPolicy ?? { mode: 'OPEN', allowedComponents: [] }
        ),
        initialCktJson: initialCircuit ? JSON.stringify(initialCircuit) : null,
        testSuiteJson: JSON.stringify(testSuite ?? []),
      },
    });

    const def: ChallengeDefinition = {
      schemaVersion: '1.0.0',
      challengeId: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty as any,
      allowedLanguages: ['CPP', 'PYTHON'],
      kitPolicy: JSON.parse(challenge.kitPolicyJson),
      initialCircuit: challenge.initialCktJson
        ? JSON.parse(challenge.initialCktJson)
        : { components: [], wires: [] },
      testSuite: JSON.parse(challenge.testSuiteJson),
    };

    return reply.status(201).send(def);
  });

  // 2. Buscar Desafio por ID
  app.get<{ Params: { id: string } }>('/api/challenges/:id', async (req, reply) => {
    const { id } = req.params;

    const challenge = await prisma.challenge.findUnique({
      where: { id },
    });

    if (!challenge) {
      return reply.status(404).send({ error: `Desafio \"${id}\" não encontrado.` });
    }

    const def: ChallengeDefinition = {
      schemaVersion: '1.0.0',
      challengeId: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty as any,
      allowedLanguages: ['CPP', 'PYTHON'],
      kitPolicy: JSON.parse(challenge.kitPolicyJson),
      initialCircuit: challenge.initialCktJson
        ? JSON.parse(challenge.initialCktJson)
        : { components: [], wires: [] },
      testSuite: JSON.parse(challenge.testSuiteJson),
    };

    return reply.send(def);
  });

  // 3. Listar Desafios
  app.get('/api/challenges', async () => {
    const list = await prisma.challenge.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return list.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      difficulty: c.difficulty,
      createdAt: c.createdAt,
    }));
  });
};
