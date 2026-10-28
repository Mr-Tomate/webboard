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
 * WorkbenchStage - Pipeline Gráfico Konva 2D com Navegação Suave (Smooth Pan & Zoom).
 *
 * Suporte aprimorado de navegação no canvas:
 * - Arrastar com Botão Esquerdo no Fundo Vazio: Desliza o canvas (pan) livremente.
 * - Arrastar com Botão Direito: Desliza o canvas de qualquer posição (padrão CAD/Blender).
 * - Botão do Meio ou Barra de Espaço + Drag: Pan universal clássico.
 * - Roda do Mouse / Trackpad (2 dedos): Pan vertical e horizontal suave (deltaX, deltaY).
 * - Ctrl + Roda do Mouse / Trackpad Pinch: Zoom contínuo, suave e centrado no cursor.
 * - Hierarquia estrita de 5 Camadas (Grid -> Componentes -> Fios -> Interação -> Efeitos).
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
    if (pointer && draggingWire) {
      const worldPos = toWorld(pointer);
      updateWireDrag(worldPos);
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
      </Stage>
    </div>
  );
};
