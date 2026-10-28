/**
 * Firmware padrão embutido para teste e demonstração do microcontrolador ATmega328P.
 * Executa:
 * 1. Transmissão serial inicial de boot ("WEBBOARD 16MHz READY\r\n").
 * 2. Configura PB5 (D13) como OUTPUT.
 * 3. Alterna o estado de PB5 entre HIGH e LOW em loop contínuo.
 */
export function createDefaultBlinkFirmware(): Uint16Array {
  const prog = new Uint16Array(16384); // 32KB flash (16k words)
  let pc = 0;

  // Mensagem de boot para a serial
  const message = 'WEBBOARD 16MHz READY\r\n';

  // 1. Enviar mensagem de boot pela UART (UDR0 = 0x00c6)
  for (let i = 0; i < message.length; i++) {
    const charCode = message.charCodeAt(i);
    // ldi r16, charCode (0xe000 | ((charCode & 0xf0) << 4) | (charCode & 0x0f))
    prog[pc++] = 0xe000 | ((charCode & 0xf0) << 4) | (charCode & 0x0f);
    // sts 0x00c6, r16 (UDR0)
    prog[pc++] = 0x9300;
    prog[pc++] = 0x00c6;
  }

  // 2. Configurar D13 como OUTPUT: sbi DDRB(0x04), 5
  prog[pc++] = 0x9a25;

  const loopStart = pc;

  // 3. Ligar D13: sbi PORTB(0x05), 5
  prog[pc++] = 0x9a2d;

  // Delay loop 1 (delay para simulação)
  for (let d = 0; d < 8; d++) {
    prog[pc++] = 0x0000; // nop
  }

  // 4. Desligar D13: cbi PORTB(0x05), 5
  prog[pc++] = 0x982d;

  // Delay loop 2
  for (let d = 0; d < 8; d++) {
    prog[pc++] = 0x0000; // nop
  }

  // 5. rjmp de volta para loopStart
  const relativeOffset = (loopStart - (pc + 1)) & 0xfff;
  prog[pc++] = 0xc000 | relativeOffset;

  return prog;
}
