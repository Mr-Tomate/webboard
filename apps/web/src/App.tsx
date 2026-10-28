import React, { useState, useEffect, useCallback } from 'react';
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
    cancelWireDrag
  } = workbenchHook;

  const {
    viewport,
    dimensions,
    zoomIn,
    zoomOut,
    resetView,
    toWorld
  } = viewportHook;

  // Estado do Editor de Código & Console Serial
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(true);
  const [language, setLanguage] = useState<SupportedLanguage>('CPP');
  const [cppCode, setCppCode] = useState(DEFAULT_CPP_CODE);
  const [pythonCode, setPythonCode] = useState(DEFAULT_PYTHON_CODE);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([
    createSerialMessage('Webboard Terminal Serial pronto. Conecte o código à bancada.', 'SYSTEM')
  ]);
  const [baudRate, setBaudRate] = useState<BaudRate>(9600);

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

  // Envio de comando UART pelo usuário
  const handleSendSerialMessage = useCallback((text: string) => {
    const userMsg = createSerialMessage(text, 'TX');
    setSerialMessages((prev) => appendToSerialBuffer(prev, userMsg));

    // Resposta de eco simulada na serial virtual
    setTimeout(() => {
      const echoMsg = createSerialMessage(`[ECHO UART ${baudRate}] ${text}`, 'RX');
      setSerialMessages((prev) => appendToSerialBuffer(prev, echoMsg));
    }, 100);
  }, [baudRate]);

  // Transições de simulação com feedback no monitor serial
  const handleStartSimulation = useCallback(() => {
    startSimulation();
    setSerialMessages((prev) =>
      appendToSerialBuffer(
        prev,
        createSerialMessage('[SISTEMA] Bancada energizada. CPU ATmega328P emulando a 16MHz.', 'SYSTEM')
      )
    );
  }, [startSimulation]);

  const handleStopSimulation = useCallback(() => {
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
