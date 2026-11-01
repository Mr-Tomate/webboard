import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Shape, Circle, Group, Rect, Text, Path } from 'react-konva';
import type { Position2D } from '@webboard/contracts';
import { GridLayer } from './GridLayer.tsx';
import { ComponentNode } from './ComponentNode.tsx';
import { WireNode } from './WireNode.tsx';
import { drawWirePath } from '../../utils/geometry.ts';
import type { useViewport } from '../../hooks/useViewport.ts';
import type { useWorkbench } from '../../hooks/useWorkbench.ts';
import type { ComponentLock, RemoteCursor } from '../../types/telemetry.ts';

const CURSOR_COLORS = [
  '#38bdf8', // Sky
  '#f472b6', // Pink
  '#a3e635', // Lime
  '#facc15', // Yellow
  '#fb923c', // Orange
  '#c084fc', // Purple
  '#2dd4bf', // Teal
  '#e879f9', // Fuchsia
];

function getCursorColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

interface WorkbenchStageProps {
  viewportHook: ReturnType<typeof useViewport>;
  workbenchHook: ReturnType<typeof useWorkbench>;
  activeLocks?: Map<string, ComponentLock>;
  remoteCursors?: Map<string, RemoteCursor>;
  onLocalCursorMove?: (worldPos: Position2D) => void;
  onComponentDragStart?: (componentId: string) => void;
  onComponentDragEnd?: (componentId: string, newPos: Position2D) => void;
}

/**
 * WorkbenchStage - Pipeline Gráfico Konva 2D com Navegação Suave (Smooth Pan & Zoom).
 *
 * Suporte aprimorado de navegação no canvas:
 * - Arrastar com Botão Esquerdo no Fundo Vazio: Desliza o canvas (pan) livremente.
 * - Arrastar com Botão Direito: Desliza o canvas de qualquer posição (padrão CAD/Blender).
 * - Botão do Meio ou Barra de Espaço + Drag: Pan universal clássico.
 * - Roda do Mouse / Trackpad (2 dedos): Pan vertical e horizontal suave (deltaX, deltaY).
 * - Ctrl + Roda do Mouse / Trackpad Pinch: Zoom contínuo, suave e centrado no cursor.
 * - Hierarquia estrita de 6 Camadas:
 *   1. GridLayer
 *   2. Componentes (com Soft-Lock)
 *   3. Wires
 *   4. Interação Ativa (Fio elástico)
 *   5. Efeitos e Alertas de Falha
 *   6. Colaboração Concorrente & Cursores Remotos (Eixo D)
 */
export const WorkbenchStage: React.FC<WorkbenchStageProps> = ({
  viewportHook,
  workbenchHook,
  activeLocks,
  remoteCursors,
  onLocalCursorMove,
  onComponentDragStart,
  onComponentDragEnd
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
  const lastCursorSendRef = useRef<number>(0);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panButton, setPanButton] = useState<number | null>(null);
  const [startPointerPos, setStartPointerPos] = useState<Position2D | null>(null);
  const [lastPointerPos, setLastPointerPos] = useState<Position2D | null>(null);
  const [hasMovedSignificantly, setHasMovedSignificantly] = useState(false);

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

  // Navegação suave com Scroll e Trackpad
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // 1. Zoom Contínuo e Suave com Ctrl / Meta (ou gesto Pinch de Trackpad)
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const zoomDelta = -e.evt.deltaY;
      const zoomFactor = Math.exp(zoomDelta * 0.0025);
      const newScale = viewport.scale * zoomFactor;
      zoomTo(newScale, pointer);
      return;
    }

    // 2. Scroll Horizontal com tecla Shift
    if (e.evt.shiftKey) {
      panBy({ x: -e.evt.deltaY, y: 0 });
      return;
    }

    // 3. Pan Bidirecional Fluido (Trackpad com 2 dedos ou Roda de Mouse padrão)
    panBy({ x: -e.evt.deltaX, y: -e.evt.deltaY });
  };

  const handleMouseDown = (e: any) => {
    const isMiddleButton = e.evt.button === 1;
    const isRightButton = e.evt.button === 2;
    const isLeftWithSpace = e.evt.button === 0 && isSpacePressed;
    const isLeftOnBackground = e.evt.button === 0 && e.target === stageRef.current && !draggingWire;

    // Inicia PAN suave no canvas (Botão Esquerdo no fundo, Botão Direito, Botão do Meio ou Espaço)
    if (isMiddleButton || isRightButton || isLeftWithSpace || isLeftOnBackground) {
      e.evt.preventDefault();
      setIsPanning(true);
      setPanButton(e.evt.button);
      setStartPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
      setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
      setHasMovedSignificantly(false);
      return;
    }

    // Clique com botão esquerdo no fundo vazio enquanto puxa fio: fixa waypoint
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
  };

  const handleMouseMove = (e: any) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (pointer) {
      const worldPos = toWorld(pointer);

      if (draggingWire) {
        updateWireDrag(worldPos);
      }

      // Transmissão do cursor local throttled para colaboradores
      if (onLocalCursorMove) {
        const now = Date.now();
        if (now - lastCursorSendRef.current >= 40) {
          lastCursorSendRef.current = now;
          onLocalCursorMove(worldPos);
        }
      }
    }

    if (isPanning && lastPointerPos) {
      const dx = e.evt.clientX - lastPointerPos.x;
      const dy = e.evt.clientY - lastPointerPos.y;

      if (startPointerPos) {
        const totalDist = Math.hypot(e.evt.clientX - startPointerPos.x, e.evt.clientY - startPointerPos.y);
        if (totalDist > 4) {
          setHasMovedSignificantly(true);
        }
      }

      panBy({ x: dx, y: dy });
      setLastPointerPos({ x: e.evt.clientX, y: e.evt.clientY });
    }
  };

  const handleMouseUp = (e: any) => {
    if (isPanning) {
      // Se foi um clique rápido no fundo sem arrastar (< 4px), desmarca seleções
      if (panButton === 0 && !hasMovedSignificantly) {
        setSelectedComponentId(null);
        setSelectedWireId(null);
        setHoveredNetId(null);
      }

      // Se foi clique direito rápido sem arrastar e havia fio em criação, cancela o fio
      if (panButton === 2 && !hasMovedSignificantly && draggingWire) {
        cancelWireDrag();
      }

      setIsPanning(false);
      setLastPointerPos(null);
      setStartPointerPos(null);
      setHasMovedSignificantly(false);
      setPanButton(null);
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
    : 'grab';

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
              lockedBy={activeLocks?.get(component.id)}
              onSelect={setSelectedComponentId}
              onDragStart={onComponentDragStart}
              onDragEnd={(compId, newPos) => {
                if (onComponentDragEnd) {
                  onComponentDragEnd(compId, newPos);
                } else {
                  updateComponentPosition(compId, newPos);
                }
              }}
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
              onHoverStart={() => handleWireHoverStart(wire.id)}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </Layer>

        {/* ========================================================
            CAMADA 4: Interação Ativa (Fio Elástico Dinâmico a 60 FPS)
            ======================================================== */}
        <Layer id="layer-interaction" listening={false}>
          {draggingWire && (
            <Shape
              sceneFunc={(context, shape) => {
                const ctx = context._context as CanvasRenderingContext2D;
                drawWirePath(
                  ctx,
                  draggingWire.fromPoint,
                  draggingWire.currentPoint,
                  draggingWire.waypoints
                );
                context.fillStrokeShape(shape);
              }}
              stroke="#00e599"
              strokeWidth={3.5}
              dash={[8, 4]}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </Layer>

        {/* ========================================================
            CAMADA 5: Alertas e Efeitos Visuais (Queima, Fumaça e Halos)
            ======================================================== */}
        <Layer id="layer-effects" listening={false}>
          {fault && fault.failedComponentId && (
            (() => {
              const comp = components.find((c) => c.id === fault.failedComponentId);
              if (!comp) return null;
              return (
                <Circle
                  x={comp.position.x + 30}
                  y={comp.position.y + 30}
                  radius={45}
                  fill="radial-gradient(circle, rgba(239,68,68,0.4) 0%, rgba(239,68,68,0) 70%)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dash={[6, 3]}
                />
              );
            })()
          )}
        </Layer>

        {/* ========================================================
            CAMADA 6: Colaboração Concorrente & Cursores Remotos (Eixo D)
            ======================================================== */}
        <Layer id="layer-collaboration-cursors" listening={false}>
          {remoteCursors &&
            Array.from(remoteCursors.values()).map((cursor) => {
              const color = getCursorColor(cursor.userId);
              return (
                <Group
                  key={cursor.userId}
                  x={cursor.position.x}
                  y={cursor.position.y}
                  listening={false}
                >
                  {/* Seta do Cursor SVG */}
                  <Path
                    data="M0 0 L0 16 L4.5 12.5 L8.5 20 L11 18.5 L7 11.5 L12.5 11.5 Z"
                    fill={color}
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  {/* Badge Neobrutalista com Nome do Colega */}
                  <Group x={12} y={14}>
                    <Rect
                      x={0}
                      y={0}
                      width={Math.max(50, cursor.userName.length * 7.5 + 14)}
                      height={18}
                      fill={color}
                      stroke="#09090b"
                      strokeWidth={1.5}
                      cornerRadius={4}
                    />
                    <Text
                      text={cursor.userName}
                      fontSize={10}
                      fontFamily="monospace"
                      fontStyle="bold"
                      fill="#09090b"
                      x={6}
                      y={3}
                    />
                  </Group>
                </Group>
              );
            })}
        </Layer>
      </Stage>
    </div>
  );
};
