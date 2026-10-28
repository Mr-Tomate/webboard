# 11 - Plano de Execução Incremental (Tijolo a Tijolo)

## 1. Princípio da Construção Incremental
Cada tijolo (brick) é uma unidade de trabalho estritamente delimitada, acompanhada de seus próprios testes unitários ou de integração. **Nenhum tijolo subsequente pode ser iniciado sem que o anterior esteja com testes passando e com status registrado no ai-memory.**

---

## 2. Mapa Geral de Tijolos e Dependências

```
[FASE 1: FUNDAÇÃO COMPARTILHADA]
 └── Tijolo 1: @webboard/contracts (Tipos TypeScript e Schemas de Dados)
       │
       ▼
[FASE 2: O MOTOR FÍSICO DO CORE]
 ├── Tijolo 2.1: Netlist Solver (Cálculo de Nós e Detecção de Curto)
 ├── Tijolo 2.2: Circuit Solver (Lei de Ohm e Destruição Térmica)
 └── Tijolo 2.3: Máquina de Estados da Bancada (Edição vs Simulação)
       │
       ▼
[FASE 3: BUNDLES DE COMPONENTES]
 └── Tijolo 3.1: Componentes Básicos (LED, Resistor, Botão, Buzzer, Ultrassom)
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
[FASE 4A: TRILHA BACKEND]               [FASE 4B: TRILHA FRONTEND]
 ├── Tijolo 4.1: API REST Workspaces     ├── Tijolo 5.1: Canvas Konva 2D
 ├── Tijolo 4.2: Compiler Worker CLI     ├── Tijolo 5.2: Fiação Interativa
 ├── Tijolo 4.3: Headless Auto-Grader    ├── Tijolo 5.3: Monaco Editor & Console
 └── Tijolo 4.4: WebSocket Telemetria    ├── Tijolo 5.4: Integração AVR8js
                                         └── Tijolo 5.5: Dashboard Panóptico
       │                                         │
       └────────────────────┬────────────────────┘
                            ▼
              [FASE 5: INTEGRAÇÃO E E2E]
               └── Tijolo 6: Fluxo Completo de Aluno e Professor
```

---

## 3. Detalhamento dos Tijolos Iniciais (Passo a Passo)

### Tijolo 1: `@webboard/contracts` (Contrato Universal de Tipos)
* **Objetivo:** Declarar em TypeScript todas as interfaces e DTOs especificados em `05_schemas_de_dados.md`.
* **Entregáveis:**
  - Tipos de Circuito: `CircuitDefinition`, `ComponentDefinition`, `WireDefinition`, `PinDefinition`.
  - Tipos de Desafio: `ChallengeDefinition`, `TestCaseDefinition`, `StaticAssertion`, `DynamicAssertion`.
  - Tipos de Submissão: `SubmissionSnapshot`, `EvaluationResult`.
* **Critério de Aceite:** Compilação limpa via `npx tsc -p packages/contracts/tsconfig.json` exportando tipos sem dependências externas.

---

### Tijolo 2: `@webboard/core` (O Motor Físico do Simulador)
* **Tijolo 2.1 (Netlist Solver):**
  - Implementar o agrupador de pinos interligados por fios em nós equipotenciais (`NetNode`).
  - Implementar a detecção de colisão direta de sinais (`RN-BNC-04`).
  - *Teste:* Unir 5V e GND e validar se o sistema dispara `SHORT_CIRCUIT` com identificador do fio.
* **Tijolo 2.2 (Circuit Solver):**
  - Implementar o cálculo da Lei de Ohm em galhos resistivos de dois terminais.
  - Implementar a checagem de sobrecorrente em semicondutores (`RN-BNC-05`).
  - *Teste:* TC-CORE-01 (LED com resistor oscila seguro) e TC-CORE-02 (LED sem resistor é destruído após 10ms).
* **Tijolo 2.3 (Workbench State Machine):**
  - Controlar as transições `MODO_EDICAO` $\leftrightarrow$ `MODO_SIMULACAO`.
  - Rejeitar mutações estruturais durante a simulação (`RN-BNC-01`).

---

### Tijolo 3: `@webboard/components` (Catálogo de Bundles)
* **Objetivo:** Criar os diretórios dos 6 primeiros componentes:
  - `resistor/`, `actuator_led/`, `pushbutton/`, `potentiometer/`, `actuator_buzzer/`, `sensor_ultrasonic/`.
  - Cada pasta contendo seu `manifest.json`, `logic.ts` (implementando `IComponentLogic`) e SVG placeholders em `assets/`.
* **Critério de Aceite:** Testes unitários headless executando a física de cada componente em milissegundos.

---

## 4. Divisão Especializada de Papéis (Agente Backend vs Agente Frontend)

A partir da conclusão do Tijolo 3, as tarefas se bifurcam em duas frentes independentes que dialogam via `ai-memory`:

| Frente | Agente Responsável | Foco Principal | Comunicação via ai-memory |
| :--- | :--- | :--- | :--- |
| **Backend & Infra** | **Agente Backend** | Persistência Prisma, Worker `arduino-cli`, Runner de Auto-Grading e WebSockets. | Publica contratos em `contracts/api.md` e registra progresso em `workstreams/backend.md`. |
| **Frontend & UI** | **Agente Frontend** | Canvas Konva.js, desenho da fiação, integração do Monaco Editor e emulação AVR8js na tela. | Propõe necessidades em `discussions/` e registra progresso em `workstreams/frontend.md`. |
