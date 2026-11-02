import type * as MonacoType from 'monaco-editor';

/**
 * Provedor de Linguagem e Tema Didático do Webboard para Arduino C++ & Python.
 * Oferece autocomplete instantâneo (sem necessidade de servidor LSP externo),
 * hover tooltips didáticos em português e tema de alto contraste visual.
 */
export function setupArduinoLanguage(monaco: typeof MonacoType): void {
  // 1. REGISTRO DO TEMA DIDÁTICO 'webboard-student-dark'
  monaco.editor.defineTheme('webboard-student-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'f43f5e', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: 'fb7185' },
      { token: 'type', foreground: 'c084fc' },
      { token: 'string', foreground: '34d399' },
      { token: 'number', foreground: '38bdf8' },
      { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '94a3b8' },
      { token: 'identifier', foreground: 'e2e8f0' }
    ],
    colors: {
      'editor.background': '#131317',
      'editor.foreground': '#e2e8f0',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#00e599',
      'editorCursor.foreground': '#00e599',
      'editor.selectionBackground': '#27272a99',
      'editor.inactiveSelectionBackground': '#18181b80',
      'editor.lineHighlightBackground': '#1a1a20',
      'editorIndentGuide.background1': '#27272a',
      'editorIndentGuide.activeBackground1': '#3f3f46',
      'editorBracketHighlight.foreground1': '#fbbf24',
      'editorBracketHighlight.foreground2': '#38bdf8',
      'editorBracketHighlight.foreground3': '#ec4899',
      'editorOverviewRuler.border': '#27272a'
    }
  });

  // 2. AUTOCOMPLETE NATIVO PARA ARDUINO C++ (Sem latência, 100% Offline)
  monaco.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const suggestions: MonacoType.languages.CompletionItem[] = [
        // --- Funções I/O Digital ---
        {
          label: 'pinMode',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'pinMode(${1:pin}, ${2|OUTPUT,INPUT,INPUT_PULLUP|});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**pinMode(pino, modo)**\n\nConfigura o pino especificado como `OUTPUT` (saída), `INPUT` (entrada) ou `INPUT_PULLUP` (com resistor de pull-up interno).\n\n```cpp\npinMode(13, OUTPUT);\n```'
          },
          range
        },
        {
          label: 'digitalWrite',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'digitalWrite(${1:pin}, ${2|HIGH,LOW|});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**digitalWrite(pino, valor)**\n\nEnvia nível lógico `HIGH` (5V) ou `LOW` (0V) para o pino digital especificado.\n\n```cpp\ndigitalWrite(13, HIGH);\n```'
          },
          range
        },
        {
          label: 'digitalRead',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'digitalRead(${1:pin})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**digitalRead(pino)**\n\nLê o valor de um pino digital configurado como entrada. Retorna `HIGH` ou `LOW`.\n\n```cpp\nint estado = digitalRead(2);\n```'
          },
          range
        },

        // --- Funções I/O Analógico e PWM ---
        {
          label: 'analogRead',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'analogRead(${1:A0});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**analogRead(pino)**\n\nLê o valor do pino analógico via ADC de 10 bits. Retorna um inteiro de `0` (0V) a `1023` (5V).'
          },
          range
        },
        {
          label: 'analogWrite',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'analogWrite(${1:pin}, ${2:128});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**analogWrite(pino, valorPWM)**\n\nGera sinal PWM no pino (3, 5, 6, 9, 10, 11 no Uno). Valor varia de `0` (0%) a `255` (100%).'
          },
          range
        },

        // --- Temporização ---
        {
          label: 'delay',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'delay(${1:1000});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**delay(ms)**\n\nPausa o programa pelo número de milissegundos indicado.\n\n```cpp\ndelay(1000); // Aguarda 1 segundo\n```'
          },
          range
        },
        {
          label: 'delayMicroseconds',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'delayMicroseconds(${1:10});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**delayMicroseconds(us)**\n\nPausa a execução por microssegundos (essencial para disparo de sensores ultrassônicos como HC-SR04).'
          },
          range
        },
        {
          label: 'millis',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'millis()',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**millis()**\n\nRetorna o número de milissegundos decorridos desde que a placa começou a rodar o sketch.'
          },
          range
        },

        // --- Comunicação Serial ---
        {
          label: 'Serial.begin',
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: 'Serial.begin(${1|9600,115200,57600,19200|});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**Serial.begin(baudRate)**\n\nInicia a porta serial para comunicação com o Monitor Serial do Webboard.\n\n```cpp\nSerial.begin(9600);\n```'
          },
          range
        },
        {
          label: 'Serial.println',
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: 'Serial.println(${1:"Texto"});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**Serial.println(dado)**\n\nImprime dados na porta serial seguido de uma quebra de linha (`\\r\\n`).'
          },
          range
        },
        {
          label: 'Serial.print',
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: 'Serial.print(${1:"Texto"});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: {
            value: '**Serial.print(dado)**\n\nImprime dados na porta serial sem quebra de linha.'
          },
          range
        },

        // --- Constantes do Arduino ---
        {
          label: 'HIGH',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'HIGH',
          documentation: 'Nível Lógico Alto (5V)',
          range
        },
        {
          label: 'LOW',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'LOW',
          documentation: 'Nível Lógico Baixo (0V / Terra)',
          range
        },
        {
          label: 'OUTPUT',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'OUTPUT',
          documentation: 'Modo de pino: Saída de Tensão',
          range
        },
        {
          label: 'INPUT',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'INPUT',
          documentation: 'Modo de pino: Entrada de Tensão (alta impedância)',
          range
        },
        {
          label: 'INPUT_PULLUP',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'INPUT_PULLUP',
          documentation: 'Modo de pino: Entrada com Resistor de Pull-Up interno ativado',
          range
        },
        {
          label: 'LED_BUILTIN',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'LED_BUILTIN',
          documentation: 'Constante que mapeia para o LED interno da placa (Pino 13 no Uno)',
          range
        },

        // --- Snippets Didáticos Completos ---
        {
          label: 'snippet-blink',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'void setup() {',
            '  pinMode(${1:13}, OUTPUT);',
            '}',
            '',
            'void loop() {',
            '  digitalWrite(${1:13}, HIGH);',
            '  delay(${2:1000});',
            '  digitalWrite(${1:13}, LOW);',
            '  delay(${2:1000});',
            '}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Estrutura completa do clássico Blink (Pisca-Pisca com LED).',
          range
        },
        {
          label: 'snippet-button',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'const int pinBotao = ${1:2};',
            'const int pinLed = ${2:13};',
            '',
            'void setup() {',
            '  pinMode(pinBotao, INPUT_PULLUP);',
            '  pinMode(pinLed, OUTPUT);',
            '}',
            '',
            'void loop() {',
            '  int estado = digitalRead(pinBotao);',
            '  if (estado == LOW) {',
            '    digitalWrite(pinLed, HIGH);',
            '  } else {',
            '    digitalWrite(pinLed, LOW);',
            '  }',
            '}'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Controle de LED via Pushbutton com resistor INPUT_PULLUP.',
          range
        }
      ];

      return { suggestions };
    }
  });

  // 3. HOVER TOOLTIPS DIDÁTICOS EM PORTUGUÊS
  monaco.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const hoverDocs: Record<string, string> = {
        pinMode: '### `pinMode(pino, modo)`\nDefine se um pino atuará enviando energia (`OUTPUT`) ou lendo sinais (`INPUT`).\n\n*Exemplo:* `pinMode(13, OUTPUT);`',
        digitalWrite: '### `digitalWrite(pino, valor)`\nAtiva (`HIGH` = 5V) ou desativa (`LOW` = 0V) a saída de um pino digital.\n\n*Exemplo:* `digitalWrite(13, HIGH);`',
        digitalRead: '### `digitalRead(pino)`\nVerifica se há tensão no pino. Retorna `HIGH` ou `LOW`.\n\n*Exemplo:* `if (digitalRead(2) == HIGH) { ... }`',
        delay: '### `delay(tempoMs)`\nPausa a execução do circuito. Durante o `delay`, o microcontrolador fica em pausa estática.',
        Serial: '### `Classe Serial`\nPermite enviar mensagens de texto e telemetria do Arduino Uno para o computador via barramento UART (Pinos 0 e 1).'
      };

      if (hoverDocs[word.word]) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: hoverDocs[word.word] }]
        };
      }

      return null;
    }
  });
}
