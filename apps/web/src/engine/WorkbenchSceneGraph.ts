import type {
  ComponentDefinition,
  WireDefinition,
  WireColor,
  WireWaypoint,
  Position2D,
  CircuitDefinition
} from '@webboard/contracts';
import { NetlistSolver, type NetlistResult } from '@webboard/core';
import { snapPointToGrid } from '../utils/geometry.ts';
import { COMPONENT_CATALOG } from '../catalog/manifests.ts';
import type { DraggingWireState } from '../types/canvas.ts';
import type { CircuitMutationAction } from '../types/telemetry.ts';

export type SceneGraphListener = () => void;

/**
 * WorkbenchSceneGraph - Grafo de Cena Puro da Bancada Virtual.
 *
 * Gerencia o estado espacial, topológico e relacional dos componentes e condutores.
 * Não possui acoplamento com o React, permitindo operações puras a 60 FPS,
 * snapping magnético de 20px e sincronização via padrão Observer.
 *
 * Conforme: docs/spec/12_arquitetura_de_renderizacao_e_workbench_engine.md
 */
export class WorkbenchSceneGraph {
  private components: ComponentDefinition[] = [];
  private wires: WireDefinition[] = [];

  private selectedComponentId: string | null = null;
  private selectedWireId: string | null = null;
  private activeWireColor: WireColor = 'GREEN';
  private hoveredNetId: string | null = null;

  private draggingWire: DraggingWireState | null = null;
  private cachedNetlist: NetlistResult | null = null;
  private listeners: Set<SceneGraphListener> = new Set();

  constructor() {
    this.initDefaultCircuit();
  }

  /**
   * Circuito canônico inicial pedagógico (Arduino Uno + Resistor 220R + LED Vermelho)
   */
  public initDefaultCircuit(): void {
    this.components = [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        label: 'Arduino Uno R3',
        isLocked: false,
        position: { x: 100, y: 150 },
        parameters: {}
      },
      {
        id: 'res_01',
        type: 'PASSIVE_RESISTOR',
        label: 'R1 (220Ω)',
        isLocked: false,
        position: { x: 500, y: 150 },
        parameters: { resistanceOhms: 220 }
      },
      {
        id: 'led_01',
        type: 'OUTPUT_LED',
        label: 'LED1',
        isLocked: false,
        position: { x: 650, y: 150 },
        parameters: { color: 'RED' }
      }
    ];

    this.wires = [
      {
        id: 'wire_01',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'res_01', pinId: 'PIN_1' },
        color: 'GREEN'
      },
      {
        id: 'wire_02',
        from: { componentId: 'res_01', pinId: 'PIN_2' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED'
      },
      {
        id: 'wire_03',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_3' },
        color: 'BLACK'
      }
    ];

    this.invalidateNetlist();
  }

  public loadFromCircuit(circuit: CircuitDefinition): void {
    this.components = circuit.components.map((c) => ({ ...c }));
    this.wires = circuit.wires.map((w) => ({ ...w }));
    this.selectedComponentId = null;
    this.selectedWireId = null;
    this.draggingWire = null;
    this.hoveredNetId = null;
    this.invalidateNetlist();
    this.emitChange();
  }

  public toCircuitDefinition(): CircuitDefinition {
    return {
      schemaVersion: '1.0.0',
      circuitId: 'workbench_active',
      components: this.components.map((c) => ({ ...c })),
      wires: this.wires.map((w) => ({ ...w }))
    };
  }

  public getComponents(): readonly ComponentDefinition[] {
    return this.components;
  }

  public getComponent(id: string): ComponentDefinition | undefined {
    return this.components.find((c) => c.id === id);
  }

  public getWires(): readonly WireDefinition[] {
    return this.wires;
  }

  public getWire(id: string): WireDefinition | undefined {
    return this.wires.find((w) => w.id === id);
  }

  public getSelectedComponentId(): string | null {
    return this.selectedComponentId;
  }

  public getSelectedWireId(): string | null {
    return this.selectedWireId;
  }

  public getActiveWireColor(): WireColor {
    return this.activeWireColor;
  }

  public setActiveWireColor(color: WireColor): void {
    this.activeWireColor = color;
    this.emitChange();
  }

  public getDraggingWire(): DraggingWireState | null {
    return this.draggingWire;
  }

  public getHoveredNetId(): string | null {
    return this.hoveredNetId;
  }

  public getNetlist(): NetlistResult {
    if (!this.cachedNetlist) {
      this.cachedNetlist = NetlistSolver.solve(this.toCircuitDefinition());
    }
    return this.cachedNetlist;
  }

  public getHighlightedWireIds(): Set<string> {
    if (!this.hoveredNetId) return new Set();
    const net = this.getNetlist().nets.find((n) => n.id === this.hoveredNetId);
    return new Set(net ? net.wireIds : []);
  }

  public getHighlightedPinKeys(): Set<string> {
    if (!this.hoveredNetId) return new Set();
    const net = this.getNetlist().nets.find((n) => n.id === this.hoveredNetId);
    return new Set(net ? net.pins.map((p) => p.pinKey) : []);
  }

  // --- Mutação de Peças ---

  public addComponent(type: string, position: Position2D = { x: 300, y: 200 }): ComponentDefinition | null {
    const manifest = COMPONENT_CATALOG[type];
    if (!manifest) return null;

    const id = `${manifest.id.toLowerCase()}_${Date.now().toString(36).slice(-4)}`;
    const snappedPos = snapPointToGrid(position);

    const newComponent: ComponentDefinition = {
      id,
      type: manifest.id,
      label: manifest.name,
      isLocked: false,
      position: snappedPos,
      parameters: { ...manifest.defaultParameters }
    };

    this.components.push(newComponent);
    this.selectedComponentId = id;
    this.invalidateNetlist();
    this.emitChange();
    return newComponent;
  }

  public updateComponentPosition(componentId: string, position: Position2D, snap: boolean = true): void {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp || comp.isLocked) return;

    comp.position = snap ? snapPointToGrid(position) : { ...position };
    this.emitChange();
  }

  public updateComponentParameters(componentId: string, parameters: Record<string, any>): void {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    comp.parameters = { ...comp.parameters, ...parameters };
    this.invalidateNetlist();
    this.emitChange();
  }

  public updateComponentLabel(componentId: string, label: string): void {
    const comp = this.components.find((c) => c.id === componentId);
    if (!comp) return;

    comp.label = label;
    this.emitChange();
  }

  public removeComponent(componentId: string): void {
    this.components = this.components.filter((c) => c.id !== componentId);
    this.wires = this.wires.filter(
      (w) => w.from.componentId !== componentId && w.to.componentId !== componentId
    );

    if (this.selectedComponentId === componentId) {
      this.selectedComponentId = null;
    }
    this.invalidateNetlist();
    this.emitChange();
  }

  public selectComponent(id: string | null): void {
    if (this.selectedComponentId !== id) {
      this.selectedComponentId = id;
      if (id !== null) this.selectedWireId = null;
      this.emitChange();
    }
  }

  // --- Mutação de Condutores (Wires) ---

  public removeWire(wireId: string): void {
    this.wires = this.wires.filter((w) => w.id !== wireId);
    if (this.selectedWireId === wireId) {
      this.selectedWireId = null;
    }
    this.invalidateNetlist();
    this.emitChange();
  }

  public updateWireColor(wireId: string, color: WireColor): void {
    const wire = this.wires.find((w) => w.id === wireId);
    if (wire) {
      wire.color = color;
      this.emitChange();
    }
  }

  public selectWire(wireId: string | null): void {
    if (this.selectedWireId !== wireId) {
      this.selectedWireId = wireId;
      if (wireId !== null) this.selectedComponentId = null;
      this.emitChange();
    }
  }

  // --- Fluxo de Conexão de Fio (Interação com o Mouse) ---

  public startWireDrag(
    componentId: string,
    pinId: string,
    startWorldPos: Position2D,
    color?: WireColor
  ): void {
    this.draggingWire = {
      fromComponentId: componentId,
      fromPinId: pinId,
      fromPoint: startWorldPos,
      currentPoint: startWorldPos,
      waypoints: [],
      color: color ?? this.activeWireColor
    };
    this.emitChange();
  }

  public updateWireDrag(currentPoint: Position2D): void {
    if (!this.draggingWire) return;
    this.draggingWire.currentPoint = currentPoint;
    this.emitChange();
  }

  public addWireWaypoint(point: Position2D): void {
    if (!this.draggingWire) return;
    const snapped = snapPointToGrid(point);
    this.draggingWire.waypoints.push(snapped);
    this.emitChange();
  }

  public finishWireDrag(toComponentId: string, toPinId: string): WireDefinition | null {
    if (!this.draggingWire) return null;

    if (
      this.draggingWire.fromComponentId === toComponentId &&
      this.draggingWire.fromPinId === toPinId
    ) {
      return null;
    }

    const fromComp = this.draggingWire.fromComponentId;
    const fromPin = this.draggingWire.fromPinId;
    const alreadyExists = this.wires.some(
      (w) =>
        (w.from.componentId === fromComp &&
          w.from.pinId === fromPin &&
          w.to.componentId === toComponentId &&
          w.to.pinId === toPinId) ||
        (w.from.componentId === toComponentId &&
          w.from.pinId === toPinId &&
          w.to.componentId === fromComp &&
          w.to.pinId === fromPin)
    );

    if (alreadyExists) {
      this.draggingWire = null;
      this.emitChange();
      return null;
    }

    const wireId = `wire_${Date.now().toString(36).slice(-4)}`;
    const newWire: WireDefinition = {
      id: wireId,
      from: {
        componentId: fromComp,
        pinId: fromPin
      },
      to: {
        componentId: toComponentId,
        pinId: toPinId
      },
      color: this.draggingWire.color,
      waypoints: this.draggingWire.waypoints.length > 0 ? [...this.draggingWire.waypoints] : undefined
    };

    this.wires.push(newWire);
    this.draggingWire = null;
    this.selectedWireId = wireId;
    this.invalidateNetlist();
    this.emitChange();
    return newWire;
  }

  public cancelWireDrag(): void {
    if (this.draggingWire) {
      this.draggingWire = null;
      this.emitChange();
    }
  }

  public setHoveredNetId(netId: string | null): void {
    if (this.hoveredNetId !== netId) {
      this.hoveredNetId = netId;
      this.emitChange();
    }
  }

  public clear(): void {
    this.components = [];
    this.wires = [];
    this.selectedComponentId = null;
    this.selectedWireId = null;
    this.draggingWire = null;
    this.hoveredNetId = null;
    this.invalidateNetlist();
    this.emitChange();
  }

  // --- Sincronização de Mutações Remotas (Eixo D) ---

  public applyRemoteMutation(action: CircuitMutationAction, data: any): void {
    switch (action) {
      case 'ADD_COMPONENT': {
        if (!data || !data.id) return;
        const exists = this.components.some((c) => c.id === data.id);
        if (!exists) {
          const comp: ComponentDefinition = {
            id: data.id,
            type: data.type,
            label: data.label || data.name || data.type,
            isLocked: !!data.isLocked,
            position: data.position || { x: 300, y: 200 },
            parameters: data.parameters || {}
          };
          this.components.push(comp);
          this.invalidateNetlist();
          this.emitChange();
        }
        break;
      }
      case 'UPDATE_COMPONENT': {
        if (!data || !data.id) return;
        const comp = this.components.find((c) => c.id === data.id);
        if (comp) {
          if (data.position) comp.position = { ...data.position };
          if (data.parameters) comp.parameters = { ...comp.parameters, ...data.parameters };
          if (data.label !== undefined) comp.label = data.label;
          this.invalidateNetlist();
          this.emitChange();
        }
        break;
      }
      case 'REMOVE_COMPONENT': {
        const id = typeof data === 'string' ? data : data?.id;
        if (id) {
          this.removeComponent(id);
        }
        break;
      }
      case 'ADD_WIRE': {
        if (!data || !data.id) return;
        const exists = this.wires.some((w) => w.id === data.id);
        if (!exists) {
          this.wires.push(data);
          this.invalidateNetlist();
          this.emitChange();
        }
        break;
      }
      case 'REMOVE_WIRE': {
        const id = typeof data === 'string' ? data : data?.id;
        if (id) {
          this.removeWire(id);
        }
        break;
      }
    }
  }

  private invalidateNetlist(): void {
    this.cachedNetlist = null;
  }

  // --- Sistema de Inscrição Observer ---

  public subscribe(listener: SceneGraphListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
