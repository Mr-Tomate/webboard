# 08 - Extensibilidade e Arquitetura de Pacotes de Componentes

## 1. Princípio Fundamental
A criação de novos componentes obedece ao princípio Open/Closed (SOLID): o motor de simulação e a bancada gráfica devem permanecer fechados para alteração, enquanto novos componentes são adicionados de forma puramente declarativa e modular, sem acoplamento entre física e renderização gráfica.

---

## 2. A Estrutura de Pacote de Componente (Component Bundle)

Todo componente da plataforma é armazenado em um diretório isolado contendo exatamente três elementos essenciais:

```text
components/{nome_componente}/
├── manifest.json       (Metadados, dimensões, pinos, posições de ancoragem)
├── logic.ts            (Lógica física pura, implementando IComponentLogic)
└── assets/             (Sprites visuais SVG e estados gráficos)
    ├── default.svg     (Estado base em repouso)
    ├── active.svg      (Estado ativo / excitado)
    └── failure.svg     (Estado de dano térmico ou queima)
```

---

## 3. Especificação do Manifesto (`manifest.json`)

Define os limites físicos e a geometria de encaixe na bancada:
* `id`: Identificador canônico do tipo (ex: `actuator_led`, `sensor_hcsr04`).
* `name`: Nome legível exibido no menu/catálogo da bancada.
* `category`: Categoria (`ACTUATOR`, `SENSOR`, `PASSIVE`, `INPUT`, `MCU`).
* `dimensions`: Largura e altura em pixels no grid da bancada (`width`, `height`).
* `pins`: Lista de pinos com:
  - `id`: Nome de identificação (ex: `ANODE`, `TRIG`, `VCC`).
  - `label`: Nome amigável.
  - `type`: `POWER_VCC`, `POWER_GND`, `DIGITAL_IO`, `ANALOG_IN`, `PASSIVE`.
  - `anchorPosition`: Coordenadas relativas `(x, y)` dentro da imagem onde o condutor se conecta magneticamente.
* `defaultParameters`: Valores nominais padrão (resistência, capacitância, cor).
* `visualStates`: Lista dos estados visuais possíveis (ex: `["OFF", "ON", "BURNED"]`).

---

## 4. O Contrato de Lógica Pura (`logic.ts`)

A lógica do componente não possui dependência de DOM, Canvas ou WebGL. Ela interage com o motor exclusivamente através do objeto `ComponentContext`:

```typescript
export interface ComponentContext {
  getPin(pinId: string): PinState;
  writePinVoltage(pinId: string, voltage: number): void;
  writePinDigital(pinId: string, state: "HIGH" | "LOW" | "HIGH_Z"): void;
  scheduleTimer(delayVirtualMicros: number, callbackId: string): void;
  getEnvironmentValue(property: string): any;
  emitFailure(type: "SHORT_CIRCUIT" | "OVERCURRENT", message: string): void;
  setVisualState(statePayload: Record<string, any>): void;
}

export interface IComponentLogic {
  onInit(ctx: ComponentContext): void;
  onReset(ctx: ComponentContext): void;
  onPinChange(pinId: string, ctx: ComponentContext): void;
  onEnvironmentChange(property: string, value: any, ctx: ComponentContext): void;
  onTimerFired(callbackId: string, ctx: ComponentContext): void;
}
```

---

## 5. Ciclo de Renderização e Desacoplamento Gráfico

1. **Separação de Papéis:**
   - O `logic.ts` calcula as leis da física e chama `ctx.setVisualState({ state: "ON", brightness: 0.8 })`.
   - O renderizador da bancada escuta a mudança de estado e aplica a transformação visual no sprite SVG correspondente (ex: ajustar opacidade do brilho ou rotacionar ponteiro do servo).
2. **Execução Headless:**
   - Em testes automatizados e no módulo de Auto-Grading de submissões no servidor, o `logic.ts` é executado com um contexto simulado sem carregar nenhum asset visual, permitindo avaliar centenas de submissões por segundo com consumo desprezível de CPU e memória.
