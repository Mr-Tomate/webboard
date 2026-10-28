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
        return '#ef4444'; // Vermelho
      case 'POWER_GND':
        return '#27272a'; // Preto/Zinc escuro
      case 'DIGITAL_IO':
        return '#3b82f6'; // Azul
      case 'ANALOG_IN':
        return '#a855f7'; // Roxo
      case 'PASSIVE':
      default:
        return '#eab308'; // Amarelo/Dourado
    }
  };

  // Coordenada absoluta do pino no mundo virtual
  const absPos: Position2D = {
    x: componentPosition.x + pin.anchorPosition.x,
    y: componentPosition.y + pin.anchorPosition.y
  };

  const handlePointerDown = (e: any) => {
    if (mode !== 'MODO_EDICAO') return;
    e.cancelBubble = true;

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

  const handleClick = (e: any) => {
    if (mode !== 'MODO_EDICAO') return;
    e.cancelBubble = true;

    if (isConnectingWire) {
      onFinishWire(componentId, pin.id);
    } else {
      onStartWire(componentId, pin.id, absPos);
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
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* 1. Halo de realce de nó equipotencial (Net Highlight) */}
      {isNetHighlighted && (
        <Circle
          radius={14}
          fill="rgba(56, 189, 248, 0.4)"
          stroke="#38bdf8"
          strokeWidth={2}
          shadowColor="#38bdf8"
          shadowBlur={10}
        />
      )}

      {/* 2. Halo magnético convidativo de conexão / hover */}
      {(isHovered || isConnectingWire) && !isNetHighlighted && (
        <Circle
          radius={isConnectingWire ? 14 : 11}
          fill={isConnectingWire ? 'rgba(0, 229, 153, 0.35)' : 'rgba(255, 255, 255, 0.2)'}
          stroke={isConnectingWire ? '#00e599' : '#ffffff'}
          strokeWidth={1.5}
        />
      )}

      {/* 3. Terminal metálico exterior */}
      <Circle
        radius={5.5}
        fill="#18181b"
        stroke="#71717a"
        strokeWidth={1.5}
      />

      {/* 4. Núcleo metálico condutor com cor por função elétrica */}
      <Circle
        radius={3}
        fill={getPinColor()}
      />

      {/* 5. Área de clique ampliada invisível (Hit area de 28px de diâmetro) */}
      <Circle
        radius={14}
        fill="rgba(0,0,0,0.001)"
      />

      {/* 6. Rótulo legível do pino */}
      <Text
        text={pin.label}
        fontSize={8}
        fontFamily="monospace"
        fontStyle="bold"
        fill="#d4d4d8"
        x={-20}
        y={pin.anchorPosition.y > 30 ? 8 : -16}
        width={40}
        align="center"
        listening={false}
      />
    </Group>
  );
};
