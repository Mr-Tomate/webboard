/**
 * Utilitário de Cálculo e Decomposição do Código de Cores do Resistor
 * Conforme Norma Internacional IEC 60062 / Eixo B da Especificação da Fase 2.
 *
 * Fórmula: R = (d1 * 10 + d2) * 10^M
 * - d1: Primeiro dígito significativo (1 a 9)
 * - d2: Segundo dígito significativo (0 a 9)
 * - M: Multiplicador decimal (potência de 10)
 * - Faixa 4: Tolerância (Dourado ±5%)
 */

export interface ResistorBand {
  digit?: number;
  multiplier?: number;
  tolerance?: string;
  name: string;
  namePt: string;
  hex: string;
  textColor: string;
}

export interface ResistorColorBands {
  resistanceOhms: number;
  d1: number;
  d2: number;
  multiplierExponent: number;
  band1: ResistorBand;
  band2: ResistorBand;
  band3: ResistorBand;
  band4: ResistorBand;
}

export const DIGIT_BANDS: Record<number, ResistorBand> = {
  0: { digit: 0, name: 'black', namePt: 'Preto', hex: '#18181b', textColor: '#ffffff' },
  1: { digit: 1, name: 'brown', namePt: 'Marrom', hex: '#78350f', textColor: '#ffffff' },
  2: { digit: 2, name: 'red', namePt: 'Vermelho', hex: '#dc2626', textColor: '#ffffff' },
  3: { digit: 3, name: 'orange', namePt: 'Laranja', hex: '#ea580c', textColor: '#ffffff' },
  4: { digit: 4, name: 'yellow', namePt: 'Amarelo', hex: '#eab308', textColor: '#18181b' },
  5: { digit: 5, name: 'green', namePt: 'Verde', hex: '#16a34a', textColor: '#ffffff' },
  6: { digit: 6, name: 'blue', namePt: 'Azul', hex: '#2563eb', textColor: '#ffffff' },
  7: { digit: 7, name: 'violet', namePt: 'Violeta', hex: '#9333ea', textColor: '#ffffff' },
  8: { digit: 8, name: 'gray', namePt: 'Cinza', hex: '#71717a', textColor: '#ffffff' },
  9: { digit: 9, name: 'white', namePt: 'Branco', hex: '#f4f4f5', textColor: '#18181b' }
};

export const MULTIPLIER_BANDS: Record<number, ResistorBand> = {
  [-2]: { multiplier: 0.01, name: 'silver', namePt: 'Prata (x0.01)', hex: '#a1a1aa', textColor: '#18181b' },
  [-1]: { multiplier: 0.1, name: 'gold', namePt: 'Dourado (x0.1)', hex: '#d97706', textColor: '#ffffff' },
  0: { multiplier: 1, name: 'black', namePt: 'Preto (x1)', hex: '#18181b', textColor: '#ffffff' },
  1: { multiplier: 10, name: 'brown', namePt: 'Marrom (x10)', hex: '#78350f', textColor: '#ffffff' },
  2: { multiplier: 100, name: 'red', namePt: 'Vermelho (x100)', hex: '#dc2626', textColor: '#ffffff' },
  3: { multiplier: 1000, name: 'orange', namePt: 'Laranja (x1k)', hex: '#ea580c', textColor: '#ffffff' },
  4: { multiplier: 10000, name: 'yellow', namePt: 'Amarelo (x10k)', hex: '#eab308', textColor: '#18181b' },
  5: { multiplier: 100000, name: 'green', namePt: 'Verde (x100k)', hex: '#16a34a', textColor: '#ffffff' },
  6: { multiplier: 1000000, name: 'blue', namePt: 'Azul (x1M)', hex: '#2563eb', textColor: '#ffffff' },
  7: { multiplier: 10000000, name: 'violet', namePt: 'Violeta (x10M)', hex: '#9333ea', textColor: '#ffffff' }
};

export const TOLERANCE_GOLD_5: ResistorBand = {
  tolerance: '±5%',
  name: 'gold',
  namePt: 'Dourado (±5%)',
  hex: '#d97706',
  textColor: '#ffffff'
};

/** Presets didáticos obrigatórios da série E12 (Norma IEC 60062) */
export const E12_PRESETS: number[] = [
  100,
  220,
  330,
  470,
  1000,
  2200,
  4700,
  10000,
  100000
];

/**
 * Decompõe um valor de resistência em Ohms nas 4 faixas coloridas.
 * Se o valor for inválido ou zero, adota 220 Ohms por padrão.
 */
export function calculateResistorColorBands(resistanceOhms: number): ResistorColorBands {
  const safeResistance = Math.max(0.1, Number.isFinite(resistanceOhms) && resistanceOhms > 0 ? resistanceOhms : 220);

  // Converte para notação científica: a.bc...e+M
  const sci = safeResistance.toExponential();
  const [mantissaStr, expStr] = sci.split('e');
  const exp = parseInt(expStr, 10);
  const mantissaNum = parseFloat(mantissaStr);

  // Ajusta para termos 2 dígitos significativos inteiros (10 a 99)
  // Ex: 220 = 2.2e+2 => 22 * 10^1 (d1=2, d2=2, M=1)
  // Ex: 100 = 1.0e+2 => 10 * 10^1 (d1=1, d2=0, M=1)
  // Ex: 1000 = 1.0e+3 => 10 * 10^2 (d1=1, d2=0, M=2)
  // Ex: 4.7 = 4.7e+0 => 47 * 10^-1 (d1=4, d2=7, M=-1)
  // Ex: 0.47 = 4.7e-1 => 47 * 10^-2 (d1=4, d2=7, M=-2)
  const twoDigitsVal = Math.round(mantissaNum * 10);
  let d1 = Math.floor(twoDigitsVal / 10);
  let d2 = twoDigitsVal % 10;
  let multiplierExponent = exp - 1;

  // Normalização caso o arredondamento resulte em 100
  if (twoDigitsVal >= 100) {
    d1 = 1;
    d2 = 0;
    multiplierExponent += 1;
  }

  // Clampa os dígitos no intervalo permitido (1-9 para d1, 0-9 para d2)
  d1 = Math.max(1, Math.min(9, d1));
  d2 = Math.max(0, Math.min(9, d2));
  multiplierExponent = Math.max(-2, Math.min(7, multiplierExponent));

  const band1 = DIGIT_BANDS[d1] ?? DIGIT_BANDS[2];
  const band2 = DIGIT_BANDS[d2] ?? DIGIT_BANDS[2];
  const band3 = MULTIPLIER_BANDS[multiplierExponent] ?? MULTIPLIER_BANDS[1];
  const band4 = TOLERANCE_GOLD_5;

  return {
    resistanceOhms: safeResistance,
    d1,
    d2,
    multiplierExponent,
    band1,
    band2,
    band3,
    band4
  };
}

/**
 * Reconstrói o valor de resistência em Ohms a partir de dois dígitos e expoente multiplicador.
 */
export function reconstructResistance(d1: number, d2: number, multiplierExponent: number): number {
  const safeD1 = Math.max(1, Math.min(9, Math.floor(d1)));
  const safeD2 = Math.max(0, Math.min(9, Math.floor(d2)));
  const factor = Math.pow(10, multiplierExponent);
  return Number(((safeD1 * 10 + safeD2) * factor).toPrecision(6));
}

/**
 * Formata um valor de resistência em Ohms com unidades ergonômicas (Ω, kΩ, MΩ).
 */
export function formatResistanceValue(ohms: number): string {
  if (!Number.isFinite(ohms) || ohms < 0) return '0 Ω';
  if (ohms >= 1_000_000) {
    const val = ohms / 1_000_000;
    return `${Number(val.toFixed(2))} MΩ`;
  }
  if (ohms >= 1_000) {
    const val = ohms / 1_000;
    return `${Number(val.toFixed(2))} kΩ`;
  }
  return `${Number(ohms.toFixed(1))} Ω`;
}
