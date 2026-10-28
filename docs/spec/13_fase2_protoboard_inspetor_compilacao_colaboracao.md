# 13 - Especificação da Fase 2: Protoboard, Inspetor, Compilação Híbrida e Colaboração

## 1. Visão Geral da Fase 2
A Fase 2 expande a maturidade do Webboard, elevando o simulador ao nível de ferramentas industriais e educacionais de ponta. Ela endereça a fidelidade de montagem física de bancada, a ergonomia de edição de componentes, a resiliência e custo zero de compilação, e a dinâmica colaborativa em sala de aula.

---

## 2. Eixo A: A Protoboard Virtual (Breadboard Half-Size 400 Furos)

### 2.1. Natureza Física e Modelo de Domínio
A Protoboard não é um componente ativo com semicondutores. Ela é modelada no Core como um **Agrupador Equipotencial Passivo** de condutância infinita ($R \approx 0\,\Omega$).

### 2.2. Topologia das Pontes Metálicas Internas (`internalBridges`)
A Protoboard de 400 furos (half-size com 30 colunas) é decomposta em **64 nós equipotenciais internos rígidos**:
1. **Barramentos Horizontais de Alimentação (Power Rails):**
   - Superior Linha Azul (`-` / GND): Furos `TOP_GND_1` a `TOP_GND_25` em curto direto.
   - Superior Linha Vermelha (`+` / VCC): Furos `TOP_VCC_1` a `TOP_VCC_25` em curto direto.
   - Inferior Linha Vermelha (`+` / VCC): Furos `BOT_VCC_1` a `BOT_VCC_25` em curto direto.
   - Inferior Linha Azul (`-` / GND): Furos `BOT_GND_1` a `BOT_GND_25` em curto direto.
2. **Trilhas Verticais de Terminais (Terminal Strips):**
   - 30 colunas superiores isoladas: Para cada coluna $k \in [1, 30]$, os furos `A_k, B_k, C_k, D_k, E_k` formam um único nó equipotencial.
   - Rasgo Central Isolante (DIP Trench): Isola galvanicamente a metade superior da inferior.
   - 30 colunas inferiores isoladas: Para cada coluna $k \in [1, 30]$, os furos `F_k, G_k, H_k, I_k, J_k` formam um único nó equipotencial.

### 2.3. Integração com o `NetlistSolver`
* No ato da instanciação da Protoboard, o `NetlistSolver` adiciona as 64 pontes internas à matriz de adjacência da bancada.
* Qualquer jumper ou terminal espetado em um furo propaga sua tensão e corrente instantaneamente para todos os furos daquela trilha.

---

## 3. Eixo B: O Inspetor de Propriedades e Código de Cores do Resistor

### 3.1. Arquitetura de Interface: Inspector Drawer
* **Posição:** Barra lateral retrátil fixa no lado direito da tela (largura de 320px).
* **Comportamento de Abertura:** Ativado ao clicar em um componente no canvas da bancada.
* **Governança Estrita da Malha:**
  - Em `MODO_EDICAO`: Todos os campos são editáveis. Alterações recalculam imediatamente as faixas coloridas e a matriz da Netlist.
  - Em `MODO_SIMULACAO`: O painel transita para **Modo Telemetria (Read-Only)**. Inputs ficam travados para impedir *hot-mutation* de malha (`RN-BNC-01`), exibindo queda de tensão, corrente em mA e potência em mW ao vivo.

### 3.2. A Matemática das 4 Faixas Coloridas (Norma IEC 60062)
Dado qualquer valor de resistência nominal $R$ em Ohms, o algoritmo realiza a decomposição científica:
$$R = (d_1 \times 10 + d_2) \times 10^M$$
* **Faixa 1 ($d_1$):** Primeiro dígito significativo (1 a 9).
* **Faixa 2 ($d_2$):** Segundo dígito significativo (0 a 9).
* **Faixa 3 ($M$):** Multiplicador decimal (potência de 10).
* **Faixa 4:** Tolerância (Dourado $\pm 5\%$).

### 3.3. Tabela Didática de Presets da Linha E12
O Drawer oferece atalhos de 1 clique para os valores mais utilizados em educação:  
`100Ω`, `220Ω`, `330Ω`, `470Ω`, `1kΩ`, `2.2kΩ`, `4.7kΩ`, `10kΩ`, `100kΩ`.

---

## 4. Eixo C: A Arquitetura Híbrida de Compilação C++

Para eliminar custos de nuvem e conferir resiliência total contra quedas de internet escolar, adota-se uma **estratégia de compilação em 2 Tiers**:

```
[ Ação: Compilar Código C++ ]
               │
               ▼
   [ Cálculo do Hash SHA-256 ]
               │
       ┌───────┴───────┐
       ▼               ▼
[ TIER 1: CLOUD CACHE ]  [ TIER 2: LOCAL WASM FALLBACK ]
- Consulta API Fastify    - Executado se offline ou código inédito
- Hash conhecido?         - Clang/LLVM WebAssembly em Web Worker
  -> Devolve .hex em 5ms  - Sistema de arquivos virtual (MEMFS)
  -> Zero gasto de CPU    - Compilação local em ~1s sem travar a UI
```

### 4.1. Requisitos do Compilador WebAssembly Local
* **Isolamento de Thread:** Executado estritamente dentro de um `Worker` do navegador, preservando os 60 FPS da renderização gráfica.
* **Carregamento Sob Demanda (Lazy-Loading):** O binário Wasm (~10MB compactado) só é baixado sob demanda ou via prefetch em background.
* **Armazenamento Permanente:** Gravado em `CacheStorage`/`IndexedDB` do navegador após o primeiro download, garantindo operação 100% offline permanente.

---

## 5. Eixo D: Colaboração Concorrente no Workspace de Grupo

### 5.1. Protocolo de Soft-Locking por Componente
Para evitar condições de corrida onde dois alunos arrastam a mesma peça simultaneamente:
1. Ao iniciar o evento `dragstart` em um componente, o cliente emite via WebSocket:
   ```json
   { "action": "LOCK_COMPONENT", "componentId": "res_01", "userId": "usr_lucas" }
   ```
2. O servidor propaga a trava para todos os outros membros conectados ao mesmo workspace.
3. Na tela dos colegas, o componente exibe uma **borda de destaque azul com etiqueta flutuante** indicando quem está manipulando a peça e bloqueia eventos de ponteiro locais.
4. Ao soltar (`dragend`), a trava é liberada (`UNLOCK_COMPONENT`) e a coordenada sincronizada é persistida.

### 5.2. Cursores Remotos (Presence Pointers)
* Os membros do grupo transmitem coordenadas normalizadas de ponteiro via WebSocket (`PRESENCE_CURSOR_UPDATE`).
* Cursores suaves com cores distintas e o primeiro nome do aluno facilitam a indicação de pinos e orientação mútua na bancada.

### 5.3. Sincronização da Simulação e Avaliação
* **Chave Geral de Energização:** O início ou parada da simulação por um membro sincroniza instantaneamente o estado da bancada de todos os colegas do grupo.
* **Autoria Compartilhada de Submissão:** A submissão oficial de um desafio grava um único snapshot com a autoria de todos os alunos ativos daquele Workspace de Grupo.
