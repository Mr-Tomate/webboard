import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TelemetryWebSocketClient,
  type TelemetrySocketOptions
} from '../api/telemetry-socket.js';
import type {
  StudentWorkspacePulse,
  ClassroomTelemetrySummary,
  PedagogicalNote,
  ServerToClientMessage
} from '../types/telemetry.js';
import { computeClassroomSummary } from '../utils/telemetry.js';

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
}

export function useTelemetrySocket(
  options: TelemetrySocketOptions,
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

  const clientRef = useRef<TelemetryWebSocketClient | null>(null);

  useEffect(() => {
    const client = new TelemetryWebSocketClient(options);
    clientRef.current = client;

    const unsubStatus = client.onStatusChange((connected) => {
      setIsConnected(connected);
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
      }
    });

    client.connect();

    return () => {
      unsubStatus();
      unsubMessage();
      client.disconnect();
      clientRef.current = null;
    };
  }, [options.role, options.classroomId, options.workspaceId, options.url]);

  const dismissNote = useCallback((noteId: string) => {
    setIncomingNotes((prev) => prev.filter((n) => n.id !== noteId));
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

  return {
    isConnected,
    workspaces,
    summary,
    latestFaultAlert,
    incomingNotes,
    dismissNote,
    sendPulse,
    sendFaultAlert,
    sendPedagogicalNote
  };
}
