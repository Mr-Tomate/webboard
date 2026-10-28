# AGENTS.md — Diretrizes para Agentes de IA no Webboard

Bem-vindo ao repositório do **Webboard**, uma plataforma educacional de robótica e simulação de circuitos microcontrolados.

Este documento é a sua porta de entrada obrigatória para operar neste repositório com autonomia, segurança e alinhamento com outros agentes.

---

## 1. Onde Encontrar a Documentação Oficial

Toda a arquitetura, regras de negócio e especificações de engenharia estão formalizadas em [`docs/spec/`](docs/spec/README.md):

* [`docs/spec/README.md`](docs/spec/README.md): **Índice Mestre de toda a especificação.**
* [`docs/spec/00_visao_geral_e_fronteiras.md`](docs/spec/00_visao_geral_e_fronteiras.md): O que o sistema faz e o que NÃO faz (limites estritos).
* [`docs/spec/01_bancada_e_simulacao.md`](docs/spec/01_bancada_e_simulacao.md): Máquina de estados (Edição vs Simulação) e modelo elétrico.
* [`docs/spec/02_execucao_e_compilacao.md`](docs/spec/02_execucao_e_compilacao.md): Duplo paradigma: C/C++ nativo e Python via PyFirmata.
* [`docs/spec/03_avaliacao_e_autograding.md`](docs/spec/03_avaliacao_e_autograding.md): Motor de auto-grading e testes de hardware.
* [`docs/spec/04_pedagogico_e_workspaces.md`](docs/spec/04_pedagogico_e_workspaces.md): Multi-tenancy escolar, Workspaces Solo/Grupo e telemetria docente.
* [`docs/spec/05_schemas_de_dados.md`](docs/spec/05_schemas_de_dados.md): Contratos JSON (Circuito, Desafio e Submissão).
* [`docs/spec/06_exportacao_e_compatibilidade_real.md`](docs/spec/06_exportacao_e_compatibilidade_real.md): Exportação para PlatformIO, Arduino IDE e `WIRING.md`.
* [`docs/spec/07_especificacao_componentes_e_testes_base.md`](docs/spec/07_especificacao_componentes_e_testes_base.md): Modelos físicos dos componentes e suite de testes do motor.
* [`docs/spec/08_extensibilidade_e_pacotes_de_componentes.md`](docs/spec/08_extensibilidade_e_pacotes_de_componentes.md): Arquitetura de Component Bundle (`manifest.json` + `logic.ts` + `assets/`).
* [`docs/spec/09_arquitetura_de_software_e_infraestrutura.md`](docs/spec/09_arquitetura_de_software_e_infraestrutura.md): Stack oficial, Monorepo e Circuit Solver.
* [`docs/spec/10_protocolo_colaboracao_agentes_ai_memory.md`](docs/spec/10_protocolo_colaboracao_agentes_ai_memory.md): **Protocolo de Comunicação entre Agentes via ai-memory.**
* [`docs/spec/11_plano_de_execucao_tijolo_a_tijolo.md`](docs/spec/11_plano_de_execucao_tijolo_a_tijolo.md): **Plano de Execução Incremental (Roadmap Tijolo a Tijolo).**

---

## 2. Estrutura do Monorepo

O projeto adota TypeScript Full-Stack com Monorepo Workspaces (`npm` / `node 26+`):

```text
webboard/
├── apps/
│   ├── api/                    <-- Backend Fastify + Prisma ORM (SQLite em dev, Postgres em prod)
│   ├── web/                    <-- Frontend SPA (React + Vite + Konva.js + Monaco Editor)
│   └── compiler-worker/        <-- Microserviço de compilação arduino-cli
│
├── packages/
│   ├── contracts/              <-- Tipos TypeScript universais e DTOs (Tijolo 1)
│   ├── core/                   <-- Motor Isomórfico de Simulação e Circuit Solver (Tijolo 2)
│   ├── components/             <-- Bundles de componentes físicos (Tijolo 3)
│   └── exporter/               <-- Gerador de pacotes .zip para hardware real
│
├── docs/spec/                  <-- Documentação de Especificação Oficial
├── .ai-memory.toml             <-- Configuração de escopo do ai-memory (workspace = "default", project = "webboard")
└── package.json                <-- Workspaces da raiz
```

---

## 3. Protocolo de Comunicação via `ai-memory` (Obrigatório)

O servidor MCP **`ai-memory`** é o hub de comunicação e alinhamento entre agentes:

1. **Antes de Iniciar Qualquer Tarefa:**
   * Leia a sua página de trabalho (`memory_read_page` com `path: "workstreams/backend.md"` ou `path: "workstreams/frontend.md"`).
   * Leia o diário do agente parceiro para saber o que ele acabou de entregar ou o que ele precisa de você.
2. **Propostas e Alinhamento Técnico:**
   * Se precisar propor um endpoint, evento de WebSocket ou mudança de comportamento, crie uma thread em `discussions/{topico}.md`.
   * **Nunca altere tipos em `@webboard/contracts` de forma unilateral.**
3. **Ao Concluir um Tijolo:**
   * Rode os testes do pacote (`npm test` ou `npx tsc`).
   * Atualize seu `workstreams/{papel}.md` registrando arquivos entregues, testes que passaram e a próxima meta.

---

## 4. Filosofia de Desenvolvimento: Tijolo a Tijolo

* Não crie peças grandes sem testar as fundações.
* Siga rigorosamente a ordem do [`docs/spec/11_plano_de_execucao_tijolo_a_tijolo.md`](docs/spec/11_plano_de_execucao_tijolo_a_tijolo.md).
* Todo código novo deve possuir testes automatizados e compilar com zero erros de TypeScript.
