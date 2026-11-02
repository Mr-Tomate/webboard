/** Flash do ATmega328P: 32KB = 16384 words de 16 bits. */
export const ATMEGA328P_FLASH_WORDS = 16384;

/**
 * Parser de formato Intel HEX para memória de programa do microcontrolador AVR.
 */
export function parseIntelHex(hexString: string, targetBytes: Uint8Array): void {
  const lines = hexString.split(/\r?\n/);
  let baseAddress = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(':')) continue;

    const byteCount = parseInt(trimmed.substring(1, 3), 16);
    const address = parseInt(trimmed.substring(3, 7), 16);
    const recordType = parseInt(trimmed.substring(7, 9), 16);

    if (recordType === 0) {
      // Data Record
      const fullAddress = baseAddress + address;
      for (let i = 0; i < byteCount; i++) {
        const byte = parseInt(trimmed.substring(9 + i * 2, 11 + i * 2), 16);
        if (fullAddress + i < targetBytes.length) {
          targetBytes[fullAddress + i] = byte;
        }
      }
    } else if (recordType === 1) {
      // End of File
      break;
    } else if (recordType === 2) {
      // Extended Segment Address
      baseAddress = parseInt(trimmed.substring(9, 13), 16) << 4;
    } else if (recordType === 4) {
      // Extended Linear Address
      baseAddress = parseInt(trimmed.substring(9, 13), 16) << 16;
    }
  }
}

/**
 * Valida estrutura e checksums de um arquivo Intel HEX antes de gravá-lo na flash virtual.
 * Retorna a descrição do primeiro problema encontrado, ou null se o arquivo for íntegro.
 */
export function validateIntelHex(hexString: string): string | null {
  const lines = hexString
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return 'arquivo Intel HEX vazio.';

  let dataRecords = 0;
  let hasEof = false;

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const lineNo = n + 1;

    if (!line.startsWith(':')) return `linha ${lineNo}: registro sem prefixo ':'.`;
    const body = line.substring(1);
    if (!/^[0-9a-fA-F]+$/.test(body) || body.length % 2 !== 0 || body.length < 10) {
      return `linha ${lineNo}: caracteres hexadecimais inválidos.`;
    }

    const bytes: number[] = [];
    for (let i = 0; i < body.length; i += 2) {
      bytes.push(parseInt(body.substring(i, i + 2), 16));
    }

    const byteCount = bytes[0];
    if (bytes.length !== byteCount + 5) {
      return `linha ${lineNo}: tamanho do registro não confere com o byte count.`;
    }

    const sum = bytes.reduce((acc, b) => acc + b, 0) & 0xff;
    if (sum !== 0) return `linha ${lineNo}: checksum inválido.`;

    const recordType = bytes[3];
    if (recordType === 0) dataRecords++;
    if (recordType === 1) {
      hasEof = true;
      break;
    }
  }

  if (dataRecords === 0) return 'nenhum registro de dados encontrado.';
  if (!hasEof) return "registro de fim de arquivo (':00000001FF') ausente.";
  return null;
}

/**
 * Converte um Intel HEX na imagem de memória de programa (words little-endian)
 * aceita pelo construtor `CPU` do AVR8js.
 */
export function hexToProgramWords(
  hexString: string,
  flashWords: number = ATMEGA328P_FLASH_WORDS
): Uint16Array {
  const program = new Uint16Array(flashWords);
  parseIntelHex(hexString, new Uint8Array(program.buffer));
  return program;
}

/**
 * Utilitário para sintetizar registros Intel HEX a partir de palavras (words) de instrução do AVR.
 * Converte palavras little-endian de 16 bits em registros tipo 00 com checksums de dois complementos
 * e registro EOF :00000001FF.
 */
export function generateIntelHex(words: Uint16Array, maxWords: number = 128): string {
  const totalWords = Math.min(words.length, maxWords);
  const bytes = new Uint8Array(totalWords * 2);
  for (let i = 0; i < totalWords; i++) {
    const word = words[i] ?? 0;
    bytes[i * 2] = word & 0xff; // Low byte
    bytes[i * 2 + 1] = (word >> 8) & 0xff; // High byte
  }

  const lines: string[] = [];
  const bytesPerLine = 16;

  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const chunk = bytes.subarray(offset, Math.min(offset + bytesPerLine, bytes.length));
    if (chunk.length === 0) continue;
    if (offset > 64 && chunk.every((b) => b === 0)) {
      // Pula blocos inteiramente zerados após o cabeçalho inicial
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
