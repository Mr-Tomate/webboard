import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  ComponentDefinition,
  WireDefinition,
  WireColor,
  WireWaypoint,
  WorkbenchMode,
  WorkbenchFaultPayload,
  Position2D,
  CircuitDefinition
} from '@webboard/contracts';
import {
  NetlistSolver,
  type NetlistResult,
  CircuitSolver,
  type ComponentElectricalState
} from '@webboard/core';
import { snapPointToGrid } from '../utils/geometry.js';
import { COMPONENT_CATALOG } from '../catalog/manifests.js';
import type { DraggingWireState } from '../types/canvas.js';

export function useWorkbench() {
  const [components, setComponents] = useState<ComponentDefinition[]>([
    {
      id: 'mcu_uno_01',
      type: 'MICROCONTROLLER_ARDUINO_UNO',
      label: 'Arduino Uno R3',
      isLocked: false,
      position: { x: 100, y: 160 },
      parameters: {}
    },
    {
      id: 'res_01',
      type: 'PASSIVE_RESISTOR',
      label: 'Resistor 220Ω',
      isLocked: false,
      position: { x: 380, y: 160 },
      parameters: { resistanceOhms: 220 }
    },
    {
      id: 'led_01',
      type: 'ACTUATOR_LED',
      label: 'LED Vermelho',
      isLocked: false,
      position: { x: 520, y: 160 },
      parameters: { color: 'RED' }
    }
  ]);

  const [wires, setWires] = useState<WireDefinition[]>([
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
  ]);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [activeWireColor, setActiveWireColor] = useState<WireColor>('BLUE');
  const [hoveredNetId, setHoveredNetId] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkbenchMode>('MODO_EDICAO');
  const [fault, setFault] = useState<WorkbenchFaultPayload | null>(null);
  const [draggingWire, setDraggingWire] = useState<DraggingWireState | null>(null);

  // Estados elétricos e visuais calculados pelo CircuitSolver
  const [electricalStates, setElectricalStates] = useState<Map<string, ComponentElectricalState>>(
    new Map()
  );

  const circuitSolverRef = useRef<CircuitSolver | null>(null);

  const circuitDefinition: CircuitDefinition = useMemo(
    () => ({
      schemaVersion: '1.0.0',
      circuitId: 'workbench_active',
      components,
      wires
    }),
    [components, wires]
  );

  const netlistResult: NetlistResult = useMemo(() => {
    return NetlistSolver.solve(circuitDefinition);
  }, [circuitDefinition]);

  const highlightedWireIds = useMemo(() => {
    if (!hoveredNetId) return new Set<string>();
    const net = netlistResult.nets.find((n) => n.id === hoveredNetId);
    return new Set<string>(net ? net.wireIds : []);
  }, [hoveredNetId, netlistResult]);

  const highlightedPinKeys = useMemo(() => {
    if (!hoveredNetId) return new Set<string>();
    const net = netlistResult.nets.find((n) => n.id === hoveredNetId);
    return new Set<string>(net ? net.pins.map((p) => p.pinKey) : []);
  }, [hoveredNetId, netlistResult]);

  const addComponent = useCallback(
    (componentType: string, initialPos: Position2D = { x: 300, y: 200 }) => {
      if (mode !== 'MODO_EDICAO') return;

      const manifest = COMPONENT_CATALOG[componentType];
      if (!manifest) return;

      const id = `${manifest.id.toLowerCase()}_${Date.now().toString(36).slice(-4)}`;
      const snappedPos = snapPointToGrid(initialPos);

      const newComponent: ComponentDefinition = {
        id,
        type: manifest.id,
        label: manifest.name,
        isLocked: false,
        position: snappedPos,
        parameters: { ...manifest.defaultParameters }
      };

      setComponents((prev) => [...prev, newComponent]);
      setSelectedComponentId(id);
    },
    [mode]
  );

  const updateComponentPosition = useCallback(
    (componentId: string, rawPosition: Position2D) => {
      if (mode !== 'MODO_EDICAO') return;

      const snapped = snapPointToGrid(rawPosition);
      setComponents((prev) =>
        prev.map((c) => (c.id === componentId && !c.isLocked ? { ...c, position: snapped } : c))
      );
    },
    [mode]
  );

  const deleteComponent = useCallback(
    (componentId: string) => {
      if (mode !== 'MODO_EDICAO') return;

      setComponents((prev) => prev.filter((c) => c.id !== componentId));
      setWires((prev) =>
        prev.filter(
          (w) => w.from.componentId !== componentId && w.to.componentId !== componentId
        )
      );
      if (selectedComponentId === componentId) setSelectedComponentId(null);
    },
    [mode, selectedComponentId]
  );

  const deleteWire = useCallback(
    (wireId: string) => {
      if (mode !== 'MODO_EDICAO') return;

      setWires((prev) => prev.filter((w) => w.id !== wireId));
      if (selectedWireId === wireId) setSelectedWireId(null);
    },
    [mode, selectedWireId]
  );

  const updateWireColor = useCallback(
    (wireId: string, color: WireColor) => {
      setWires((prev) =>
        prev.map((w) => (w.id === wireId ? { ...w, color } : w))
      );
    },
    []
  );

  const startWireDrag = useCallback(
    (componentId: string, pinId: string, worldPoint: Position2D) => {
      if (mode !== 'MODO_EDICAO') return;

      setDraggingWire({
        fromComponentId: componentId,
        fromPinId: pinId,
        fromPoint: worldPoint,
        currentPoint: worldPoint,
        waypoints: [],
        color: activeWireColor
      });
    },
    [mode, activeWireColor]
  );

  const addWireWaypoint = useCallback(
    (worldPoint: Position2D) => {
      if (!draggingWire) return;
      const snapped = snapPointToGrid(worldPoint);
      setDraggingWire((prev) =>
        prev
          ? {
              ...prev,
              waypoints: [...prev.waypoints, snapped]
            }
          : null
      );
    },
    [draggingWire]
  );

  const updateWireDrag = useCallback((currentPoint: Position2D) => {
    setDraggingWire((prev) => (prev ? { ...prev, currentPoint } : null));
  }, []);

  const finishWireDrag = useCallback(
    (toComponentId: string, toPinId: string) => {
      if (!draggingWire) return;

      // Se soltar ou clicar no mesmo pino de origem, NÃO cancela e NÃO fecha curto consigo mesmo
      // Mantém a criação ativa aguardando o clique no pino de destino
      if (
        draggingWire.fromComponentId === toComponentId &&
        draggingWire.fromPinId === toPinId
      ) {
        return;
      }

      // Evita duplicidade de fios entre o mesmo par de pinos
      const alreadyExists = wires.some(
        (w) =>
          (w.from.componentId === draggingWire.fromComponentId &&
            w.from.pinId === draggingWire.fromPinId &&
            w.to.componentId === toComponentId &&
            w.to.pinId === toPinId) ||
          (w.from.componentId === toComponentId &&
            w.from.pinId === toPinId &&
            w.to.componentId === draggingWire.fromComponentId &&
            w.to.pinId === draggingWire.fromPinId)
      );

      if (alreadyExists) {
        setDraggingWire(null);
        return;
      }

      const wireId = `wire_${Date.now().toString(36).slice(-4)}`;
      const newWire: WireDefinition = {
        id: wireId,
        from: {
          componentId: draggingWire.fromComponentId,
          pinId: draggingWire.fromPinId
        },
        to: {
          componentId: toComponentId,
          pinId: toPinId
        },
        color: draggingWire.color,
        waypoints: draggingWire.waypoints.length > 0 ? draggingWire.waypoints : undefined
      };

      setWires((prev) => [...prev, newWire]);
      setDraggingWire(null);
      setSelectedWireId(wireId);
    },
    [draggingWire, wires]
  );

  const cancelWireDrag = useCallback(() => {
    setDraggingWire(null);
  }, []);

  /**
   * Disparado pelo emulador AVR8js quando um pino do microcontrolador transita de nível.
   * Conecta a CPU ao CircuitSolver e atualiza a física e os estados visuais da bancada.
   */
  const handleEmulatorPinChange = useCallback(
    (pinName: string, level: 'HIGH' | 'LOW') => {
      const solver = circuitSolverRef.current;
      if (!solver) return;

      solver.setPinOutput('mcu_uno_01', pinName, level);
      const stepResult = solver.step(0.001); // avança 1ms virtual

      setElectricalStates(new Map(stepResult.componentStates));

      // Se houver destruição térmica por sobrecorrente (RN-BNC-05) ou curto
      if (stepResult.hasFault && stepResult.fault) {
        setMode('ESTADO_FALHA_ENG');
        setFault(stepResult.fault);
        if (stepResult.fault.failedComponentId) {
          setSelectedComponentId(stepResult.fault.failedComponentId);
        }
      }
    },
    []
  );

  /**
   * Inicia a Simulação.
   */
  const startSimulation = useCallback((): boolean => {
    if (netlistResult.hasFault && netlistResult.fault) {
      setMode('ESTADO_FALHA_ENG');
      setFault(netlistResult.fault);
      if (netlistResult.fault.failedWireId) {
        setSelectedWireId(netlistResult.fault.failedWireId);
      }
      return false;
    }

    // Instancia o solver para a sessão energizada
    const solver = new CircuitSolver(circuitDefinition);
    circuitSolverRef.current = solver;

    const initialResult = solver.step(0.0);
    setElectricalStates(new Map(initialResult.componentStates));

    if (initialResult.hasFault && initialResult.fault) {
      setMode('ESTADO_FALHA_ENG');
      setFault(initialResult.fault);
      return false;
    }

    setMode('MODO_SIMULACAO');
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setFault(null);
    setDraggingWire(null);
    return true;
  }, [netlistResult, circuitDefinition]);

  const stopSimulation = useCallback(() => {
    setMode('MODO_EDICAO');
    setFault(null);
    circuitSolverRef.current = null;
    setElectricalStates(new Map());
  }, []);

  const clearWorkbench = useCallback(() => {
    if (mode !== 'MODO_EDICAO') return;
    setComponents([]);
    setWires([]);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setFault(null);
    setElectricalStates(new Map());
  }, [mode]);

  return {
    components,
    wires,
    selectedComponentId,
    selectedWireId,
    activeWireColor,
    hoveredNetId,
    highlightedWireIds,
    highlightedPinKeys,
    electricalStates,
    netlistResult,
    mode,
    fault,
    draggingWire,
    setSelectedComponentId,
    setSelectedWireId,
    setActiveWireColor,
    setHoveredNetId,
    addComponent,
    updateComponentPosition,
    deleteComponent,
    deleteWire,
    updateWireColor,
    startWireDrag,
    addWireWaypoint,
    updateWireDrag,
    finishWireDrag,
    cancelWireDrag,
    handleEmulatorPinChange,
    startSimulation,
    stopSimulation,
    clearWorkbench
  };
}
