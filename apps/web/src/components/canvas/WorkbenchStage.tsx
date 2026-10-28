import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Shape, Circle } from 'react-konva';
import type { Position2D } from '@webboard/contracts';
import { GridLayer } from './GridLayer.tsx';
import { ComponentNode } from './ComponentNode.tsx';
import { WireNode } from './WireNode.tsx';
import { drawWirePath } from '../../utils/geometry.ts';
import type { useViewport } from '../../hooks/useViewport.ts';
import type { useWorkbench } from '../../hooks/useWorkbench.ts';

interface WorkbenchStageProps {
  viewportHook: ReturnType<typeof useViewport>;
  workbenchHook: ReturnType<typeof useWorkbench>;
}

/**
 * WorkbenchStage - Pipeline Gráfico Konva 2D em 5 Camadas Isoladas.
 *
 * Hierarquia de Z-Index corrigida para máxima fidelidade física da bancada:
 * - Layer 1: Grid & Background (GridLayer nativo com listening=false)
 * - Layer 2: Componentes Físicos e Placas (Arduino, sensores, atuadores)
 * - Layer 3: Condutores (Wires) Plugados (cabos elétricos passam POR CIMA das placas)
 * - Layer 4: Interação Ativa (cabo elétrico dinâmico sendo esticado pelo mouse a 60 FPS)
 * - Layer 5: Alertas e Efeitos Visuais (FX / Glows / Queimas)
 */
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

    // Clique com botão esquerdo no fundo vazio da bancada enquanto puxa fio: fixa waypoint
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

    // Clique no fundo desmarca seleções
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
        {/* ========================================================
            CAMADA 1: Grid & Background (GridLayer direto no Stage)
            ======================================================== */}
        <GridLayer
          stageOffset={viewport.offset}
          scale={viewport.scale}
          width={dimensions.width}
          height={dimensions.height}
        />

        {/* ========================================================
            CAMADA 2: Componentes Físicos e Placas de Circuito
            (Renderizados antes dos fios para que os fios fiquem POR CIMA)
            ======================================================== */}
        <Layer id="layer-components">
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

        {/* ========================================================
            CAMADA 3: Condutores (Wires) Plugados com Terminais
            (Ficam POR CIMA das placas e componentes físicos)
            ======================================================== */}
        <Layer id="layer-wires">
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

        {/* ========================================================
            CAMADA 4: Interação Ativa (Fio em arraste a 60 FPS)
            ======================================================== */}
        <Layer id="layer-interaction">
          {draggingWire && (
            <>
              {/* Sombra projetada do cabo em criação */}
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
                stroke="rgba(0, 0, 0, 0.45)"
                strokeWidth={7}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              {/* Contorno Neobrutalista do fio */}
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
                listening={false}
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
                listening={false}
              />
              {/* Terminal Plug de Origem (Conector Dupont fixo) */}
              <Circle
                x={draggingWire.fromPoint.x}
                y={draggingWire.fromPoint.y}
                radius={7}
                fill="#09090b"
                listening={false}
              />
              <Circle
                x={draggingWire.fromPoint.x}
                y={draggingWire.fromPoint.y}
                radius={5}
                fill="#00e599"
                stroke="#18181b"
                strokeWidth={1.5}
                listening={false}
              />
              <Circle
                x={draggingWire.fromPoint.x}
                y={draggingWire.fromPoint.y}
                radius={2}
                fill="#ffffff"
                listening={false}
              />
              {/* Vértices intermediários fixados */}
              {draggingWire.waypoints.map((wp, idx) => (
                <Circle
                  key={`drag_wp_${idx}`}
                  x={wp.x}
                  y={wp.y}
                  radius={4.5}
                  fill="#00e599"
                  stroke="#09090b"
                  strokeWidth={1.5}
                  listening={false}
                />
              ))}
              {/* Ponta guia magnética sobre o cursor */}
              <Circle
                x={draggingWire.currentPoint.x}
                y={draggingWire.currentPoint.y}
                radius={7}
                fill="#09090b"
                listening={false}
              />
              <Circle
                x={draggingWire.currentPoint.x}
                y={draggingWire.currentPoint.y}
                radius={5}
                fill="#00e599"
                stroke="#ffffff"
                strokeWidth={1.5}
                listening={false}
              />
            </>
          )}
        </Layer>

        {/* ========================================================
            CAMADA 5: Alertas e Efeitos Visuais (FX / Glows / Falhas)
            ======================================================== */}
        <Layer id="layer-effects" listening={false}>
          {components.map((comp) => {
            const state = electricalStates.get(comp.id);
            if (!state) return null;

            // Halo luminoso difuso de LED aceso
            if (comp.type === 'ACTUATOR_LED' && state.visualState === 'active') {
              return (
                <Circle
                  key={`fx_led_${comp.id}`}
                  x={comp.position.x + 35}
                  y={comp.position.y + 30}
                  radius={28}
                  fill="rgba(239, 68, 68, 0.45)"
                  shadowColor="#ef4444"
                  shadowBlur={24}
                />
              );
            }

            // Indicador de sobrecorrente térmica ou queima (RN-BNC-05)
            if (state.visualState === 'destroyed' || state.isDestroyed) {
              return (
                <Circle
                  key={`fx_burned_${comp.id}`}
                  x={comp.position.x + 35}
                  y={comp.position.y + 30}
                  radius={18}
                  fill="rgba(239, 68, 68, 0.25)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dash={[4, 3]}
                />
              );
            }

            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
};
