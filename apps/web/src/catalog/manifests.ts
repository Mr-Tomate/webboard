import type { ComponentManifest } from '@webboard/contracts';

export const COMPONENT_CATALOG: Record<string, ComponentManifest> = {
  MICROCONTROLLER_ARDUINO_UNO: {
    id: 'MICROCONTROLLER_ARDUINO_UNO',
    name: 'Arduino Uno R3',
    category: 'MCU',
    dimensions: { width: 220, height: 160 },
    pins: [
      // Pinos de alimentação inferiores
      { id: '3V3', label: '3.3V', type: 'POWER_VCC', anchorPosition: { x: 40, y: 150 } },
      { id: '5V', label: '5V', type: 'POWER_VCC', anchorPosition: { x: 60, y: 150 } },
      { id: 'GND_1', label: 'GND', type: 'POWER_GND', anchorPosition: { x: 80, y: 150 } },
      { id: 'GND_2', label: 'GND', type: 'POWER_GND', anchorPosition: { x: 100, y: 150 } },
      { id: 'VIN', label: 'VIN', type: 'POWER_VCC', anchorPosition: { x: 120, y: 150 } },

      // Analógicos inferiores
      { id: 'A0', label: 'A0', type: 'ANALOG_IN', anchorPosition: { x: 150, y: 150 } },
      { id: 'A1', label: 'A1', type: 'ANALOG_IN', anchorPosition: { x: 165, y: 150 } },
      { id: 'A2', label: 'A2', type: 'ANALOG_IN', anchorPosition: { x: 180, y: 150 } },
      { id: 'A3', label: 'A3', type: 'ANALOG_IN', anchorPosition: { x: 195, y: 150 } },

      // Digitais superiores
      { id: 'GND_3', label: 'GND', type: 'POWER_GND', anchorPosition: { x: 40, y: 10 } },
      { id: 'D13', label: 'D13', type: 'DIGITAL_IO', anchorPosition: { x: 60, y: 10 } },
      { id: 'D12', label: 'D12', type: 'DIGITAL_IO', anchorPosition: { x: 75, y: 10 } },
      { id: 'D11', label: 'D11', type: 'DIGITAL_IO', anchorPosition: { x: 90, y: 10 } },
      { id: 'D10', label: 'D10', type: 'DIGITAL_IO', anchorPosition: { x: 105, y: 10 } },
      { id: 'D9', label: 'D9', type: 'DIGITAL_IO', anchorPosition: { x: 120, y: 10 } },
      { id: 'D8', label: 'D8', type: 'DIGITAL_IO', anchorPosition: { x: 135, y: 10 } },
      { id: 'D7', label: 'D7', type: 'DIGITAL_IO', anchorPosition: { x: 155, y: 10 } },
      { id: 'D6', label: 'D6', type: 'DIGITAL_IO', anchorPosition: { x: 170, y: 10 } },
      { id: 'D5', label: 'D5', type: 'DIGITAL_IO', anchorPosition: { x: 185, y: 10 } },
      { id: 'D4', label: 'D4', type: 'DIGITAL_IO', anchorPosition: { x: 200, y: 10 } }
    ],
    defaultParameters: {},
    visualStates: ['default']
  },

  ACTUATOR_LED: {
    id: 'ACTUATOR_LED',
    name: 'LED Difuso 5mm',
    category: 'ACTUATOR',
    dimensions: { width: 60, height: 60 },
    pins: [
      { id: 'ANODE', label: 'Ânodo (+)', type: 'PASSIVE', anchorPosition: { x: 20, y: 55 } },
      { id: 'CATHODE', label: 'Cátodo (-)', type: 'PASSIVE', anchorPosition: { x: 40, y: 55 } }
    ],
    defaultParameters: {
      color: 'RED',
      forwardVoltageVolts: 1.8,
      maxCurrentAmperes: 0.03
    },
    visualStates: ['default', 'active', 'burned']
  },

  PASSIVE_RESISTOR: {
    id: 'PASSIVE_RESISTOR',
    name: 'Resistor de Precisão',
    category: 'PASSIVE',
    dimensions: { width: 80, height: 40 },
    pins: [
      { id: 'PIN_1', label: 'Terminal 1', type: 'PASSIVE', anchorPosition: { x: 5, y: 20 } },
      { id: 'PIN_2', label: 'Terminal 2', type: 'PASSIVE', anchorPosition: { x: 75, y: 20 } }
    ],
    defaultParameters: {
      resistanceOhms: 220,
      tolerancePercent: 5,
      powerRatingWatts: 0.25
    },
    visualStates: ['default', 'burned']
  },

  INPUT_PUSHBUTTON: {
    id: 'INPUT_PUSHBUTTON',
    name: 'Botão Táctil (Pushbutton)',
    category: 'INPUT',
    dimensions: { width: 60, height: 60 },
    pins: [
      { id: 'PIN_1', label: 'Terminal A', type: 'PASSIVE', anchorPosition: { x: 10, y: 30 } },
      { id: 'PIN_2', label: 'Terminal B', type: 'PASSIVE', anchorPosition: { x: 50, y: 30 } }
    ],
    defaultParameters: {
      isNormallyOpen: true
    },
    visualStates: ['default', 'pressed']
  },

  INPUT_POTENTIOMETER: {
    id: 'INPUT_POTENTIOMETER',
    name: 'Potenciômetro Rotativo',
    category: 'INPUT',
    dimensions: { width: 80, height: 60 },
    pins: [
      { id: 'VCC', label: 'VCC', type: 'POWER_VCC', anchorPosition: { x: 15, y: 55 } },
      { id: 'SIG', label: 'Sinal (Cursor)', type: 'ANALOG_IN', anchorPosition: { x: 40, y: 55 } },
      { id: 'GND', label: 'GND', type: 'POWER_GND', anchorPosition: { x: 65, y: 55 } }
    ],
    defaultParameters: {
      totalResistanceOhms: 10000,
      currentPositionRatio: 0.5
    },
    visualStates: ['default']
  },

  ACTUATOR_BUZZER: {
    id: 'ACTUATOR_BUZZER',
    name: 'Buzzer Piezoelétrico',
    category: 'ACTUATOR',
    dimensions: { width: 60, height: 60 },
    pins: [
      { id: 'POSITIVE', label: '(+)', type: 'PASSIVE', anchorPosition: { x: 20, y: 55 } },
      { id: 'NEGATIVE', label: '(-)', type: 'POWER_GND', anchorPosition: { x: 40, y: 55 } }
    ],
    defaultParameters: {
      frequencyHz: 2000
    },
    visualStates: ['default', 'beeping']
  },

  SENSOR_ULTRASONIC_HCSR04: {
    id: 'SENSOR_ULTRASONIC_HCSR04',
    name: 'Sensor Ultrassônico HC-SR04',
    category: 'SENSOR',
    dimensions: { width: 120, height: 60 },
    pins: [
      { id: 'VCC', label: 'VCC', type: 'POWER_VCC', anchorPosition: { x: 30, y: 55 } },
      { id: 'TRIG', label: 'Trig', type: 'DIGITAL_IO', anchorPosition: { x: 50, y: 55 } },
      { id: 'ECHO', label: 'Echo', type: 'DIGITAL_IO', anchorPosition: { x: 70, y: 55 } },
      { id: 'GND', label: 'GND', type: 'POWER_GND', anchorPosition: { x: 90, y: 55 } }
    ],
    defaultParameters: {
      simulatedDistanceCm: 25.0
    },
    visualStates: ['default', 'pulsing']
  }
};
