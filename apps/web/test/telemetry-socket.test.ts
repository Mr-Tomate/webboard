import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryWebSocketClient } from '../src/api/telemetry-socket.ts';
import type {
  StudentWorkspacePulse,
  ServerToClientMessage
} from '../src/types/telemetry.js';

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
