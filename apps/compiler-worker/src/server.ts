import { buildCompilerApp } from './app.js';

const PORT = Number(process.env.PORT) || 3002;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = await buildCompilerApp();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`⚡ Compiler Worker rodando em ${address}`);
  } catch (err) {
    console.error('Erro ao inicializar Compiler Worker:', err);
    process.exit(1);
  }
}

main();
