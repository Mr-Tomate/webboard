import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { WireColor } from '@webboard/contracts';
import { useViewport } from './hooks/useViewport.js';
import { useWorkbench } from './hooks/useWorkbench.js';
import { WorkbenchStage } from './components/canvas/WorkbenchStage.js';
import { Toolbar } from './components/ui/Toolbar.js';
import { CatalogSidebar } from './components/ui/CatalogSidebar.js';
import { StatusBar } from './components/ui/StatusBar.js';
import { CodeWorkspacePanel } from './components/editor/CodeWorkspacePanel.js';
import type { SupportedLanguage } from './components/editor/CodeEditor.js';
import {
  type SerialMessage,
  type BaudRate,
  DEFAULT_CPP_CODE,
  DEFAULT_PYTHON_CODE,
  createSerialMessage,
  appendToSerialBuffer
} from './utils/serial.js';
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

  // Instância do Emulador AVR8js
  const avrBoardRef = useRef<AVRBoard | null>(null);

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
  }, [selectedComponentId, selectedWireId, deleteComponent, deleteWire, cancelWireDrag]);

  const handleAddComponentAtCenter = (type: string) => {
    const centerScreen = {
      x: isCodePanelOpen ? (dimensions.width - 520) / 2 : dimensions.width / 2,
      y: dimensions.height / 2
    };
    const centerWorld = toWorld(centerScreen);
    addComponent(type, centerWorld);
  };

  const handleDeleteSelected = () => {
    if (selectedComponentId) {
      deleteComponent(selectedComponentId);
    } else if (selectedWireId) {
      deleteWire(selectedWireId);
    }
  };

  const handleSelectWireColor = (color: WireColor) => {
    setActiveWireColor(color);
    if (selectedWireId) {
      updateWireColor(selectedWireId, color);
    }
  };

  // Envio de comando UART pelo usuário para o MCU virtual
  const handleSendSerialMessage = useCallback((text: string) => {
    const userMsg = createSerialMessage(text, 'TX');
    setSerialMessages((prev) => appendToSerialBuffer(prev, userMsg));

    if (avrBoardRef.current) {
      avrBoardRef.current.sendSerialString(text + '\n');
    }
  }, []);

  // Inicia simulação com o emulador AVR8js sincronizado ao CircuitSolver
  const handleStartSimulation = useCallback(() => {
    const ok = startSimulation();
    if (!ok) return;

    // Cria e inicializa a CPU ATmega328P
    const board = new AVRBoard();
    avrBoardRef.current = board;

    // Escuta transmissões seriais da CPU
    board.onSerialOutput((line) => {
      setSerialMessages((prev) => appendToSerialBuffer(prev, createSerialMessage(line, 'RX')));
    });

    // Escuta transições dos pinos e sincroniza com o CircuitSolver
    board.onPinChange((pinName, level) => {
      handleEmulatorPinChange(pinName, level);
    });

    // Inicia execução a 16MHz simulados
    board.start(10000);

    setSerialMessages((prev) =>
      appendToSerialBuffer(
        prev,
        createSerialMessage('[SISTEMA] CPU ATmega328P emulando a 16MHz via AVR8js.', 'SYSTEM')
      )
    );
  }, [startSimulation, handleEmulatorPinChange]);

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
        onSelectWireColor={handleSelectWireColor}
        onToggleCodePanel={() => setIsCodePanelOpen(!isCodePanelOpen)}
        onStartSimulation={handleStartSimulation}
        onStopSimulation={handleStopSimulation}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetView}
        onDeleteSelected={handleDeleteSelected}
        onClearWorkbench={clearWorkbench}
      />

      {/* Catálogo Lateral de Componentes */}
      <CatalogSidebar
        mode={mode}
        onAddComponent={handleAddComponentAtCenter}
      />

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
        isReadOnly={mode === 'MODO_SIMULACAO'}
        onCodeChange={(val) => {
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
    </div>
  );
}

export default App;
