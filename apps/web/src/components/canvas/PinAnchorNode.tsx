import React, { useState } from 'react';
import { Group, Circle, Rect, Text } from 'react-konva';
import type { ComponentPinAnchor, Position2D, WorkbenchMode } from '@webboard/contracts';

interface PinAnchorNodeProps {
  pin: ComponentPinAnchor;
  componentId: string;
  componentPosition: Position2D;
  mode: WorkbenchMode;
  isConnectingWire: boolean;
  isNetHighlighted: boolean;
  isBreadboard?: boolean;
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
  isBreadboard = false,
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
          radius={isBreadboard ? 10 : 14}
          fill="rgba(56, 189, 248, 0.4)"
          stroke="#38bdf8"
          strokeWidth={2}
          shadowColor="#38bdf8"
          shadowBlur={8}
        />
      )}

      {/* 2. Halo magnético de conexão / hover */}
      {(isHovered || isConnectingWire) && !isNetHighlighted && (
        <Circle
          radius={isBreadboard ? 9 : isConnectingWire ? 14 : 11}
          fill={isConnectingWire ? 'rgba(0, 229, 153, 0.4)' : 'rgba(255, 255, 255, 0.25)'}
          stroke={isConnectingWire ? '#00e599' : '#ffffff'}
          strokeWidth={1.5}
        />
      )}

      {/* 3. Renderização específica para furo de Protoboard vs terminal normal */}
      {isBreadboard ? (
        <>
          {/* Furo de inserção metálico da protoboard */}
          <Rect
            x={-4}
            y={-4}
            width={8}
            height={8}
            fill="#27272a"
            stroke="#71717a"
            strokeWidth={1}
            cornerRadius={1.5}
          />
          <Rect
            x={-2}
            y={-2}
            width={4}
            height={4}
            fill="#09090b"
          />
        </>
      ) : (
        <>
          {/* Terminal metálico exterior */}
          <Circle
            radius={5.5}
            fill="#18181b"
            stroke="#71717a"
            strokeWidth={1.5}
          />

          {/* Núcleo metálico condutor com cor por função elétrica */}
          <Circle
            radius={3}
            fill={getPinColor()}
          />
        </>
      )}

      {/* 4. Área de clique ampliada invisível (Hit area de 20 a 28px) */}
      <Circle
        radius={isBreadboard ? 10 : 14}
        fill="rgba(0,0,0,0.001)"
      />

      {/* 5. Rótulo legível do pino:
          - Protoboard: Tooltip flutuante sob demanda (apenas no hover ou destaque) para performance 60fps.
          - Componentes normais: Rótulo estático afastado do rodapé para nunca encavalar. */}
      {isBreadboard ? (
        (isHovered || isNetHighlighted) && (
          <Group y={-22} listening={false}>
            <Rect
              x={-16}
              y={0}
              width={32}
              height={16}
              fill="#09090b"
              stroke={isNetHighlighted ? '#38bdf8' : '#00e599'}
              strokeWidth={1.5}
              cornerRadius={3}
              shadowColor="#000000"
              shadowBlur={4}
            />
            <Text
              text={pin.label}
              fontSize={9}
              fontFamily="monospace"
              fontStyle="bold"
              fill="#f4f4f5"
              x={-16}
              y={3}
              width={32}
              align="center"
            />
          </Group>
        )
      ) : (
        <Text
          text={pin.label}
          fontSize={8}
          fontFamily="monospace"
          fontStyle="bold"
          fill="#d4d4d8"
          x={-15}
          y={pin.anchorPosition.y > 35 ? -14 : 8}
          width={30}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
};
