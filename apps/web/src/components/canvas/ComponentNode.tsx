import React from 'react';
import { Group, Rect, Text, Circle, Line } from 'react-konva';
import type { ComponentDefinition, Position2D, WorkbenchMode } from '@webboard/contracts';
import type { ComponentElectricalState } from '@webboard/core';
import { COMPONENT_CATALOG } from '../../catalog/manifests.js';
import { PinAnchorNode } from './PinAnchorNode.js';
import { snapPointToGrid } from '../../utils/geometry.js';

interface ComponentNodeProps {
  component: ComponentDefinition;
  isSelected: boolean;
  mode: WorkbenchMode;
  isConnectingWire: boolean;
  highlightedPinKeys: Set<string>;
  electricalState?: ComponentElectricalState;
  onSelect: (componentId: string) => void;
  onDragEnd: (componentId: string, newPos: Position2D) => void;
  onStartWire: (componentId: string, pinId: string, worldPos: Position2D) => void;
  onFinishWire: (componentId: string, pinId: string) => void;
  onPinHoverStart?: (componentId: string, pinId: string) => void;
  onPinHoverEnd?: () => void;
}

export const ComponentNode: React.FC<ComponentNodeProps> = ({
  component,
  isSelected,
  mode,
  isConnectingWire,
  highlightedPinKeys,
  electricalState,
  onSelect,
  onDragEnd,
  onStartWire,
  onFinishWire,
  onPinHoverStart,
  onPinHoverEnd
}) => {
  const manifest = COMPONENT_CATALOG[component.type];
  const width = manifest?.dimensions.width ?? 100;
  const height = manifest?.dimensions.height ?? 80;

  const isSimulating = mode === 'MODO_SIMULACAO';
  const canDrag = !isSimulating && !component.isLocked;

  const isLedActive = electricalState?.visualState === 'active';
  const isDestroyed = electricalState?.visualState === 'destroyed' || electricalState?.isDestroyed;

  const getThemeColor = () => {
    if (isDestroyed) return '#2e1014'; // Queimado por sobrecorrente térmica

    switch (manifest?.category) {
      case 'MCU':
        return '#005f73'; // Azul petróleo Arduino
      case 'ACTUATOR':
        return '#27272a';
      case 'PASSIVE':
        return '#27272a';
      case 'SENSOR':
        return '#1b3a32';
      case 'INPUT':
        return '#26262b';
      default:
        return '#1f2023';
    }
  };

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      draggable={canDrag}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(component.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(component.id);
      }}
      onDragMove={(e) => {
        // Atualiza a posição em tempo real para os fios conectados acompanharem a 60fps
        const rawPos = { x: e.target.x(), y: e.target.y() };
        onDragEnd(component.id, rawPos);
      }}
      onDragEnd={(e) => {
        const rawPos = { x: e.target.x(), y: e.target.y() };
        const snapped = snapPointToGrid(rawPos);
        e.target.position(snapped);
        onDragEnd(component.id, snapped);
      }}
    >
      {/* Sombra Neobrutalista sólida preta */}
      <Rect
        x={4}
        y={4}
        width={width}
        height={height}
        fill="#09090b"
        cornerRadius={4}
      />

      {/* Corpo principal do componente */}
      <Rect
        width={width}
        height={height}
        fill={getThemeColor()}
        stroke={isDestroyed ? '#ef4444' : isSelected ? '#00e599' : '#3f3f46'}
        strokeWidth={isSelected || isDestroyed ? 2.5 : 1.5}
        cornerRadius={4}
      />

      {/* 1. Arduino Uno R3 Detalhes Visuais */}
      {component.type === 'MICROCONTROLLER_ARDUINO_UNO' && (
        <Group>
          {/* Microcontrolador ATmega328P DIP-28 */}
          <Rect
            x={width / 2 - 40}
            y={height / 2 - 14}
            width={80}
            height={26}
            fill="#121214"
            stroke="#52525b"
            strokeWidth={1}
            cornerRadius={2}
          />
          <Text
            text="ATmega328P 16MHz"
            fontSize={8}
            fontFamily="monospace"
            fill="#00e599"
            x={width / 2 - 38}
            y={height / 2 - 5}
          />
          {/* Porta USB Tipo-B prateada */}
          <Rect
            x={24}
            y={height / 2 - 10}
            width={20}
            height={18}
            fill="#a1a1aa"
            stroke="#52525b"
            strokeWidth={1}
            cornerRadius={2}
          />
          {/* LED Onboard D13 ("L") */}
          <Circle
            x={80}
            y={42}
            radius={4}
            fill={isLedActive ? '#eab308' : '#3f3f46'}
            stroke="#18181b"
            strokeWidth={1}
          />
          <Text text="L" fontSize={8} fontFamily="monospace" fontStyle="bold" fill="#a1a1aa" x={88} y={38} />
          {/* Rótulo da placa */}
          <Text
            text="ARDUINO UNO R3"
            fontSize={10}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#38bdf8"
            x={width / 2 - 35}
            y={height - 24}
          />
        </Group>
      )}

      {/* 2. Resistor de Precisão Detalhes Visuais */}
      {component.type === 'PASSIVE_RESISTOR' && (
        <Group>
          {/* Terminais metálicos laterais */}
          <Line points={[8, 22, 22, 22]} stroke="#a1a1aa" strokeWidth={2.5} lineCap="round" />
          <Line points={[68, 22, 82, 22]} stroke="#a1a1aa" strokeWidth={2.5} lineCap="round" />
          {/* Corpo cerâmico cilíndrico */}
          <Rect
            x={22}
            y={12}
            width={46}
            height={20}
            fill={isDestroyed ? '#261214' : '#d4b483'}
            stroke="#18181b"
            strokeWidth={1.5}
            cornerRadius={3}
          />
          {/* Faixas coloridas do resistor (220 ohms: Vermelho, Vermelho, Marrom, Dourado) */}
          {!isDestroyed && (
            <>
              <Rect x={28} y={12} width={4} height={20} fill="#dc2626" />
              <Rect x={36} y={12} width={4} height={20} fill="#dc2626" />
              <Rect x={44} y={12} width={4} height={20} fill="#78350f" />
              <Rect x={56} y={12} width={4} height={20} fill="#eab308" />
            </>
          )}
          {isDestroyed && (
            <Text text="QUEIMADO" fontSize={7} fontStyle="bold" fill="#ef4444" x={24} y={17} />
          )}
        </Group>
      )}

      {/* 3. LED Difuso 5mm Detalhes Visuais */}
      {component.type === 'ACTUATOR_LED' && (
        <Group>
          {/* Halo de luz difusa neon quando conduzindo corrente */}
          {isLedActive && (
            <Circle
              x={width / 2}
              y={24}
              radius={24}
              fill="rgba(239, 68, 68, 0.45)"
              shadowColor="#ef4444"
              shadowBlur={20}
            />
          )}

          {/* Cúpula do LED */}
          <Circle
            x={width / 2}
            y={24}
            radius={18}
            fill={
              isDestroyed
                ? '#1c1917'
                : isLedActive
                ? '#ff3333'
                : component.parameters?.color === 'RED'
                ? '#ef4444'
                : '#22c55e'
            }
            stroke={isDestroyed ? '#7f1d1d' : '#ffffff'}
            strokeWidth={1.5}
          />

          {/* Reflexo vítreo na cúpula */}
          {!isDestroyed && (
            <Circle
              x={width / 2 - 5}
              y={20}
              radius={4}
              fill="rgba(255, 255, 255, 0.65)"
            />
          )}

          {/* Terminais saindo para os pinos */}
          <Line points={[width / 2 - 10, 42, 22, 65]} stroke="#a1a1aa" strokeWidth={1.5} />
          <Line points={[width / 2 + 10, 42, 48, 65]} stroke="#a1a1aa" strokeWidth={1.5} />

          {/* Indicador de destruição térmica por sobrecorrente */}
          {isDestroyed && (
            <Text
              text="QUEIMADO"
              fontSize={8}
              fontStyle="bold"
              fill="#ef4444"
              x={width / 2 - 24}
              y={20}
            />
          )}
        </Group>
      )}

      {/* 4. Sensor Ultrassônico HC-SR04 Detalhes Visuais */}
      {component.type === 'SENSOR_ULTRASONIC_HCSR04' && (
        <Group>
          {/* Transdutor Emissor (T) */}
          <Circle
            x={35}
            y={32}
            radius={18}
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth={2}
          />
          <Text text="T" fontSize={11} fontFamily="monospace" fontStyle="bold" fill="#ffffff" x={31} y={26} />
          {/* Transdutor Receptor (R) */}
          <Circle
            x={95}
            y={32}
            radius={18}
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth={2}
          />
          <Text text="R" fontSize={11} fontFamily="monospace" fontStyle="bold" fill="#ffffff" x={91} y={26} />
        </Group>
      )}

      {/* 5. Pushbutton Detalhes Visuais */}
      {component.type === 'INPUT_PUSHBUTTON' && (
        <Group>
          <Circle
            x={width / 2}
            y={30}
            radius={16}
            fill="#18181b"
            stroke="#52525b"
            strokeWidth={2}
          />
          <Circle
            x={width / 2}
            y={30}
            radius={10}
            fill="#3f3f46"
          />
        </Group>
      )}

      {/* 6. Potenciômetro Detalhes Visuais */}
      {component.type === 'INPUT_POTENTIOMETER' && (
        <Group>
          <Circle
            x={width / 2}
            y={28}
            radius={18}
            fill="#18181b"
            stroke="#52525b"
            strokeWidth={2}
          />
          <Circle
            x={width / 2}
            y={28}
            radius={12}
            fill="#0284c7"
          />
          <Line points={[width / 2, 28, width / 2, 18]} stroke="#ffffff" strokeWidth={2} lineCap="round" />
        </Group>
      )}

      {/* Rótulo do Componente (se não for Arduino que tem layout próprio) */}
      {component.type !== 'MICROCONTROLLER_ARDUINO_UNO' && (
        <Text
          text={
            isDestroyed
              ? `[FALHA] ${component.label}`
              : component.label || manifest?.name || component.type
          }
          fontSize={10}
          fontFamily="sans-serif"
          fontStyle="bold"
          fill={isDestroyed ? '#f87171' : '#a1a1aa'}
          x={4}
          y={height - 14}
          width={width - 8}
          align="center"
          ellipsis={true}
          listening={false}
        />
      )}

      {/* Pinos do Componente */}
      {manifest?.pins.map((pin) => {
        const pinKey = `${component.id}:${pin.id}`;
        return (
          <PinAnchorNode
            key={pin.id}
            pin={pin}
            componentId={component.id}
            componentPosition={component.position}
            mode={mode}
            isConnectingWire={isConnectingWire}
            isNetHighlighted={highlightedPinKeys.has(pinKey)}
            onStartWire={onStartWire}
            onFinishWire={onFinishWire}
            onHoverStart={onPinHoverStart}
            onHoverEnd={onPinHoverEnd}
          />
        );
      })}
    </Group>
  );
};
