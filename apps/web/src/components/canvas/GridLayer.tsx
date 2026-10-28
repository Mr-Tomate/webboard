import React from 'react';
import { Layer, Shape } from 'react-konva';
import type { Position2D } from '@webboard/contracts';
import { GRID_SIZE, MAJOR_GRID_FACTOR } from '../../utils/geometry.js';

interface GridLayerProps {
  stageOffset: Position2D;
  scale: number;
  width: number;
  height: number;
}

export const GridLayer: React.FC<GridLayerProps> = ({
  stageOffset,
  scale,
  width,
  height
}) => {
  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(context, shape) => {
          const ctx = context._context as CanvasRenderingContext2D;

          // Limites do mundo visíveis no viewport atual
          const startWorldX = Math.floor((-stageOffset.x) / scale / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
          const endWorldX = Math.ceil((-stageOffset.x + width) / scale / GRID_SIZE) * GRID_SIZE + GRID_SIZE;

          const startWorldY = Math.floor((-stageOffset.y) / scale / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
          const endWorldY = Math.ceil((-stageOffset.y + height) / scale / GRID_SIZE) * GRID_SIZE + GRID_SIZE;

          const majorStep = GRID_SIZE * MAJOR_GRID_FACTOR;

          // 1. Linhas Secundárias (20px) - sutil
          ctx.beginPath();
          ctx.strokeStyle = '#1e1e24';
          ctx.lineWidth = 1 / scale;

          for (let x = startWorldX; x <= endWorldX; x += GRID_SIZE) {
            if (x % majorStep !== 0) {
              ctx.moveTo(x, startWorldY);
              ctx.lineTo(x, endWorldY);
            }
          }

          for (let y = startWorldY; y <= endWorldY; y += GRID_SIZE) {
            if (y % majorStep !== 0) {
              ctx.moveTo(startWorldX, y);
              ctx.lineTo(endWorldX, y);
            }
          }
          ctx.stroke();

          // 2. Linhas Primárias / Major (100px) - contraste maior
          ctx.beginPath();
          ctx.strokeStyle = '#2d2d38';
          ctx.lineWidth = 1.5 / scale;

          const startMajorX = Math.floor(startWorldX / majorStep) * majorStep;
          for (let x = startMajorX; x <= endWorldX; x += majorStep) {
            ctx.moveTo(x, startWorldY);
            ctx.lineTo(x, endWorldY);
          }

          const startMajorY = Math.floor(startWorldY / majorStep) * majorStep;
          for (let y = startMajorY; y <= endWorldY; y += majorStep) {
            ctx.moveTo(startWorldX, y);
            ctx.lineTo(endWorldX, y);
          }
          ctx.stroke();

          // 3. Ponto de Origem (0, 0) demarcado
          ctx.beginPath();
          ctx.strokeStyle = '#00e599';
          ctx.lineWidth = 2 / scale;
          ctx.moveTo(-15, 0);
          ctx.lineTo(15, 0);
          ctx.moveTo(0, -15);
          ctx.lineTo(0, 15);
          ctx.stroke();
        }}
      />
    </Layer>
  );
};
