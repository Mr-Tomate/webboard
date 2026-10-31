import type { WebSocket } from 'ws';
import {
  CIRCUIT_MUTATION_ACTIONS,
  type StudentWorkspacePulse,
  type StudentWorkspaceStatus,
  type ClassroomTelemetrySummary,
  type PedagogicalNote,
  type ServerToClientMessage,
  type ComponentLock,
  type PresenceMember,
  type CircuitMutationAction,
} from './types.js';

interface ConnectionMeta {
  ws: WebSocket;
  role: 'student' | 'teacher';
  classroomId: string;
  workspaceId?: string;
  userId?: string;
  userName?: string;
}

/** Membro identificado de um workspace de grupo (estudante com userId). */
interface Collaborator {
  ws: WebSocket;
  workspaceId: string;
  userId: string;
  userName: string;
}

interface LockEntry {
  lock: ComponentLock;
  /** Conexão (aba) que detém o lock; a queda dela libera o componente. */
  ownerWs: WebSocket;
}

const MAX_COMPONENT_ID_LENGTH = 128;

export class TelemetryRoomManager {
  // classroomId -> Set<ConnectionMeta>
  private teacherConnections = new Map<string, Set<ConnectionMeta>>();
  // workspaceId -> Set<ConnectionMeta>
  private studentConnections = new Map<string, Set<ConnectionMeta>>();
  // ws -> ConnectionMeta
  private socketMap = new Map<WebSocket, ConnectionMeta>();

  // classroomId -> Map<workspaceId, StudentWorkspacePulse>
  private classroomWorkspaces = new Map<string, Map<string, StudentWorkspacePulse>>();

  // workspaceId -> Map<componentId, LockEntry>
  private workspaceLocks = new Map<string, Map<string, LockEntry>>();

  /**
   * Registra a conexão de uma bancada de estudante.
   *
   * Envia ao novo socket os snapshots de locks e presença do workspace e, se
   * for a primeira conexão do usuário, anuncia MEMBER_JOINED aos colegas.
   */
  public registerStudent(
    ws: WebSocket,
    workspaceId: string,
    classroomId = 'default_classroom',
    userId?: string,
    userName?: string
  ): void {
    const meta: ConnectionMeta = {
      ws,
      role: 'student',
      classroomId,
      workspaceId,
      userId: userId || undefined,
      userName: userId ? userName || userId : undefined,
    };

    const isFirstConnectionOfUser =
      !!meta.userId && this.countUserConnections(workspaceId, meta.userId) === 0;

    this.socketMap.set(ws, meta);

    if (!this.studentConnections.has(workspaceId)) {
      this.studentConnections.set(workspaceId, new Set());
    }
    this.studentConnections.get(workspaceId)!.add(meta);

    // Sincronização inicial da interface do novo membro
    this.sendJson(ws, {
      type: 'WORKSPACE_LOCKS_SNAPSHOT',
      payload: { workspaceId, locks: this.getWorkspaceLocks(workspaceId) },
    });
    this.sendJson(ws, {
      type: 'PRESENCE_SNAPSHOT',
      payload: { workspaceId, members: this.getWorkspacePresence(workspaceId) },
    });

    if (isFirstConnectionOfUser) {
      this.sendToWorkspaceStudents(
        workspaceId,
        {
          type: 'MEMBER_JOINED',
          payload: {
            workspaceId,
            member: { userId: meta.userId!, userName: meta.userName!, connections: 1 },
          },
        },
        ws
      );
    }
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
   * Desconecta um WebSocket e limpa os registros, locks e presença.
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
      const workspaceId = meta.workspaceId;
      const room = this.studentConnections.get(workspaceId);
      if (room) {
        room.delete(meta);
        if (room.size === 0) this.studentConnections.delete(workspaceId);
      }

      // Prevenção de deadlock: a queda da aba libera os locks que ela detinha
      this.releaseLocksOwnedBy(workspaceId, ws);

      // Presença: o membro só "sai" quando fecha a última aba do workspace
      if (meta.userId && this.countUserConnections(workspaceId, meta.userId) === 0) {
        this.sendToWorkspaceStudents(workspaceId, {
          type: 'MEMBER_LEFT',
          payload: { workspaceId, userId: meta.userId },
        });
      }
    }
  }

  // -------------------------------------------------------------
  // EIXO D: COLABORAÇÃO CONCORRENTE (SOFT-LOCK, CURSORES, MUTAÇÕES)
  // Identidade (workspace/usuário) é sempre derivada da conexão.
  // -------------------------------------------------------------

  /**
   * Aplica soft-lock em um componente para o membro dono do socket.
   * Re-lock pelo mesmo usuário (outra aba) transfere a posse do lock.
   */
  public lockComponent(ws: WebSocket, componentId: unknown): boolean {
    const member = this.requireCollaborator(ws);
    if (!member) return false;
    if (!this.isValidComponentId(componentId)) {
      this.sendError(ws, 'componentId inválido para LOCK_COMPONENT.');
      return false;
    }

    const { workspaceId, userId, userName } = member;
    if (!this.workspaceLocks.has(workspaceId)) {
      this.workspaceLocks.set(workspaceId, new Map());
    }
    const locks = this.workspaceLocks.get(workspaceId)!;

    const existing = locks.get(componentId);
    if (existing && existing.lock.userId !== userId) {
      this.sendJson(ws, {
        type: 'LOCK_REJECTED',
        payload: {
          workspaceId,
          componentId,
          reason: `Componente em uso por ${existing.lock.userName}.`,
        },
      });
      return false;
    }

    if (existing) {
      // Lock idempotente do mesmo usuário: apenas atualiza a aba detentora
      existing.ownerWs = ws;
      return true;
    }

    const lock: ComponentLock = {
      workspaceId,
      componentId,
      userId,
      userName,
      lockedAt: new Date().toISOString(),
    };
    locks.set(componentId, { lock, ownerWs: ws });

    // Broadcast para todos no workspace (inclusive o autor, como ACK)
    this.sendToWorkspaceStudents(workspaceId, {
      type: 'COMPONENT_LOCKED',
      payload: lock,
    });

    return true;
  }

  /**
   * Libera o soft-lock de um componente (apenas o próprio detentor).
   */
  public unlockComponent(ws: WebSocket, componentId: unknown): boolean {
    const member = this.requireCollaborator(ws);
    if (!member) return false;
    if (!this.isValidComponentId(componentId)) {
      this.sendError(ws, 'componentId inválido para UNLOCK_COMPONENT.');
      return false;
    }

    const locks = this.workspaceLocks.get(member.workspaceId);
    const existing = locks?.get(componentId);
    if (!locks || !existing || existing.lock.userId !== member.userId) {
      return false;
    }

    this.deleteLock(member.workspaceId, componentId);
    return true;
  }

  /**
   * Retorna os locks ativos de um workspace.
   */
  public getWorkspaceLocks(workspaceId: string): ComponentLock[] {
    const locks = this.workspaceLocks.get(workspaceId);
    if (!locks) return [];
    return Array.from(locks.values(), (entry) => entry.lock);
  }

  /**
   * Lista os membros identificados presentes no workspace (agrupados por userId).
   */
  public getWorkspacePresence(workspaceId: string): PresenceMember[] {
    const students = this.studentConnections.get(workspaceId);
    if (!students) return [];

    const members = new Map<string, PresenceMember>();
    for (const meta of students) {
      if (!meta.userId) continue;
      const current = members.get(meta.userId);
      if (current) {
        current.connections++;
      } else {
        members.set(meta.userId, {
          userId: meta.userId,
          userName: meta.userName || meta.userId,
          connections: 1,
        });
      }
    }
    return Array.from(members.values());
  }

  /**
   * Transmite a movimentação do cursor de um membro para os colegas (sem eco).
   */
  public broadcastCursor(ws: WebSocket, position: unknown): boolean {
    const member = this.requireCollaborator(ws);
    if (!member) return false;

    const pos = position as { x?: unknown; y?: unknown } | null | undefined;
    if (
      !pos ||
      typeof pos.x !== 'number' ||
      typeof pos.y !== 'number' ||
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y)
    ) {
      this.sendError(ws, 'position {x, y} numérica é obrigatória para CURSOR_MOVE.');
      return false;
    }

    this.sendToWorkspaceStudents(
      member.workspaceId,
      {
        type: 'CURSOR_MOVED',
        payload: {
          workspaceId: member.workspaceId,
          userId: member.userId,
          userName: member.userName,
          position: { x: pos.x, y: pos.y },
        },
      },
      ws
    );
    return true;
  }

  /**
   * Transmite mutação de circuito em tempo real para os colegas (sem eco).
   */
  public broadcastMutation(ws: WebSocket, action: unknown, data: unknown): boolean {
    const member = this.requireCollaborator(ws);
    if (!member) return false;

    if (!CIRCUIT_MUTATION_ACTIONS.includes(action as CircuitMutationAction)) {
      this.sendError(ws, `Ação de mutação desconhecida: ${String(action)}.`);
      return false;
    }

    this.sendToWorkspaceStudents(
      member.workspaceId,
      {
        type: 'CIRCUIT_MUTATED',
        payload: {
          workspaceId: member.workspaceId,
          userId: member.userId,
          userName: member.userName,
          action: action as CircuitMutationAction,
          data,
        },
      },
      ws
    );
    return true;
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

  // -------------------------------------------------------------
  // HELPERS PRIVADOS
  // -------------------------------------------------------------

  /**
   * Resolve a identidade colaborativa do socket. Docentes e bancadas sem
   * userId não participam da colaboração (recebem ERROR).
   */
  private requireCollaborator(ws: WebSocket): Collaborator | null {
    const meta = this.socketMap.get(ws);
    if (!meta || meta.role !== 'student' || !meta.workspaceId || !meta.userId) {
      this.sendError(
        ws,
        'Colaboração requer conexão de estudante identificada (workspaceId e userId no handshake).'
      );
      return null;
    }
    return {
      ws,
      workspaceId: meta.workspaceId,
      userId: meta.userId,
      userName: meta.userName || meta.userId,
    };
  }

  private isValidComponentId(componentId: unknown): componentId is string {
    return (
      typeof componentId === 'string' &&
      componentId.trim().length > 0 &&
      componentId.length <= MAX_COMPONENT_ID_LENGTH
    );
  }

  private countUserConnections(workspaceId: string, userId: string): number {
    const students = this.studentConnections.get(workspaceId);
    if (!students) return 0;
    let count = 0;
    for (const meta of students) {
      if (meta.userId === userId) count++;
    }
    return count;
  }

  private releaseLocksOwnedBy(workspaceId: string, ws: WebSocket): void {
    const locks = this.workspaceLocks.get(workspaceId);
    if (!locks) return;
    for (const [componentId, entry] of Array.from(locks.entries())) {
      if (entry.ownerWs === ws) this.deleteLock(workspaceId, componentId);
    }
  }

  private deleteLock(workspaceId: string, componentId: string): void {
    const locks = this.workspaceLocks.get(workspaceId);
    if (!locks || !locks.delete(componentId)) return;
    if (locks.size === 0) this.workspaceLocks.delete(workspaceId);

    this.sendToWorkspaceStudents(workspaceId, {
      type: 'COMPONENT_UNLOCKED',
      payload: { workspaceId, componentId },
    });
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
    message: ServerToClientMessage,
    excludeWs?: WebSocket
  ): void {
    const students = this.studentConnections.get(workspaceId);
    if (!students) return;

    for (const meta of students) {
      if (excludeWs && meta.ws === excludeWs) continue;
      this.sendJson(meta.ws, message);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    this.sendJson(ws, { type: 'ERROR', message });
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
