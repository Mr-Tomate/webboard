# 03 - Domínio de Avaliação Automatizada (Auto-Grading)

## 1. Responsabilidade
Atuar como árbitro imparcial que valida se a solução do aluno (circuito + código) atende aos requisitos funcionais do Desafio, sem depender de análise textual subjetiva do código.

---

## 2. Estrutura do Desafio (Challenge Contract)

Um Desafio pedagógico é composto por:
1. **Catálogo Restrito (Kit Fechado):** Lista com componentes permitidos e quantidades máximas.
2. **Estado Inicial (Seed):** Componentes pré-fixados na bancada que não podem ser excluídos pelo aluno.
3. **Casos de Teste (Test Suite):**
   * **Testes Públicos (Exemplos):** Abertos ao aluno para que ele entenda o contrato de entrada e saída.
   * **Testes Ocultos (Borda/Robustez):** Executados no ato da submissão para validar condições de limite e evitar hardcoding.

---

## 3. Tipos de Asserções

### 3.1. Asserções Estáticas de Hardware (Pré-Execução)
Executadas com a simulação desligada para validar a integridade física do esquemático:
* `ASSERCAO_COMPONENTE_PRESENTE`: Valida se o circuito contém o número exigido de peças (ex: exatos 2 LEDs).
* `ASSERCAO_MALHA_CONEXAO`: Valida se o pino $X$ de um sensor atinge o pino $Y$ do microcontrolador através de uma Net válida.
* `ASSERCAO_RESISTOR_PROTECAO`: Valida se entre o anodo/catodo de um LED e o polo de alimentação existe um resistor limitador na faixa permitida ($R_{min} \le R \le R_{max}$).

### 3.2. Asserções Dinâmicas e Temporais (Sob Simulação)
Executadas com a injeção de estímulos virtuais ao longo de uma linha do tempo virtual:
* O autor do desafio define a duração do estímulo $T_{est}$.
* **Cálculo de Timeout Virtual:**
  $$\text{Timeout de Execução} = T_{\text{est}} + \Delta t_{\text{tolerancia}}$$
* Se a asserção esperada não for satisfeita dentro desse intervalo de tempo simulado, o caso de teste encerra com falha por `TIMEOUT_DE_COMPORTAMENTO`.
* **Flag de Timeout Ligável/Desligável:**
  - Na avaliação oficial: Timeout obrigatoriamente **ATIVO**.
  - Na bancada de depuração do aluno: Timeout pode ser **DESATIVADO** para inspeção manual.

---

## 4. Política de Submissão e Snapshots Imutáveis

```
[ Ação: Submeter Desafio ]
       │
       ▼
1. Validação Estática de Hardware ──────(Falhou)──────► [ REPROVADO_CIRCUITO ]
       │                                                (Aponta o identificador do erro)
       ▼ (Passou)
2. Compilação de Código ────────────────(Falhou)──────► [ ERRO_COMPILACAO ]
       │
       ▼ (Passou)
3. Execução Headless dos Casos de Teste
   ├── Teste Público 1 ────► OK
   ├── Teste Oculto 1  ────► OK
   └── Teste Oculto 2  ────► (Falhou) ───────────────► [ REPROVADO_TESTE ]
       │
       ▼ (Todos passaram)
[ APROVADO COM SUCESSO ] ──► Salva Snapshot Imutável e Notifica Painel Docente
```

### Regras de Negócio de Submissão
* **RN-GRD-01 (Tentativas Ilimitadas):** O aluno não sofre penalidade de nota por submeter múltiplas vezes.
* **RN-GRD-02 (Snapshots Versionados):** Cada submissão registra um snapshot imutável (`v1`, `v2`, `v3`...) contendo:
  - Topologia serializada da bancada (BOM + Netlist JSON).
  - Código-fonte textual exato.
  - Relatório de testes executados e asserções falhas/aprovadas.
  - Identificador do autor ou dos membros do Workspace.
  - Timestamp oficial.
