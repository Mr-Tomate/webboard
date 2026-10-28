import React, { useEffect } from 'react';
import type { WireColor } from '@webboard/contracts';
import { useViewport } from './hooks/useViewport.js';
import { useWorkbench } from './hooks/useWorkbench.js';
import { WorkbenchStage } from './components/canvas/WorkbenchStage.js';
import { Toolbar } from './components/ui/Toolbar.js';
import { CatalogSidebar } from './components/ui/CatalogSidebar.js';
import { StatusBar } from './components/ui/StatusBar.js';

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
      x: dimensions.width / 2,
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#121214]">
      {/* Barra de Ferramentas Superior com Seletor de Cores */}
      <Toolbar
        mode={mode}
        fault={fault}
        scale={viewport.scale}
        hasSelection={!!selectedComponentId || !!selectedWireId}
        hasSelectedWire={!!selectedWireId}
        activeWireColor={activeWireColor}
        onSelectWireColor={handleSelectWireColor}
        onStartSimulation={startSimulation}
        onStopSimulation={stopSimulation}
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
