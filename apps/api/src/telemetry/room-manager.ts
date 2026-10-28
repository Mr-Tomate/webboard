import type { WebSocket } from 'ws';
import type {
  StudentWorkspacePulse,
  StudentWorkspaceStatus,
  ClassroomTelemetrySummary,
  PedagogicalNote,
  ServerToClientMessage,
} from './types.js';

interface ConnectionMeta {
  ws: WebSocket;
  role: 'student' | 'teacher';
  classroomId: string;
  workspaceId?: string;
}

export class TelemetryRoomManager {
  // classroomId -> Set<ConnectionMeta>
  private teacherConnections = new Map<string, Set<ConnectionMeta>>();
  // workspaceId -> Set<ConnectionMeta>
  private studentConnections = new Map<string, Set<ConnectionMeta>>();
  // ws -> ConnectionMeta
  private socketMap = new Map<WebSocket, ConnectionMeta>();

  // classroomId -> Map<workspaceId, StudentWorkspacePulse>
  private classroomWorkspaces = new Map<string, Map<string, StudentWorkspacePulse>>();

  /**
   * Registra a conexão de uma bancada de estudante.
   */
  public registerStudent(
    ws: WebSocket,
    workspaceId: string,
    classroomId = 'default_classroom'
  ): void {
    const meta: ConnectionMeta = {
      ws,
      role: 'student',
      classroomId,
      workspaceId,
    };

    this.socketMap.set(ws, meta);

    if (!this.studentConnections.has(workspaceId)) {
      this.studentConnections.set(workspaceId, new Set());
    }
    this.studentConnections.get(workspaceId)!.add(meta);
  }

  /**
   * Registra a conexão de um docente observando uma turma específica.
   */
  public registerTeacher(ws: WebSocket, classroomId = 'default_classroom'): void {
    const meta: ConnectionMeta = {
      ws,
      role: 'teacher',
      classroomId,
    };

    this.socketMap.set(ws, meta);

    if (!this.teacherConnections.has(classroomId)) {
      this.teacherConnections.set(classroomId, new Set());
    }
    this.teacherConnections.get(classroomId)!.add(meta);

    // Envia imediatamente o snapshot atual da turma para o novo professor conectado
    const workspaces = this.getClassroomWorkspaces(classroomId);
    const summary = this.computeClassroomSummary(classroomId);
    const snapshotMsg: ServerToClientMessage = {
      type: 'CLASSROOM_SNAPSHOT',
      payload: {
        classroomId,
        workspaces,
        summary,
      },
    };
    this.sendJson(ws, snapshotMsg);
  }

  /**
   * Desconecta um WebSocket e limpa os registros.
   */
  public unregister(ws: WebSocket): void {
    const meta = this.socketMap.get(ws);
    if (!meta) return;

    this.socketMap.delete(ws);

    if (meta.role === 'teacher') {
      const room = this.teacherConnections.get(meta.classroomId);
      if (room) {
        room.delete(meta);
        if (room.size === 0) this.teacherConnections.delete(meta.classroomId);
      }
    } else if (meta.role === 'student' && meta.workspaceId) {
      const room = this.studentConnections.get(meta.workspaceId);
      if (room) {
        room.delete(meta);
        if (room.size === 0) this.studentConnections.delete(meta.workspaceId);
      }
    }
  }

  /**
   * Processa o pulso de telemetria periódico de um workspace.
   */
  public processPulse(pulse: StudentWorkspacePulse): {
    updatedPulse: StudentWorkspacePulse;
    summary: ClassroomTelemetrySummary;
  } {
    const classroomId = pulse.classroomId || 'default_classroom';

    if (!this.classroomWorkspaces.has(classroomId)) {
      this.classroomWorkspaces.set(classroomId, new Map());
    }
    const room = this.classroomWorkspaces.get(classroomId)!;

    // Preserva notas pedagógicas prévias se o pulso não contiver
    const existing = room.get(pulse.workspaceId);
    let notes = pulse.pedagogicalNotes;
    if (existing && existing.pedagogicalNotes && existing.pedagogicalNotes.length > 0) {
      if (!notes || notes.length === 0) {
        notes = existing.pedagogicalNotes;
      }
    }

    const calculatedStatus = this.determineStatus(pulse);
    const updatedPulse: StudentWorkspacePulse = {
      ...pulse,
      classroomId,
      status: calculatedStatus,
      pedagogicalNotes: notes || [],
    };

    room.set(pulse.workspaceId, updatedPulse);
    const summary = this.computeClassroomSummary(classroomId);

    // Broadcast para todos os professores observando a turma
    const updateMsg: ServerToClientMessage = {
      type: 'WORKSPACE_PULSE_UPDATED',
      payload: {
        classroomId,
        pulse: updatedPulse,
        summary,
      },
    };
    this.broadcastToTeachers(classroomId, updateMsg);

    return { updatedPulse, summary };
  }

  /**
   * Alerta imediato de falha física crítica (Curto-circuito ou sobrecorrente termica).
   */
  public processFaultAlert(
    classroomId: string,
    alert: {
      workspaceId: string;
      teamName: string;
      faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
      message: string;
    }
  ): void {
    const faultMsg: ServerToClientMessage = {
      type: 'WORKSPACE_FAULT_ALERT',
      payload: {
        classroomId,
        workspaceId: alert.workspaceId,
        teamName: alert.teamName,
        faultType: alert.faultType,
        message: alert.message,
        timestamp: new Date().toISOString(),
      },
    };

    this.broadcastToTeachers(classroomId, faultMsg);
  }

  /**
   * Adiciona uma anotação pedagógica do docente para a bancada (RN-PED-01 / RN-PED-02).
   */
  public addPedagogicalNote(
    classroomId: string,
    workspaceId: string,
    noteInput: {
      author: string;
      text: string;
      targetComponentId?: string;
    }
  ): PedagogicalNote | null {
    const room = this.classroomWorkspaces.get(classroomId);
    if (!room) return null;

    const workspace = room.get(workspaceId);
    if (!workspace) return null;

    const note: PedagogicalNote = {
      id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      author: noteInput.author,
      text: noteInput.text.trim(),
      createdAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      targetComponentId: noteInput.targetComponentId,
    };

    workspace.pedagogicalNotes.push(note);

    // Enviar mensagem direta para os estudantes conectados a este workspace
    const directMsg: ServerToClientMessage = {
      type: 'PEDAGOGICAL_NOTE_RECEIVED',
      payload: {
        workspaceId,
        note,
      },
    };
    this.sendToWorkspaceStudents(workspaceId, directMsg);

    // Notificar também os demais professores da turma sobre a anotação
    const summary = this.computeClassroomSummary(classroomId);
    this.broadcastToTeachers(classroomId, {
      type: 'WORKSPACE_PULSE_UPDATED',
      payload: {
        classroomId,
        pulse: workspace,
        summary,
      },
    });

    return note;
  }

  public getClassroomWorkspaces(classroomId: string): StudentWorkspacePulse[] {
    const room = this.classroomWorkspaces.get(classroomId);
    if (!room) return [];
    return Array.from(room.values());
  }

  public computeClassroomSummary(classroomId: string): ClassroomTelemetrySummary {
    const workspaces = this.getClassroomWorkspaces(classroomId);
    const summary: ClassroomTelemetrySummary = {
      totalWorkspaces: workspaces.length,
      activeWorkspaces: 0,
      statusCounts: {
        normal: 0,
        difficulty: 0,
        critical: 0,
        inactive: 0,
      },
      averageProgressPercent: 0,
    };

    if (workspaces.length === 0) return summary;

    let totalProgress = 0;

    for (const ws of workspaces) {
      switch (ws.status) {
        case 'NORMAL':
          summary.statusCounts.normal++;
          summary.activeWorkspaces++;
          break;
        case 'DIFICULDADE':
          summary.statusCounts.difficulty++;
          summary.activeWorkspaces++;
          break;
        case 'FALHA_CRÍTICA':
          summary.statusCounts.critical++;
          summary.activeWorkspaces++;
          break;
        case 'INATIVO':
          summary.statusCounts.inactive++;
          break;
      }

      const progress =
        ws.testSummary.total > 0
          ? (ws.testSummary.passed / ws.testSummary.total) * 100
          : 0;
      totalProgress += progress;
    }

    summary.averageProgressPercent = Math.round(totalProgress / workspaces.length);
    return summary;
  }

  /**
   * Calcula o status semafórico conforme spec 04:
   * - VERMELHO (FALHA_CRÍTICA): curto ou destruição térmica.
   * - CINZA (INATIVO): sem atividade há >= 300 segundos.
   * - AMARELO (DIFICULDADE): >= 3 tentativas de compilação ou falhas nos testes com compilações repetidas.
   * - VERDE (NORMAL): operação padrão.
   */
  public determineStatus(pulse: StudentWorkspacePulse): StudentWorkspaceStatus {
    if (
      pulse.circuitMetrics.hasShortCircuit ||
      pulse.circuitMetrics.hasThermalDestruction
    ) {
      return 'FALHA_CRÍTICA';
    }
    if (pulse.lastActivitySecondsAgo >= 300) {
      return 'INATIVO';
    }
    if (
      pulse.compilationAttempts >= 3 ||
      (pulse.testSummary.total > 0 &&
        pulse.testSummary.passed < pulse.testSummary.total &&
        pulse.compilationAttempts >= 2)
    ) {
      return 'DIFICULDADE';
    }
    return 'NORMAL';
  }

  private broadcastToTeachers(classroomId: string, message: ServerToClientMessage): void {
    const teachers = this.teacherConnections.get(classroomId);
    if (!teachers) return;

    for (const meta of teachers) {
      this.sendJson(meta.ws, message);
    }
  }

  private sendToWorkspaceStudents(
    workspaceId: string,
    message: ServerToClientMessage
  ): void {
    const students = this.studentConnections.get(workspaceId);
    if (!students) return;

    for (const meta of students) {
      this.sendJson(meta.ws, message);
    }
  }

  private sendJson(ws: WebSocket, message: ServerToClientMessage): void {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        // Falha no envio silenciosa
      }
    }
  }
}
