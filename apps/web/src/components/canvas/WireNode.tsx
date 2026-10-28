import React from 'react';
import { Group, Shape, Circle } from 'react-konva';
import type { WireDefinition, ComponentDefinition } from '@webboard/contracts';
import { COMPONENT_CATALOG } from '../../catalog/manifests.ts';
import { getPinAbsolutePosition, drawWirePath } from '../../utils/geometry.ts';

interface WireNodeProps {
  wire: WireDefinition;
  components: ComponentDefinition[];
  isSelected: boolean;
  isNetHighlighted: boolean;
  isFailedWire: boolean;
  onSelect: (wireId: string) => void;
  onHoverStart?: (wireId: string) => void;
  onHoverEnd?: () => void;
}

/**
 * WireNode - Renderizador de Condutores Elétricos (Cabos Jumpers) na Bancada.
 *
 * Características visuais:
 * - Terminais Plug Dupont (encaixe macho/fêmea) nas extremidades (startPos e endPos).
 * - Sombra de profundidade e oclusão de cruzamento (Wire Crossover).
 * - Núcleo condutor cilíndrico com brilho superior de silicone.
 */
export const WireNode: React.FC<WireNodeProps> = ({
  wire,
  components,
  isSelected,
  isNetHighlighted,
  isFailedWire,
  onSelect,
  onHoverStart,
  onHoverEnd
}) => {
  const fromComponent = components.find((c) => c.id === wire.from.componentId);
  const toComponent = components.find((c) => c.id === wire.to.componentId);

  if (!fromComponent || !toComponent) return null;

  const fromManifest = COMPONENT_CATALOG[fromComponent.type];
  const toManifest = COMPONENT_CATALOG[toComponent.type];

  const fromPin = fromManifest?.pins.find((p) => p.id === wire.from.pinId);
  const toPin = toManifest?.pins.find((p) => p.id === wire.to.pinId);

  if (!fromPin || !toPin) return null;

  const startPos = getPinAbsolutePosition(
    fromComponent.position,
    fromPin.anchorPosition,
    fromComponent.rotation || 0
  );
  const endPos = getPinAbsolutePosition(
    toComponent.position,
    toPin.anchorPosition,
    toComponent.rotation || 0
  );

  const getWireStrokeColor = () => {
    if (isFailedWire) return '#ff2222';

    switch (wire.color) {
      case 'RED':
        return '#ef4444';
      case 'BLACK':
        return '#27272a';
      case 'GREEN':
        return '#22c55e';
      case 'BLUE':
        return '#3b82f6';
      case 'YELLOW':
        return '#eab308';
      case 'WHITE':
        return '#f4f4f5';
      case 'ORANGE':
        return '#f97316';
      default:
        return '#3b82f6';
    }
  };

  const wireColor = getWireStrokeColor();

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(wire.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(wire.id);
      }}
      onMouseEnter={() => onHoverStart && onHoverStart(wire.id)}
      onMouseLeave={() => onHoverEnd && onHoverEnd()}
    >
      {/* 1. Halo de Realce Equipotencial (Net Highlighting) ou Falha Elétrica */}
      {(isNetHighlighted || isSelected || isFailedWire) && (
        <Shape
          sceneFunc={(ctx, shape) => {
            drawWirePath(ctx as any, startPos, endPos, wire.waypoints);
            (ctx as any).strokeShape(shape);
          }}
          stroke={isFailedWire ? '#ef4444' : isSelected ? '#00e599' : '#38bdf8'}
          strokeWidth={isFailedWire ? 12 : isSelected ? 9 : 8}
          opacity={0.8}
          lineCap="round"
          lineJoin="round"
          shadowColor={isFailedWire ? '#ef4444' : isSelected ? '#00e599' : '#38bdf8'}
          shadowBlur={14}
          hitStrokeWidth={0}
        />
      )}

      {/* 2. Sombra de Profundidade Projetada (Efeito 3D para cruzamentos de fios) */}
      <Shape
        sceneFunc={(ctx, shape) => {
          drawWirePath(ctx as any, startPos, endPos, wire.waypoints);
          (ctx as any).strokeShape(shape);
        }}
        stroke="rgba(0, 0, 0, 0.55)"
        strokeWidth={7}
        lineCap="round"
        lineJoin="round"
        shadowColor="#000000"
        shadowBlur={6}
        shadowOffset={{ x: 0, y: 3 }}
        shadowOpacity={0.5}
        hitStrokeWidth={0}
      />

      {/* 3. Borda Neobrutalista Preta Sólida (Corta fios que passam por baixo em cruzamentos) */}
      <Shape
        sceneFunc={(ctx, shape) => {
          drawWirePath(ctx as any, startPos, endPos, wire.waypoints);
          (ctx as any).strokeShape(shape);
        }}
        stroke="#09090b"
        strokeWidth={5.5}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={0}
      />

      {/* 4. Núcleo Condutor Colorido com Área de Clique Ampliada */}
      <Shape
        sceneFunc={(ctx, shape) => {
          drawWirePath(ctx as any, startPos, endPos, wire.waypoints);
          (ctx as any).strokeShape(shape);
        }}
        stroke={wireColor}
        strokeWidth={3.5}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={18}
      />

      {/* 5. Vértices Intermediários / Waypoints com snap */}
      {wire.waypoints?.map((wp, idx) => (
        <Group key={`wp_${idx}`}>
          <Circle
            x={wp.x}
            y={wp.y}
            radius={5}
            fill="#09090b"
          />
          <Circle
            x={wp.x}
            y={wp.y}
            radius={3.5}
            fill={isSelected ? '#00e599' : wireColor}
            stroke="#ffffff"
            strokeWidth={1}
          />
        </Group>
      ))}

      {/* ========================================================
          TERMINAIS PLUG DUPONT (Ponteiras de Encaixe nos Pinos)
          ======================================================== */}
      {/* Plugue Terminal de Partida (Start Pin) */}
      <Group x={startPos.x} y={startPos.y}>
        {/* Anel de base escuro neobrutalista */}
        <Circle radius={7.5} fill="#09090b" />
        {/* Corpo do conector com a cor do fio */}
        <Circle
          radius={6}
          fill={wireColor}
          stroke="#18181b"
          strokeWidth={1.5}
        />
        {/* Terminal metálico interno */}
        <Circle radius={3.5} fill="#27272a" stroke="#71717a" strokeWidth={1} />
        {/* Pino central de contato dourado */}
        <Circle radius={1.8} fill="#facc15" />
      </Group>

      {/* Plugue Terminal de Destino (End Pin) */}
      <Group x={endPos.x} y={endPos.y}>
        {/* Anel de base escuro neobrutalista */}
        <Circle radius={7.5} fill="#09090b" />
        {/* Corpo do conector com a cor do fio */}
        <Circle
          radius={6}
          fill={wireColor}
          stroke="#18181b"
          strokeWidth={1.5}
        />
        {/* Terminal metálico interno */}
        <Circle radius={3.5} fill="#27272a" stroke="#71717a" strokeWidth={1} />
        {/* Pino central de contato dourado */}
        <Circle radius={1.8} fill="#facc15" />
      </Group>
    </Group>
  );
};
