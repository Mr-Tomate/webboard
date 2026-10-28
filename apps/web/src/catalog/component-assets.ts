/**
 * Cache global de texturas vetoriais (SVG) para renderização acelerada por GPU no Konva.
 *
 * Conforme Spec 08 (Extensibilidade e Pacotes) e Spec 12 (Workbench Engine).
 */

// SVGs oficiais dos pacotes de componentes com suporte aos estados: default, active, failure
export const COMPONENT_SVG_ASSETS: Record<string, Record<string, string>> = {
  MICROCONTROLLER_ARDUINO_UNO: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" width="220" height="160">
      <rect x="2" y="2" width="216" height="156" rx="6" fill="#005f73" stroke="#09090b" stroke-width="4"/>
      <rect x="70" y="66" width="80" height="26" rx="2" fill="#121214" stroke="#52525b" stroke-width="1.5"/>
      <text x="74" y="83" fill="#00e599" font-size="9" font-family="monospace" font-weight="bold">ATmega328P 16MHz</text>
      <rect x="18" y="70" width="22" height="20" rx="2" fill="#a1a1aa" stroke="#52525b" stroke-width="1.5"/>
      <circle cx="85" cy="42" r="4" fill="#3f3f46" stroke="#18181b" stroke-width="1"/>
      <text x="93" y="45" fill="#a1a1aa" font-size="8" font-family="monospace" font-weight="bold">L</text>
      <text x="75" y="138" fill="#38bdf8" font-size="11" font-family="monospace" font-weight="bold">ARDUINO UNO R3</text>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" width="220" height="160">
      <rect x="2" y="2" width="216" height="156" rx="6" fill="#005f73" stroke="#09090b" stroke-width="4"/>
      <rect x="70" y="66" width="80" height="26" rx="2" fill="#121214" stroke="#52525b" stroke-width="1.5"/>
      <text x="74" y="83" fill="#00e599" font-size="9" font-family="monospace" font-weight="bold">ATmega328P 16MHz</text>
      <rect x="18" y="70" width="22" height="20" rx="2" fill="#a1a1aa" stroke="#52525b" stroke-width="1.5"/>
      <circle cx="85" cy="42" r="4.5" fill="#eab308" stroke="#18181b" stroke-width="1"/>
      <text x="93" y="45" fill="#facc15" font-size="8" font-family="monospace" font-weight="bold">L</text>
      <text x="75" y="138" fill="#38bdf8" font-size="11" font-family="monospace" font-weight="bold">ARDUINO UNO R3</text>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" width="220" height="160">
      <rect x="2" y="2" width="216" height="156" rx="6" fill="#2d1517" stroke="#ef4444" stroke-width="4"/>
      <rect x="70" y="66" width="80" height="26" rx="2" fill="#121214" stroke="#7f1d1d" stroke-width="1.5"/>
      <text x="82" y="83" fill="#ef4444" font-size="9" font-family="monospace" font-weight="bold">HALTED</text>
      <rect x="18" y="70" width="22" height="20" rx="2" fill="#52525b" stroke="#7f1d1d" stroke-width="1.5"/>
      <text x="65" y="138" fill="#ef4444" font-size="11" font-family="monospace" font-weight="bold">[FALHA CRÍTICA]</text>
    </svg>`
  },

  PASSIVE_RESISTOR: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 44" width="90" height="44">
      <line x1="8" y1="22" x2="22" y2="22" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round"/>
      <line x1="68" y1="22" x2="82" y2="22" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round"/>
      <rect x="22" y="12" width="46" height="20" rx="3" fill="#d4b483" stroke="#18181b" stroke-width="2.5"/>
      <line x1="30" y1="12" x2="30" y2="32" stroke="#dc2626" stroke-width="3.5"/>
      <line x1="38" y1="12" x2="38" y2="32" stroke="#dc2626" stroke-width="3.5"/>
      <line x1="46" y1="12" x2="46" y2="32" stroke="#78350f" stroke-width="3.5"/>
      <line x1="58" y1="12" x2="58" y2="32" stroke="#eab308" stroke-width="2.5"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 44" width="90" height="44">
      <line x1="8" y1="22" x2="22" y2="22" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round"/>
      <line x1="68" y1="22" x2="82" y2="22" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round"/>
      <rect x="22" y="12" width="46" height="20" rx="3" fill="#e2c89f" stroke="#18181b" stroke-width="2.5"/>
      <line x1="30" y1="12" x2="30" y2="32" stroke="#dc2626" stroke-width="3.5"/>
      <line x1="38" y1="12" x2="38" y2="32" stroke="#dc2626" stroke-width="3.5"/>
      <line x1="46" y1="12" x2="46" y2="32" stroke="#78350f" stroke-width="3.5"/>
      <line x1="58" y1="12" x2="58" y2="32" stroke="#eab308" stroke-width="2.5"/>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 44" width="90" height="44">
      <line x1="8" y1="22" x2="22" y2="22" stroke="#52525b" stroke-width="3" stroke-linecap="round"/>
      <line x1="68" y1="22" x2="82" y2="22" stroke="#52525b" stroke-width="3" stroke-linecap="round"/>
      <rect x="22" y="12" width="46" height="20" rx="3" fill="#2d1517" stroke="#ef4444" stroke-width="2.5"/>
      <text x="26" y="25" fill="#ef4444" font-size="8" font-family="sans-serif" font-weight="bold">QUEIMADO</text>
    </svg>`
  },

  ACTUATOR_LED: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 75" width="70" height="75">
      <line x1="22" y1="48" x2="22" y2="65" stroke="#a1a1aa" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="48" y1="48" x2="48" y2="65" stroke="#a1a1aa" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 18 45 A 17 17 0 0 1 52 45 Z" fill="#ef4444" opacity="0.6" stroke="#18181b" stroke-width="3"/>
      <rect x="15" y="44" width="40" height="5" rx="2" fill="#b91c1c" stroke="#18181b" stroke-width="2"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 75" width="70" height="75">
      <line x1="22" y1="48" x2="22" y2="65" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="48" y1="48" x2="48" y2="65" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="35" cy="30" r="22" fill="#f87171" opacity="0.45"/>
      <path d="M 18 45 A 17 17 0 0 1 52 45 Z" fill="#ff2222" stroke="#ffffff" stroke-width="2"/>
      <circle cx="30" cy="24" r="4" fill="rgba(255,255,255,0.7)"/>
      <rect x="15" y="44" width="40" height="5" rx="2" fill="#dc2626" stroke="#18181b" stroke-width="2"/>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 75" width="70" height="75">
      <line x1="22" y1="48" x2="22" y2="65" stroke="#52525b" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="48" y1="48" x2="48" y2="65" stroke="#52525b" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 18 45 A 17 17 0 0 1 52 45 Z" fill="#1c1917" stroke="#7f1d1d" stroke-width="3"/>
      <rect x="15" y="44" width="40" height="5" rx="2" fill="#2d1517" stroke="#7f1d1d" stroke-width="2"/>
      <text x="17" y="32" fill="#ef4444" font-size="8" font-family="sans-serif" font-weight="bold">QUEIMADO</text>
    </svg>`
  },

  INPUT_PUSHBUTTON: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 60" width="70" height="60">
      <rect x="12" y="8" width="46" height="44" rx="6" fill="#27272a" stroke="#18181b" stroke-width="3"/>
      <circle cx="35" cy="30" r="15" fill="#3f3f46" stroke="#18181b" stroke-width="2"/>
      <line x1="0" y1="30" x2="12" y2="30" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
      <line x1="58" y1="30" x2="70" y2="30" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 60" width="70" height="60">
      <rect x="12" y="8" width="46" height="44" rx="6" fill="#18181b" stroke="#00e599" stroke-width="3"/>
      <circle cx="35" cy="30" r="13" fill="#00e599" stroke="#18181b" stroke-width="2"/>
      <line x1="0" y1="30" x2="12" y2="30" stroke="#00e599" stroke-width="3" stroke-linecap="round"/>
      <line x1="58" y1="30" x2="70" y2="30" stroke="#00e599" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 60" width="70" height="60">
      <rect x="12" y="8" width="46" height="44" rx="6" fill="#2d1517" stroke="#ef4444" stroke-width="3"/>
      <circle cx="35" cy="30" r="14" fill="#52525b" stroke="#7f1d1d" stroke-width="2"/>
    </svg>`
  },

  INPUT_POTENTIOMETER: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 70" width="90" height="70">
      <circle cx="45" cy="28" r="24" fill="#0284c7" stroke="#18181b" stroke-width="3"/>
      <circle cx="45" cy="28" r="14" fill="#0f172a" stroke="#18181b" stroke-width="2"/>
      <line x1="45" y1="28" x2="45" y2="16" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <line x1="18" y1="50" x2="18" y2="62" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
      <line x1="45" y1="50" x2="45" y2="62" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
      <line x1="72" y1="50" x2="72" y2="62" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 70" width="90" height="70">
      <circle cx="45" cy="28" r="24" fill="#38bdf8" stroke="#00e599" stroke-width="3"/>
      <circle cx="45" cy="28" r="14" fill="#0f172a" stroke="#18181b" stroke-width="2"/>
      <line x1="45" y1="28" x2="45" y2="16" stroke="#00e599" stroke-width="3" stroke-linecap="round"/>
      <line x1="18" y1="50" x2="18" y2="62" stroke="#00e599" stroke-width="3" stroke-linecap="round"/>
      <line x1="45" y1="50" x2="45" y2="62" stroke="#00e599" stroke-width="3" stroke-linecap="round"/>
      <line x1="72" y1="50" x2="72" y2="62" stroke="#00e599" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 70" width="90" height="70">
      <circle cx="45" cy="28" r="24" fill="#2d1517" stroke="#ef4444" stroke-width="3"/>
    </svg>`
  },

  ACTUATOR_BUZZER: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <circle cx="35" cy="30" r="24" fill="#18181b" stroke="#18181b" stroke-width="3"/>
      <circle cx="35" cy="30" r="8" fill="#3f3f46" stroke="#18181b" stroke-width="2"/>
      <line x1="22" y1="52" x2="22" y2="62" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
      <line x1="48" y1="52" x2="48" y2="62" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <circle cx="35" cy="30" r="26" fill="#3b82f6" opacity="0.3"/>
      <circle cx="35" cy="30" r="24" fill="#2563eb" stroke="#ffffff" stroke-width="3"/>
      <circle cx="35" cy="30" r="8" fill="#93c5fd" stroke="#18181b" stroke-width="2"/>
      <line x1="22" y1="52" x2="22" y2="62" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      <line x1="48" y1="52" x2="48" y2="62" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <circle cx="35" cy="30" r="24" fill="#2d1517" stroke="#ef4444" stroke-width="3"/>
    </svg>`
  },

  SENSOR_ULTRASONIC_HCSR04: {
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 70" width="130" height="70">
      <rect x="5" y="5" width="120" height="54" rx="4" fill="#0284c7" stroke="#09090b" stroke-width="3"/>
      <circle cx="35" cy="32" r="18" fill="#64748b" stroke="#18181b" stroke-width="2"/>
      <circle cx="35" cy="32" r="9" fill="#1e293b"/>
      <text x="31" y="27" fill="#ffffff" font-size="10" font-family="monospace" font-weight="bold">T</text>
      <circle cx="95" cy="32" r="18" fill="#64748b" stroke="#18181b" stroke-width="2"/>
      <circle cx="95" cy="32" r="9" fill="#1e293b"/>
      <text x="91" y="27" fill="#ffffff" font-size="10" font-family="monospace" font-weight="bold">R</text>
      <line x1="30" y1="55" x2="30" y2="64" stroke="#18181b" stroke-width="2.5"/>
      <line x1="55" y1="55" x2="55" y2="64" stroke="#18181b" stroke-width="2.5"/>
      <line x1="75" y1="55" x2="75" y2="64" stroke="#18181b" stroke-width="2.5"/>
      <line x1="100" y1="55" x2="100" y2="64" stroke="#18181b" stroke-width="2.5"/>
    </svg>`,
    active: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 70" width="130" height="70">
      <rect x="5" y="5" width="120" height="54" rx="4" fill="#0284c7" stroke="#00e599" stroke-width="3"/>
      <circle cx="35" cy="32" r="18" fill="#38bdf8" stroke="#18181b" stroke-width="2"/>
      <circle cx="35" cy="32" r="9" fill="#0284c7"/>
      <text x="31" y="27" fill="#ffffff" font-size="10" font-family="monospace" font-weight="bold">T</text>
      <circle cx="95" cy="32" r="18" fill="#38bdf8" stroke="#18181b" stroke-width="2"/>
      <circle cx="95" cy="32" r="9" fill="#0284c7"/>
      <text x="91" y="27" fill="#ffffff" font-size="10" font-family="monospace" font-weight="bold">R</text>
    </svg>`,
    failure: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 70" width="130" height="70">
      <rect x="5" y="5" width="120" height="54" rx="4" fill="#2d1517" stroke="#ef4444" stroke-width="3"/>
    </svg>`
  }
};

// Cache de instâncias HTMLImageElement para reutilização imediata na GPU
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Obtém ou carrega a textura HTMLImageElement correspondente ao tipo e estado visual.
 * No ambiente do navegador, retorna a imagem carregada via data URI.
 * No ambiente Node.js / SSR / Test runner, retorna null de forma segura.
 */
export function getComponentImage(type: string, visualState: string = 'default'): HTMLImageElement | null {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  const cacheKey = `${type}:${visualState}`;
  const existing = imageCache.get(cacheKey);
  if (existing) return existing;

  const typeAssets = COMPONENT_SVG_ASSETS[type] ?? COMPONENT_SVG_ASSETS['PASSIVE_RESISTOR'];
  const svgString = typeAssets[visualState] ?? typeAssets['default'];
  if (!svgString) return null;

  const img = new Image();
  const encodedSvg = encodeURIComponent(svgString);
  img.src = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

  imageCache.set(cacheKey, img);
  return img;
}
