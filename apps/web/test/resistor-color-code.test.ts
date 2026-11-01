import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateResistorColorBands,
  reconstructResistance,
  formatResistanceValue,
  E12_PRESETS
} from '../src/utils/resistor-color-code.ts';

test('calculateResistorColorBands: 220 Ohms gera Vermelho, Vermelho, Marrom, Dourado', () => {
  const bands = calculateResistorColorBands(220);
  assert.equal(bands.d1, 2);
  assert.equal(bands.d2, 2);
  assert.equal(bands.multiplierExponent, 1);
  assert.equal(bands.band1.namePt, 'Vermelho');
  assert.equal(bands.band2.namePt, 'Vermelho');
  assert.equal(bands.band3.namePt, 'Marrom (x10)');
  assert.equal(bands.band4.namePt, 'Dourado (±5%)');
});

test('calculateResistorColorBands: 100 Ohms gera Marrom, Preto, Marrom, Dourado', () => {
  const bands = calculateResistorColorBands(100);
  assert.equal(bands.d1, 1);
  assert.equal(bands.d2, 0);
  assert.equal(bands.multiplierExponent, 1);
  assert.equal(bands.band1.namePt, 'Marrom');
  assert.equal(bands.band2.namePt, 'Preto');
  assert.equal(bands.band3.namePt, 'Marrom (x10)');
});

test('calculateResistorColorBands: 330 Ohms gera Laranja, Laranja, Marrom, Dourado', () => {
  const bands = calculateResistorColorBands(330);
  assert.equal(bands.d1, 3);
  assert.equal(bands.d2, 3);
  assert.equal(bands.multiplierExponent, 1);
  assert.equal(bands.band1.namePt, 'Laranja');
  assert.equal(bands.band2.namePt, 'Laranja');
  assert.equal(bands.band3.namePt, 'Marrom (x10)');
});

test('calculateResistorColorBands: 470 Ohms gera Amarelo, Violeta, Marrom, Dourado', () => {
  const bands = calculateResistorColorBands(470);
  assert.equal(bands.d1, 4);
  assert.equal(bands.d2, 7);
  assert.equal(bands.multiplierExponent, 1);
  assert.equal(bands.band1.namePt, 'Amarelo');
  assert.equal(bands.band2.namePt, 'Violeta');
  assert.equal(bands.band3.namePt, 'Marrom (x10)');
});

test('calculateResistorColorBands: 1k Ohms (1000) gera Marrom, Preto, Vermelho, Dourado', () => {
  const bands = calculateResistorColorBands(1000);
  assert.equal(bands.d1, 1);
  assert.equal(bands.d2, 0);
  assert.equal(bands.multiplierExponent, 2);
  assert.equal(bands.band1.namePt, 'Marrom');
  assert.equal(bands.band2.namePt, 'Preto');
  assert.equal(bands.band3.namePt, 'Vermelho (x100)');
});

test('calculateResistorColorBands: 2.2k Ohms (2200) gera Vermelho, Vermelho, Vermelho, Dourado', () => {
  const bands = calculateResistorColorBands(2200);
  assert.equal(bands.d1, 2);
  assert.equal(bands.d2, 2);
  assert.equal(bands.multiplierExponent, 2);
  assert.equal(bands.band1.namePt, 'Vermelho');
  assert.equal(bands.band2.namePt, 'Vermelho');
  assert.equal(bands.band3.namePt, 'Vermelho (x100)');
});

test('calculateResistorColorBands: 4.7k Ohms (4700) gera Amarelo, Violeta, Vermelho, Dourado', () => {
  const bands = calculateResistorColorBands(4700);
  assert.equal(bands.d1, 4);
  assert.equal(bands.d2, 7);
  assert.equal(bands.multiplierExponent, 2);
  assert.equal(bands.band1.namePt, 'Amarelo');
  assert.equal(bands.band2.namePt, 'Violeta');
  assert.equal(bands.band3.namePt, 'Vermelho (x100)');
});

test('calculateResistorColorBands: 10k Ohms (10000) gera Marrom, Preto, Laranja, Dourado', () => {
  const bands = calculateResistorColorBands(10000);
  assert.equal(bands.d1, 1);
  assert.equal(bands.d2, 0);
  assert.equal(bands.multiplierExponent, 3);
  assert.equal(bands.band1.namePt, 'Marrom');
  assert.equal(bands.band2.namePt, 'Preto');
  assert.equal(bands.band3.namePt, 'Laranja (x1k)');
});

test('calculateResistorColorBands: 100k Ohms (100000) gera Marrom, Preto, Amarelo, Dourado', () => {
  const bands = calculateResistorColorBands(100000);
  assert.equal(bands.d1, 1);
  assert.equal(bands.d2, 0);
  assert.equal(bands.multiplierExponent, 4);
  assert.equal(bands.band1.namePt, 'Marrom');
  assert.equal(bands.band2.namePt, 'Preto');
  assert.equal(bands.band3.namePt, 'Amarelo (x10k)');
});

test('reconstructResistance: recalcula valor nominal a partir das faixas', () => {
  assert.equal(reconstructResistance(2, 2, 1), 220);
  assert.equal(reconstructResistance(1, 0, 1), 100);
  assert.equal(reconstructResistance(1, 0, 2), 1000);
  assert.equal(reconstructResistance(4, 7, 2), 4700);
  assert.equal(reconstructResistance(1, 0, 3), 10000);
  assert.equal(reconstructResistance(1, 0, 4), 100000);
});

test('formatResistanceValue: formata unidades com símbolos corretos', () => {
  assert.equal(formatResistanceValue(220), '220 Ω');
  assert.equal(formatResistanceValue(1000), '1 kΩ');
  assert.equal(formatResistanceValue(4700), '4.7 kΩ');
  assert.equal(formatResistanceValue(10000), '10 kΩ');
  assert.equal(formatResistanceValue(100000), '100 kΩ');
  assert.equal(formatResistanceValue(1500000), '1.5 MΩ');
});

test('E12_PRESETS contém todos os 9 valores didáticos da especificação', () => {
  assert.equal(E12_PRESETS.length, 9);
  assert.deepEqual(E12_PRESETS, [100, 220, 330, 470, 1000, 2200, 4700, 10000, 100000]);
});
