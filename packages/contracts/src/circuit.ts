export interface Position2D {
  x: number;
  y: number;
}

export interface WirePinReference {
  componentId: string;
  pinId: string;
}

export interface WireWaypoint {
  x: number;
  y: number;
}

export type WireColor =
  | 'RED'
  | 'BLACK'
  | 'GREEN'
  | 'BLUE'
  | 'YELLOW'
  | 'WHITE'
  | 'ORANGE'
  | string;

export interface WireDefinition {
  id: string;
  from: WirePinReference;
  to: WirePinReference;
  color: WireColor;
  waypoints?: WireWaypoint[];
}

export interface ComponentDefinition {
  id: string;
  type: string;
  label?: string;
  isLocked: boolean;
  position: Position2D;
  rotation?: number;
  parameters: Record<string, any>;
}

export interface EnvironmentObstacle {
  id: string;
  targetSensorId: string;
  distanceCm: number;
}

export interface EnvironmentDefinition {
  temperatureCelsius?: number;
  ambientLightLux?: number;
  obstacles?: EnvironmentObstacle[];
}

export interface CircuitDefinition {
  schemaVersion: string;
  circuitId: string;
  environment?: EnvironmentDefinition;
  components: ComponentDefinition[];
  wires: WireDefinition[];
}
