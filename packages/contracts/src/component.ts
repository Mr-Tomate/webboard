import type { Position2D } from './circuit.js';

export type PinType =
  | 'POWER_VCC'
  | 'POWER_GND'
  | 'DIGITAL_IO'
  | 'ANALOG_IN'
  | 'PASSIVE';

export type PinDirection = 'INPUT' | 'OUTPUT' | 'BIDIRECTIONAL';

export type PinDigitalLevel = 'HIGH' | 'LOW' | 'HIGH_Z';

export interface PinState {
  voltage: number;
  digitalLevel: PinDigitalLevel;
  currentAmperes: number;
}

export interface PinDefinition {
  id: string;
  label: string;
  type: PinType;
  direction?: PinDirection;
  anchorPosition?: Position2D;
}

export interface ComponentPinAnchor {
  id: string;
  label: string;
  type: PinType;
  anchorPosition: Position2D;
}

export type ComponentCategory =
  | 'MCU'
  | 'ACTUATOR'
  | 'SENSOR'
  | 'PASSIVE'
  | 'INPUT';

export interface ComponentDimensions {
  width: number;
  height: number;
}

export interface ComponentManifest {
  id: string;
  name: string;
  category: ComponentCategory;
  dimensions: ComponentDimensions;
  pins: ComponentPinAnchor[];
  defaultParameters: Record<string, any>;
  visualStates: string[];
}

export type ComponentFaultType = 'SHORT_CIRCUIT' | 'OVERCURRENT';

export interface ComponentContext {
  getPin(pinId: string): PinState;
  writePinVoltage(pinId: string, voltage: number): void;
  writePinDigital(pinId: string, state: PinDigitalLevel): void;
  scheduleTimer(delayVirtualMicros: number, callbackId: string): void;
  getEnvironmentValue(property: string): any;
  emitFailure(type: ComponentFaultType, message: string): void;
  setVisualState(statePayload: Record<string, any>): void;
}

export interface IComponentLogic {
  onInit(ctx: ComponentContext): void;
  onReset(ctx: ComponentContext): void;
  onPinChange(pinId: string, ctx: ComponentContext): void;
  onEnvironmentChange(property: string, value: any, ctx: ComponentContext): void;
  onTimerFired(callbackId: string, ctx: ComponentContext): void;
}
