import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Zap,
  Activity,
  Sliders,
  Flame,
  Info,
  CheckCircle2,
  Lock,
  Edit3
} from 'lucide-react';
import type {
  ComponentDefinition,
  WorkbenchMode
} from '@webboard/contracts';
import type { ComponentElectricalState } from '@webboard/core';
import { COMPONENT_CATALOG } from '../../catalog/manifests.ts';
import {
  calculateResistorColorBands,
  reconstructResistance,
  formatResistanceValue,
  E12_PRESETS,
  DIGIT_BANDS,
  MULTIPLIER_BANDS,
  TOLERANCE_GOLD_5
} from '../../utils/resistor-color-code.ts';

export interface InspectorDrawerProps {
  component: ComponentDefinition | null;
  mode: WorkbenchMode;
  electricalState?: ComponentElectricalState;
  isCodePanelOpen: boolean;
  onClose: () => void;
  onUpdateParameters: (componentId: string, parameters: Record<string, any>) => void;
  onUpdateLabel: (componentId: string, label: string) => void;
  onDeleteComponent: (componentId: string) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  component,
  mode,
  electricalState,
  isCodePanelOpen,
  onClose,
  onUpdateParameters,
  onUpdateLabel,
  onDeleteComponent
}) => {
  if (!component) return null;

  const manifest = COMPONENT_CATALOG[component.type];
  const isSimulating = mode === 'MODO_SIMULACAO';

  // Edição de rótulo
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(component.label ?? '');

  useEffect(() => {
    setLabelValue(component.label ?? '');
  }, [component.id, component.label]);

  const handleSaveLabel = () => {
    const trimmed = (labelValue ?? '').trim();
    if (trimmed && trimmed !== component.label) {
      onUpdateLabel(component.id, trimmed);
    }
    setEditingLabel(false);
  };

  // Código de Cores do Resistor
  const currentResistance = component.parameters?.resistanceOhms ?? 220;
  const resistorBands = component.type === 'PASSIVE_RESISTOR'
    ? calculateResistorColorBands(currentResistance)
    : null;

  const handleResistanceChange = (newOhms: number) => {
    if (isSimulating) return;
    const safeVal = Math.max(0.1, Number.isFinite(newOhms) ? newOhms : 220);
    onUpdateParameters(component.id, { resistanceOhms: safeVal });
  };

  const handleBandChange = (type: 'd1' | 'd2' | 'multiplier', value: number) => {
    if (isSimulating || !resistorBands) return;
    const newD1 = type === 'd1' ? value : resistorBands.d1;
    const newD2 = type === 'd2' ? value : resistorBands.d2;
    const newM = type === 'multiplier' ? value : resistorBands.multiplierExponent;
    const newOhms = reconstructResistance(newD1, newD2, newM);
    handleResistanceChange(newOhms);
  };

  // Métricas elétricas em tempo real
  const voltageDrop = electricalState?.voltageDrop ?? 0;
  const currentAmperes = electricalState?.currentAmperes ?? 0;
  const currentMilliAmps = currentAmperes * 1000;
  const powerMilliWatts = Math.abs(voltageDrop * currentAmperes * 1000);
  const isDestroyed = electricalState?.isDestroyed || electricalState?.visualState === 'destroyed';

  // Posicionamento inteligente: se o editor de código estiver aberto, fica ancorado ao lado dele
  const rightOffsetClass = isCodePanelOpen ? 'right-[520px]' : 'right-0';

  return (
    <aside
      aria-label="Inspetor de Propriedades"
      className={`absolute top-0 ${rightOffsetClass} w-[320px] h-full z-20 flex flex-col bg-[#141417] border-l-2 border-[#27272a] shadow-2xl transition-all duration-300 ease-in-out`}
    >
      {/* Cabeçalho Neobrutalista do Inspetor */}
      <div className="p-4 bg-[#18181b] border-b-2 border-[#27272a] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-[#27272a] border border-[#3f3f46] text-[#00e599]">
            <Sliders className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Inspetor de Componente
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {editingLabel && !isSimulating ? (
                <input
                  type="text"
                  value={labelValue}
                  autoFocus
                  onChange={(e) => setLabelValue(e.target.value)}
                  onBlur={handleSaveLabel}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
                  className="px-1.5 py-0.5 text-xs font-bold bg-[#09090b] border border-[#00e599] rounded text-white outline-none w-36"
                />
              ) : (
                <button
                  onClick={() => !isSimulating && setEditingLabel(true)}
                  disabled={isSimulating}
                  title={isSimulating ? 'Bloqueado na simulação' : 'Clique para renomear'}
                  className="flex items-center gap-1 text-sm font-bold text-white hover:text-[#00e599] transition truncate cursor-pointer text-left"
                >
                  <span className="truncate">{component.label}</span>
                  {!isSimulating && <Edit3 className="w-3 h-3 text-zinc-500 hover:text-[#00e599]" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isSimulating && (
            <button
              onClick={() => onDeleteComponent(component.id)}
              title="Excluir componente da bancada"
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 rounded transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Fechar inspetor"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Badge de Governança Estrita da Malha (RN-BNC-01) */}
      <div className={`px-4 py-2 border-b text-xs font-semibold flex items-center justify-between ${
        isSimulating
          ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
          : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
      }`}>
        <div className="flex items-center gap-1.5">
          {isSimulating ? (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Telemetria (Read-Only)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modo Edição Ativo</span>
            </>
          )}
        </div>
        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700">
          {isSimulating ? 'RN-BNC-01' : 'EDITÁVEL'}
        </span>
      </div>

      {/* Conteúdo com Scroll Suave */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Aviso de trava na simulação */}
        {isSimulating && (
          <div className="p-2.5 rounded-lg bg-zinc-900 border border-amber-500/30 text-amber-200/90 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Inputs travados para impedir <strong>hot-mutation</strong> da malha enquanto energizada (<code className="text-amber-300">RN-BNC-01</code>).
            </span>
          </div>
        )}

        {/* ========================================================
            EIXO B: RESISTOR E CÓDIGO DE CORES IEC 60062
            ======================================================== */}
        {component.type === 'PASSIVE_RESISTOR' && resistorBands && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Resistência Nominal
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="10000000"
                  step="1"
                  disabled={isSimulating}
                  value={currentResistance}
                  onChange={(e) => handleResistanceChange(parseFloat(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-sm font-mono font-bold bg-[#09090b] border-2 border-[#27272a] focus:border-[#00e599] rounded text-white outline-none disabled:opacity-50"
                />
                <span className="px-3 py-1.5 bg-[#27272a] rounded font-mono font-bold text-xs text-[#00e599] border border-[#3f3f46]">
                  {formatResistanceValue(currentResistance)}
                </span>
              </div>
            </div>

            {/* Visualizador Gráfico das 4 Faixas Coloridas */}
            <div className="p-3 bg-[#09090b] rounded-xl border border-[#27272a] shadow-inner space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>Norma IEC 60062 (4 Faixas)</span>
                <span className="font-mono text-amber-400">±5%</span>
              </div>

              {/* Corpo do Resistor Ilustrado */}
              <div className="relative h-14 bg-[#d4b483] rounded-lg border-2 border-black flex items-center justify-between px-6 shadow-md overflow-hidden">
                {/* Linhas de terminal condutor */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-1.5 bg-zinc-400 -ml-4" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-1.5 bg-zinc-400 -mr-4" />

                {/* Faixa 1 (1º Dígito) */}
                <div
                  className="w-3.5 h-full shadow-md"
                  style={{ backgroundColor: resistorBands.band1.hex }}
                  title={`Faixa 1: ${resistorBands.band1.namePt} (${resistorBands.d1})`}
                />
                {/* Faixa 2 (2º Dígito) */}
                <div
                  className="w-3.5 h-full shadow-md"
                  style={{ backgroundColor: resistorBands.band2.hex }}
                  title={`Faixa 2: ${resistorBands.band2.namePt} (${resistorBands.d2})`}
                />
                {/* Faixa 3 (Multiplicador) */}
                <div
                  className="w-3.5 h-full shadow-md"
                  style={{ backgroundColor: resistorBands.band3.hex }}
                  title={`Faixa 3: ${resistorBands.band3.namePt}`}
                />
                {/* Faixa 4 (Tolerância Ouro) */}
                <div
                  className="w-3.5 h-full shadow-md"
                  style={{ backgroundColor: resistorBands.band4.hex }}
                  title={`Faixa 4: ${resistorBands.band4.namePt}`}
                />
              </div>

              {/* Legenda das Cores Ativas */}
              <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold">
                <div className="p-1 rounded bg-[#18181b] border border-zinc-800 text-zinc-300">
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1 border border-black/40" style={{ backgroundColor: resistorBands.band1.hex }} />
                  <span>{resistorBands.d1}</span>
                </div>
                <div className="p-1 rounded bg-[#18181b] border border-zinc-800 text-zinc-300">
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1 border border-black/40" style={{ backgroundColor: resistorBands.band2.hex }} />
                  <span>{resistorBands.d2}</span>
                </div>
                <div className="p-1 rounded bg-[#18181b] border border-zinc-800 text-zinc-300">
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1 border border-black/40" style={{ backgroundColor: resistorBands.band3.hex }} />
                  <span>10^{resistorBands.multiplierExponent}</span>
                </div>
                <div className="p-1 rounded bg-[#18181b] border border-zinc-800 text-amber-400">
                  <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1 border border-black/40" style={{ backgroundColor: resistorBands.band4.hex }} />
                  <span>±5%</span>
                </div>
              </div>
            </div>

            {/* Presets Didáticos da Linha E12 (Atalhos de 1 clique) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Valores Didáticos Padrão (Série E12)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {E12_PRESETS.map((val) => {
                  const isActive = currentResistance === val;
                  return (
                    <button
                      key={val}
                      disabled={isSimulating}
                      onClick={() => handleResistanceChange(val)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                        isActive
                          ? 'bg-[#00e599] text-black border-[#00e599] shadow-sm'
                          : 'bg-[#18181b] text-zinc-300 border-[#27272a] hover:border-zinc-500 hover:text-white disabled:opacity-50'
                      }`}
                    >
                      {formatResistanceValue(val)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seletores Didáticos de Faixas Coloridas (Interatividade Educacional) */}
            {!isSimulating && (
              <div className="p-3 bg-[#18181b] rounded-lg border border-[#27272a] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Ajuste por Código de Cores
                </span>
                <div className="space-y-1.5 text-xs">
                  {/* Faixa 1 */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">1ª Faixa (1..9):</span>
                    <select
                      value={resistorBands.d1}
                      onChange={(e) => handleBandChange('d1', parseInt(e.target.value, 10))}
                      className="bg-[#09090b] text-white font-mono px-2 py-1 rounded border border-zinc-700 outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <option key={digit} value={digit}>
                          {digit} - {DIGIT_BANDS[digit].namePt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Faixa 2 */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">2ª Faixa (0..9):</span>
                    <select
                      value={resistorBands.d2}
                      onChange={(e) => handleBandChange('d2', parseInt(e.target.value, 10))}
                      className="bg-[#09090b] text-white font-mono px-2 py-1 rounded border border-zinc-700 outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <option key={digit} value={digit}>
                          {digit} - {DIGIT_BANDS[digit].namePt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Faixa 3 Multiplicador */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Multiplicador:</span>
                    <select
                      value={resistorBands.multiplierExponent}
                      onChange={(e) => handleBandChange('multiplier', parseInt(e.target.value, 10))}
                      className="bg-[#09090b] text-white font-mono px-2 py-1 rounded border border-zinc-700 outline-none"
                    >
                      {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map((exp) => (
                        <option key={exp} value={exp}>
                          {MULTIPLIER_BANDS[exp]?.namePt ?? `10^${exp}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            LED DIFUSO 5MM
            ======================================================== */}
        {component.type === 'ACTUATOR_LED' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Cor da Lente
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'RED', label: 'Vermelho', hex: '#ef4444' },
                  { id: 'GREEN', label: 'Verde', hex: '#22c55e' },
                  { id: 'BLUE', label: 'Azul', hex: '#3b82f6' },
                  { id: 'YELLOW', label: 'Amarelo', hex: '#eab308' },
                  { id: 'WHITE', label: 'Branco', hex: '#f4f4f5' }
                ].map((col) => {
                  const isActive = (component.parameters?.color ?? 'RED') === col.id;
                  return (
                    <button
                      key={col.id}
                      disabled={isSimulating}
                      onClick={() => onUpdateParameters(component.id, { color: col.id })}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-[#27272a] border-[#00e599] text-white shadow-sm'
                          : 'bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white disabled:opacity-50'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-black/40" style={{ backgroundColor: col.hex }} />
                      <span>{col.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-[#18181b] rounded-lg border border-[#27272a] space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Queda típica (Vf):</span>
                <span className="font-mono text-zinc-200">2.0 V</span>
              </div>
              <div className="flex justify-between">
                <span>Corrente máxima (RN-BNC-05):</span>
                <span className="font-mono text-amber-400">30 mA</span>
              </div>
              <div className="flex justify-between">
                <span>Tempo tolerado sobrecorrente:</span>
                <span className="font-mono text-zinc-200">10 ms</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            POTENCIÔMETRO (INPUT_POTENTIOMETER)
            ======================================================== */}
        {component.type === 'INPUT_POTENTIOMETER' && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Posição do Cursor (Wiper)
                </label>
                <span className="text-xs font-mono font-bold text-[#00e599]">
                  {Math.round((component.parameters?.alpha ?? 0.5) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={component.parameters?.alpha ?? 0.5}
                onChange={(e) => onUpdateParameters(component.id, { alpha: parseFloat(e.target.value) })}
                className="w-full accent-[#00e599] cursor-pointer"
              />
            </div>

            <div className="p-3 bg-[#18181b] rounded-lg border border-[#27272a] space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Resistência Total:</span>
                <span className="font-mono text-zinc-200">10 kΩ</span>
              </div>
              <div className="flex justify-between">
                <span>Interatividade na Simulação:</span>
                <span className="font-mono text-emerald-400">Permitida (RN-BNC-03)</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SENSOR ULTRASSÔNICO HC-SR04
            ======================================================== */}
        {component.type === 'SENSOR_ULTRASONIC_HCSR04' && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Distância do Obstáculo
                </label>
                <span className="text-xs font-mono font-bold text-[#38bdf8]">
                  {Math.round(component.parameters?.distanceCm ?? 20)} cm
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="400"
                step="1"
                value={component.parameters?.distanceCm ?? 20}
                onChange={(e) => onUpdateParameters(component.id, { distanceCm: parseFloat(e.target.value) })}
                className="w-full accent-[#38bdf8] cursor-pointer"
              />
            </div>
            <div className="p-3 bg-[#18181b] rounded-lg border border-[#27272a] space-y-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Tempo de Eco (Echo Pulse):</span>
                <span className="font-mono text-zinc-200">
                  {Math.round((component.parameters?.distanceCm ?? 20) * 58)} µs
                </span>
              </div>
              <div className="flex justify-between">
                <span>Alcance Nominal:</span>
                <span className="font-mono text-zinc-200">2cm a 400cm</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            PROTOBOARD VIRTUAL HALF-SIZE 400 FUROS
            ======================================================== */}
        {(component.type === 'BOARD_BREADBOARD_HALF' || component.type === 'BOARD_BREADBOARD') && (
          <div className="p-3.5 bg-[#18181b] rounded-xl border border-[#27272a] space-y-2 text-xs">
            <span className="font-bold text-zinc-200 uppercase tracking-wide block">
              Topologia da Matriz Interna
            </span>
            <p className="text-zinc-400 leading-relaxed text-[11px]">
              Agrupador equipotencial passivo contendo <strong>64 pontes internas</strong> de condutância infinita integradas à matriz do NetlistSolver:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
              <li>4 barramentos horizontais de energia (+ e -)</li>
              <li>60 trilhas verticais de 5 furos (A-E e F-J)</li>
              <li>Fenda central isolante DIP com separação galvânica</li>
            </ul>
          </div>
        )}

        {/* ========================================================
            PAINEL DE TELEMETRIA ELÉTRICA AO VIVO (MODO SIMULAÇÃO)
            ======================================================== */}
        <div className="pt-2 border-t border-[#27272a] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#00e599]" />
              Telemetria Elétrica
            </span>
            {isSimulating && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AO VIVO
              </span>
            )}
          </div>

          {isSimulating ? (
            <div className="space-y-2">
              {/* Alerta de destruição térmica */}
              {isDestroyed ? (
                <div className="p-3 bg-red-950/60 border-2 border-red-500/80 rounded-xl text-red-200 flex items-start gap-2.5">
                  <Flame className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs uppercase text-red-400">
                      Componente Destruído
                    </h5>
                    <p className="text-[11px] text-red-200/90 mt-0.5">
                      {electricalState?.destroyedReason || 'Falha por sobrecorrente térmica (RN-BNC-05).'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-[#09090b] border border-[#27272a] text-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                      Tensão (V)
                    </span>
                    <span className="font-mono font-bold text-sm text-cyan-400">
                      {voltageDrop.toFixed(2)} V
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#09090b] border border-[#27272a] text-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                      Corrente (I)
                    </span>
                    <span className="font-mono font-bold text-sm text-[#00e599]">
                      {currentMilliAmps.toFixed(2)} mA
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#09090b] border border-[#27272a] text-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                      Potência (P)
                    </span>
                    <span className="font-mono font-bold text-sm text-amber-400">
                      {powerMilliWatts.toFixed(1)} mW
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#09090b] border border-[#27272a] text-center text-xs text-zinc-500">
              <Zap className="w-5 h-5 mx-auto mb-1 text-zinc-600" />
              <span>Inicie a simulação para visualizar tensão, corrente e potência em tempo real.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
