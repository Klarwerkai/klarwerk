# 40 — Teststrategie

## Grundsatz
Tests werden **aus Anforderungen/Akzeptanzkriterien** erzeugt — niemals aus bereits geschriebenem Code (sonst bestätigen sie nur das Ist-Verhalten). Ablauf: Anforderung → erwartetes Verhalten → zunächst fehlschlagender Test → Implementierung → grün.

## Arten
- **API-Tests** (`/tests/api`): je Modul gegen echte DB im Container (Testcontainers). Prüfen HTTP-Antworten, DB-Zustand, ausgelöste Domain Events.
- **Workflow-/E2E-Tests** (`/tests/workflows`): gesamte Umgebung + n8n hochgefahren, reale Workflows ausgelöst. Externe Systeme (Notion/Jira/Mail) mit WireMock/Mock simuliert — keine echten Seiteneffekte.
- **Contract-Tests** (`/tests/contracts`): API- und Event-Schemata.

## Akzeptanz-Gate
Ein Feature ist erst fertig, wenn seine Akzeptanzkriterien als **grüne Tests** existieren. Ziel-Coverage Backend/Workflow ≥ 80 %.
