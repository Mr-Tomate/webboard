import type { ComponentManifest, IComponentLogic } from '@webboard/contracts';

import resistorManifest from './resistor/manifest.json' with { type: 'json' };
import ledManifest from './actuator_led/manifest.json' with { type: 'json' };
import pushbuttonManifest from './pushbutton/manifest.json' with { type: 'json' };
import potentiometerManifest from './potentiometer/manifest.json' with { type: 'json' };
import buzzerManifest from './actuator_buzzer/manifest.json' with { type: 'json' };
import ultrasonicManifest from './sensor_ultrasonic/manifest.json' with { type: 'json' };
import breadboardManifest from './board_breadboard/manifest.json' with { type: 'json' };

import { ResistorLogic } from './resistor/logic.js';
import { LedLogic } from './actuator_led/logic.js';
import { PushbuttonLogic } from './pushbutton/logic.js';
import { PotentiometerLogic } from './potentiometer/logic.js';
import { BuzzerLogic } from './actuator_buzzer/logic.js';
import { UltrasonicSensorLogic } from './sensor_ultrasonic/logic.js';
import { BreadboardLogic } from './board_breadboard/logic.js';

export {
  ResistorLogic,
  LedLogic,
  PushbuttonLogic,
  PotentiometerLogic,
  BuzzerLogic,
  UltrasonicSensorLogic,
  BreadboardLogic,
};

export interface ComponentBundle {
  manifest: ComponentManifest;
  createLogic: (parameters?: Record<string, any>) => IComponentLogic;
}

export const COMPONENT_CATALOG: Record<string, ComponentBundle> = {
  resistor: {
    manifest: resistorManifest as ComponentManifest,
    createLogic: (params) => new ResistorLogic(params),
  },
  PASSIVE_RESISTOR: {
    manifest: resistorManifest as ComponentManifest,
    createLogic: (params) => new ResistorLogic(params),
  },
  actuator_led: {
    manifest: ledManifest as ComponentManifest,
    createLogic: (params) => new LedLogic(params),
  },
  ACTUATOR_LED: {
    manifest: ledManifest as ComponentManifest,
    createLogic: (params) => new LedLogic(params),
  },
  pushbutton: {
    manifest: pushbuttonManifest as ComponentManifest,
    createLogic: (params) => new PushbuttonLogic(params),
  },
  INPUT_PUSHBUTTON: {
    manifest: pushbuttonManifest as ComponentManifest,
    createLogic: (params) => new PushbuttonLogic(params),
  },
  potentiometer: {
    manifest: potentiometerManifest as ComponentManifest,
    createLogic: (params) => new PotentiometerLogic(params),
  },
  INPUT_POTENTIOMETER: {
    manifest: potentiometerManifest as ComponentManifest,
    createLogic: (params) => new PotentiometerLogic(params),
  },
  actuator_buzzer: {
    manifest: buzzerManifest as ComponentManifest,
    createLogic: (params) => new BuzzerLogic(params),
  },
  ACTUATOR_BUZZER: {
    manifest: buzzerManifest as ComponentManifest,
    createLogic: (params) => new BuzzerLogic(params),
  },
  sensor_ultrasonic: {
    manifest: ultrasonicManifest as ComponentManifest,
    createLogic: (params) => new UltrasonicSensorLogic(params),
  },
  SENSOR_ULTRASONIC_HCSR04: {
    manifest: ultrasonicManifest as ComponentManifest,
    createLogic: (params) => new UltrasonicSensorLogic(params),
  },
  board_breadboard: {
    manifest: breadboardManifest as ComponentManifest,
    createLogic: (params) => new BreadboardLogic(params),
  },
  BOARD_BREADBOARD_HALF: {
    manifest: breadboardManifest as ComponentManifest,
    createLogic: (params) => new BreadboardLogic(params),
  },
  BOARD_BREADBOARD: {
    manifest: breadboardManifest as ComponentManifest,
    createLogic: (params) => new BreadboardLogic(params),
  },
};

export function getComponentBundle(type: string): ComponentBundle | undefined {
  return COMPONENT_CATALOG[type];
}

export function getAllComponentManifests(): ComponentManifest[] {
  return [
    resistorManifest as ComponentManifest,
    ledManifest as ComponentManifest,
    pushbuttonManifest as ComponentManifest,
    potentiometerManifest as ComponentManifest,
    buzzerManifest as ComponentManifest,
    ultrasonicManifest as ComponentManifest,
    breadboardManifest as ComponentManifest,
  ];
}
