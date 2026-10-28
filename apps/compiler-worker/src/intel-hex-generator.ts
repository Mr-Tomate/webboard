/**
 * Utilitário para gerar registros Intel HEX a partir de buffers de bytes ou words do AVR.
 */
export function generateIntelHex(words: Uint16Array, maxWords = 128): string {
  const bytes = new Uint8Array(maxWords * 2);
  for (let i = 0; i < maxWords; i++) {
    const word = words[i] ?? 0;
    bytes[i * 2] = word & 0xff; // Low byte
    bytes[i * 2 + 1] = (word >> 8) & 0xff; // High byte
  }

  const lines: string[] = [];
  const bytesPerLine = 16;

  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const chunk = bytes.subarray(offset, offset + bytesPerLine);
    if (chunk.every((b) => b === 0) && offset > 64) {
      // Pula blocos vazios no final da flash
      continue;
    }

    const len = chunk.length;
    const addrHi = (offset >> 8) & 0xff;
    const addrLo = offset & 0xff;
    const type = 0x00; // Data Record

    let checksum = len + addrHi + addrLo + type;
    let hexData = '';

    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];
      checksum += b;
      hexData += b.toString(16).padStart(2, '0').toUpperCase();
    }

    const finalChecksum = ((~checksum + 1) & 0xff)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

    const line = `:${len.toString(16).padStart(2, '0').toUpperCase()}${addrHi
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()}${addrLo
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()}00${hexData}${finalChecksum}`;

    lines.push(line);
  }

  // EOF Record
  lines.push(':00000001FF');

  return lines.join('\n');
}
