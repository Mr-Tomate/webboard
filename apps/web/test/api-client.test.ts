import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebboardApiClient } from '../src/api/client.ts';
import type { CircuitDefinition, EvaluationResult } from '@webboard/contracts';

test('WebboardApiClient: formata requisição PUT para saveWorkspace', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedMethod = '';
  let interceptedBody = '';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    interceptedUrl = String(input);
    interceptedMethod = init?.method || 'GET';
    interceptedBody = String(init?.body || '');
    return new Response(JSON.stringify({ id: 'ws_test_01', name: 'Bancada Alpha' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const client = new WebboardApiClient('http://localhost:3333');
    const dummyCircuit: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: 'ckt_01',
      components: [],
      wires: []
    };

    const res = await client.saveWorkspace('ws_test_01', {
      circuit: dummyCircuit,
      codeText: 'void setup() {}',
      language: 'CPP'
    });

    assert.equal(res.id, 'ws_test_01');
    assert.equal(interceptedUrl, 'http://localhost:3333/api/workspaces/ws_test_01');
    assert.equal(interceptedMethod, 'PUT');

    const parsedBody = JSON.parse(interceptedBody);
    assert.equal(parsedBody.codeText, 'void setup() {}');
    assert.equal(parsedBody.language, 'CPP');
    assert.deepEqual(parsedBody.circuit, dummyCircuit);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WebboardApiClient: formata requisição POST para submitChallenge', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedBody = '';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    interceptedUrl = String(input);
    interceptedBody = String(init?.body || '');
    return new Response(
      JSON.stringify({
        id: 'sub_01',
        workspaceId: 'ws_01',
        challengeId: 'ch_01',
        versionNumber: 1,
        status: 'APPROVED'
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  };

  try {
    const client = new WebboardApiClient('http://localhost:3333');
    const dummyCircuit: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: 'ckt_01',
      components: [],
      wires: []
    };

    const evalResult: EvaluationResult = {
      status: 'APPROVED',
      totalExecutionVirtualSeconds: 3.5,
      summary: { totalTests: 2, passedTests: 2, failedTests: 0 },
      testResults: [
        { testCaseId: 'tc_01', passed: true, executionTimeVirtualSeconds: 1.0, message: 'Sucesso' }
      ]
    };

    const res = await client.submitChallenge('ws_01', {
      challengeId: 'ch_01',
      userId: 'usr_aluno_01',
      circuit: dummyCircuit,
      codeText: 'void loop() {}',
      language: 'CPP',
      status: 'APPROVED',
      evaluation: evalResult
    });

    assert.equal(res.status, 'APPROVED');
    assert.equal(interceptedUrl, 'http://localhost:3333/api/workspaces/ws_01/submissions');

    const parsed = JSON.parse(interceptedBody);
    assert.equal(parsed.challengeId, 'ch_01');
    assert.equal(parsed.userId, 'usr_aluno_01');
    assert.deepEqual(parsed.evaluation, evalResult);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
