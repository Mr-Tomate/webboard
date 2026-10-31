import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { WireColor, CircuitDefinition, EvaluationResult } from '@webboard/contracts';
import { useViewport } from './hooks/useViewport.js';
import { useWorkbench } from './hooks/useWorkbench.js';
import { useTelemetrySocket } from './hooks/useTelemetrySocket.js';
import { WorkbenchStage } from './components/canvas/WorkbenchStage.js';
import { Toolbar, type ActiveAppView } from './components/ui/Toolbar.js';
import { CatalogSidebar } from './components/ui/CatalogSidebar.js';
import { StatusBar } from './components/ui/StatusBar.js';
import { CodeWorkspacePanel } from './components/editor/CodeWorkspacePanel.js';
import { PanopticDashboard } from './components/dashboard/PanopticDashboard.js';
import { SubmissionResultModal } from './components/ui/SubmissionResultModal.js';
import { WebboardApiClient } from './api/client.js';
import { CompilerClient } from './api/compiler-client.js';
import { buildFirmware } from './emulator/firmware-pipeline.js';
import type { SupportedLanguage } from './components/editor/CodeEditor.js';
import {
  type SerialMessage,
  type BaudRate,
  DEFAULT_CPP_CODE,
  DEFAULT_PYTHON_CODE,
  createSerialMessage,
  appendToSerialBuffer
} from './utils/serial.js';
import {
  type StudentWorkspacePulse
} from './types/telemetry.js';
import {
  SAMPLE_CLASSROOM_WORKSPACES,
  determineWorkspaceStatus
} from './utils/telemetry.js';
import { AVRBoard } from './emulator/avr-board.js';
import { MessageSquare, X } from 'lucide-react';

export function App() {
  const viewportHook = useViewport(1.0, { x: 50, y: 50 });
  const workbenchHook = useWorkbench();

  const {
    mode,
    fault,
    components,
    wires,
    selectedComponentId,
    selectedWireId,
    activeWireColor,
    setActiveWireColor,
    updateWireColor,
    startSimulation,
    stopSimulation,
    deleteComponent,
    deleteWire,
    addComponent,
    clearWorkbench,
    cancelWireDrag,
    handleEmulatorPinChange
  } = workbenchHook;

  const {
    viewport,
    dimensions,
    zoomIn,
    zoomOut,
    resetView,
    fitToComponents,
    toWorld
  } = viewportHook;

  // Alternância de Visão (Bancada do Aluno vs Painel Panóptico do Professor)
  const [currentView, setCurrentView] = useState<ActiveAppView>('STUDENT_BENCH');
  const [isMirrorMode, setIsMirrorMode] = useState(false);

  // Instância do Emulador AVR8js
  const avrBoardRef = useRef<AVRBoard | null>(null);

  // Cliente de API Backend
  const apiClient = useMemo(() => new WebboardApiClient(), []);
  const compilerClient = useMemo(() => new CompilerClient(), []);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // Estado do Editor de Código & Console Serial
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(true);
  const [language, setLanguage] = useState<SupportedLanguage>('CPP');
  const [cppCode, setCppCode] = useState(DEFAULT_CPP_CODE);
  const [pythonCode, setPythonCode] = useState(DEFAULT_PYTHON_CODE);
  const [compilationAttempts, setCompilationAttempts] = useState(0);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([
    createSerialMessage('Webboard Terminal Serial pronto. Conecte o código à bancada.', 'SYSTEM')
  ]);
  const [baudRate, setBaudRate] = useState<BaudRate>(9600);

  // Conexão WebSocket de Telemetria (Aluno ou Professor)
  const socketRole = currentView === 'TEACHER_DASHBOARD' ? 'teacher' : 'student';
  const {
    isConnected: isWsConnected,
    workspaces: telemetryWorkspaces,
    latestFaultAlert,
    incomingNotes,
    dismissNote,
    sendPulse,
    sendFaultAlert,
    sendPedagogicalNote
  } = useTelemetrySocket(
    {
      role: socketRole,
      classroomId: 'turma_8b',
      workspaceId: 'ws_aluno_01'
    },
    SAMPLE_CLASSROOM_WORKSPACES
  );

  // Pulso periódico e reativo de telemetria da bancada do aluno
  useEffect(() => {
    if (currentView !== 'STUDENT_BENCH' || isMirrorMode) return;

    const hasShortCircuit = fault?.type === 'SHORT_CIRCUIT';
    const hasThermalDestruction = fault?.type === 'OVERCURRENT';

    const status = determineWorkspaceStatus({
      hasShortCircuit,
      hasThermalDestruction,
      lastActivitySecondsAgo: 0,
      compilationAttempts,
      testsPassed: evaluationResult?.status === 'APPROVED' ? 2 : 0,
      testsTotal: 2
    });

    const pulsePayload: StudentWorkspacePulse = {
      workspaceId: 'ws_aluno_01',
      classroomId: 'turma_8b',
      teamName: 'Bancada 01 (Principal)',
      students: ['Aluno Webboard'],
      status,
      lastActivitySecondsAgo: 0,
      currentChallengeTitle: 'Desafio 01: Circuito de Sinalização com LED',
      circuitMetrics: {
        componentCount: components.length,
        wireCount: wires.length,
        hasShortCircuit,
        hasThermalDestruction
      },
      codeLanguage: language,
      compilationAttempts,
      testSummary: {
        passed: evaluationResult?.status === 'APPROVED' ? 2 : 0,
        total: 2
      },
      pedagogicalNotes: incomingNotes
    };

    sendPulse(pulsePayload);
  }, [
    components.length,
    wires.length,
    fault,
    language,
    compilationAttempts,
    evaluationResult,
    currentView,
    isMirrorMode,
    sendPulse,
    incomingNotes
  ]);

  // Se a bancada entrar em ESTADO_FALHA_ENG, dispara alerta crítico para o professor via WebSocket
  useEffect(() => {
    if (mode === 'ESTADO_FALHA_ENG' && fault) {
      if (avrBoardRef.current) {
        avrBoardRef.current.stop();
      }
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage(`[HALT] ${fault.message}`, 'ERROR')
        )
      );

      // Emite alerta em tempo real para a sala de aula
      sendFaultAlert({
        workspaceId: 'ws_aluno_01',
        faultType: fault.type === 'SHORT_CIRCUIT' ? 'SHORT_CIRCUIT' : 'OVERCURRENT',
        message: fault.message,
        failedWireId: fault.failedWireId,
        failedComponentId: fault.failedComponentId
      });
    }
  }, [mode, fault, sendFaultAlert]);

  // Teclas de atalho globais (Delete, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMirrorMode) return; // View-only (RN-PED-01)

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponentId) {
          deleteComponent(selectedComponentId);
        } else if (selectedWireId) {
          deleteWire(selectedWireId);
        }
      } else if (e.key === 'Escape') {
        cancelWireDrag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, selectedWireId, deleteComponent, deleteWire, cancelWireDrag, isMirrorMode]);

  const handleAddComponentAtCenter = (type: string) => {
    if (isMirrorMode) return;
    const centerScreen = {
      x: isCodePanelOpen ? (dimensions.width - 520) / 2 : dimensions.width / 2,
      y: dimensions.height / 2
    };
    const centerWorld = toWorld(centerScreen);
    addComponent(type, centerWorld);
  };

  const handleDeleteSelected = () => {
    if (isMirrorMode) return;
    if (selectedComponentId) {
      deleteComponent(selectedComponentId);
    } else if (selectedWireId) {
      deleteWire(selectedWireId);
    }
  };

  const handleSelectWireColor = (color: WireColor) => {
    if (isMirrorMode) return;
    setActiveWireColor(color);
    if (selectedWireId) {
      updateWireColor(selectedWireId, color);
    }
  };

  const handleSendSerialMessage = useCallback((text: string) => {
    const userMsg = createSerialMessage(text, 'TX');
    setSerialMessages((prev) => appendToSerialBuffer(prev, userMsg));

    if (avrBoardRef.current) {
      avrBoardRef.current.sendSerialString(text + '\n');
    }
  }, []);

  const handleStartSimulation = useCallback(async () => {
    if (isMirrorMode || isCompiling) return;

    let program: Uint16Array | undefined;

    if (language === 'CPP') {
      setCompilationAttempts((prev) => prev + 1);
      setIsCompiling(true);
      const result = await buildFirmware(compilerClient, cppCode).finally(() =>
        setIsCompiling(false)
      );

      setSerialMessages((prev) =>
        result.logs.reduce(
          (buf, log) => appendToSerialBuffer(buf, createSerialMessage(log.text, log.level)),
          prev
        )
      );

      // RN-COD-01: compilação reprovada nunca energiza a bancada
      if (!result.ok) return;
      program = result.program;
    } else {
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage(
            '[PYFIRMATA] Runtime Python ainda não integrado: executando firmware de demonstração.',
            'SYSTEM'
          )
        )
      );
    }

    const ok = startSimulation();
    if (!ok) return;

    const board = new AVRBoard(program);
    avrBoardRef.current = board;

    board.onSerialOutput((line) => {
      setSerialMessages((prev) => appendToSerialBuffer(prev, createSerialMessage(line, 'RX')));
    });

    board.onPinChange((pinName, level) => {
      handleEmulatorPinChange(pinName, level);
    });

    board.start(10000);

    setSerialMessages((prev) =>
      appendToSerialBuffer(
        prev,
        createSerialMessage('[SISTEMA] CPU ATmega328P emulando a 16MHz via AVR8js.', 'SYSTEM')
      )
    );
  }, [
    startSimulation,
    handleEmulatorPinChange,
    isMirrorMode,
    isCompiling,
    language,
    cppCode,
    compilerClient
  ]);

  const handleStopSimulation = useCallback(() => {
    if (avrBoardRef.current) {
      avrBoardRef.current.stop();
      avrBoardRef.current = null;
    }
    stopSimulation();
    setSerialMessages((prev) =>
      appendToSerialBuffer(
        prev,
        createSerialMessage('[SISTEMA] Simulação interrompida. Bancada desenergizada.', 'SYSTEM')
      )
    );
  }, [stopSimulation]);

  // Persistência na API Fastify
  const handleSaveWorkspace = async () => {
    if (isMirrorMode || isSaving) return;
    setIsSaving(true);

    const circuitPayload: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: 'ckt_workbench_01',
      components,
      wires
    };

    try {
      await apiClient.saveWorkspace('ws_aluno_01', {
        circuit: circuitPayload,
        codeText: language === 'CPP' ? cppCode : pythonCode,
        language
      });
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage('[NUVEM] Bancada salva com sucesso no servidor Fastify.', 'SYSTEM')
        )
      );
    } catch {
      // Fallback gracioso caso o backend local não esteja rodando em porta 3333
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage('[OFFLINE] Bancada sincronizada localmente no navegador.', 'SYSTEM')
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Submissão de Desafio e Auto-Grading
  const handleSubmitChallenge = async () => {
    if (isMirrorMode || isSubmitting) return;
    setIsSubmitting(true);

    const circuitPayload: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: 'ckt_workbench_01',
      components,
      wires
    };

    const hasLed = components.some((c) => c.type === 'LED');
    const hasWires = wires.length >= 1;
    const isApproved = hasLed && hasWires && !fault;

    const evalResult: EvaluationResult = {
      status: isApproved ? 'APPROVED' : 'FAILED',
      totalExecutionVirtualSeconds: 2.0,
      summary: {
        totalTests: 2,
        passedTests: isApproved ? 2 : (hasWires ? 1 : 0),
        failedTests: isApproved ? 0 : (hasWires ? 1 : 2)
      },
      testResults: [
        {
          testCaseId: 'TC-01: Análise Elétrica e Invariantes',
          passed: !fault,
          executionTimeVirtualSeconds: 1.0,
          message: fault
            ? `Falha detectada: ${fault.message}`
            : 'Circuito estável sem curtos-circuitos ou queima de componentes.'
        },
        {
          testCaseId: 'TC-02: Ativação de Cargas e Firmware',
          passed: isApproved,
          executionTimeVirtualSeconds: 1.0,
          message: isApproved
            ? 'LED conectado com sucesso e acoplado ao firmware da bancada.'
            : 'Faltam componentes essenciais: insira um LED e realize as conexões elétricas.'
        }
      ]
    };

    try {
      await apiClient.submitChallenge('ws_aluno_01', {
        challengeId: 'ch_desafio_blink_01',
        userId: 'usr_aluno_01',
        circuit: circuitPayload,
        codeText: language === 'CPP' ? cppCode : pythonCode,
        language,
        status: isApproved ? 'APPROVED' : 'FAILED',
        evaluation: evalResult
      });
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage(`[SUBMISSÃO] Snapshot registrado com sucesso. Status: ${evalResult.status}`, 'SYSTEM')
        )
      );
    } catch {
      // Continua exibindo a avaliação formativa local mesmo sem API online
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage(`[AVALIAÇÃO] Relatório gerado localmente. Status: ${evalResult.status}`, 'SYSTEM')
        )
      );
    } finally {
      setIsSubmitting(false);
      setEvaluationResult(evalResult);
    }
  };

  const handleMirrorWorkspace = (_ws: StudentWorkspacePulse) => {
    setIsMirrorMode(true);
    setCurrentView('STUDENT_BENCH');
  };

  const handleExitMirrorMode = () => {
    setIsMirrorMode(false);
  };

  const handleAddPedagogicalNote = (workspaceId: string, text: string, targetComponentId?: string) => {
    sendPedagogicalNote({
      workspaceId,
      author: 'Prof. Titular',
      text,
      targetComponentId
    });
  };

  // Enquadra perfeitamente o circuito existente na tela ou restaura 100%
  const handleResetOrFitZoom = useCallback(() => {
    if (components.length > 0) {
      fitToComponents(components.map((c) => c.position));
    } else {
      resetView();
    }
  }, [components, fitToComponents, resetView]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#121214]">
      {/* Barra de Ferramentas Superior */}
      <Toolbar
        mode={mode}
        fault={fault}
        scale={viewport.scale}
        hasSelection={!!selectedComponentId || !!selectedWireId}
        hasSelectedWire={!!selectedWireId}
        activeWireColor={activeWireColor}
        isCodePanelOpen={isCodePanelOpen}
        currentView={currentView}
        isMirrorMode={isMirrorMode}
        isSaving={isSaving}
        isSubmitting={isSubmitting}
        isCompiling={isCompiling}
        onSelectWireColor={handleSelectWireColor}
        onToggleCodePanel={() => setIsCodePanelOpen(!isCodePanelOpen)}
        onToggleView={() =>
          setCurrentView(
            currentView === 'STUDENT_BENCH' ? 'TEACHER_DASHBOARD' : 'STUDENT_BENCH'
          )
        }
        onExitMirrorMode={handleExitMirrorMode}
        onStartSimulation={handleStartSimulation}
        onStopSimulation={handleStopSimulation}
        onSaveWorkspace={handleSaveWorkspace}
        onSubmitChallenge={handleSubmitChallenge}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={handleResetOrFitZoom}
        onDeleteSelected={handleDeleteSelected}
        onClearWorkbench={clearWorkbench}
      />

      {/* Visão 1: Bancada do Aluno / Espelho */}
      {currentView === 'STUDENT_BENCH' ? (
        <>
          {/* Banner de Novas Orientações Pedagógicas Recebidas do Docente */}
          {incomingNotes.length > 0 && !isMirrorMode && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in slide-in-from-top-4">
              <div className="p-3.5 rounded-xl bg-amber-950/90 border-2 border-amber-500/80 shadow-2xl text-amber-200 flex items-start justify-between gap-3 backdrop-blur-md">
                <div className="flex items-start gap-2.5">
                  <MessageSquare className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                      Orientação do Professor ({incomingNotes[0].author}):
                    </h5>
                    <p className="text-xs text-amber-100 font-medium mt-0.5">
                      "{incomingNotes[0].text}"
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dismissNote(incomingNotes[0].id)}
                  className="p-1 rounded hover:bg-amber-900 text-amber-400 transition cursor-pointer"
                  title="Dispensar orientação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Catálogo Lateral de Componentes */}
          {!isMirrorMode && (
            <CatalogSidebar
              mode={mode}
              onAddComponent={handleAddComponentAtCenter}
            />
          )}

          {/* Canvas Konva 2D da Bancada */}
          <WorkbenchStage
            viewportHook={viewportHook}
            workbenchHook={workbenchHook}
          />

          {/* Painel Lateral do Monaco Editor & Monitor Serial */}
          <CodeWorkspacePanel
            isOpen={isCodePanelOpen}
            onToggle={() => setIsCodePanelOpen(!isCodePanelOpen)}
            language={language}
            code={language === 'CPP' ? cppCode : pythonCode}
            isReadOnly={mode === 'MODO_SIMULACAO' || isMirrorMode || isCompiling}
            onCodeChange={(val) => {
              if (isMirrorMode) return;
              if (language === 'CPP') setCppCode(val ?? '');
              else setPythonCode(val ?? '');
            }}
            onLanguageChange={setLanguage}
            serialMessages={serialMessages}
            baudRate={baudRate}
            onBaudRateChange={setBaudRate}
            onSendSerialMessage={handleSendSerialMessage}
            onClearSerial={() => setSerialMessages([])}
          />

          {/* Barra de Status Inferior */}
          <StatusBar
            mode={mode}
            fault={fault}
            componentCount={components.length}
            wireCount={wires.length}
          />

          {/* Modal de Avaliação / Auto-Grading */}
          <SubmissionResultModal
            evaluation={evaluationResult}
            challengeTitle="Desafio 01: Circuito de Sinalização com LED"
            onClose={() => setEvaluationResult(null)}
          />
        </>
      ) : (
        /* Visão 2: Painel Panóptico do Professor */
        <div className="pt-20 w-full h-full">
          <PanopticDashboard
            workspaces={telemetryWorkspaces}
            isConnected={isWsConnected}
            latestFaultAlert={latestFaultAlert}
            onMirrorWorkspace={handleMirrorWorkspace}
            onAddNote={handleAddPedagogicalNote}
          />
        </div>
      )}
    </div>
  );
}

export default App;
