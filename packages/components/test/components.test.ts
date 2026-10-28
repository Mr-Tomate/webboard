import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ComponentContext,
  PinDigitalLevel,
  PinState,
  ComponentFaultType,
} from '@webboard/contracts';
import {
  getAllComponentManifests,
  getComponentBundle,
  ResistorLogic,
  LedLogic,
  PushbuttonLogic,
  PotentiometerLogic,
  BuzzerLogic,
  UltrasonicSensorLogic,
  BreadboardLogic,
} from '../dist/index.js';

class MockComponentContext implements ComponentContext {
  public pins: Map<string, PinState> = new Map();
  public scheduledTimers: Array<{ delayMicros: number; callbackId: string }> = [];
  public environment: Map<string, any> = new Map();
  public failures: Array<{ type: ComponentFaultType; message: string }> = [];
  public lastVisualState: Record<string, any> = {};

  public getPin(pinId: string): PinState {
    return (
      this.pins.get(pinId) ?? {
        voltage: 0,
        digitalLevel: 'LOW',
        currentAmperes: 0,
      }
    );
  }

  public writePinVoltage(pinId: string, voltage: number): void {
    const p = this.getPin(pinId);
    p.voltage = voltage;
    this.pins.set(pinId, p);
  }

  public writePinDigital(pinId: string, state: PinDigitalLevel): void {
    const p = this.getPin(pinId);
    p.digitalLevel = state;
    p.voltage = state === 'HIGH' ? 5.0 : 0.0;
    this.pins.set(pinId, p);
  }

  public scheduleTimer(delayVirtualMicros: number, callbackId: string): void {
    this.scheduledTimers.push({ delayMicros: delayVirtualMicros, callbackId });
  }

  public getEnvironmentValue(property: string): any {
    return this.environment.get(property);
  }

  public emitFailure(type: ComponentFaultType, message: string): void {
    this.failures.push({ type, message });
  }

  public setVisualState(statePayload: Record<string, any>): void {
    this.lastVisualState = { ...this.lastVisualState, ...statePayload };
  }
}

test('Manifestos: Todos os 7 componentes basicos sao validos e exportados', () => {
  const manifests = getAllComponentManifests();
  assert.equal(manifests.length, 7);

  const expectedIds = [
    'resistor',
    'actuator_led',
    'pushbutton',
    'potentiometer',
    'actuator_buzzer',
    'sensor_ultrasonic',
    'BOARD_BREADBOARD_HALF',
  ];

  for (const id of expectedIds) {
    const bundle = getComponentBundle(id);
    assert.ok(bundle, `Bundle "${id}" deve existir`);
    assert.equal(bundle.manifest.id, id);
    assert.ok(bundle.manifest.dimensions.width > 0);
    assert.ok(bundle.manifest.dimensions.height > 0);
    assert.ok(bundle.manifest.pins.length >= 2);
    assert.ok(bundle.manifest.visualStates.length >= 2);

    // Validar limites dos pinos (dentro da bounding box)
    for (const pin of bundle.manifest.pins) {
      assert.ok(
        pin.anchorPosition.x >= 0 &&
          pin.anchorPosition.x <= bundle.manifest.dimensions.width,
        `Pino ${pin.id} x fora dos limites`
      );
      assert.ok(
        pin.anchorPosition.y >= 0 &&
          pin.anchorPosition.y <= bundle.manifest.dimensions.height,
        `Pino ${pin.id} y fora dos limites`
      );
    }
  }

  const bbBundle = getComponentBundle('BOARD_BREADBOARD_HALF');
  assert.ok(bbBundle);
  assert.equal(bbBundle.manifest.pins.length, 420);
});

test('Protoboard: Inicializacao passiva e conservacao de estado visual', () => {
  const ctx = new MockComponentContext();
  const bb = new BreadboardLogic();
  bb.onInit(ctx);

  assert.equal(ctx.lastVisualState.state, 'default');
  bb.onPinChange('TOP_PLUS_1', ctx);
  assert.equal(ctx.lastVisualState.state, 'default');
});

test('Resistor: Fisica de corrente e queda de tensao', () => {
  const ctx = new MockComponentContext();
  const resistor = new ResistorLogic({ resistanceOhms: 220 });
  resistor.onInit(ctx);

  assert.equal(ctx.lastVisualState.state, 'default');

  // Aplicar 5V no PIN_1 e 0V no PIN_2
  ctx.pins.set('PIN_1', { voltage: 5.0, digitalLevel: 'HIGH', currentAmperes: 0.0227 });
  ctx.pins.set('PIN_2', { voltage: 0.0, digitalLevel: 'LOW', currentAmperes: 0.0227 });

  resistor.onPinChange('PIN_1', ctx);

  assert.equal(ctx.lastVisualState.state, 'active');
  assert.ok(Math.abs(ctx.lastVisualState.currentAmperes - 0.0227) < 1e-3);
  assert.equal(ctx.lastVisualState.voltageDrop, 5.0);
});

test('LED: Conducao normal e disparo de sobrecorrente termica', () => {
  const ctx = new MockComponentContext();
  const led = new LedLogic({ color: 'RED', forwardVoltageVolts: 1.8, maxCurrentAmperes: 0.03 });
  led.onInit(ctx);

  assert.equal(ctx.lastVisualState.state, 'default');

  // 1. Condução normal em 14.5mA
  ctx.pins.set('ANODE', { voltage: 5.0, digitalLevel: 'HIGH', currentAmperes: 0.0145 });
  ctx.pins.set('CATHODE', { voltage: 3.2, digitalLevel: 'LOW', currentAmperes: 0.0145 });
  led.onPinChange('ANODE', ctx);

  assert.equal(ctx.lastVisualState.state, 'active');
  assert.equal(ctx.failures.length, 0);

  // 2. Sobrecorrente de 50mA (> 30mA)
  ctx.pins.set('ANODE', { voltage: 5.0, digitalLevel: 'HIGH', currentAmperes: 0.050 });
  ctx.pins.set('CATHODE', { voltage: 0.0, digitalLevel: 'LOW', currentAmperes: 0.050 });
  led.onPinChange('ANODE', ctx);

  assert.equal(ctx.scheduledTimers.length, 1);
  assert.equal(ctx.scheduledTimers[0].delayMicros, 10000); // 10ms
  assert.equal(ctx.scheduledTimers[0].callbackId, 'THERMAL_OVERLOAD');

  // 3. Fogo no LED quando timer dispara
  led.onTimerFired('THERMAL_OVERLOAD', ctx);
  assert.equal(ctx.failures.length, 1);
  assert.equal(ctx.failures[0].type, 'OVERCURRENT');
  assert.equal(ctx.lastVisualState.state, 'failure');
});

test('Pushbutton: Interacao e comutacao condutiva', () => {
  const ctx = new MockComponentContext();
  const button = new PushbuttonLogic();
  button.onInit(ctx);

  assert.equal(ctx.lastVisualState.isPressed, false);
  assert.equal(ctx.lastVisualState.state, 'default');

  // Simular clique (press)
  button.onEnvironmentChange('isPressed', true, ctx);
  assert.equal(ctx.lastVisualState.isPressed, true);
  assert.equal(ctx.lastVisualState.state, 'active');

  // Simular soltura (release)
  button.onEnvironmentChange('isPressed', false, ctx);
  assert.equal(ctx.lastVisualState.isPressed, false);
  assert.equal(ctx.lastVisualState.state, 'default');
});

test('Potenciometro: Divisao de tensao proporcional a alpha', () => {
  const ctx = new MockComponentContext();
  const pot = new PotentiometerLogic({ totalResistanceOhms: 10000, alpha: 0.5 });

  ctx.pins.set('TERMINAL_1', { voltage: 0.0, digitalLevel: 'LOW', currentAmperes: 0 });
  ctx.pins.set('TERMINAL_2', { voltage: 5.0, digitalLevel: 'HIGH', currentAmperes: 0 });
  pot.onInit(ctx);

  // Alpha = 0.5 -> Wiper = 2.5V
  assert.equal(ctx.pins.get('WIPER')?.voltage, 2.5);
  assert.equal(ctx.lastVisualState.alpha, 0.5);

  // Mudar alpha para 0.8 -> Wiper = 4.0V
  pot.onEnvironmentChange('alpha', 0.8, ctx);
  assert.equal(ctx.pins.get('WIPER')?.voltage, 4.0);
  assert.equal(ctx.lastVisualState.alpha, 0.8);
});

test('Buzzer: Emissao sonora a partir de 3.0V', () => {
  const ctx = new MockComponentContext();
  const buzzer = new BuzzerLogic();
  buzzer.onInit(ctx);

  assert.equal(ctx.lastVisualState.isBeeping, false);

  // Abaixo de 3V (ex: 2.5V) -> Nao apita
  ctx.pins.set('VCC', { voltage: 2.5, digitalLevel: 'HIGH', currentAmperes: 0 });
  ctx.pins.set('GND', { voltage: 0.0, digitalLevel: 'LOW', currentAmperes: 0 });
  buzzer.onPinChange('VCC', ctx);
  assert.equal(ctx.lastVisualState.isBeeping, false);

  // 5V -> Apita com 2500Hz
  ctx.pins.set('VCC', { voltage: 5.0, digitalLevel: 'HIGH', currentAmperes: 0 });
  buzzer.onPinChange('VCC', ctx);
  assert.equal(ctx.lastVisualState.isBeeping, true);
  assert.equal(ctx.lastVisualState.frequencyHz, 2500);
});

test('TC-CORE-05: Sensor Ultrassonico HC-SR04 emite pulso proporcional de 1160us a 20cm', () => {
  const ctx = new MockComponentContext();
  const sonar = new UltrasonicSensorLogic();
  sonar.onInit(ctx);

  // Configurar obstaculo a 20.0cm no ambiente
  ctx.environment.set('obstacles', [{ id: 'wall_01', distanceCm: 20.0 }]);

  // Pino TRIG recebe pulso HIGH
  ctx.pins.set('TRIG', { voltage: 5.0, digitalLevel: 'HIGH', currentAmperes: 0 });
  sonar.onPinChange('TRIG', ctx);

  // ECHO deve ir para HIGH imediatamente
  assert.equal(ctx.pins.get('ECHO')?.digitalLevel, 'HIGH');
  assert.equal(ctx.lastVisualState.state, 'active');
  assert.equal(ctx.lastVisualState.distanceCm, 20.0);

  // Timer agendado deve ser 20 * 58us = 1160us
  assert.equal(ctx.scheduledTimers.length, 1);
  assert.equal(ctx.scheduledTimers[0].delayMicros, 1160);
  assert.equal(ctx.scheduledTimers[0].callbackId, 'ECHO_FALLING_EDGE');

  // Disparo do timer encerra o pulso ECHO (volta para LOW)
  sonar.onTimerFired('ECHO_FALLING_EDGE', ctx);
  assert.equal(ctx.pins.get('ECHO')?.digitalLevel, 'LOW');
  assert.equal(ctx.lastVisualState.state, 'default');
});
