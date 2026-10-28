import React from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
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
    if (isDestroyed) return '#2e1014'; // Queimado por sobrecorrente

    switch (manifest?.category) {
      case 'MCU':
        return '#005f73';
      case 'ACTUATOR':
        return '#3a1e28';
      case 'PASSIVE':
        return '#282b30';
      case 'SENSOR':
        return '#1b3a32';
      case 'INPUT':
        return '#322d25';
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
      onDragEnd={(e) => {
        const rawPos = { x: e.target.x(), y: e.target.y() };
        const snapped = snapPointToGrid(rawPos);
        e.target.position(snapped);
        onDragEnd(component.id, snapped);
      }}
    >
      {/* Sombra Neobrutalista sólida */}
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

      {/* Detalhes visuais customizados para tipos conhecidos */}
      {component.type === 'MICROCONTROLLER_ARDUINO_UNO' && (
        <Group>
          <Rect
            x={width / 2 - 40}
            y={height / 2 - 12}
            width={80}
            height={24}
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
            y={height / 2 - 4}
          />
          <Rect
            x={30}
            y={height / 2 - 8}
            width={18}
            height={16}
            fill="#a1a1aa"
            stroke="#52525b"
            strokeWidth={1}
            cornerRadius={2}
          />
          {/* LED Onboard D13 */}
          <Circle
            x={75}
            y={40}
            radius={3.5}
            fill={isLedActive ? '#eab308' : '#3f3f46'}
            stroke="#18181b"
            strokeWidth={1}
          />
          <Text text="L" fontSize={7} fill="#a1a1aa" x={82} y={37} />
        </Group>
      )}

      {component.type === 'ACTUATOR_LED' && (
        <Group>
          {/* Brilho e emissão de luz quando conduzindo (active) */}
          {isLedActive && (
            <Circle
              x={width / 2}
              y={24}
              radius={24}
              fill="rgba(239, 68, 68, 0.45)"
              shadowColor="#ef4444"
              shadowBlur={18}
            />
          )}

          {/* Cúpula do LED */}
          <Circle
            x={width / 2}
            y={24}
            radius={16}
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
          {!isDestroyed && (
            <Circle
              x={width / 2 - 4}
              y={20}
              radius={4}
              fill="rgba(255, 255, 255, 0.7)"
            />
          )}

          {/* Indicador de queima térmica */}
          {isDestroyed && (
            <Text
              text="🔥 QUEIMADO"
              fontSize={8}
              fontStyle="bold"
              fill="#ef4444"
              x={width / 2 - 26}
              y={20}
            />
          )}
        </Group>
      )}

      {component.type === 'SENSOR_ULTRASONIC_HCSR04' && (
        <Group>
          <Circle
            x={35}
            y={28}
            radius={18}
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth={2}
          />
          <Text text="T" fontSize={10} fill="#ffffff" x={31} y={23} />
          <Circle
            x={85}
            y={28}
            radius={18}
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth={2}
          />
          <Text text="R" fontSize={10} fill="#ffffff" x={81} y={23} />
        </Group>
      )}

      {/* Rótulo do Componente */}
      <Text
        text={
          isDestroyed
            ? `[DESTRUÍDO] ${component.label}`
            : component.label || manifest?.name || component.type
        }
        fontSize={11}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill={isDestroyed ? '#f87171' : '#f4f4f5'}
        x={8}
        y={height - 20}
        width={width - 16}
        align="center"
        ellipsis={true}
        listening={false}
      />

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
