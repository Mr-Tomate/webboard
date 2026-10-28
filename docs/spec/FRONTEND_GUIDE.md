# Guia de Engenharia e Refatoração da Workbench (Frontend)

Este documento centraliza todas as diretrizes, diagnósticos de performance, metas de arquitetura e o roteiro de implementação para o **Desenvolvedor / Agente Frontend** do projeto Webboard.

---

## 1. O Diagnóstico do Problema

A implementação anterior acoplou o loop da CPU (16MHz) e a resolução do `CircuitSolver` aos hooks do React (`useWorkbench`, `useState`). Isso gerou:
1. **Gargalo Temporal:** O microcontrolador executa instruções a 16MHz, enquanto a tela só precisa renderizar a 60 FPS. Atualizar estado do React a cada pulso de pino provoca jank severo e queda de FPS.
2. **Desenho Acoplado:** Formas geométricas (`Rect`, `Circle`) foram escritas de forma fixa (*hardcoded*) dentro de `ComponentNode.tsx`, ignorando o padrão de sprites e manifests dos componentes.
3. **Falta de Camadas Gráficas (Layers):** Ao arrastar um fio ou peça, o Konva tenta redesenhar o grid e elementos estáticos.

---

## 2. A Nova Arquitetura em 3 Camadas Isoladas

```
┌────────────────────────────────────────────────────────────────────────┐
│ CAMADA 1: MOTOR DE SIMULAÇÃO (HEADLESS - PURA LÓGICA)                  │
│  - Classe pura TypeScript: WorkbenchEngine.ts (fora do React).         │
│  - Orquestra: AVRBoard (CPU), CircuitSolver (física) e State Machine.  │
│  - Avança em batches acumulados (Fixed Timestep Accumulator).          │
│  - Emite apenas Dirty Flags (quais componentes mudaram de estado).     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Notificações pontuais (sem re-render da árvore toda)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ CAMADA 2: O GRAFO DE CENA DA BANCADA (SCENE GRAPH)                     │
│  - WorkbenchSceneGraph.ts: Gerencia peças, posições {x, y}, rotação.  │
│  - Não depende de hooks; gerencia drag-and-drop e conexões puras.      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Sincronizado via requestAnimationFrame (60Hz)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ CAMADA 3: O PIPELINE EM 5 CAMADAS (LAYERS KONVA NO WORKBENCHSTAGE)     │
│  Layer 1: GridLayer (Fundo e grade magnética 20px com cache estático)  │
│  Layer 2: WiresLayer (Fios Bézier e waypoints; só redesenha se mover)  │
│  Layer 3: ComponentsLayer (Renderização por sprites/assets SVG)        │
│  Layer 4: InteractionLayer (O cabo sendo esticado pelo mouse a 60fps)  │
│  Layer 5: EffectsLayer (Halos luminosos de LEDs, faíscas de curto)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Metas de Entrega da Refatoração

1. **`WorkbenchEngine.ts`:** Motor headless com loop `stepBatch(deltaTimeMs)` que roda a simulação e calcula a física sem tocar no React.
2. **`WorkbenchSceneGraph.ts`:** Grafo de cena isolado para manipulação de coordenadas, waypoints e âncoras magnéticas.
3. **Particionamento em 5 `<Layer>`:** Reestruturar `WorkbenchStage.tsx` nas 5 camadas independentes para garantir 60 FPS lisos.
4. **Renderizador de Componentes:** Consumir os manifests e SVGs de `@webboard/components` sem formas geométricas chumbadas.
5. **Critério de Aceite:** 
   - `npm test -w @webboard/web` passando 100%.
   - `npm run build -w @webboard/web` passando em menos de 1s.
   - 60 FPS cravados no navegador sem travamento ao arrastar cabos ou ligar a CPU.

---

## 4. Documentos de Referência no Repositório

* [`docs/spec/12_arquitetura_de_renderizacao_e_workbench_engine.md`](12_arquitetura_de_renderizacao_e_workbench_engine.md) — O projeto detalhado do motor gráfico.
* [`docs/spec/01_bancada_e_simulacao.md`](01_bancada_e_simulacao.md) — Máquina de estados (Edição vs Simulação travada).
* [`docs/spec/08_extensibilidade_e_pacotes_de_componentes.md`](08_extensibilidade_e_pacotes_de_componentes.md) — O padrão de Component Bundles.
* [`AGENTS.md`](../../AGENTS.md) — Regras de conduta e protocolo `ai-memory`.
