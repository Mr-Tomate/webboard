import React from 'react';
import { Group, Rect, Text, Circle, Line } from 'react-konva';
import type { ComponentDefinition, Position2D, WorkbenchMode } from '@webboard/contracts';
import type { ComponentElectricalState } from '@webboard/core';
import { COMPONENT_CATALOG } from '../../catalog/manifests.ts';
import { PinAnchorNode } from './PinAnchorNode.tsx';
import { snapPointToGrid } from '../../utils/geometry.ts';
import { calculateResistorColorBands } from '../../utils/resistor-color-code.ts';

interface ComponentNodeProps {
  component: ComponentDefinition;
  isSelected: boolean;
  mode: WorkbenchMode;
  isConnectingWire: boolean;
  highlightedPinKeys: Set<string>;
  electricalState?: ComponentElectricalState;
  lockedBy?: { userId: string; userName: string; lockedAt: string };
  onSelect: (componentId: string) => void;
  onDragStart?: (componentId: string) => void;
  onDragEnd: (componentId: string, newPos: Position2D) => void;
  onStartWire: (componentId: string, pinId: string, worldPos: Position2D) => void;
  onFinishWire: (componentId: string, pinId: string) => void;
  onPinHoverStart?: (componentId: string, pinId: string) => void;
  onPinHoverEnd?: () => void;
}

/**
 * ComponentNode - Renderizador Vetorial Nativo e Confiável dos Componentes.
 *
 * Mapeia os dados do manifesto (dimensões e âncoras de pinos) e desenha o corpo
 * e detalhes serigráficos de forma síncrona com aceleração de hardware 60 FPS.
 *
 * Suporta Soft-Locking Colaborativo (Eixo D): quando outro usuário manipula a peça,
 * exibe contorno azul com etiqueta flutuante e bloqueia o arrasto local.
 */
export const ComponentNode: React.FC<ComponentNodeProps> = ({
  component,
  isSelected,
  mode,
  isConnectingWire,
  highlightedPinKeys,
  electricalState,
  lockedBy,
  onSelect,
  onDragStart,
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
  const isLockedByPeer = !!lockedBy;
  const canDrag = !isSimulating && !component.isLocked && !isLockedByPeer;

  const isLedActive = electricalState?.visualState === 'active';
  const isDestroyed = electricalState?.visualState === 'destroyed' || electricalState?.isDestroyed;

  const isBreadboard = component.type === 'BOARD_BREADBOARD_HALF' || component.type === 'BOARD_BREADBOARD';

  // Código de cores do resistor calculado dinamicamente pela Norma IEC 60062
  const resistorBands = component.type === 'PASSIVE_RESISTOR'
    ? calculateResistorColorBands(component.parameters?.resistanceOhms ?? 220)
    : null;

  // Lente do LED em repouso e ativa
  const getLedBaseColor = () => {
    switch (component.parameters?.color) {
      case 'GREEN': return '#22c55e';
      case 'BLUE': return '#3b82f6';
      case 'YELLOW': return '#eab308';
      case 'WHITE': return '#f4f4f5';
      case 'RED':
      default:
        return '#ef4444';
    }
  };

  const getLedActiveColor = () => {
    switch (component.parameters?.color) {
      case 'GREEN': return '#4ade80';
      case 'BLUE': return '#60a5fa';
      case 'YELLOW': return '#fde047';
      case 'WHITE': return '#ffffff';
      case 'RED':
      default:
        return '#ff4d4d';
    }
  };

  const getThemeColor = () => {
    if (isDestroyed) return '#2e1014'; // Queimado por sobrecorrente

    if (isBreadboard) return '#f4f1ea'; // Bege marfim clássico da Protoboard

    switch (manifest?.category) {
      case 'MCU':
        return '#005f73'; // Azul petróleo Arduino Uno
      case 'ACTUATOR':
        return '#27272a';
      case 'PASSIVE':
        return '#27272a';
      case 'SENSOR':
        return '#1b3a32';
      default:
        return '#18181b';
    }
  };

  const strokeColor = isDestroyed
    ? '#ef4444'
    : isLockedByPeer
    ? '#0284c7'
    : isSelected
    ? '#00e599'
    : isBreadboard
    ? '#52525b'
    : '#3f3f46';

  const strokeWidth = isLockedByPeer ? 3 : isSelected || isDestroyed ? 2.5 : isBreadboard ? 2 : 1.5;

  return (
    <Group
      x={component.position.x}
      y={component.position.y}
      draggable={canDrag}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isLockedByPeer ? 'not-allowed' : canDrag ? 'move' : 'pointer';
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grab';
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(component.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(component.id);
      }}
      onDragStart={() => {
        onDragStart?.(component.id);
      }}
      onDragMove={(e) => {
        // Atualiza a posição em tempo real para os fios conectados acompanharem a 60 FPS
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
        x={isBreadboard ? 6 : 4}
        y={isBreadboard ? 6 : 4}
        width={width}
        height={height}
        fill="#09090b"
        cornerRadius={isBreadboard ? 8 : 4}
      />

      {/* Corpo principal do componente */}
      <Rect
        width={width}
        height={height}
        fill={getThemeColor()}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        cornerRadius={isBreadboard ? 8 : 4}
      />

      {/* ========================================================
          ETIQUETA FLUTUANTE DE SOFT-LOCK COLABORATIVO (EIXO D)
          ======================================================== */}
      {isLockedByPeer && lockedBy && (
        <Group x={0} y={-24} listening={false}>
          <Rect
            x={0}
            y={0}
            width={Math.max(110, (lockedBy.userName.length + 11) * 7.5)}
            height={20}
            fill="#0284c7"
            stroke="#09090b"
            strokeWidth={1.5}
            cornerRadius={4}
          />
          <Text
            text={`🔒 ${lockedBy.userName} movendo...`}
            fontSize={10}
            fontFamily="sans-serif"
            fontStyle="bold"
            fill="#ffffff"
            x={6}
            y={4}
          />
        </Group>
      )}

      {/* ========================================================
          DETALHES VETORIAIS ESPECÍFICOS POR COMPONENTE
          ======================================================== */}

      {/* 0. Protoboard Half-Size 400 Furos */}
      {isBreadboard && (
        <Group listening={false}>
          {/* Linhas serigráficas dos barramentos superiores */}
          <Line points={[25, 12, 515, 12]} stroke="#ef4444" strokeWidth={2} />
          <Line points={[25, 46, 515, 46]} stroke="#3b82f6" strokeWidth={2} />
          <Text text="+" fontSize={12} fontStyle="bold" fill="#ef4444" x={12} y={5} />
          <Text text="-" fontSize={14} fontStyle="bold" fill="#3b82f6" x={14} y={38} />
          <Text text="+" fontSize={12} fontStyle="bold" fill="#ef4444" x={522} y={5} />
          <Text text="-" fontSize={14} fontStyle="bold" fill="#3b82f6" x={524} y={38} />

          {/* Fenda central isolante DIP */}
          <Rect
            x={15}
            y={136}
            width={510}
            height={8}
            fill="#ded8ca"
            stroke="#c8c0b0"
            strokeWidth={1}
            cornerRadius={2}
          />

          {/* Serigrafia das colunas 1..30 */}
          {[1, 5, 10, 15, 20, 25, 30].map((col) => {
            const x = 35 + (col - 1) * 16;
            return (
              <React.Fragment key={col}>
                <Text
                  text={String(col)}
                  fontSize={8}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill="#71717a"
                  x={x - 6}
                  y={52}
                  width={12}
                  align="center"
                />
                <Text
                  text={String(col)}
                  fontSize={8}
                  fontFamily="monospace"
                  fontStyle="bold"
                  fill="#71717a"
                  x={x - 6}
                  y={224}
                  width={12}
                  align="center"
                />
              </React.Fragment>
            );
          })}

          {/* Serigrafia das letras de linhas A-E e F-J nas laterais */}
          {['A', 'B', 'C', 'D', 'E'].map((letter, idx) => (
            <React.Fragment key={letter}>
              <Text
                text={letter}
                fontSize={8}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#71717a"
                x={14}
                y={60 + idx * 14}
              />
              <Text
                text={letter}
                fontSize={8}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#71717a"
                x={525}
                y={60 + idx * 14}
              />
            </React.Fragment>
          ))}

          {['F', 'G', 'H', 'I', 'J'].map((letter, idx) => (
            <React.Fragment key={letter}>
              <Text
                text={letter}
                fontSize={8}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#71717a"
                x={14}
                y={150 + idx * 14}
              />
              <Text
                text={letter}
                fontSize={8}
                fontFamily="monospace"
                fontStyle="bold"
                fill="#71717a"
                x={525}
                y={150 + idx * 14}
              />
            </React.Fragment>
          ))}

          {/* Linhas serigráficas dos barramentos inferiores */}
          <Line points={[25, 234, 515, 234]} stroke="#ef4444" strokeWidth={2} />
          <Line points={[25, 268, 515, 268]} stroke="#3b82f6" strokeWidth={2} />
          <Text text="+" fontSize={12} fontStyle="bold" fill="#ef4444" x={12} y={227} />
          <Text text="-" fontSize={14} fontStyle="bold" fill="#3b82f6" x={14} y={260} />
          <Text text="+" fontSize={12} fontStyle="bold" fill="#ef4444" x={522} y={227} />
          <Text text="-" fontSize={14} fontStyle="bold" fill="#3b82f6" x={524} y={260} />

          {/* Serigrafia e identificação no centro da fenda */}
          <Text
            text="PROTOBOARD 400 FUROS (HALF-SIZE)"
            fontSize={9}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#a1a1aa"
            x={180}
            y={135}
          />
        </Group>
      )}

      {/* 1. Arduino Uno R3: Chip ATmega328P DIP-28, porta USB, cristal e LED L */}
      {component.type === 'MICROCONTROLLER_ARDUINO_UNO' && (
        <Group>
          {/* Microcontrolador ATmega328P DIP-28 */}
          <Rect
            x={width / 2 - 42}
            y={height / 2 - 14}
            width={84}
            height={28}
            fill="#121214"
            stroke="#52525b"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          <Text
            text="ATmega328P 16MHz"
            fontSize={9}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#00e599"
            x={width / 2 - 40}
            y={height / 2 - 5}
          />
          {/* Porta USB Tipo-B prateada */}
          <Rect
            x={18}
            y={height / 2 - 12}
            width={24}
            height={22}
            fill="#a1a1aa"
            stroke="#52525b"
            strokeWidth={1.5}
            cornerRadius={2}
          />
          {/* Jack de alimentação DC */}
          <Rect
            x={18}
            y={height - 35}
            width={26}
            height={18}
            fill="#18181b"
            stroke="#3f3f46"
            strokeWidth={1}
            cornerRadius={2}
          />
          {/* LED Onboard D13 ("L") */}
          <Circle
            x={82}
            y={42}
            radius={4}
            fill={isLedActive ? '#eab308' : '#3f3f46'}
            stroke="#18181b"
            strokeWidth={1}
          />
          <Text text="L" fontSize={8} fontFamily="monospace" fontStyle="bold" fill="#a1a1aa" x={90} y={38} />
          {/* Serigrafia e identificação */}
          <Text
            text="ARDUINO UNO R3"
            fontSize={11}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#38bdf8"
            x={width / 2 - 45}
            y={height - 24}
          />
        </Group>
      )}

      {/* 2. Resistor de Precisão: Corpo cerâmico com faixas coloridas dinâmicas IEC 60062 */}
      {component.type === 'PASSIVE_RESISTOR' && (
        <Group>
          {/* Terminais metálicos laterais */}
          <Line points={[12, 30, 36, 30]} stroke="#a1a1aa" strokeWidth={3.5} lineCap="round" />
          <Line points={[104, 30, 128, 30]} stroke="#a1a1aa" strokeWidth={3.5} lineCap="round" />
          {/* Corpo cerâmico cilíndrico */}
          <Rect
            x={36}
            y={15}
            width={68}
            height={30}
            fill={isDestroyed ? '#261214' : '#d4b483'}
            stroke="#18181b"
            strokeWidth={2}
            cornerRadius={4}
          />
          {/* Faixas coloridas do resistor (Norma IEC 60062) */}
          {!isDestroyed && resistorBands && (
            <>
              <Rect x={46} y={15} width={6} height={30} fill={resistorBands.band1.hex} />
              <Rect x={58} y={15} width={6} height={30} fill={resistorBands.band2.hex} />
              <Rect x={70} y={15} width={6} height={30} fill={resistorBands.band3.hex} />
              <Rect x={88} y={15} width={6} height={30} fill={resistorBands.band4.hex} />
            </>
          )}
          {isDestroyed && (
            <Text text="QUEIMADO" fontSize={9} fontStyle="bold" fill="#ef4444" x={42} y={24} />
          )}
        </Group>
      )}

      {/* 3. LED Difuso 5mm: Cúpula ampla com halo generoso e pernas até os pinos */}
      {component.type === 'ACTUATOR_LED' && (
        <Group>
          {/* Halo de luz difusa neon quando conduzindo corrente */}
          {isLedActive && (
            <Circle
              x={width / 2}
              y={34}
              radius={32}
              fill="rgba(239, 68, 68, 0.45)"
              shadowColor={getLedActiveColor()}
              shadowBlur={24}
            />
          )}

          {/* Cúpula do LED 5mm ampliada */}
          <Circle
            x={width / 2}
            y={34}
            radius={22}
            fill={
              isDestroyed
                ? '#1c1917'
                : isLedActive
                ? getLedActiveColor()
                : getLedBaseColor()
            }
            stroke={isDestroyed ? '#7f1d1d' : '#ffffff'}
            strokeWidth={2}
          />

          {/* Brilho reflexivo na cúpula */}
          {!isDestroyed && (
            <Circle
              x={width / 2 - 6}
              y={28}
              radius={5}
              fill="rgba(255, 255, 255, 0.65)"
            />
          )}

          {/* Terminais metálicos saindo da base do LED até os pinos */}
          <Line points={[width / 2 - 12, 55, 28, 76]} stroke="#a1a1aa" strokeWidth={2.5} lineCap="round" />
          <Line points={[width / 2 + 12, 55, 62, 76]} stroke="#a1a1aa" strokeWidth={2.5} lineCap="round" />

          {/* Indicador de destruição térmica por sobrecorrente */}
          {isDestroyed && (
            <Text
              text="QUEIMADO"
              fontSize={8}
              fontStyle="bold"
              fill="#ef4444"
              x={width / 2 - 24}
              y={30}
            />
          )}
        </Group>
      )}

      {/* 4. Sensor Ultrassônico HC-SR04: Transdutores T e R ampliados */}
      {component.type === 'SENSOR_ULTRASONIC_HCSR04' && (
        <Group>
          {/* Transdutor Emissor (T) */}
          <Circle
            x={45}
            y={36}
            radius={24}
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth={2}
          />
          <Text text="T" fontSize={13} fontFamily="monospace" fontStyle="bold" fill="#ffffff" x={40} y={28} />
          {/* Transdutor Receptor (R) */}
          <Circle
            x={115}
            y={36}
            radius={24}
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth={2}
          />
          <Text text="R" fontSize={13} fontFamily="monospace" fontStyle="bold" fill="#ffffff" x={110} y={28} />
          {/* Cristal de quartzo */}
          <Rect
            x={74}
            y={28}
            width={12}
            height={16}
            fill="#a1a1aa"
            stroke="#52525b"
            strokeWidth={1}
            cornerRadius={2}
          />
        </Group>
      )}

      {/* 5. Pushbutton: Botão tátil mecânico ampliado */}
      {component.type === 'INPUT_PUSHBUTTON' && (
        <Group>
          {/* Terminais metálicos laterais */}
          <Line points={[14, 45, 25, 45]} stroke="#a1a1aa" strokeWidth={3} lineCap="round" />
          <Line points={[75, 45, 86, 45]} stroke="#a1a1aa" strokeWidth={3} lineCap="round" />
          {/* Base metálica do switch */}
          <Rect
            x={25}
            y={20}
            width={50}
            height={50}
            fill="#18181b"
            stroke="#52525b"
            strokeWidth={2}
            cornerRadius={6}
          />
          {/* Botão atuador redondo */}
          <Circle
            x={50}
            y={45}
            radius={16}
            fill="#3f3f46"
            stroke="#71717a"
            strokeWidth={1.5}
          />
        </Group>
      )}

      {/* 6. Potenciômetro: Knob rotativo ampliado com indicador */}
      {component.type === 'INPUT_POTENTIOMETER' && (
        <Group>
          <Circle
            x={width / 2}
            y={40}
            radius={28}
            fill="#18181b"
            stroke="#52525b"
            strokeWidth={2}
          />
          <Circle
            x={width / 2}
            y={40}
            radius={18}
            fill="#0284c7"
          />
          <Line points={[width / 2, 40, width / 2, 24]} stroke="#ffffff" strokeWidth={3} lineCap="round" />
          {/* Terminais para os pinos inferiores */}
          <Line points={[width / 2 - 35, 68, 25, 80]} stroke="#a1a1aa" strokeWidth={2} />
          <Line points={[width / 2, 68, 60, 80]} stroke="#a1a1aa" strokeWidth={2} />
          <Line points={[width / 2 + 35, 68, 95, 80]} stroke="#a1a1aa" strokeWidth={2} />
        </Group>
      )}

      {/* 7. Buzzer Piezoelétrico ampliado */}
      {component.type === 'ACTUATOR_BUZZER' && (
        <Group>
          <Circle
            x={width / 2}
            y={42}
            radius={30}
            fill="#18181b"
            stroke="#52525b"
            strokeWidth={2}
          />
          <Circle
            x={width / 2}
            y={42}
            radius={9}
            fill="#3f3f46"
            stroke="#52525b"
            strokeWidth={1}
          />
          <Line points={[width / 2 - 20, 72, 30, 78]} stroke="#a1a1aa" strokeWidth={2} />
          <Line points={[width / 2 + 20, 72, 70, 78]} stroke="#a1a1aa" strokeWidth={2} />
        </Group>
      )}

      {/* Rótulo do Componente (se não for Arduino nem Breadboard que têm serigrafia própria) */}
      {component.type !== 'MICROCONTROLLER_ARDUINO_UNO' && !isBreadboard && (
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

      {/* ========================================================
          PINOS DE ANCORAGEM MAGNÉTICA MAPEADOS DO MANIFESTO
          ======================================================== */}
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
            isBreadboard={isBreadboard}
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
