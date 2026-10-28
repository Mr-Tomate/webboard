import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkbenchSceneGraph } from '../src/engine/WorkbenchSceneGraph.ts';

test('WorkbenchSceneGraph: inicializa circuito padrão e notifica observadores', () => {
  const scene = new WorkbenchSceneGraph();
  assert.equal(scene.getComponents().length, 3);
  assert.equal(scene.getWires().length, 3);

  let notified = false;
  const unsubscribe = scene.subscribe(() => {
    notified = true;
  });

  scene.updateComponentPosition('res_01', { x: 400, y: 160 });
  assert.equal(notified, true);
  assert.deepEqual(scene.getComponent('res_01')?.position, { x: 400, y: 160 });

  unsubscribe();
});

test('WorkbenchSceneGraph: adiciona e remove componentes com snap to grid', () => {
  const scene = new WorkbenchSceneGraph();
  const initialCount = scene.getComponents().length;

  const added = scene.addComponent('PASSIVE_RESISTOR', { x: 204, y: 198 });
  assert.ok(added);
  assert.equal(added.position.x, 200); // 204 snap -> 200
  assert.equal(added.position.y, 200); // 198 snap -> 200
  assert.equal(scene.getComponents().length, initialCount + 1);

  scene.removeComponent(added.id);
  assert.equal(scene.getComponents().length, initialCount);
  assert.equal(scene.getComponent(added.id), undefined);
});

test('WorkbenchSceneGraph: fluxo de fiação e waypoints', () => {
  const scene = new WorkbenchSceneGraph();

  scene.startWireDrag('mcu_uno_01', 'D12', { x: 175, y: 170 });
  assert.ok(scene.getDraggingWire());

  scene.addWireWaypoint({ x: 250, y: 170 });
  assert.equal(scene.getDraggingWire()?.waypoints.length, 1);

  // Tentativa no mesmo pino não fecha e mantém ativo
  const same = scene.finishWireDrag('mcu_uno_01', 'D12');
  assert.equal(same, null);
  assert.ok(scene.getDraggingWire());

  // Conexão em pino diferente cria condutor
  const finished = scene.finishWireDrag('res_01', 'PIN_1');
  assert.ok(finished);
  assert.equal(scene.getDraggingWire(), null);
  assert.equal(finished.from.pinId, 'D12');
  assert.equal(finished.to.pinId, 'PIN_1');
  assert.equal(finished.waypoints?.length, 1);
});
