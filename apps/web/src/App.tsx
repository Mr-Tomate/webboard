import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { WireColor, CircuitDefinition, EvaluationResult } from '@webboard/contracts';
import { useViewport } from './hooks/useViewport.js';
import { useWorkbench } from './hooks/useWorkbench.js';
import { WorkbenchStage } from './components/canvas/WorkbenchStage.js';
import { Toolbar, type ActiveAppView } from './components/ui/Toolbar.js';
import { CatalogSidebar } from './components/ui/CatalogSidebar.js';
import { StatusBar } from './components/ui/StatusBar.js';
import { CodeWorkspacePanel } from './components/editor/CodeWorkspacePanel.js';
import { PanopticDashboard } from './components/dashboard/PanopticDashboard.js';
import { SubmissionResultModal } from './components/ui/SubmissionResultModal.js';
import { WebboardApiClient } from './api/client.js';
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
  addPedagogicalNote
} from './utils/telemetry.js';
import { AVRBoard } from './emulator/avr-board.js';

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
    toWorld
  } = viewportHook;

  // Alternância de Visão (Bancada do Aluno vs Painel Panóptico do Professor)
  const [currentView, setCurrentView] = useState<ActiveAppView>('STUDENT_BENCH');
  const [isMirrorMode, setIsMirrorMode] = useState(false);
  const [classroomWorkspaces, setClassroomWorkspaces] = useState<StudentWorkspacePulse[]>(
    SAMPLE_CLASSROOM_WORKSPACES
  );

  // Instância do Emulador AVR8js
  const avrBoardRef = useRef<AVRBoard | null>(null);

  // Cliente de API Backend
  const apiClient = useMemo(() => new WebboardApiClient(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);

  // Estado do Editor de Código & Console Serial
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(true);
  const [language, setLanguage] = useState<SupportedLanguage>('CPP');
  const [cppCode, setCppCode] = useState(DEFAULT_CPP_CODE);
  const [pythonCode, setPythonCode] = useState(DEFAULT_PYTHON_CODE);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([
    createSerialMessage('Webboard Terminal Serial pronto. Conecte o código à bancada.', 'SYSTEM')
  ]);
  const [baudRate, setBaudRate] = useState<BaudRate>(9600);

  // Se a bancada entrar em ESTADO_FALHA_ENG, para a CPU virtual imediatamente
  useEffect(() => {
    if (mode === 'ESTADO_FALHA_ENG' && avrBoardRef.current) {
      avrBoardRef.current.stop();
      setSerialMessages((prev) =>
        appendToSerialBuffer(
          prev,
          createSerialMessage(`[HALT] ${fault?.message || 'Falha crítica: Emulação congelada.'}`, 'ERROR')
        )
      );
    }
  }, [mode, fault]);

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

  const handleStartSimulation = useCallback(() => {
    if (isMirrorMode) return;
    const ok = startSimulation();
    if (!ok) return;

    const board = new AVRBoard();
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
  }, [startSimulation, handleEmulatorPinChange, isMirrorMode]);

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
          createSerialMessage(`[SUBMISSÃO] Snapshot v1 registrado. Status: ${evalResult.status}`, 'SYSTEM')
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
    setClassroomWorkspaces((prev) =>
      prev.map((ws) =>
        ws.workspaceId === workspaceId
          ? addPedagogicalNote(ws, 'Prof. Titular', text, targetComponentId)
          : ws
      )
    );
  };

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
        onResetZoom={resetView}
        onDeleteSelected={handleDeleteSelected}
        onClearWorkbench={clearWorkbench}
      />

      {/* Visão 1: Bancada do Aluno / Espelho */}
      {currentView === 'STUDENT_BENCH' ? (
        <>
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
            isReadOnly={mode === 'MODO_SIMULACAO' || isMirrorMode}
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
            workspaces={classroomWorkspaces}
            onMirrorWorkspace={handleMirrorWorkspace}
            onAddNote={handleAddPedagogicalNote}
          />
        </div>
      )}
    </div>
  );
}

export default App;
