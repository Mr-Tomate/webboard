# 05 - Especificação de Schemas de Dados (JSON Contracts)

Este documento especifica os esquemas de dados fundamentais do Core do Webboard. Todos os modelos são representados em JSON/JSON Schema, garantindo interoperabilidade e persistência declarativa.

---

## 1. Schema do Circuito e Bancada (`CircuitDefinition`)

Representa o estado completo de uma bancada de trabalho (componentes colocados, fios esticados e parâmetros de ambiente).

### 1.1. Estrutura JSON Exemplo
```json
{
  "schemaVersion": "1.0.0",
  "circuitId": "ckt_7f9a1b2c",
  "environment": {
    "temperatureCelsius": 25.0,
    "ambientLightLux": 300,
    "obstacles": [
      {
        "id": "obs_wall_01",
        "targetSensorId": "sensor_sonar_01",
        "distanceCm": 45.5
      }
    ]
  },
  "components": [
    {
      "id": "mcu_uno_01",
      "type": "MICROCONTROLLER_ARDUINO_UNO",
      "label": "Arduino Uno R3",
      "isLocked": true,
      "position": { "x": 100, "y": 150 },
      "parameters": {}
    },
    {
      "id": "res_01",
      "type": "PASSIVE_RESISTOR",
      "label": "Resistor 220R",
      "isLocked": false,
      "position": { "x": 320, "y": 180 },
      "parameters": {
        "resistanceOhms": 220,
        "tolerancePercent": 5,
        "powerRatingWatts": 0.25
      }
    },
    {
      "id": "led_01",
      "type": "ACTUATOR_LED",
      "label": "LED Vermelho",
      "isLocked": false,
      "position": { "x": 400, "y": 180 },
      "parameters": {
        "color": "RED",
        "forwardVoltageVolts": 1.8,
        "maxCurrentAmperes": 0.03
      }
    }
  ],
  "wires": [
    {
      "id": "wire_01",
      "from": { "componentId": "mcu_uno_01", "pinId": "D13" },
      "to": { "componentId": "res_01", "pinId": "PIN_1" },
      "color": "GREEN"
    },
    {
      "id": "wire_02",
      "from": { "componentId": "res_01", "pinId": "PIN_2" },
      "to": { "componentId": "led_01", "pinId": "ANODE" },
      "color": "RED"
    },
    {
      "id": "wire_03",
      "from": { "componentId": "led_01", "pinId": "CATHODE" },
      "to": { "componentId": "mcu_uno_01", "pinId": "GND_1" },
      "color": "BLACK"
    }
  ]
}
```

---

## 2. Schema do Desafio e Casos de Teste (`ChallengeDefinition`)

Define as regras de um exercício pedagógico, os limites de materiais e os testes com estímulos temporais.

### 2.1. Estrutura JSON Exemplo
```json
{
  "schemaVersion": "1.0.0",
  "challengeId": "ch_alarme_distancia_01",
  "title": "Alarme de Proximidade com Sensor Ultrassônico",
  "difficulty": "INTERMEDIATE",
  "allowedLanguages": ["CPP", "PYTHON"],
  "kitPolicy": {
    "mode": "RESTRICTED_BOM",
    "allowedComponents": [
      { "type": "MICROCONTROLLER_ARDUINO_UNO", "maxQuantity": 1 },
      { "type": "SENSOR_ULTRASONIC_HCSR04", "maxQuantity": 1 },
      { "type": "ACTUATOR_BUZZER", "maxQuantity": 1 },
      { "type": "ACTUATOR_LED", "maxQuantity": 2 },
      { "type": "PASSIVE_RESISTOR", "maxQuantity": 4 }
    ]
  },
  "initialCircuit": {
    "components": [
      {
        "id": "mcu_uno_01",
        "type": "MICROCONTROLLER_ARDUINO_UNO",
        "isLocked": true,
        "position": { "x": 100, "y": 150 }
      }
    ],
    "wires": []
  },
  "testSuite": [
    {
      "id": "tc_public_01",
      "name": "Verificação de Topologia e Segurança Elétrica",
      "isPublic": true,
      "timeoutVirtualSeconds": 0.0,
      "staticAssertions": [
        {
          "type": "COMPONENT_COUNT",
          "componentType": "ACTUATOR_BUZZER",
          "expectedExactCount": 1
        },
        {
          "type": "SERIES_PROTECTION_RESISTOR",
          "targetComponentType": "ACTUATOR_LED",
          "minResistanceOhms": 150,
          "maxResistanceOhms": 1000
        }
      ],
      "stimuli": [],
      "dynamicAssertions": []
    },
    {
      "id": "tc_public_02",
      "name": "Alerta Ativo para Obstáculo a Menos de 20cm",
      "isPublic": true,
      "timeoutVirtualSeconds": 4.0,
      "staticAssertions": [],
      "stimuli": [
        {
          "atVirtualSecond": 0.0,
          "target": "environment.obstacles.obs_wall_01",
          "action": "SET_DISTANCE",
          "value": 15.0
        }
      ],
      "dynamicAssertions": [
        {
          "type": "PIN_PULSE_FREQUENCY",
          "targetPin": { "componentType": "ACTUATOR_BUZZER", "pinId": "VCC" },
          "duringVirtualSeconds": { "start": 1.0, "end": 3.5 },
          "expectedMinFrequencyHz": 1.0,
          "expectedMaxFrequencyHz": 10.0
        }
      ]
    },
    {
      "id": "tc_hidden_03",
      "name": "Silêncio com Obstáculo Distante (Teste Oculto)",
      "isPublic": false,
      "timeoutVirtualSeconds": 3.0,
      "staticAssertions": [],
      "stimuli": [
        {
          "atVirtualSecond": 0.0,
          "target": "environment.obstacles.obs_wall_01",
          "action": "SET_DISTANCE",
          "value": 80.0
        }
      ],
      "dynamicAssertions": [
        {
          "type": "PIN_STEADY_STATE",
          "targetPin": { "componentType": "ACTUATOR_BUZZER", "pinId": "VCC" },
          "duringVirtualSeconds": { "start": 0.5, "end": 2.5 },
          "expectedLevel": "LOW"
        }
      ]
    }
  ]
}
```

---

## 3. Schema do Snapshot de Submissão (`SubmissionSnapshot`)

Registra o momento em que o aluno submete uma resposta, contendo a entrega completa e o veredito da avaliação.

### 3.1. Estrutura JSON Exemplo
```json
{
  "schemaVersion": "1.0.0",
  "submissionId": "sub_99a8b7c6",
  "workspaceId": "ws_turma_8b_equipe_03",
  "challengeId": "ch_alarme_distancia_01",
  "versionNumber": 3,
  "submittedAt": "2026-10-28T10:45:00Z",
  "submittedBy": {
    "userId": "usr_aluno_lucas",
    "collaboratorUserIds": ["usr_aluno_gabriel"]
  },
  "payload": {
    "code": {
      "language": "PYTHON",
      "sourceText": "import pyfirmata\nimport time\n\nboard = pyfirmata.Arduino('/dev/ttyACM0')\n# logica do aluno..."
    },
    "circuit": {
      "circuitId": "ckt_7f9a1b2c",
      "components": [ "...lista de componentes..." ],
      "wires": [ "...lista de fios..." ]
    }
  },
  "evaluation": {
    "status": "APPROVED",
    "totalExecutionVirtualSeconds": 7.0,
    "summary": {
      "totalTests": 3,
      "passedTests": 3,
      "failedTests": 0
    },
    "testResults": [
      {
        "testCaseId": "tc_public_01",
        "passed": true,
        "executionTimeVirtualSeconds": 0.0,
        "message": "Topologia e proteção elétrica validadas com sucesso."
      },
      {
        "testCaseId": "tc_public_02",
        "passed": true,
        "executionTimeVirtualSeconds": 4.0,
        "message": "Buzzer acionou pulsos de alerta conforme esperado."
      },
      {
        "testCaseId": "tc_hidden_03",
        "passed": true,
        "executionTimeVirtualSeconds": 3.0,
        "message": "Condição de silêncio respeitada para obstáculos distantes."
      }
    ]
  }
}
```
