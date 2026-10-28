# 12 - Arquitetura de Renderização e Motor de Bancada (Workbench Engine)

## 1. Problema e Motivação
A execução de microcontroladores em tempo real (16MHz) e o cálculo de malha elétrica em tempo discreto são incompatíveis com o ciclo de reconciliação de estado de frameworks reativos como React. Tentar acoplar eventos de CPU diretamente a estados de tela provoca gargalos de renderização, jank e perda severa de FPS.

A Workbench deve ser decomposta em três domínios ortogonais: **Simulação e Física**, **Grafo de Cena da Bancada** e **Pipeline Gráfico em Camadas**.

---

## 2. Princípio do Desacoplamento Temporal

```
[ Tempo Virtual da Simulação (16MHz) ]
  └── Avança em passos discretos de tempo (dt = 1us ou batch de 1ms)
  └── Emite apenas "Dirty Flags" quando o estado elétrico de um pino transita

               ▲
               │ Acoplamento desacoplado via Buffer de Estado Visual
               ▼

[ Tempo de Renderização da Tela (60Hz) ]
  └── Sincronizado estritamente ao requestAnimationFrame do navegador
  └── Renderiza apenas os elementos que sofreram mutação na Layer correspondente
```

---

## 3. O Pipeline de Renderização em 5 Camadas (Layers)

A tela é particionada em camadas de renderização independentes com estratégias de cache específicas:

| Camada | Nome | Responsabilidade | Política de Redesenho |
| :--- | :--- | :--- | :--- |
| **Layer 1** | **Grid & Background** | Malha quadriculada magnética de 20px e plano de fundo infinito. | Cache estático em bitmap; só redesenha em eventos de Pan e Zoom. |
| **Layer 2** | **Condutores (Wires)** | Cabos elétricos com curvas de Bézier e waypoints ortogonais. | Redesenha somente quando uma peça é movida ou fio é conectado/deletado. |
| **Layer 3** | **Componentes (Sprites)** | Gráficos vetorizados dos componentes com âncoras magnéticas de pinos. | Cacheado por componente; redesenha apenas a camada visual afetada. |
| **Layer 4** | **Interação Ativa** | Cabo elétrico em processo de arraste pelo mouse e caixa de seleção. | Redesenho livre a cada evento de `mousemove` a 60fps sem afetar outras layers. |
| **Layer 5** | **Alertas e Efeitos (FX)** | Halo difuso de LEDs acesos, faíscas de curto e badges de falha térmica. | Atualizado em resposta a eventos de estado da simulação. |

---

## 4. O Ciclo de Execução da Workbench (Passo a Passo)

```
[ 1. Início do Frame: requestAnimationFrame ]
       │
       ▼
[ 2. Avanço da Física e CPU ]
  ├── Executa bloco de instruções da CPU (AVR8js) equivalente a dt
  ├── CircuitSolver resolve tensões e correntes da malha
  └── Registra componentes que alteraram estado visual em `dirtySet`
       │
       ▼
[ 3. Se dirtySet estiver vazio: Não faz nada (Preserva CPU/GPU) ]
       │
       ▼ (Se houver alterações)
[ 4. Aplica transformações gráficas pontuais nas Layers afetadas ]
  ├── Layer 3: Atualiza opacidade de brilho do LED
  └── Layer 5: Se houver queima, renderiza sprite de cinzas e congela
```

---

## 5. Estratégia de Transição para o Código
1. **Isolar o Loop da Simulação em um `WorkbenchEngine` Puro:** Uma classe TypeScript independente fora de hooks React, responsável por gerenciar a CPU e o `CircuitSolver`.
2. **Adaptador de Renderização:** Um componente de visualização que consome snapshots do motor e delega o desenho para layers Konva sem re-renderizar a árvore React inteira.
3. **Interação com a Bancada:** Movimento de peças e puxamento de fios alteram apenas o Grafo de Cena visual; a física só é acionada quando o circuito é energizado.
