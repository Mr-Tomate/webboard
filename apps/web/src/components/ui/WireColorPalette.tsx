import React from 'react';
import type { WireColor } from '@webboard/contracts';
import { Tooltip } from './Tooltip.js';

interface WireColorPaletteProps {
  activeColor: WireColor;
  hasSelectedWire: boolean;
  onSelectColor: (color: WireColor) => void;
}

export const WIRE_COLORS: Array<{ id: WireColor; name: string; hex: string; border: string }> = [
  { id: 'RED', name: 'Vermelho (VCC / 5V)', hex: '#ef4444', border: '#b91c1c' },
  { id: 'BLACK', name: 'Preto (GND / Terra)', hex: '#18181b', border: '#52525b' },
  { id: 'GREEN', name: 'Verde (Sinal / Dados)', hex: '#22c55e', border: '#15803d' },
  { id: 'BLUE', name: 'Azul (Sinal)', hex: '#3b82f6', border: '#1d4ed8' },
  { id: 'YELLOW', name: 'Amarelo (Sinal)', hex: '#eab308', border: '#a16207' },
  { id: 'WHITE', name: 'Branco (Neutro / Dados)', hex: '#f4f4f5', border: '#a1a1aa' },
  { id: 'ORANGE', name: 'Laranja (Alimentação Aux)', hex: '#f97316', border: '#c2410c' }
];

export const WireColorPalette: React.FC<WireColorPaletteProps> = ({
  activeColor,
  hasSelectedWire,
  onSelectColor
}) => {
  return (
    <div
      id="tour-wire-colors"
      className="flex items-center gap-1.5 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] p-1.5 rounded-lg shadow-xl pointer-events-auto"
    >
      <div className="flex items-center gap-1">
        {WIRE_COLORS.map((c) => {
          const isSelected = activeColor === c.id;
          return (
            <Tooltip key={c.id} content={hasSelectedWire ? `Recolorir para ${c.name}` : c.name} placement="bottom">
              <button
                onClick={() => onSelectColor(c.id)}
                style={{ backgroundColor: c.hex, borderColor: isSelected ? '#00e599' : c.border }}
                className={`w-4 h-4 rounded-full border-2 transition-transform cursor-pointer relative ${
                  isSelected ? 'scale-125 ring-2 ring-[#00e599]/40 z-10' : 'hover:scale-110 opacity-80 hover:opacity-100'
                }`}
              >
                {isSelected && (
                  <span className="absolute inset-0 m-auto w-1 h-1 rounded-full bg-white shadow" />
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};
