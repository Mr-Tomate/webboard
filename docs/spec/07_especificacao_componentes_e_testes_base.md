# 07 - Especificação de Componentes Básicos e Bateria de Testes do Core

## 1. Responsabilidade
Definir as propriedades elétricas, limites operacionais e comportamentos físicos dos componentes que compõem o catálogo inicial do MVP, além de formalizar os casos de teste que validam a integridade do motor de simulação.

---

## 2. Catálogo de Componentes e Modelos Físicos

### 2.1. Microcontrolador (Arduino Uno / ESP32)
* **Alimentação:** Pinos 5V / 3.3V com limite máximo de 500mA e GND como 0.0V.
* **Pinos Digitais (GPIO):**
  - `OUTPUT`: Nível lógico 5V (HIGH) ou 0V (LOW). Corrente máxima nominal: 20mA a 40mA.
  - `INPUT`: Alta impedância ($Z \approx 100\text{M}\Omega$). Medição contínua (>3.0V = HIGH, <1.5V = LOW). Pino flutuante gera leitura de ruído estocástico.
  - `INPUT_PULLUP`: Resistor interno de 20k$\Omega$ a 50k$\Omega$ ligado aos 5V.
* **Pinos Analógicos (ADC):** Resolução de 10 bits mapeando linearmente 0V-5V para a escala inteira 0-1023.

### 2.2. LED (Diodo Emissor de Luz)
* **Terminais:** Anode (+) e Cathode (-).
* **Tensão Direta ($V_f$):** 1.8V (Vermelho/Amarelo) a 3.0V (Azul/Branco).
* **Corrente Nominal:** 10mA a 20mA.
* **Corrente Máxima de Sobrecarga ($I_{max}$):** 30mA (0.03A).
* **Regra de Destruição:** Se $I > 30\text{mA}$ por tempo $T > 10\text{ms}$ no tempo de simulação, o componente transita para `DESTRUIDO_POR_SOBRECARGA`, apaga e interrompe condução.

### 2.3. Resistor
* **Terminais:** PIN_1 e PIN_2 (simétrico).
* **Parâmetro:** Resistência nominal em Ohms ($R$).
* **Física:** $V = R \cdot I$. Queda de tensão linear e limitação de corrente no nó.

### 2.4. Pushbutton (Botão Pulsador)
* **Terminais:** Par 1 (PIN_1A, PIN_1B) e Par 2 (PIN_2A, PIN_2B).
* **Estados:**
  - `SOLTO`: Circuito aberto ($R \approx \infty$).
  - `PRESSIONADO`: Circuito fechado condutivo ($R \approx 0.001\Omega$).

### 2.5. Potenciômetro
* **Terminais:** Terminal 1, Wiper (Cursor central) e Terminal 2.
* **Comportamento:** Divisor de tensão linear ajustável via posição angular $\alpha \in [0.0, 1.0]$.
  $$R_1 = \alpha \cdot R_t, \quad R_2 = (1 - \alpha) \cdot R_t$$

### 2.6. Sensor Ultrassônico (HC-SR04)
* **Terminais:** VCC (5V), GND (0V), TRIG (Entrada) e ECHO (Saída).
* **Protocolo:**
  1. Pulso de disparo em TRIG em HIGH por $\ge 10\mu\text{s}$.
  2. Consulta a distância do obstáculo alinhado no ambiente virtual ($D$ em cm).
  3. Gera pulso em nível HIGH no pino ECHO por tempo $T_{echo} = D \times 58\mu\text{s}$.
  4. Alcance operacional: 2cm a 400cm. Sem obstáculo detectado, emite pulso de timeout de 38ms.

### 2.7. Buzzer
* **Terminais:** VCC (+) e GND (-).
* **Ativo:** Apita em frequência fixa (2.5kHz) sob tensão contínua $\ge 3.0\text{V}$.
* **Passivo:** Reproduz a frequência sonora exata do sinal de onda quadrada oscilante aplicado nos terminais.

---

## 3. Bateria de Testes Básicos de Aceitação do Core

Estes testes devem ser implementados como suíte automatizada de testes do próprio simulador:

| ID | Nome do Teste | Topologia | Estímulo / Código | Critério de Aceite |
| :--- | :--- | :--- | :--- | :--- |
| **TC-CORE-01** | Blink Saudável | Uno D13 $\rightarrow$ R (220$\Omega$) $\rightarrow$ LED $\rightarrow$ GND | Blink a cada 1000ms | Corrente $\approx 14.5\text{mA}$. Sem falhas elétricas. LED oscila estado. |
| **TC-CORE-02** | Queima por Sobrecarga | Uno D13 $\rightarrow$ LED $\rightarrow$ GND (sem R) | D13 em HIGH | Corrente $> 30\text{mA}$. LED destruído em 10ms com diagnóstico de sobrecorrente. |
| **TC-CORE-03** | Curto VCC-GND | Fio direto de 5V para GND | Ligação inicial | Simulação aborta em T=0 com diagnóstico de curto-circuito objetivo. |
| **TC-CORE-04** | Entrada com Pull-up | Uno D2 $\rightarrow$ Botão $\rightarrow$ GND | INPUT_PULLUP; Botão solto e depois pressionado | D2 lê HIGH com botão solto e LOW com botão pressionado. |
| **TC-CORE-05** | Sensor Ultrassônico | HC-SR04 nos pinos D11/D12 | Obstáculo a 20.0cm | Pulso ECHO de $1160\mu\text{s} \pm 10\mu\text{s}$. Distância lida é 20cm. |
