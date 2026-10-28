import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  snapToGrid,
  snapPointToGrid,
  screenToWorld,
  worldToScreen,
  clampZoom,
  calculateZoomAtPointer,
  getPinAbsolutePosition,
  calculateWireBezierControlPoints,
  getWirePathPoints,
  GRID_SIZE
} from '../src/utils/geometry.ts';

test('snapToGrid: arredonda para múltiplos de GRID_SIZE (20px)', () => {
  assert.equal(snapToGrid(0), 0);
  assert.equal(snapToGrid(8), 0);
  assert.equal(snapToGrid(10), 20);
  assert.equal(snapToGrid(29), 20);
  assert.equal(snapToGrid(31), 40);
  assert.equal(snapToGrid(-11), -20);
});

test('snapPointToGrid: ajusta ponto {x, y}', () => {
  const p = { x: 104, y: 38 };
  const snapped = snapPointToGrid(p);
  assert.deepEqual(snapped, { x: 100, y: 40 });
});

test('screenToWorld e worldToScreen: conversões bidirecionais exatas', () => {
  const stageOffset = { x: 150, y: 80 };
  const scale = 1.5;

  const worldPos = { x: 200, y: 300 };
  const screenPos = worldToScreen(worldPos, stageOffset, scale);

  assert.equal(screenPos.x, 200 * 1.5 + 150); // 450
  assert.equal(screenPos.y, 300 * 1.5 + 80);  // 530

  const backToWorld = screenToWorld(screenPos, stageOffset, scale);
  assert.ok(Math.abs(backToWorld.x - worldPos.x) < 1e-6);
  assert.ok(Math.abs(backToWorld.y - worldPos.y) < 1e-6);
});

test('clampZoom: restringe escala entre 0.2x e 3.0x', () => {
  assert.equal(clampZoom(0.05), 0.2);
  assert.equal(clampZoom(1.0), 1.0);
  assert.equal(clampZoom(5.0), 3.0);
});

test('calculateZoomAtPointer: mantém a posição do cursor sobre o mesmo ponto do mundo', () => {
  const pointer = { x: 400, y: 300 };
  const initialOffset = { x: 0, y: 0 };
  const initialScale = 1.0;
  const newScale = 2.0;

  const newOffset = calculateZoomAtPointer(pointer, initialOffset, initialScale, newScale);
  const worldPointAfterZoom = screenToWorld(pointer, newOffset, newScale);
  assert.ok(Math.abs(worldPointAfterZoom.x - 400) < 1e-6);
  assert.ok(Math.abs(worldPointAfterZoom.y - 300) < 1e-6);
});

test('getPinAbsolutePosition: calcula offset com e sem rotação', () => {
  const compPos = { x: 100, y: 100 };
  const anchor = { x: 10, y: 20 };

  const pin0 = getPinAbsolutePosition(compPos, anchor, 0);
  assert.deepEqual(pin0, { x: 110, y: 120 });

  const pin90 = getPinAbsolutePosition(compPos, anchor, 90);
  assert.ok(Math.abs(pin90.x - (100 - 20)) < 1e-6);
  assert.ok(Math.abs(pin90.y - (100 + 10)) < 1e-6);
});

test('calculateWireBezierControlPoints: gera pontos adaptativos e flexiveis sem mergulho nos pinos', () => {
  // Cenário 1: Conexão predominantemente horizontal com caimento gravitacional
  const from = { x: 100, y: 100 };
  const to = { x: 300, y: 100 };
  const [cp1, cp2] = calculateWireBezierControlPoints(from, to);

  // Pontos de controle avançam organicamente na direção da corda
  assert.ok(cp1.x > from.x && cp1.x < to.x);
  assert.ok(cp2.x > from.x && cp2.x < to.x);
  assert.ok(cp1.y > 100);
  assert.ok(cp2.y > 100);

  // Cenário 2: Fio descendo em direção à placa (dy > 0), cp2 nunca pode ultrapassar o pino (evita U-turn por baixo)
  const compTop = { x: 120, y: 50 };
  const arduinoPin = { x: 150, y: 250 };
  const [, cp2Down] = calculateWireBezierControlPoints(compTop, arduinoPin);
  assert.ok(cp2Down.y <= arduinoPin.y, 'O ponto de controle não deve mergulhar além do pino de destino');
});

test('getWirePathPoints: intercala waypoints ordenadamente entre start e end', () => {
  const start = { x: 10, y: 20 };
  const end = { x: 100, y: 200 };

  // Sem waypoints
  const pathWithout = getWirePathPoints(start, end);
  assert.deepEqual(pathWithout, [start, end]);

  // Com waypoints
  const waypoints = [
    { x: 50, y: 20 },
    { x: 50, y: 100 }
  ];
  const pathWith = getWirePathPoints(start, end, waypoints);
  assert.equal(pathWith.length, 4);
  assert.deepEqual(pathWith[0], start);
  assert.deepEqual(pathWith[1], waypoints[0]);
  assert.deepEqual(pathWith[2], waypoints[1]);
  assert.deepEqual(pathWith[3], end);
});
