import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Shape, Circle } from 'react-konva';
import type { Position2D } from '@webboard/contracts';
import { GridLayer } from './GridLayer.js';
import { ComponentNode } from './ComponentNode.js';
import { WireNode } from './WireNode.js';
import { drawWirePath } from '../../utils/geometry.js';
import type { useViewport } from '../../hooks/useViewport.js';
import type { useWorkbench } from '../../hooks/useWorkbench.js';

interface WorkbenchStageProps {
  viewportHook: ReturnType<typeof useViewport>;
  workbenchHook: ReturnType<typeof useWorkbench>;
}

export const WorkbenchStage: React.FC<WorkbenchStageProps> = ({
  viewportHook,
  workbenchHook
}) => {
  const {
    viewport,
    dimensions,
    panBy,
    zoomTo,
    toWorld
  } = viewportHook;

  const {
    components,
    wires,
    selectedComponentId,
    selectedWireId,
    highlightedWireIds,
    highlightedPinKeys,
    electricalStates,
    netlistResult,
    mode,
    fault,
    draggingWire,
    setSelectedComponentId,
    setSelectedWireId,
    setHoveredNetId,
    updateComponentPosition,
    startWireDrag,
    addWireWaypoint,
    updateWireDrag,
    finishWireDrag,
    cancelWireDrag
  } = workbenchHook;

  const stageRef = useRef<any>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointerPos, setLastPointerPos] = useState<Position2D | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
      if (e.key === 'Escape') {
        cancelWireDrag();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cancelWireDrag]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const zoomFactor = 1.1;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? viewport.scale * zoomFactor : viewport.scale / zoomFactor;

    zoomTo(newScale, pointer);
  };

  const handleMouseDown = (e: any) => {
    const isMiddleButton = e.evt.button === 1;
    const isLeftWithSpace = e.evt.button === 0 && isSpacePressed;

    if (isMiddleButton || isLeftWithSpace) {
      e.evt.preventDefault();
      setIsPanning(true);
      setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    // Clique direito cancela a passagem de condutor
    if (e.evt.button === 2) {
      if (draggingWire) {
        cancelWireDrag();
        return;
      }
    }

    // Clique com botão esquerdo no fundo do palco enquanto puxa um fio: adiciona waypoint intermediário
    if (draggingWire && e.evt.button === 0 && e.target === stageRef.current) {
      const stage = stageRef.current;
      if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const worldPos = toWorld(pointer);
          addWireWaypoint(worldPos);
          return;
        }
      }
    }

    // Clique no fundo vazio desmarca seleções
    if (e.target === stageRef.current) {
      setSelectedComponentId(null);
      setSelectedWireId(null);
      setHoveredNetId(null);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (pointer && draggingWire) {
      const worldPos = toWorld(pointer);
      updateWireDrag(worldPos);
    }

    if (isPanning && lastPointerPos) {
      const dx = e.evt.clientX - lastPointerPos.x;
      const dy = e.evt.clientY - lastPointerPos.y;
      panBy({ x: dx, y: dy });
      setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
    }
  };

  const handleMouseUp = (e: any) => {
    if (isPanning) {
      setIsPanning(false);
      setLastPointerPos(null);
    }
  };

  const handleWireHoverStart = (wireId: string) => {
    const net = netlistResult.nets.find((n) => n.wireIds.includes(wireId));
    if (net) setHoveredNetId(net.id);
  };

  const handlePinHoverStart = (componentId: string, pinId: string) => {
    const net = netlistResult.getNetForPin(componentId, pinId);
    if (net) setHoveredNetId(net.id);
  };

  const handleHoverEnd = () => {
    setHoveredNetId(null);
  };

  const cursorStyle = isPanning
    ? 'grabbing'
    : isSpacePressed
    ? 'grab'
    : draggingWire
    ? 'crosshair'
    : 'default';

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none"
      style={{ cursor: cursorStyle }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={viewport.offset.x}
        y={viewport.offset.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Camada 1: Grade Infinita 20px com Snap */}
        <GridLayer
          stageOffset={viewport.offset}
          scale={viewport.scale}
          width={dimensions.width}
          height={dimensions.height}
        />

        {/* Camada 2: Condutores Elétricos */}
        <Layer>
          {wires.map((wire) => (
            <WireNode
              key={wire.id}
              wire={wire}
              components={components}
              isSelected={selectedWireId === wire.id}
              isNetHighlighted={highlightedWireIds.has(wire.id)}
              isFailedWire={fault?.failedWireId === wire.id}
              onSelect={setSelectedWireId}
              onHoverStart={handleWireHoverStart}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </Layer>

        {/* Camada 3: Componentes Físicos com Pinos Ancorados e Estados Elétricos */}
        <Layer>
          {components.map((component) => (
            <ComponentNode
              key={component.id}
              component={component}
              isSelected={selectedComponentId === component.id}
              mode={mode}
              isConnectingWire={!!draggingWire}
              highlightedPinKeys={highlightedPinKeys}
              electricalState={electricalStates.get(component.id)}
              onSelect={setSelectedComponentId}
              onDragEnd={updateComponentPosition}
              onStartWire={startWireDrag}
              onFinishWire={finishWireDrag}
              onPinHoverStart={handlePinHoverStart}
              onPinHoverEnd={handleHoverEnd}
            />
          ))}
        </Layer>

        {/* Camada 4: Fio Elástico com Waypoints em Criação */}
        {draggingWire && (
          <Layer>
            {/* Halo / Contorno escuro da linha elástica */}
            <Shape
              sceneFunc={(ctx, shape) => {
                drawWirePath(
                  ctx as any,
                  draggingWire.fromPoint,
                  draggingWire.currentPoint,
                  draggingWire.waypoints
                );
                (ctx as any).strokeShape(shape);
              }}
              stroke="#09090b"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
            {/* Núcleo do fio elástico animado com tracejado */}
            <Shape
              sceneFunc={(ctx, shape) => {
                drawWirePath(
                  ctx as any,
                  draggingWire.fromPoint,
                  draggingWire.currentPoint,
                  draggingWire.waypoints
                );
                (ctx as any).strokeShape(shape);
              }}
              stroke="#00e599"
              strokeWidth={3}
              dash={[8, 5]}
              lineCap="round"
              lineJoin="round"
            />
            {/* Waypoints intermediários já fixados */}
            {draggingWire.waypoints.map((wp, idx) => (
              <Circle
                key={`drag_wp_${idx}`}
                x={wp.x}
                y={wp.y}
                radius={4.5}
                fill="#00e599"
                stroke="#09090b"
                strokeWidth={1.5}
              />
            ))}
            {/* Ponta guia magnética seguindo o cursor */}
            <Circle
              x={draggingWire.currentPoint.x}
              y={draggingWire.currentPoint.y}
              radius={6}
              fill="#00e599"
              stroke="#09090b"
              strokeWidth={1.5}
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
};
