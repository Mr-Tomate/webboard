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
