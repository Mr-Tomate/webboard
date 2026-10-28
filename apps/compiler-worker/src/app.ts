import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ArduinoCompiler, type CompileRequest } from './compiler.js';

export async function buildCompilerApp(compiler?: ArduinoCompiler): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const comp = compiler ?? new ArduinoCompiler();

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  app.get('/health', async () => {
    const hasCli = await comp.hasArduinoCli();
    return {
      status: 'ok',
      service: 'webboard-compiler-worker',
      hasArduinoCli: hasCli,
      supportedTargets: ['arduino:avr:uno'],
      timestamp: new Date().toISOString(),
    };
  });

  app.post<{ Body: CompileRequest }>('/compile', async (req, reply) => {
    const { sourceCode, fqbn } = req.body ?? {};

    if (!sourceCode) {
      return reply.status(400).send({
        success: false,
        error: 'ERRO_COMPILACAO',
        message: 'Campo "sourceCode" obrigatório não fornecido.',
        stderr: 'error: no source code provided.',
      });
    }

    const result = await comp.compile({ sourceCode, fqbn });

    if (!result.success) {
      return reply.status(422).send(result);
    }

    return reply.status(200).send(result);
  });

  return app;
}
