export type SerialDirection = 'RX' | 'TX' | 'SYSTEM' | 'ERROR';

export interface SerialMessage {
  id: string;
  timestamp: string;
  direction: SerialDirection;
  text: string;
}

export const SUPPORTED_BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const;
export type BaudRate = (typeof SUPPORTED_BAUD_RATES)[number];

export const DEFAULT_CPP_CODE = `// Webboard - Arduino C++ Blink & Serial Demo
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("[BANCADA] Sistema inicializado a 16MHz");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("[UART] LED D13: LIGADO (HIGH)");
  delay(1000);
  
  digitalWrite(13, LOW);
  Serial.println("[UART] LED D13: DESLIGADO (LOW)");
  delay(1000);
}
`;

export const DEFAULT_PYTHON_CODE = `# Webboard - Python (PyFirmata) Virtual Automation
import pyfirmata
import time

board = pyfirmata.Arduino('/dev/ttyACM0')
print("[PYFIRMATA] Conectado a porta serial virtual")

led = board.get_pin('d:13:o')

while True:
    led.write(1)
    print("[PY] Pino D13 setado para HIGH")
    time.sleep(1.0)
    
    led.write(0)
    print("[PY] Pino D13 setado para LOW")
    time.sleep(1.0)
`;

export function formatSerialTimestamp(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function createSerialMessage(
  text: string,
  direction: SerialDirection = 'RX',
  timestamp?: string
): SerialMessage {
  return {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: timestamp ?? formatSerialTimestamp(),
    direction,
    text
  };
}

export function appendToSerialBuffer(
  buffer: SerialMessage[],
  newMessage: SerialMessage,
  maxSize: number = 500
): SerialMessage[] {
  const updated = [...buffer, newMessage];
  if (updated.length > maxSize) {
    return updated.slice(updated.length - maxSize);
  }
  return updated;
}
