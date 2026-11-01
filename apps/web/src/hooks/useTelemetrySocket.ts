import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TelemetryWebSocketClient,
  type TelemetrySocketOptions
} from '../api/telemetry-socket.js';
import type {
  StudentWorkspacePulse,
  ClassroomTelemetrySummary,
  PedagogicalNote,
  ServerToClientMessage,
  ComponentLock,
  RemoteCursor,
  PresenceMember,
  CircuitMutationAction
} from '../types/telemetry.js';
import { computeClassroomSummary } from '../utils/telemetry.js';

export interface UseTelemetrySocketOptions extends TelemetrySocketOptions {
  onCircuitMutated?: (payload: {
    workspaceId: string;
    userId: string;
    userName: string;
    action: CircuitMutationAction;
    data: unknown;
  }) => void;
}

export interface UseTelemetrySocketReturn {
  isConnected: boolean;
  workspaces: StudentWorkspacePulse[];
  summary: ClassroomTelemetrySummary;
  latestFaultAlert: {
    workspaceId: string;
    teamName: string;
    faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
    message: string;
    timestamp: string;
  } | null;
  incomingNotes: PedagogicalNote[];
  dismissNote: (noteId: string) => void;
  sendPulse: (pulse: StudentWorkspacePulse) => boolean;
  sendFaultAlert: (payload: {
    workspaceId: string;
    faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
    message: string;
    failedWireId?: string;
    failedComponentId?: string;
  }) => boolean;
  sendPedagogicalNote: (payload: {
    workspaceId: string;
    author: string;
    text: string;
    targetComponentId?: string;
  }) => boolean;

  // Eixo D: Colaboração Concorrente
  activeLocks: Map<string, ComponentLock>;
  remoteCursors: Map<string, RemoteCursor>;
  presenceMembers: PresenceMember[];
  lockRejectedAlert: { componentId: string; reason: string } | null;
  dismissLockRejectedAlert: () => void;
  lockComponent: (componentId: string) => boolean;
  unlockComponent: (componentId: string) => boolean;
  sendCursorPosition: (pos: { x: number; y: number }) => boolean;
  sendCircuitMutation: (action: CircuitMutationAction, data: unknown) => boolean;
}

export function useTelemetrySocket(
  options: UseTelemetrySocketOptions,
  fallbackWorkspaces: StudentWorkspacePulse[] = []
): UseTelemetrySocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [workspaces, setWorkspaces] = useState<StudentWorkspacePulse[]>(fallbackWorkspaces);
  const [summary, setSummary] = useState<ClassroomTelemetrySummary>(() =>
    computeClassroomSummary(fallbackWorkspaces)
  );
  const [latestFaultAlert, setLatestFaultAlert] = useState<{
    workspaceId: string;
    teamName: string;
    faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
    message: string;
    timestamp: string;
  } | null>(null);
  const [incomingNotes, setIncomingNotes] = useState<PedagogicalNote[]>([]);

  // Estados de Colaboração (Eixo D)
  const [activeLocks, setActiveLocks] = useState<Map<string, ComponentLock>>(new Map());
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [presenceMembers, setPresenceMembers] = useState<PresenceMember[]>([]);
  const [lockRejectedAlert, setLockRejectedAlert] = useState<{ componentId: string; reason: string } | null>(null);

  const clientRef = useRef<TelemetryWebSocketClient | null>(null);
  const onCircuitMutatedRef = useRef(options.onCircuitMutated);
  useEffect(() => {
    onCircuitMutatedRef.current = options.onCircuitMutated;
  }, [options.onCircuitMutated]);

  useEffect(() => {
    const client = new TelemetryWebSocketClient(options);
    clientRef.current = client;

    const unsubStatus = client.onStatusChange((connected) => {
      setIsConnected(connected);
      if (!connected) {
        // Ao desconectar, limpa cursores e travas temporárias locais
        setRemoteCursors(new Map());
      }
    });

    const unsubMessage = client.onMessage((msg: ServerToClientMessage) => {
      if (msg.type === 'CLASSROOM_SNAPSHOT') {
        setWorkspaces(msg.payload.workspaces);
        setSummary(msg.payload.summary);
      } else if (msg.type === 'WORKSPACE_PULSE_UPDATED') {
        setWorkspaces((prev) => {
          const index = prev.findIndex((w) => w.workspaceId === msg.payload.pulse.workspaceId);
          if (index >= 0) {
            const next = [...prev];
            next[index] = msg.payload.pulse;
            return next;
          }
          return [...prev, msg.payload.pulse];
        });
        setSummary(msg.payload.summary);
      } else if (msg.type === 'WORKSPACE_FAULT_ALERT') {
        setLatestFaultAlert({
          workspaceId: msg.payload.workspaceId,
          teamName: msg.payload.teamName,
          faultType: msg.payload.faultType,
          message: msg.payload.message,
          timestamp: msg.payload.timestamp
        });
      } else if (msg.type === 'PEDAGOGICAL_NOTE_RECEIVED') {
        setIncomingNotes((prev) => [msg.payload.note, ...prev]);
      } else if (msg.type === 'WORKSPACE_LOCKS_SNAPSHOT') {
        setActiveLocks(new Map(msg.payload.locks.map((l) => [l.componentId, l])));
      } else if (msg.type === 'COMPONENT_LOCKED') {
        setActiveLocks((prev) => {
          const next = new Map(prev);
          next.set(msg.payload.componentId, msg.payload);
          return next;
        });
      } else if (msg.type === 'COMPONENT_UNLOCKED') {
        setActiveLocks((prev) => {
          const next = new Map(prev);
          next.delete(msg.payload.componentId);
          return next;
        });
      } else if (msg.type === 'LOCK_REJECTED') {
        setLockRejectedAlert({
          componentId: msg.payload.componentId,
          reason: msg.payload.reason
        });
      } else if (msg.type === 'PRESENCE_SNAPSHOT') {
        setPresenceMembers(msg.payload.members);
      } else if (msg.type === 'MEMBER_JOINED') {
        setPresenceMembers((prev) => {
          const idx = prev.findIndex((m) => m.userId === msg.payload.member.userId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = msg.payload.member;
            return next;
          }
          return [...prev, msg.payload.member];
        });
      } else if (msg.type === 'MEMBER_LEFT') {
        setPresenceMembers((prev) => prev.filter((m) => m.userId !== msg.payload.userId));
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.delete(msg.payload.userId);
          return next;
        });
      } else if (msg.type === 'CURSOR_MOVED') {
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(msg.payload.userId, msg.payload);
          return next;
        });
      } else if (msg.type === 'CIRCUIT_MUTATED') {
        onCircuitMutatedRef.current?.(msg.payload);
      }
    });

    client.connect();

    return () => {
      unsubStatus();
      unsubMessage();
      client.disconnect();
      clientRef.current = null;
    };
  }, [options.role, options.classroomId, options.workspaceId, options.userId, options.userName, options.url]);

  const dismissNote = useCallback((noteId: string) => {
    setIncomingNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const dismissLockRejectedAlert = useCallback(() => {
    setLockRejectedAlert(null);
  }, []);

  const sendPulse = useCallback((pulse: StudentWorkspacePulse) => {
    return clientRef.current?.sendPulse(pulse) ?? false;
  }, []);

  const sendFaultAlert = useCallback(
    (payload: {
      workspaceId: string;
      faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
      message: string;
      failedWireId?: string;
      failedComponentId?: string;
    }) => {
      return clientRef.current?.sendFaultAlert(payload) ?? false;
    },
    []
  );

  const sendPedagogicalNote = useCallback(
    (payload: {
      workspaceId: string;
      author: string;
      text: string;
      targetComponentId?: string;
    }) => {
      const sent = clientRef.current?.sendPedagogicalNote(payload) ?? false;
      // Atualização otimista local das notas
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (ws.workspaceId === payload.workspaceId) {
            return {
              ...ws,
              pedagogicalNotes: [
                ...ws.pedagogicalNotes,
                {
                  id: `note_${Date.now()}`,
                  author: payload.author,
                  text: payload.text,
                  createdAt: new Date().toISOString(),
                  targetComponentId: payload.targetComponentId
                }
              ]
            };
          }
          return ws;
        })
      );
      return sent;
    },
    []
  );

  const lockComponent = useCallback((componentId: string) => {
    return clientRef.current?.lockComponent(componentId) ?? false;
  }, []);

  const unlockComponent = useCallback((componentId: string) => {
    return clientRef.current?.unlockComponent(componentId) ?? false;
  }, []);

  const sendCursorPosition = useCallback((position: { x: number; y: number }) => {
    return clientRef.current?.sendCursorPosition(position) ?? false;
  }, []);

  const sendCircuitMutation = useCallback((action: CircuitMutationAction, data: unknown) => {
    return clientRef.current?.sendCircuitMutation(action, data) ?? false;
  }, []);

  return {
    isConnected,
    workspaces,
    summary,
    latestFaultAlert,
    incomingNotes,
    dismissNote,
    sendPulse,
    sendFaultAlert,
    sendPedagogicalNote,

    // Colaboração
    activeLocks,
    remoteCursors,
    presenceMembers,
    lockRejectedAlert,
    dismissLockRejectedAlert,
    lockComponent,
    unlockComponent,
    sendCursorPosition,
    sendCircuitMutation
  };
}
