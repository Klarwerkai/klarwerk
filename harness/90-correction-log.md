# 90 — Correction Log (Harness Correction Development)

Jede wiederkehrende Abweichung wird hier als behobene Harness-Lücke dokumentiert, statt sie nur im Code zu reparieren.

| Datum | Symptom / Abweichung | Harness-Regel ergänzt in | Status |
|---|---|---|---|
| 2026-06-22 | (Initialer Aufbau — noch keine Korrekturen) | — | — |
| 2026-06-22 | Unvollständiges `npm install` ließ Fastify-Typdeklarationen fehlen → `tsc`-Fehler „Could not find declaration file". | Build-Schritt muss `npm ci` (deterministisch, vollständig) statt partiellem `npm install` nutzen. | behoben |
| 2026-06-22 | „Done" überstrapaziert: FR-RBAC-02 hat offene Akzeptanzteile (Löschen, Audit). | DoD-Regel: Story erst „Done", wenn **alle** Akzeptanzkriterien als Tests grün sind; sonst „In Progress". | angewandt |
| 2026-06-22 | `no-orphans`-Warnung für rein per `import type` genutzte Dateien; Modulgrenzen prüften Typ-Importe nicht. | `tsPreCompilationDeps: true` in `.dependency-cruiser.cjs` — Architekturregeln decken jetzt auch Typ-Importe ab. | behoben |
| 2026-07-19 | ≥2 app-globale ASYNC-onSend-Hooks verzögern writeHead über die Handler-Resolution hinaus → Fastifys wrap-thenable sendet nach „`reply.send()` + resolve undefined" ERNEUT → ERR_HTTP_HEADERS_SENT als unhandled rejection → Prozess-Crash (traf JEDEN Handler mit diesem Muster, sichtbar am Prod-Import-502: je Aufruf ein Neustart). | WP-E: (1) App-globale onSend-Hooks IMMER synchron (Callback-Stil `done(null, payload)`, nie `async`). (2) Handler, die selbst senden, enden mit `return reply` (Thenable-Adoption). (3) Fehlerpfade loggen die (redigierte) Ursache statt `catch {}`. | behoben |
