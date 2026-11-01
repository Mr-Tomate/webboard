import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryWebSocketClient } from '../src/api/telemetry-socket.ts';
import type {
  StudentWorkspacePulse,
  ServerToClientMessage
} from '../src/types/telemetry.js';
import { WorkbenchSceneGraph } from '../src/engine/WorkbenchSceneGraph.ts';

class MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public static instances: MockWebSocket[] = [];
  public url: string;
  public readyState: number = 0; // CONNECTING
  public sentMessages: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((e: { data: string }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((e: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 5);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  simulateIncoming(msg: ServerToClientMessage) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(msg) });
    }
  }
}

test('TelemetryWebSocketClient: monta URL correta e envia mensagens tipadas', async () => {
  const originalWs = (globalThis as any).WebSocket;
  (globalThis as any).WebSocket = MockWebSocket;
  MockWebSocket.instances = [];

  try {
    const client = new TelemetryWebSocketClient({
      url: 'ws://localhost:3333/ws/telemetry',
      role: 'student',
      classroomId: 'turma_alpha',
      workspaceId: 'ws_aluno_99',
      userId: 'usr_lucas',
      userName: 'Lucas',
      autoReconnect: false
    });

    let connectionStatus = false;
    client.onStatusChange((status) => {
      connectionStatus = status;
    });

    client.connect();

    // Aguarda a abertura assíncrona da conexão
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(connectionStatus, true);
    assert.equal(client.isConnected(), true);

    const wsInstance = MockWebSocket.instances[0];
    assert.ok(wsInstance.url.includes('role=student'));
    assert.ok(wsInstance.url.includes('classroomId=turma_alpha'));
    assert.ok(wsInstance.url.includes('workspaceId=ws_aluno_99'));
    assert.ok(wsInstance.url.includes('userId=usr_lucas'));
    assert.ok(wsInstance.url.includes('userName=Lucas'));

    // Teste de envio de PULSE
    const dummyPulse: StudentWorkspacePulse = {
      workspaceId: 'ws_aluno_99',
      classroomId: 'turma_alpha',
      teamName: 'Equipe Teste',
      students: ['Dev'],
      status: 'NORMAL',
      lastActivitySecondsAgo: 0,
      currentChallengeTitle: 'Desafio Teste',
      circuitMetrics: {
        componentCount: 2,
        wireCount: 1,
        hasShortCircuit: false,
        hasThermalDestruction: false
      },
      codeLanguage: 'CPP',
      compilationAttempts: 1,
      testSummary: { passed: 1, total: 1 },
      pedagogicalNotes: []
    };

    const sentPulse = client.sendPulse(dummyPulse);
    assert.equal(sentPulse, true);
    assert.equal(wsInstance.sentMessages.length, 1);

    const parsedPulse = JSON.parse(wsInstance.sentMessages[0]);
    assert.equal(parsedPulse.type, 'PULSE');
    assert.equal(parsedPulse.payload.workspaceId, 'ws_aluno_99');

    // Teste de envio de FAULT_ALERT
    const sentFault = client.sendFaultAlert({
      workspaceId: 'ws_aluno_99',
      faultType: 'SHORT_CIRCUIT',
      message: 'Curto circuito detectado entre 5V e GND'
    });
    assert.equal(sentFault, true);
    assert.equal(wsInstance.sentMessages.length, 2);
    const parsedFault = JSON.parse(wsInstance.sentMessages[1]);
    assert.equal(parsedFault.type, 'FAULT_ALERT');
    assert.equal(parsedFault.payload.faultType, 'SHORT_CIRCUIT');

    // Teste de recepção de mensagem do servidor
    let receivedNoteText = '';
    client.onMessage((msg) => {
      if (msg.type === 'PEDAGOGICAL_NOTE_RECEIVED') {
        receivedNoteText = msg.payload.note.text;
      }
    });

    wsInstance.simulateIncoming({
      type: 'PEDAGOGICAL_NOTE_RECEIVED',
      payload: {
        workspaceId: 'ws_aluno_99',
        note: {
          id: 'note_123',
          author: 'Prof. Teste',
          text: 'Adicione um resistor antes do LED.',
          createdAt: new Date().toISOString()
        }
      }
    });

    assert.equal(receivedNoteText, 'Adicione um resistor antes do LED.');

    client.disconnect();
    assert.equal(client.isConnected(), false);
  } finally {
    (globalThis as any).WebSocket = originalWs;
  }
});

test('EIXO D: TelemetryWebSocketClient envia ações colaborativas (locks, cursores e mutações)', async () => {
  const originalWs = (globalThis as any).WebSocket;
  (globalThis as any).WebSocket = MockWebSocket;
  MockWebSocket.instances = [];

  try {
    const client = new TelemetryWebSocketClient({
      url: 'ws://localhost:3333/ws/telemetry',
      role: 'student',
      workspaceId: 'ws_collab_01',
      userId: 'usr_pedro',
      userName: 'Pedro',
      autoReconnect: false
    });

    client.connect();
    await new Promise((r) => setTimeout(r, 20));

    const ws = MockWebSocket.instances[0];

    // 1. Lock Component
    const locked = client.lockComponent('res_01');
    assert.equal(locked, true);
    const lastLock = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    assert.equal(lastLock.type, 'LOCK_COMPONENT');
    assert.equal(lastLock.payload.componentId, 'res_01');

    // 2. Unlock Component
    const unlocked = client.unlockComponent('res_01');
    assert.equal(unlocked, true);
    const lastUnlock = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    assert.equal(lastUnlock.type, 'UNLOCK_COMPONENT');
    assert.equal(lastUnlock.payload.componentId, 'res_01');

    // 3. Cursor Move
    const moved = client.sendCursorPosition({ x: 450, y: 320 });
    assert.equal(moved, true);
    const lastCursor = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    assert.equal(lastCursor.type, 'CURSOR_MOVE');
    assert.equal(lastCursor.payload.position.x, 450);
    assert.equal(lastCursor.payload.position.y, 320);

    // 4. Circuit Mutation
    const mutated = client.sendCircuitMutation('UPDATE_COMPONENT', {
      id: 'res_01',
      position: { x: 500, y: 300 }
    });
    assert.equal(mutated, true);
    const lastMutation = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    assert.equal(lastMutation.type, 'CIRCUIT_MUTATION');
    assert.equal(lastMutation.payload.action, 'UPDATE_COMPONENT');
    assert.equal(lastMutation.payload.data.id, 'res_01');

    client.disconnect();
  } finally {
    (globalThis as any).WebSocket = originalWs;
  }
});

test('EIXO D: WorkbenchSceneGraph aplica mutações remotas em tempo real', () => {
  const scene = new WorkbenchSceneGraph();

  // 1. ADD_COMPONENT remoto
  scene.applyRemoteMutation('ADD_COMPONENT', {
    id: 'btn_peer_01',
    type: 'INPUT_PUSHBUTTON',
    label: 'Botão Colaborativo',
    position: { x: 400, y: 220 }
  });

  const btn = scene.getComponent('btn_peer_01');
  assert.ok(btn, 'Componente adicionado remotamente deve existir no grafo');
  assert.equal(btn.type, 'INPUT_PUSHBUTTON');
  assert.equal(btn.position.x, 400);

  // 2. UPDATE_COMPONENT remoto (posição e label)
  scene.applyRemoteMutation('UPDATE_COMPONENT', {
    id: 'btn_peer_01',
    position: { x: 420, y: 240 },
    label: 'Botão Atualizado'
  });

  const updatedBtn = scene.getComponent('btn_peer_01');
  assert.equal(updatedBtn?.position.x, 420);
  assert.equal(updatedBtn?.label, 'Botão Atualizado');

  // 3. ADD_WIRE remoto
  scene.applyRemoteMutation('ADD_WIRE', {
    id: 'wire_peer_99',
    from: { componentId: 'btn_peer_01', pinId: 'PIN_1' },
    to: { componentId: 'mcu_uno_01', pinId: 'D2' },
    color: 'BLUE'
  });

  const wire = scene.getWire('wire_peer_99');
  assert.ok(wire, 'Fio adicionado remotamente deve existir no grafo');
  assert.equal(wire.color, 'BLUE');

  // 4. REMOVE_WIRE remoto
  scene.applyRemoteMutation('REMOVE_WIRE', { id: 'wire_peer_99' });
  assert.equal(scene.getWire('wire_peer_99'), undefined);

  // 5. REMOVE_COMPONENT remoto
  scene.applyRemoteMutation('REMOVE_COMPONENT', { id: 'btn_peer_01' });
  assert.equal(scene.getComponent('btn_peer_01'), undefined);
});
