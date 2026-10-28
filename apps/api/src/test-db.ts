import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando teste de conectividade com Prisma (SQLite)...");

  const runId = Date.now().toString(36);

  // 1. Criar um Tenant (Escola) com slug dinâmico
  const tenant = await prisma.tenant.create({
    data: {
      name: `Colégio Tecnológico ${runId}`,
      slug: `colegio-${runId}`,
    },
  });
  console.log("Tenant criado com sucesso:", tenant.id, tenant.name);

  // 2. Criar um Usuário Aluno
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: `Aluno Teste ${runId}`,
      email: `aluno_${runId}@exemplo.com`,
      role: "STUDENT",
    },
  });
  console.log("Usuário criado com sucesso:", user.id, user.name);

  // 3. Criar um Workspace Solo com Circuito inicial vazio
  const workspace = await prisma.workspace.create({
    data: {
      name: "Bancada do Aluno",
      type: "SOLO",
      language: "CPP",
      circuitJson: JSON.stringify({ components: [], wires: [] }),
      codeText: "void setup() {}\nvoid loop() {}",
      members: {
        create: {
          userId: user.id,
          isOwner: true,
        },
      },
    },
    include: {
      members: true,
    },
  });
  console.log("Workspace criado com sucesso:", workspace.id, "Membros:", workspace.members.length);

  // 4. Consultar o banco para validar integridade
  const count = await prisma.workspace.count();
  console.log("Total de workspaces no banco SQLite:", count);

  console.log("TESTE DE BANCO E PRISMA CONCLUÍDO COM SUCESSO!");
}

main()
  .catch((e) => {
    console.error("Erro no teste do banco:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
