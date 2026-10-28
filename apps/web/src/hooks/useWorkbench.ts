import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type {
  ComponentDefinition,
  WireDefinition,
  WireColor,
  WorkbenchMode,
  WorkbenchFaultPayload,
  Position2D,
  CircuitDefinition
} from '@webboard/contracts';
import type { ComponentElectricalState, NetlistResult } from '@webboard/core';
import { WorkbenchEngine } from '../engine/WorkbenchEngine.ts';
import { WorkbenchSceneGraph } from '../engine/WorkbenchSceneGraph.ts';
import type { DraggingWireState } from '../types/canvas.ts';

/**
 * useWorkbench - Hook Adaptador Reativo para o WorkbenchEngine e WorkbenchSceneGraph.
 *
 * Conecta o motor headless desacoplado (WorkbenchEngine) e o grafo de cena puro
 * (WorkbenchSceneGraph) à interface React, isolando os ciclos de clock da renderização.
 *
 * Conforme: docs/spec/12_arquitetura_de_renderizacao_e_workbench_engine.md
 */
export function useWorkbench() {
  const sceneGraphRef = useRef<WorkbenchSceneGraph | null>(null);
  if (!sceneGraphRef.current) {
    sceneGraphRef.current = new WorkbenchSceneGraph();
  }
  const sceneGraph = sceneGraphRef.current;

  const engineRef = useRef<WorkbenchEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new WorkbenchEngine({ autoLoop: true, batchIntervalMs: 10 });
  }
  const engine = engineRef.current;

  // Estado sincronizado com o Grafo de Cena
  const [sceneVersion, setSceneVersion] = useState(0);
  useEffect(() => {
    return sceneGraph.subscribe(() => {
      setSceneVersion((v) => v + 1);
    });
  }, [sceneGraph]);

  // Estado sincronizado com o Motor de Simulação
  const [mode, setMode] = useState<WorkbenchMode>(engine.getMode());
  const [fault, setFault] = useState<WorkbenchFaultPayload | null>(engine.getFault());
  const [electricalStates, setElectricalStates] = useState<Map<string, ComponentElectricalState>>(
    new Map()
  );

  useEffect(() => {
    const unsubState = engine.onStateChange((newMode, newFault) => {
      setMode(newMode);
      setFault(newFault);
    });

    const unsubDirty = () => {
      setElectricalStates(engine.getAllElectricalStates());
    };
    const unsubEngineDirty = engine.onDirty(unsubDirty);

    return () => {
      unsubState();
      unsubEngineDirty();
      engine.destroy();
    };
  }, [engine]);

  // Getters derivados do SceneGraph
  const components = useMemo(() => Array.from(sceneGraph.getComponents()), [sceneGraph, sceneVersion]);
  const wires = useMemo(() => Array.from(sceneGraph.getWires()), [sceneGraph, sceneVersion]);
  const selectedComponentId = sceneGraph.getSelectedComponentId();
  const selectedWireId = sceneGraph.getSelectedWireId();
  const activeWireColor = sceneGraph.getActiveWireColor();
  const hoveredNetId = sceneGraph.getHoveredNetId();
  const draggingWire: DraggingWireState | null = sceneGraph.getDraggingWire();

  const netlistResult: NetlistResult = useMemo(
    () => sceneGraph.getNetlist(),
    [sceneGraph, sceneVersion]
  );
  const highlightedWireIds = useMemo(
    () => sceneGraph.getHighlightedWireIds(),
    [sceneGraph, sceneVersion, hoveredNetId]
  );
  const highlightedPinKeys = useMemo(
    () => sceneGraph.getHighlightedPinKeys(),
    [sceneGraph, sceneVersion, hoveredNetId]
  );

  // Ações de Componentes
  const addComponent = useCallback(
    (type: string, initialPos: Position2D = { x: 300, y: 200 }) => {
      if (mode !== 'MODO_EDICAO') return;
      sceneGraph.addComponent(type, initialPos);
    },
    [sceneGraph, mode]
  );

  const updateComponentPosition = useCallback(
    (componentId: string, rawPosition: Position2D) => {
      if (mode !== 'MODO_EDICAO') return;
      sceneGraph.updateComponentPosition(componentId, rawPosition, true);
    },
    [sceneGraph, mode]
  );

  const deleteComponent = useCallback(
    (componentId: string) => {
      if (mode !== 'MODO_EDICAO') return;
      sceneGraph.removeComponent(componentId);
    },
    [sceneGraph, mode]
  );

  // Ações de Condutores (Wires)
  const deleteWire = useCallback(
    (wireId: string) => {
      if (mode !== 'MODO_EDICAO') return;
      sceneGraph.removeWire(wireId);
    },
    [sceneGraph, mode]
  );

  const updateWireColor = useCallback(
    (wireId: string, color: WireColor) => {
      sceneGraph.updateWireColor(wireId, color);
    },
    [sceneGraph]
  );

  const setSelectedComponentId = useCallback(
    (id: string | null) => {
      sceneGraph.selectComponent(id);
    },
    [sceneGraph]
  );

  const setSelectedWireId = useCallback(
    (id: string | null) => {
      sceneGraph.selectWire(id);
    },
    [sceneGraph]
  );

  const setActiveWireColor = useCallback(
    (color: WireColor) => {
      sceneGraph.setActiveWireColor(color);
    },
    [sceneGraph]
  );

  const setHoveredNetId = useCallback(
    (netId: string | null) => {
      sceneGraph.setHoveredNetId(netId);
    },
    [sceneGraph]
  );

  // Fluxo de Fiação
  const startWireDrag = useCallback(
    (componentId: string, pinId: string, worldPoint: Position2D) => {
      if (mode !== 'MODO_EDICAO') return;
      sceneGraph.startWireDrag(componentId, pinId, worldPoint);
    },
    [sceneGraph, mode]
  );

  const addWireWaypoint = useCallback(
    (worldPoint: Position2D) => {
      sceneGraph.addWireWaypoint(worldPoint);
    },
    [sceneGraph]
  );

  const updateWireDrag = useCallback(
    (currentPoint: Position2D) => {
      sceneGraph.updateWireDrag(currentPoint);
    },
    [sceneGraph]
  );

  const finishWireDrag = useCallback(
    (toComponentId: string, toPinId: string) => {
      sceneGraph.finishWireDrag(toComponentId, toPinId);
    },
    [sceneGraph]
  );

  const cancelWireDrag = useCallback(() => {
    sceneGraph.cancelWireDrag();
  }, [sceneGraph]);

  // Transições de Simulação
  const startSimulation = useCallback((): boolean => {
    const circuitDef = sceneGraph.toCircuitDefinition();
    engine.loadCircuit(circuitDef);
    const ok = engine.startSimulation();
    if (ok) {
      sceneGraph.selectComponent(null);
      sceneGraph.selectWire(null);
      sceneGraph.cancelWireDrag();
    }
    return ok;
  }, [sceneGraph, engine]);

  const stopSimulation = useCallback(() => {
    engine.stopSimulation();
  }, [engine]);

  const clearWorkbench = useCallback(() => {
    if (mode !== 'MODO_EDICAO') return;
    engine.stopSimulation();
    sceneGraph.clear();
  }, [engine, sceneGraph, mode]);

  const handleEmulatorPinChange = useCallback(
    (pinName: string, level: 'HIGH' | 'LOW') => {
      engine.handlePinOutputChange('mcu_uno_01', pinName, level);
    },
    [engine]
  );

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
    engine,
    sceneGraph,
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
