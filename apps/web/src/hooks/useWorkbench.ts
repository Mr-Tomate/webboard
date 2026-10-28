import { useState, useCallback, useMemo } from 'react';
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
import { NetlistSolver, type NetlistResult, type NetNode } from '@webboard/core';
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
      position: { x: 500, y: 160 },
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

  /**
   * Resolução reativa do grafo elétrico em Nós Equipotenciais (NetNodes)
   * através do NetlistSolver do @webboard/core.
   */
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

  /**
   * Retorna os IDs dos fios pertencentes à Net destacada.
   */
  const highlightedWireIds = useMemo(() => {
    if (!hoveredNetId) return new Set<string>();
    const net = netlistResult.nets.find((n) => n.id === hoveredNetId);
    return new Set<string>(net ? net.wireIds : []);
  }, [hoveredNetId, netlistResult]);

  /**
   * Retorna as chaves `componentId:pinId` pertencentes à Net destacada.
   */
  const highlightedPinKeys = useMemo(() => {
    if (!hoveredNetId) return new Set<string>();
    const net = netlistResult.nets.find((n) => n.id === hoveredNetId);
    return new Set<string>(net ? net.pins.map((p) => p.pinKey) : []);
  }, [hoveredNetId, netlistResult]);

  /**
   * Adiciona um novo componente na bancada com alinhamento na grade.
   */
  const addComponent = useCallback(
    (componentType: string, initialPos: Position2D = { x: 300, y: 200 }) => {
      if (mode !== 'MODO_EDICAO') {
        console.warn('[RN-BNC-01] Adição bloqueada: Bancada em simulação.');
        return;
      }

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

  /**
   * Atualiza a posição de um componente no Canvas aplicando snap à grade.
   */
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

  /**
   * Remove componente e seus condutores conectados.
   */
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

  /**
   * Remove um fio selecionado.
   */
  const deleteWire = useCallback(
    (wireId: string) => {
      if (mode !== 'MODO_EDICAO') return;

      setWires((prev) => prev.filter((w) => w.id !== wireId));
      if (selectedWireId === wireId) setSelectedWireId(null);
    },
    [mode, selectedWireId]
  );

  /**
   * Altera a cor de um condutor existente.
   */
  const updateWireColor = useCallback(
    (wireId: string, color: WireColor) => {
      setWires((prev) =>
        prev.map((w) => (w.id === wireId ? { ...w, color } : w))
      );
    },
    []
  );

  /**
   * Inicia o arraste de um novo fio a partir de um pino.
   */
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

  /**
   * Adiciona um waypoint intermediário durante a rota do fio elástico.
   */
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

  /**
   * Atualiza o cursor do fio elástico em tempo real.
   */
  const updateWireDrag = useCallback((currentPoint: Position2D) => {
    setDraggingWire((prev) => (prev ? { ...prev, currentPoint } : null));
  }, []);

  /**
   * Conclui a fiação ligando ao pino de destino.
   */
  const finishWireDrag = useCallback(
    (toComponentId: string, toPinId: string) => {
      if (!draggingWire) return;

      // 1. Proibido ligar o pino nele mesmo
      if (
        draggingWire.fromComponentId === toComponentId &&
        draggingWire.fromPinId === toPinId
      ) {
        setDraggingWire(null);
        return;
      }

      // 2. Proibido duplicar conexão existente entre os mesmos pinos
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
   * Inicia a Simulação com Verificação Rigorosa de Curto-Circuito (RN-BNC-04).
   */
  const startSimulation = useCallback(() => {
    // Valida curto-circuito antes de energizar
    if (netlistResult.hasFault && netlistResult.fault) {
      setMode('ESTADO_FALHA_ENG');
      setFault(netlistResult.fault);
      if (netlistResult.fault.failedWireId) {
        setSelectedWireId(netlistResult.fault.failedWireId);
      }
      return;
    }

    setMode('MODO_SIMULACAO');
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setFault(null);
    setDraggingWire(null);
  }, [netlistResult]);

  const stopSimulation = useCallback(() => {
    setMode('MODO_EDICAO');
    setFault(null);
  }, []);

  const clearWorkbench = useCallback(() => {
    if (mode !== 'MODO_EDICAO') return;
    setComponents([]);
    setWires([]);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setFault(null);
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
    startSimulation,
    stopSimulation,
    clearWorkbench
  };
}
