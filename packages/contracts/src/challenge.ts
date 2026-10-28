import type { ComponentDefinition, WireDefinition } from './circuit.js';

export type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type ProgrammingLanguage = 'CPP' | 'PYTHON';

export type KitPolicyMode = 'OPEN' | 'RESTRICTED_BOM';

export interface AllowedComponent {
  type: string;
  maxQuantity: number;
}

export interface KitPolicy {
  mode: KitPolicyMode;
  allowedComponents: AllowedComponent[];
}

export interface InitialCircuit {
  components: ComponentDefinition[];
  wires: WireDefinition[];
}

export type StaticAssertionType =
  | 'COMPONENT_COUNT'
  | 'SERIES_PROTECTION_RESISTOR'
  | 'NET_CONNECTIVITY'
  | string;

export interface StaticAssertion {
  type: StaticAssertionType;
  componentType?: string;
  expectedExactCount?: number;
  minCount?: number;
  maxCount?: number;
  targetComponentType?: string;
  minResistanceOhms?: number;
  maxResistanceOhms?: number;
  fromPin?: { componentId?: string; componentType?: string; pinId: string };
  toPin?: { componentId?: string; componentType?: string; pinId: string };
  [key: string]: any;
}

export type StimulusAction =
  | 'SET_DISTANCE'
  | 'SET_LUX'
  | 'PRESS_BUTTON'
  | 'RELEASE_BUTTON'
  | 'SET_POTENTIOMETER'
  | string;

export interface Stimulus {
  atVirtualSecond: number;
  target: string;
  action: StimulusAction;
  value?: any;
}

export type DynamicAssertionType =
  | 'PIN_PULSE_FREQUENCY'
  | 'PIN_STEADY_STATE'
  | 'PIN_VOLTAGE_RANGE'
  | string;

export interface TargetPinReference {
  componentType?: string;
  componentId?: string;
  pinId: string;
}

export interface TimeWindow {
  start: number;
  end: number;
}

export interface DynamicAssertion {
  type: DynamicAssertionType;
  targetPin: TargetPinReference;
  duringVirtualSeconds: TimeWindow;
  expectedMinFrequencyHz?: number;
  expectedMaxFrequencyHz?: number;
  expectedLevel?: 'HIGH' | 'LOW';
  minVoltage?: number;
  maxVoltage?: number;
  toleranceSeconds?: number;
  [key: string]: any;
}

export interface TestCaseDefinition {
  id: string;
  name: string;
  isPublic: boolean;
  timeoutVirtualSeconds: number;
  staticAssertions: StaticAssertion[];
  stimuli: Stimulus[];
  dynamicAssertions: DynamicAssertion[];
}

export interface ChallengeDefinition {
  schemaVersion: string;
  challengeId: string;
  title: string;
  description?: string;
  difficulty: DifficultyLevel;
  allowedLanguages: ProgrammingLanguage[];
  kitPolicy: KitPolicy;
  initialCircuit: InitialCircuit;
  testSuite: TestCaseDefinition[];
}
