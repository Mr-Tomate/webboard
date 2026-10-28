# 06 - Domínio de Exportação e Compatibilidade com o Mundo Real

## 1. Responsabilidade
Garantir que qualquer projeto concebido e validado na bancada virtual possa ser exportado em um único clique para ferramentas e padrões industriais do mundo real, acompanhado do mapa físico de montagem elétrica.

---

## 2. Princípio da Fidelidade 100% ao Hardware Físico
* O código executado no simulador **não deve usar bibliotecas proprietárias ou "falsas"**. Ele utiliza a mesma API padrão do framework Arduino (`pinMode`, `digitalWrite`, `Serial.begin`) ou scripts Python padronizados (`pyfirmata`).
* A abstração ocorre apenas na camada de infraestrutura virtual; o código-fonte gerado é 100% executável em silício real sem necessidade de reescrita.

---

## 3. Padrões de Exportação Suportados (Targets)

### 3.1. Target: PlatformIO (Profissional / VS Code)
Voltado para cursos técnicos, faculdades e placas como ESP32, ESP8266, STM32 e Arduino.
* **Estrutura de Saída (`.zip`):**
  ```text
  projeto_platformio/
  ├── platformio.ini       (configuração de placa, framework e lib_deps)
  ├── WIRING.md            (tabela de fiação para montagem física)
  ├── include/
  │   └── config.h         (mapeamento de pinos e constantes)
  └── src/
      └── main.cpp         (código-fonte em C++)
  ```

### 3.2. Target: Arduino IDE Clássico
Voltado para educação básica e iniciantes no ecossistema Arduino.
* **Regra de Diretório:** O nome da pasta raiz coincide obrigatoriamente com o nome do arquivo principal `.ino`.
* **Estrutura de Saída (`.zip`):**
  ```text
  meu_projeto/
  ├── meu_projeto.ino      (sketch principal)
  └── WIRING.md            (guia de montagem física)
  ```

### 3.3. Target: Python / PyFirmata (Automação Host-Client)
Voltado para automação e IoT onde o computador controla a placa via porta serial física.
* **Estrutura de Saída (`.zip`):**
  ```text
  meu_projeto_python/
  ├── main.py              (script Python do aluno)
  ├── requirements.txt     (dependências: pyfirmata, pyserial)
  ├── firmware/
  │   └── StandardFirmata.ino (firmware oficial para gravar na placa física)
  ├── README.md            (guia de execução passo a passo)
  └── WIRING.md            (tabela de conexões da protoboard)
  ```

---

## 4. O Gerador de Mapeamento Físico (`WIRING.md`)

O Core analisa o grafo de condutores (`wires`) e gera uma tabela legível em Markdown instruindo o aluno sobre como plugar os jumpers na protoboard real:
* Identificação clara do componente físico e pino de origem.
* Componentes intermediários em série (ex: resistores de proteção obrigatórios).
* Pino de destino no microcontrolador (ex: D13, 5V, GND).
* Sugestão padronizada de cor de fio (Vermelho para VCC, Preto para GND, cores distintas para sinais digitais/analógicos).
