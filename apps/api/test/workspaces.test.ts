import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import type { CircuitDefinition } from '@webboard/contracts';
import { buildApp } from '../dist/app.js';

const prisma = new PrismaClient();

test('API REST Workspaces: Ciclo Completo de Vida, Colaboracao e Submissoes', async (t) => {
  const app = await buildApp(prisma);
  const runId = Date.now().toString(36);

  // Criar Tenant e Usuários de Teste no banco local
  const tenant = await prisma.tenant.create({
    data: {
      name: `Escola Teste ${runId}`,
      slug: `escola-${runId}`,
    },
  });

  const studentA = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: `Aluno Lucas ${runId}`,
      email: `lucas_${runId}@teste.com`,
      role: 'STUDENT',
    },
  });

  const studentB = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: `Aluno Gabriel ${runId}`,
      email: `gabriel_${runId}@teste.com`,
      role: 'STUDENT',
    },
  });

  const challenge = await prisma.challenge.create({
    data: {
      title: 'Desafio do Blink',
      description: 'Acione o LED a cada 1 segundo',
      difficulty: 'BEGINNER',
      kitPolicyJson: JSON.stringify({ mode: 'OPEN', allowedComponents: [] }),
      testSuiteJson: JSON.stringify([]),
    },
  });

  let createdWorkspaceId = '';

  await t.test('GET /health retorna status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'webboard-api');
  });

  await t.test('POST /api/workspaces cria workspace Solo com circuito inicial', async () => {
    const initialCircuit: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: `ckt_${runId}`,
      components: [
        {
          id: 'mcu_01',
          type: 'MICROCONTROLLER_ARDUINO_UNO',
          isLocked: true,
          position: { x: 100, y: 100 },
          parameters: {},
        },
      ],
      wires: [],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      payload: {
        name: 'Bancada do Lucas',
        type: 'SOLO',
        ownerId: studentA.id,
        circuit: initialCircuit,
        language: 'CPP',
        codeText: 'void setup() { pinMode(13, OUTPUT); } void loop() {}',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.id);
    assert.equal(body.name, 'Bancada do Lucas');
    assert.equal(body.type, 'SOLO');
    assert.equal(body.circuit.circuitId, `ckt_${runId}`);
    assert.equal(body.members.length, 1);
    assert.equal(body.members[0].userId, studentA.id);
    assert.equal(body.members[0].isOwner, true);

    createdWorkspaceId = body.id;
  });

  await t.test('GET /api/workspaces/:id recupera workspace com circuito deserializado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${createdWorkspaceId}`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.id, createdWorkspaceId);
    assert.equal(body.circuit.components.length, 1);
    assert.equal(body.circuit.components[0].id, 'mcu_01');
  });

  await t.test('PUT /api/workspaces/:id atualiza componentes e fiação do circuito', async () => {
    const updatedCircuit: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: `ckt_${runId}`,
      components: [
        {
          id: 'mcu_01',
          type: 'MICROCONTROLLER_ARDUINO_UNO',
          isLocked: true,
          position: { x: 100, y: 100 },
          parameters: {},
        },
        {
          id: 'led_01',
          type: 'ACTUATOR_LED',
          isLocked: false,
          position: { x: 200, y: 100 },
          parameters: { color: 'RED' },
        },
      ],
      wires: [
        {
          id: 'w1',
          from: { componentId: 'mcu_01', pinId: 'D13' },
          to: { componentId: 'led_01', pinId: 'ANODE' },
          color: 'RED',
        },
      ],
    };

    const res = await app.inject({
      method: 'PUT',
      url: `/api/workspaces/${createdWorkspaceId}`,
      payload: {
        circuit: updatedCircuit,
        codeText: '// Codigo atualizado com blink',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.circuit.components.length, 2);
    assert.equal(body.circuit.wires.length, 1);
    assert.equal(body.codeText, '// Codigo atualizado com blink');
  });

  await t.test('POST /api/workspaces/:id/members adiciona colega e converte para GROUP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${createdWorkspaceId}/members`,
      payload: {
        userId: studentB.id,
      },
    });

    assert.equal(res.statusCode, 201);

    // Verificar se virou GROUP
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${createdWorkspaceId}`,
    });
    const ws = JSON.parse(getRes.body);
    assert.equal(ws.type, 'GROUP');
    assert.equal(ws.members.length, 2);
  });

  await t.test('POST /api/workspaces/:id/submissions cria snapshot sequencial v1 e v2', async () => {
    // 1. Submissão v1
    const sub1Res = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${createdWorkspaceId}/submissions`,
      payload: {
        challengeId: challenge.id,
        userId: studentA.id,
        codeText: 'int led = 13;',
        circuit: { schemaVersion: '1.0.0', circuitId: 'c1', components: [], wires: [] },
        status: 'APPROVED',
      },
    });

    assert.equal(sub1Res.statusCode, 201);
    const snap1 = JSON.parse(sub1Res.body);
    assert.equal(snap1.versionNumber, 1);
    assert.equal(snap1.submittedBy.userId, studentA.id);
    assert.deepEqual(snap1.submittedBy.collaboratorUserIds, [studentB.id]);

    // 2. Submissão v2
    const sub2Res = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${createdWorkspaceId}/submissions`,
      payload: {
        challengeId: challenge.id,
        userId: studentB.id,
        codeText: 'int led = 13; // versao 2',
        circuit: { schemaVersion: '1.0.0', circuitId: 'c1', components: [], wires: [] },
        status: 'APPROVED',
      },
    });

    assert.equal(sub2Res.statusCode, 201);
    const snap2 = JSON.parse(sub2Res.body);
    assert.equal(snap2.versionNumber, 2);
    assert.equal(snap2.submittedBy.userId, studentB.id);
    assert.deepEqual(snap2.submittedBy.collaboratorUserIds, [studentA.id]);
  });

  await t.test('GET /api/workspaces/:id/submissions lista histórico', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${createdWorkspaceId}/submissions`,
    });

    assert.equal(res.statusCode, 200);
    const history = JSON.parse(res.body);
    assert.equal(history.length, 2);
    assert.equal(history[0].versionNumber, 2); // ordem descendente
    assert.equal(history[1].versionNumber, 1);
  });

  await t.test('DELETE /api/workspaces/:id exclui workspace', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/workspaces/${createdWorkspaceId}`,
    });

    assert.equal(res.statusCode, 204);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${createdWorkspaceId}`,
    });
    assert.equal(getRes.statusCode, 404);
  });

  await app.close();
  await prisma.$disconnect();
});
