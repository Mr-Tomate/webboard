# 01 - Domínio da Bancada Virtual e Motor de Simulação

## 1. Responsabilidade
Gerenciar o ciclo de vida dos componentes, a conectividade elétrica por nós (nets), a máquina de estados de energização e a emissão de falhas físicas (curto-circuito e destruição térmica).

---

## 2. Máquina de Estados da Bancada

A bancada possui dois estados operacionais principais mutuamente exclusivos:

```
    ┌────────────────┐   Iniciar Simulação (Energizar)    ┌──────────────────┐
    │  MODO_EDICAO   │ ─────────────────────────────────► │  MODO_SIMULACAO  │
    │  (Desenergizado)│ ◄───────────────────────────────── │    (Energizado)  │
    └────────────────┘     Parar Simulação (Desligar)     └─────────┬────────┘
                                                                    │
                                                           Ocorrência de Falha
                                                           (Curto / Sobrecarga)
                                                                    │
                                                                    ▼
                                                          ┌──────────────────┐
                                                          │ ESTADO_FALHA_ENG │
                                                          │(Congelado p/ ver)│
                                                          └──────────────────┘
```

### Regras de Transição de Estado
* **RN-BNC-01 (Trava Física):** Ao entrar em `MODO_SIMULACAO`, a topologia é travada. É terminantemente proibido adicionar peças, deletar peças ou alterar fios.
* **RN-BNC-02 (Proibição de Hot-Plugging):** Qualquer alteração estrutural no circuito requer o desligamento da simulação (`MODO_EDICAO`).
* **RN-BNC-03 (Interatividade em Simulação):** Em `MODO_SIMULACAO`, o usuário só pode interagir com elementos de entrada física expostos (botões, potenciômetros, ajuste de obstáculos de distância e sensores de luz).

---

## 3. Modelo de Entidades e Conectividade Elétrica

### 3.1. Identificadores Rastreáveis
Todos os componentes e condutores devem possuir um Identificador Único Universal (UID) gerado pelo sistema:
* Exemplos: `mcu_uno_01`, `led_01`, `res_02`, `condutor_b4`.

### 3.2. A Resolução de Nós (Nets)
* Quando múltiplos pinos são unidos por condutores, o sistema calcula uma **Net (Nó Elétrico Equipotencial)**.
* Todo pino pertencente à mesma Net compartilha o mesmo potencial de tensão ($V$).

### 3.3. Diagnóstico e Regras de Falha Elétrica
O simulador adota comportamento objetivo (estilo multímetro/disjuntor industrial), sem fornecer respostas mastigadas ao estudante:

* **RN-BNC-04 (Curto-Circuito Lógico / Conflito Direto):**
  - **Condição:** Mais de um pino configurado como `OUTPUT` no mesmo nó elétrico com níveis lógicos divergentes (ex: pino A em HIGH e pino B em LOW) ou ligação direta entre linha de alimentação (5V) e Terra (GND).
  - **Ação:** Interrupção imediata da alimentação e congelamento da simulação.
  - **Mensagem:**  
    `[FALHA ELÉTRICA] Curto-circuito detectado: Conflito de condução direta no condutor {id_condutor} entre {pino_origem} e {pino_destino}.`

* **RN-BNC-05 (Destruição Térmica por Sobrecarga):**
  - **Condição:** A corrente contínua que atravessa um componente semicondutor/atuador excede sua corrente nominal máxima ($I > I_{max}$) por tempo superior à janela de tolerância de transientes ($T_{tolerancia}$).
  - **Ação:** O componente é marcado com `estado_operacional = DESTRUIDO_POR_SOBRECARGA`, interrompe sua função (LED apaga, motor para) e a simulação sinaliza a queima.
  - **Mensagem:**  
    `[FALHA TÉRMICA] Sobrecorrente crítica em {id_componente}: Limite de corrente violado. O componente foi desativado por queima.`

---

## 4. O Cenário de Estímulos e Ambiente (Mundo Físico Virtual)

A bancada suporta uma camada de **Objetos de Ambiente**:
* **Obstáculo de Parede/Superfície:** Posição em centímetros para reflexão do sensor ultrassônico.
* **Intensidade Luminosa do Ambiente:** Valor em Lux para leitura do LDR.
* **Perfil de Atuação:** Permite fixar estímulos manuais ou injetar roteiros automatizados para testes determinísticos.
