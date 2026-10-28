import React from 'react';
import { Group, Shape, Circle } from 'react-konva';
import type { WireDefinition, ComponentDefinition } from '@webboard/contracts';
import { COMPONENT_CATALOG } from '../../catalog/manifests.js';
import { getPinAbsolutePosition, drawWirePath } from '../../utils/geometry.js';

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
          strokeWidth={isFailedWire ? 10 : isSelected ? 8 : 7}
          opacity={0.75}
          lineCap="round"
          lineJoin="round"
          shadowColor={isFailedWire ? '#ef4444' : isSelected ? '#00e599' : '#38bdf8'}
          shadowBlur={12}
          hitStrokeWidth={0}
        />
      )}

      {/* 2. Borda / Sombra de profundidade preta (Contorno Neobrutalista) */}
      <Shape
        sceneFunc={(ctx, shape) => {
          drawWirePath(ctx as any, startPos, endPos, wire.waypoints);
          (ctx as any).strokeShape(shape);
        }}
        stroke="#09090b"
        strokeWidth={5}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={0}
      />

      {/* 3. Núcleo condutor colorido com área de clique ampliada */}
      <Shape
        sceneFunc={(ctx, shape) => {
          drawWirePath(ctx as any, startPos, endPos, wire.waypoints);
          (ctx as any).strokeShape(shape);
        }}
        stroke={getWireStrokeColor()}
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={16}
      />

      {/* 4. Vértices intermediários / Waypoints com snap */}
      {wire.waypoints?.map((wp, idx) => (
        <Circle
          key={`wp_${idx}`}
          x={wp.x}
          y={wp.y}
          radius={4}
          fill={isSelected ? '#00e599' : '#ffffff'}
          stroke="#09090b"
          strokeWidth={1.5}
        />
      ))}
    </Group>
  );
};
