# 09 - Arquitetura de Software, Stack Tecnológica e Infraestrutura

## 1. Responsabilidade
Definir a pilha tecnológica oficial, a organização dos módulos em Monorepo, o modelo de banco de dados e a infraestrutura de computação do sistema.

---

## 2. A Stack Tecnológica Oficial

Adota-se uma arquitetura **TypeScript Full-Stack Monorepo**, permitindo o compartilhamento integral de tipos, contratos JSON e da lógica de simulação física entre o navegador do usuário e o servidor de auto-avaliação.

### 2.1. Frontend (Navegador do Aluno e do Professor)
* **Framework:** React + Vite (SPA de alta performance).
* **Renderização de Bancada:** Konva.js (`react-konva`) para desenho 2D acelerado por hardware dos componentes, conexões elétricas e movimentação fluida de fios.
* **Editor de Código:** Monaco Editor (engine oficial do VS Code para web) com suporte a C++ e Python.
* **Emulador de Microcontrolador:** `@wokwi/avr8js` (WebAssembly/TypeScript) executando o binário a 16MHz no cliente.
* **Ambiente Python:** Pyodide (Python 3 em WebAssembly) conectado à serial virtual do emulador AVR.
* **Comunicação Realtime:** WebSockets para telemetria panóptica da sala e colaboração em workspaces de grupo.

### 2.2. Backend & Serviços em Nuvem
* **API Gateway & Lógica de Negócio:** Node.js com Fastify em TypeScript (alta performance e baixa latência de I/O).
* **Camada de Dados & ORM:** Prisma ORM com PostgreSQL (para produção multi-tenant) e SQLite3 (para ambiente de desenvolvimento e testes locais).
* **Microserviço de Compilação (Build Farm):** Worker isolado executando `arduino-cli` com `ccache` local para compilação C++ em frações de segundo.
* **Storage de Snapshots:** Buckets compatíveis com S3 (Cloudflare R2 / MinIO) para armazenamento de dumps de circuitos e pacotes exportados em `.zip`.

---

## 3. O Circuit Solver e a Engenharia da Física

O Core de Simulação opera de forma desacoplada da CPU do microcontrolador:

1. **Divisão de Responsabilidades:**
   * O emulador de chip (AVR8js) executa unicamente as instruções assembly da CPU e atualiza o estado de seus pinos (PORTs/PINs).
   * O **Circuit Solver (Core do Webboard)** é o responsável por orquestrar o grafo elétrico, calcular as Nets equipotenciais, aplicar a Lei de Ohm nos galhos resistivos e determinar correntes, quedas de tensão e acionamento de periféricos.
2. **Suporte Nativo a Fontes Externas e Múltiplas Tensões:**
   * Fontes de energia (baterias de 9V, pilhas, fontes de alimentação de bancada) são modeladas como componentes geradores de nós de tensão independente.
   * O sistema suporta terra comum e protege pinos contra sobretensão quando submetidos a tensões acima do limite nominal (ex: 9V injetado em GPIO de 5V dispara erro elétrico objetivo).

---

## 4. Estrutura do Monorepo

```text
webboard/
├── apps/
│   ├── web/                    (SPA Frontend: React + Konva + Monaco)
│   ├── api/                    (API Backend: Fastify + Prisma ORM)
│   └── compiler-worker/        (Serviço de compilação arduino-cli)
│
├── packages/
│   ├── core/                   (Motor Isomórfico de Simulação e Circuit Solver)
│   ├── components/             (Catálogo de Component Bundles: manifest + logic + assets)
│   ├── contracts/              (Schemas JSON e tipos TypeScript compartilhados)
│   └── exporter/               (Gerador de pacotes reais PlatformIO/Arduino IDE/Python)
│
├── docs/spec/                  (Especificação conceitual e regras de negócio)
├── package.json
└── tsconfig.base.json
```
