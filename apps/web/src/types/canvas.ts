import type {
  Position2D,
  ComponentDefinition,
  WireDefinition,
  WireColor,
  WireWaypoint,
  WorkbenchMode,
  WorkbenchFaultPayload
} from '@webboard/contracts';

export interface ViewportState {
  scale: number;
  offset: Position2D;
}

export type CanvasTool = 'SELECT' | 'PAN' | 'WIRE' | 'DELETE';

export interface PinConnectionTarget {
  componentId: string;
  pinId: string;
  pinLabel: string;
  screenPosition: Position2D;
}

export interface DraggingWireState {
  fromComponentId: string;
  fromPinId: string;
  fromPoint: Position2D;
  currentPoint: Position2D;
  waypoints: WireWaypoint[];
  color: WireColor;
}

export interface WorkbenchCircuitState {
  components: ComponentDefinition[];
  wires: WireDefinition[];
  selectedComponentId: string | null;
  selectedWireId: string | null;
  mode: WorkbenchMode;
  fault: WorkbenchFaultPayload | null;
  activeWireColor: WireColor;
  hoveredNetId: string | null;
}
