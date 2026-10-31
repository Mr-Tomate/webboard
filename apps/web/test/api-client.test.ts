import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebboardApiClient } from '../src/api/client.ts';
import type { CircuitDefinition, EvaluationResult, SubmissionSnapshot } from '@webboard/contracts';

test('WebboardApiClient: formata requisição GET para getWorkspace', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedMethod = '';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    interceptedUrl = String(input);
    interceptedMethod = init?.method || 'GET';
    return new Response(
      JSON.stringify({
        id: 'ws_test_01',
        name: 'Bancada Alpha',
        type: 'SOLO',
        language: 'CPP',
        codeText: 'void setup() {}',
        circuit: { schemaVersion: '1.0.0', circuitId: 'ckt_01', components: [], wires: [] },
        members: []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const client = new WebboardApiClient('http://localhost:3333');
    const ws = await client.getWorkspace('ws_test_01');

    assert.equal(ws.id, 'ws_test_01');
    assert.equal(interceptedUrl, 'http://localhost:3333/api/workspaces/ws_test_01');
    assert.equal(interceptedMethod, 'GET');
    assert.equal(ws.language, 'CPP');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test('WebboardApiClient: formata requisição POST para submitChallenge consumindo AutoGrader oficial', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedBody = '';

  const mockSnapshot: SubmissionSnapshot = {
    schemaVersion: '1.0.0',
    submissionId: 'sub_01',
    workspaceId: 'ws_01',
    challengeId: 'ch_01',
    versionNumber: 1,
    submittedAt: new Date().toISOString(),
    submittedBy: {
      userId: 'usr_aluno_01',
      collaboratorUserIds: []
    },
    payload: {
      code: { language: 'CPP', sourceText: 'void loop() {}' },
      circuit: { schemaVersion: '1.0.0', circuitId: 'ckt_01', components: [], wires: [] }
    },
    evaluation: {
      status: 'APPROVED',
      totalExecutionVirtualSeconds: 3.5,
      summary: { totalTests: 2, passedTests: 2, failedTests: 0 },
      testResults: [
        { testCaseId: 'tc_01', passed: true, executionTimeVirtualSeconds: 1.0, message: 'Sucesso' }
      ]
    }
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    interceptedUrl = String(input);
    interceptedBody = String(init?.body || '');
    return new Response(
      JSON.stringify(mockSnapshot),
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

    const res = await client.submitChallenge('ws_01', {
      challengeId: 'ch_01',
      userId: 'usr_aluno_01',
      circuit: dummyCircuit,
      codeText: 'void loop() {}',
      language: 'CPP'
    });

    assert.equal(res.submissionId, 'sub_01');
    assert.equal(res.evaluation.status, 'APPROVED');
    assert.equal(interceptedUrl, 'http://localhost:3333/api/workspaces/ws_01/submissions');

    const parsed = JSON.parse(interceptedBody);
    assert.equal(parsed.challengeId, 'ch_01');
    assert.equal(parsed.userId, 'usr_aluno_01');
    assert.equal(parsed.evaluation, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WebboardApiClient: busca catálogo e detalhes de desafios (GET /api/challenges)', async () => {
  const originalFetch = globalThis.fetch;
  const interceptedUrls: string[] = [];

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    interceptedUrls.push(urlStr);

    if (urlStr.endsWith('/api/challenges')) {
      return new Response(
        JSON.stringify([
          { id: 'ch_01', title: 'Desafio Blink', description: 'Piscar LED', difficulty: 'BEGINNER' }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.endsWith('/api/challenges/ch_01')) {
      return new Response(
        JSON.stringify({
          schemaVersion: '1.0.0',
          challengeId: 'ch_01',
          title: 'Desafio Blink',
          difficulty: 'BEGINNER',
          allowedLanguages: ['CPP', 'PYTHON'],
          kitPolicy: { mode: 'OPEN', allowedComponents: [] },
          initialCircuit: { components: [], wires: [] },
          testSuite: []
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(null, { status: 404 });
  };

  try {
    const client = new WebboardApiClient('http://localhost:3333');
    const list = await client.getChallenges();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'ch_01');

    const challenge = await client.getChallenge('ch_01');
    assert.equal(challenge.challengeId, 'ch_01');
    assert.equal(challenge.title, 'Desafio Blink');
    assert.equal(challenge.kitPolicy.mode, 'OPEN');

    assert.deepEqual(interceptedUrls, [
      'http://localhost:3333/api/challenges',
      'http://localhost:3333/api/challenges/ch_01'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
