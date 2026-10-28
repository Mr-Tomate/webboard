# 02 - Domínio de Execução de Código e Compilação

## 1. Responsabilidade
Receber os textos de programa do usuário, validar sintaxe, gerar os binários executáveis ou pacotes seriais e sincronizar o fluxo de instruções com o relógio da Bancada Virtual.

---

## 2. Os Dois Paradigmas de Execução

O sistema suporta oficialmente dois modelos de programação:

```
PARADIGMA 1: BARE-METAL (C/C++)
[Código C++] ──► [Compilador (arduino-cli)] ──► [Binário .HEX] ──► [Memória Flash MCU Virtual]

PARADIGMA 2: HOST-CLIENT (Python / PyFirmata)
[Script Python] ──► [Interpretador Host] ──(Serial Virtual)──► [Firmata Firmware no MCU]
```

### 2.1. Paradigma 1: C/C++ Nativo (Bare-Metal)
* O código C++ escrito pelo estudante é compilado diretamente para o target do microcontrolador (ex: ATmega328P para Arduino Uno).
* O binário compilado (`.hex` ou `.elf`) é carregado na memória flash do emulador.
* As instruções de máquina assembly são executadas ciclo a ciclo na CPU virtual em sincronia com o clock de simulação (16 MHz).

### 2.2. Paradigma 2: Python / PyFirmata (Automação e Robótica)
* O microcontrolador da bancada roda uma imagem de firmware pré-compilada do protocolo **StandardFirmata**.
* O script Python do aluno executa em um interpretador dedicado.
* Uma **Ponte Serial Virtual (Virtual UART Bridge)** conecta o script Python à porta RX/TX do microcontrolador simulado.
* Chamadas de biblioteca como `board.digital[13].write(1)` trafegam como pacotes de bytes na serial virtual, acionando os pinos em tempo simulado.

---

## 3. Regras de Compilação e Erros

* **RN-COD-01 (Isolamento de Erro de Compilação):** Erros de sintaxe ou bibliotecas ausentes devem ser capturados e devolvidos imediatamente como `ERRO_COMPILACAO`, sem iniciar a simulação elétrica.
* **RN-COD-02 (Agnóstico de Camada Visual):** Se uma interface de blocos (estilo Blockly/Scratch) for acoplada no futuro, ela atuará estritamente como geradora de texto-fonte (C/C++ ou Python), preservando o Core desacoplado de dependências visuais.
* **RN-COD-03 (Determinismo Temporal):** Funções bloqueantes de delay (ex: `delay(1000)` ou `time.sleep(1)`) não congelam a thread de renderização da aplicação; elas apenas suspendem a CPU virtual pelo número exato de ciclos de simulação correspondentes.
