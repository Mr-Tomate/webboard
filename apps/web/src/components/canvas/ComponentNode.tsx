import React, { useState, useEffect } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import type { ComponentDefinition, Position2D, WorkbenchMode } from '@webboard/contracts';
import type { ComponentElectricalState } from '@webboard/core';
import { COMPONENT_CATALOG } from '../../catalog/manifests.ts';
import { getComponentImage } from '../../catalog/component-assets.ts';
import { PinAnchorNode } from './PinAnchorNode.tsx';
import { snapPointToGrid } from '../../utils/geometry.ts';

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

/**
 * ComponentNode - Renderizador Genérico de Componentes da Bancada.
 *
 * Consome os manifests e texturas SVG vetorizadas sem formas geométricas hardcoded,
 * permitindo extensibilidade total conforme Spec 08 e Spec 12.
 */
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

  const isDestroyed = electricalState?.visualState === 'destroyed' || electricalState?.isDestroyed;
  const visualState = isDestroyed
    ? 'failure'
    : electricalState?.visualState === 'active'
    ? 'active'
    : 'default';

  const [svgImage, setSvgImage] = useState<HTMLImageElement | null>(() =>
    getComponentImage(component.type, visualState)
  );

  useEffect(() => {
    const img = getComponentImage(component.type, visualState);
    if (!img) return;

    if (img.complete) {
      setSvgImage(img);
    } else {
      img.onload = () => setSvgImage(img);
    }
  }, [component.type, visualState]);

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
      {/* Sombra Neobrutalista preta sólida */}
      <Rect
        x={4}
        y={4}
        width={width}
        height={height}
        fill="#09090b"
        cornerRadius={4}
      />

      {/* Renderização do Asset SVG Vetorial do Component Bundle */}
      {svgImage ? (
        <KonvaImage
          image={svgImage}
          width={width}
          height={height}
        />
      ) : (
        <Rect
          width={width}
          height={height}
          fill="#1f2023"
          cornerRadius={4}
        />
      )}

      {/* Contorno Neobrutalista de Seleção ou Falha */}
      <Rect
        width={width}
        height={height}
        stroke={isDestroyed ? '#ef4444' : isSelected ? '#00e599' : '#18181b'}
        strokeWidth={isSelected || isDestroyed ? 2.5 : 1.5}
        cornerRadius={4}
        listening={false}
      />

      {/* Rótulo descritivo do componente */}
      <Text
        text={
          isDestroyed
            ? `[FALHA] ${component.label}`
            : component.label || manifest?.name || component.type
        }
        fontSize={9}
        fontFamily="monospace"
        fontStyle="bold"
        fill={isDestroyed ? '#f87171' : '#a1a1aa'}
        x={4}
        y={height + 6}
        width={width - 8}
        align="center"
        ellipsis={true}
        listening={false}
      />

      {/* Pinos de Ancoragem Magnética mapeados do Manifesto */}
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
