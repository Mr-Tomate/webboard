import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineWorkspaceStatus,
  computeClassroomSummary,
  addPedagogicalNote,
  SAMPLE_CLASSROOM_WORKSPACES
} from '../src/utils/telemetry.ts';

test('determineWorkspaceStatus: semaforo pedagogico conforme spec 04', () => {
  // 1. Falha crítica (curto ou queima) tem prioridade máxima
  const criticoCurto = determineWorkspaceStatus({
    hasShortCircuit: true,
    hasThermalDestruction: false,
    lastActivitySecondsAgo: 10,
    compilationAttempts: 0,
    testsPassed: 0,
    testsTotal: 2
  });
  assert.equal(criticoCurto, 'FALHA_CRÍTICA');

  const criticoQueima = determineWorkspaceStatus({
    hasShortCircuit: false,
    hasThermalDestruction: true,
    lastActivitySecondsAgo: 10,
    compilationAttempts: 0,
    testsPassed: 0,
    testsTotal: 2
  });
  assert.equal(criticoQueima, 'FALHA_CRÍTICA');

  // 2. Inativo se sem atividade há mais de 300 segundos
  const inativo = determineWorkspaceStatus({
    hasShortCircuit: false,
    hasThermalDestruction: false,
    lastActivitySecondsAgo: 350,
    compilationAttempts: 0,
    testsPassed: 1,
    testsTotal: 2
  });
  assert.equal(inativo, 'INATIVO');

  // 3. Dificuldade se muitos erros de compilação
  const dificuldade = determineWorkspaceStatus({
    hasShortCircuit: false,
    hasThermalDestruction: false,
    lastActivitySecondsAgo: 30,
    compilationAttempts: 3,
    testsPassed: 0,
    testsTotal: 2
  });
  assert.equal(dificuldade, 'DIFICULDADE');

  // 4. Normal se tudo ok
  const normal = determineWorkspaceStatus({
    hasShortCircuit: false,
    hasThermalDestruction: false,
    lastActivitySecondsAgo: 20,
    compilationAttempts: 1,
    testsPassed: 2,
    testsTotal: 2
  });
  assert.equal(normal, 'NORMAL');
});

test('computeClassroomSummary: agrega metricas da turma', () => {
  const summary = computeClassroomSummary(SAMPLE_CLASSROOM_WORKSPACES);

  assert.equal(summary.totalWorkspaces, 5);
  assert.equal(summary.statusCounts.normal, 2);
  assert.equal(summary.statusCounts.difficulty, 1);
  assert.equal(summary.statusCounts.critical, 1);
  assert.equal(summary.statusCounts.inactive, 1);
  assert.equal(summary.activeWorkspaces, 4);
  assert.ok(summary.averageProgressPercent > 0);
});

test('addPedagogicalNote: insere anotacao respeitando RN-PED-01 e RN-PED-02', () => {
  const ws = SAMPLE_CLASSROOM_WORKSPACES[0];
  const updated = addPedagogicalNote(
    ws,
    'Prof. Renato',
    'Excelente organizacao dos fios coloridos!',
    'res_01'
  );

  assert.equal(updated.pedagogicalNotes.length, ws.pedagogicalNotes.length + 1);
  const lastNote = updated.pedagogicalNotes[updated.pedagogicalNotes.length - 1];
  assert.equal(lastNote.author, 'Prof. Renato');
  assert.equal(lastNote.text, 'Excelente organizacao dos fios coloridos!');
  assert.equal(lastNote.targetComponentId, 'res_01');
  // Garante que o circuito original não foi alterado (RN-PED-01)
  assert.equal(updated.circuitMetrics.componentCount, ws.circuitMetrics.componentCount);
});
