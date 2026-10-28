# 00 - Visão Geral, Propósito e Fronteiras do Core

## 1. Identificação do Projeto
* **Nome de Trabalho:** Webboard (Simulador Educacional de Eletrônica e Robótica)
* **Objetivo:** Prover um ecossistema educacional de robótica e eletrônica digital onde estudantes montam circuitos e programam microcontroladores em um ambiente simulado de alta fidelidade lógica, com auto-avaliação contratual e monitoramento docente em tempo real.
* **Modelo Operacional:** B2B Escolar (Redes públicas, escolas privadas, cursos técnicos e faculdades).

---

## 2. O que o Sistema É e o que NÃO É (Fronteiras Rígidas)

### 2.1. O que o Sistema É (In-Scope)
1. **Simulador Lógico e Comportamental:** Modela nós elétricos (nets), níveis de tensão padrão (0V, 3.3V, 5V), PWM, leituras analógicas aproximadas e limites nominais de corrente contínua ($I_{max}$).
2. **Ambiente com Duplo Paradigma de Código:** Suporta programação bare-metal em C/C++ e controle via script em Python (protocolo PyFirmata via serial virtual).
3. **Motor de Avaliação Automatizada (Auto-Grading):** Valida circuitos e código via asserções estáticas (topologia) e asserções dinâmicas (resposta temporal sob cenários de estímulo).
4. **Plataforma Pedagógica Multi-Tenant:** Gerencia turmas, permissões de acesso, snapshots de versões e telemetria docente em tempo real.
5. **Ambiente Colaborativo de Bancada:** Modelo baseado em *Workspaces* (Solo ou Grupo).

### 2.2. O que o Sistema NÃO É (Out-of-Scope)
1. **Não é simulador SPICE analógico puro:** Não efetua cálculo de equações diferenciais em componentes de alta frequência nem modelagem de capacitância/indutância parasita.
2. **Não suporta Hot-Plugging:** A bancada bloqueia edições físicas enquanto a energia está ligada.
3. **Não é ERP Escolar:** Não substitui diário de classe genérico, frequência física ou emissão de boletos de mensalidade escolar.

---

## 3. Arquitetura de Bounded Contexts

O Core é estruturado em 4 contextos com responsabilidades bem delimitadas:

```
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│     1. BANCADA & SIMULAÇÃO      │        │     2. CÓDIGO & COMPILAÇÃO      │
│  - Topologia de Nós (Nets)      │◄───────┤  - C/C++ Bare-Metal (.hex)      │
│  - Pinos, Fios e Componentes    │        │  - Python / PyFirmata           │
│  - Diagnóstico de Sobrecarga    │        │  - Serial Bridge Virtual        │
└────────────────┬────────────────┘        └────────────────┬────────────────┘
                 │                                          │
                 │                 Telemetria de Sinais     │
                 ▼                                          ▼
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│     3. AVALIAÇÃO & AUTOGRADING  │        │    4. PEDAGÓGICO & WORKSPACES   │
│  - Asserções de Topologia       │◄───────┤  - Gestão de Turmas e Alunos    │
│  - Cenários de Estímulos        │        │  - Workspaces Solo / Grupo      │
│  - Snapshots de Submissão       │        │  - Telemetria do Professor      │
└─────────────────────────────────┘        └─────────────────────────────────┘
```

---

## 4. Glossário Ubíquo do Sistema

* **Bancada (Workbench):** Instância virtual de trabalho contendo componentes, fios e ambiente físico.
* **Componente (Component):** Peça de hardware com identificador único, propriedades nominais e pinos de conexão.
* **Pino (Pin):** Ponto elétrico de entrada, saída, bidirecional ou passivo de um componente.
* **Condutor (Wire):** Fio de conexão que une dois pinos, possuindo identificador rastreável.
* **Nó Elétrico (NetNode / Net):** Agrupamento equipotencial de pinos e condutores interligados.
* **Workspace:** Espaço de projeto contendo bancadas e códigos, com permissão para um aluno (Solo) ou múltiplos alunos (Grupo).
* **Desafio (Challenge):** Atividade pedagógica com restrições de kit, instruções e bateria de testes.
* **Caso de Teste (Test Case):** Roteiro de validação contendo asserções estáticas e dinâmicas com injeção de estímulos.
* **Submissão (Submission):** Snapshot imutável de circuito + código enviado para validação oficial.
