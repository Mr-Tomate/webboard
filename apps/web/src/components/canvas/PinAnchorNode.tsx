import React, { useState } from 'react';
import { Group, Circle, Text } from 'react-konva';
import type { ComponentPinAnchor, Position2D, WorkbenchMode } from '@webboard/contracts';

interface PinAnchorNodeProps {
  pin: ComponentPinAnchor;
  componentId: string;
  componentPosition: Position2D;
  mode: WorkbenchMode;
  isConnectingWire: boolean;
  isNetHighlighted: boolean;
  onStartWire: (componentId: string, pinId: string, worldPos: Position2D) => void;
  onFinishWire: (componentId: string, pinId: string) => void;
  onHoverStart?: (componentId: string, pinId: string) => void;
  onHoverEnd?: () => void;
}

export const PinAnchorNode: React.FC<PinAnchorNodeProps> = ({
  pin,
  componentId,
  componentPosition,
  mode,
  isConnectingWire,
  isNetHighlighted,
  onStartWire,
  onFinishWire,
  onHoverStart,
  onHoverEnd
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getPinColor = () => {
    switch (pin.type) {
      case 'POWER_VCC':
        return '#ef4444';
      case 'POWER_GND':
        return '#18181b';
      case 'DIGITAL_IO':
        return '#3b82f6';
      case 'ANALOG_IN':
        return '#a855f7';
      case 'PASSIVE':
      default:
        return '#eab308';
    }
  };

  const handlePointerDown = (e: any) => {
    if (mode !== 'MODO_EDICAO') return;
    e.cancelBubble = true;

    const absPos: Position2D = {
      x: componentPosition.x + pin.anchorPosition.x,
      y: componentPosition.y + pin.anchorPosition.y
    };

    if (isConnectingWire) {
      onFinishWire(componentId, pin.id);
    } else {
      onStartWire(componentId, pin.id, absPos);
    }
  };

  const handlePointerUp = (e: any) => {
    if (mode !== 'MODO_EDICAO') return;
    e.cancelBubble = true;
    if (isConnectingWire) {
      onFinishWire(componentId, pin.id);
    }
  };

  return (
    <Group
      x={pin.anchorPosition.x}
      y={pin.anchorPosition.y}
      onMouseEnter={() => {
        setIsHovered(true);
        if (onHoverStart) onHoverStart(componentId, pin.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (onHoverEnd) onHoverEnd();
      }}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
    >
      {/* Halo de realce de nó equipotencial (Net Highlight) */}
      {isNetHighlighted && (
        <Circle
          radius={14}
          fill="rgba(56, 189, 248, 0.35)"
          stroke="#38bdf8"
          strokeWidth={2}
          shadowColor="#38bdf8"
          shadowBlur={10}
        />
      )}

      {/* Halo magnético quando em hover ou buscando conexão */}
      {(isHovered || isConnectingWire) && !isNetHighlighted && (
        <Circle
          radius={12}
          fill={isConnectingWire ? 'rgba(0, 229, 153, 0.35)' : 'rgba(255, 255, 255, 0.2)'}
          stroke={isConnectingWire ? '#00e599' : '#ffffff'}
          strokeWidth={1.5}
        />
      )}

      {/* Anel do terminal metálico */}
      <Circle
        radius={5}
        fill="#27272a"
        stroke="#71717a"
        strokeWidth={1.5}
      />

      {/* Centro do pino colorido por tipo */}
      <Circle
        radius={2.5}
        fill={getPinColor()}
      />

      {/* Rótulo do pino */}
      <Text
        text={pin.label}
        fontSize={8}
        fontFamily="sans-serif"
        fill="#a1a1aa"
        x={-15}
        y={pin.anchorPosition.y > 30 ? 7 : -15}
        width={30}
        align="center"
        listening={false}
      />
    </Group>
  );
};
