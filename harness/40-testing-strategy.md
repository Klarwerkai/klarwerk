# 40 — Teststrategie

## Grundsatz
Tests werden **aus Anforderungen/Akzeptanzkriterien** erzeugt — niemals aus bereits geschriebenem Code (sonst bestätigen sie nur das Ist-Verhalten). Ablauf: Anforderung → erwartetes Verhalten → zunächst fehlschlagender Test → Implementierung → grün.

## Arten
- **API-Tests** (`/tests/api`): je Modul gegen echte DB im Container (Testcontainers). Prüfen HTTP-Antworten, DB-Zustand, ausgelöste Domain Events.
- **Workflow-/E2E-Tests** (`/tests/workflows`): Wenn ein n8n-Integrationsworkflow durch eigenen
  ADR eingeführt wurde, wird die gesamte benötigte Umgebung hochgefahren und der reale Workflow
  ausgelöst. Externe Systeme werden mit WireMock/Mock simuliert — keine echten Seiteneffekte.
- **Contract-Tests** (`/tests/contracts`): API- und Event-Schemata.

## Akzeptanz-Gate
Ein Feature ist erst fertig, wenn seine Akzeptanzkriterien als **grüne Tests** existieren. Ziel-Coverage Backend/Workflow ≥ 80 %.
