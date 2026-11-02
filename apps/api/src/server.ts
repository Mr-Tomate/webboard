import 'dotenv/config';
import { prisma } from './db.js';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = await buildApp(prisma);

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Webboard API rodando em ${address}`);
  } catch (err) {
    console.error('Erro ao inicializar servidor API:', err);
    process.exit(1);
  }
}

main();
