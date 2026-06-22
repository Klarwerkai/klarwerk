# 90 — Correction Log (Harness Correction Development)

Jede wiederkehrende Abweichung wird hier als behobene Harness-Lücke dokumentiert, statt sie nur im Code zu reparieren.

| Datum | Symptom / Abweichung | Harness-Regel ergänzt in | Status |
|---|---|---|---|
| 2026-06-22 | (Initialer Aufbau — noch keine Korrekturen) | — | — |
| 2026-06-22 | Unvollständiges `npm install` ließ Fastify-Typdeklarationen fehlen → `tsc`-Fehler „Could not find declaration file". | Build-Schritt muss `npm ci` (deterministisch, vollständig) statt partiellem `npm install` nutzen. | behoben |
| 2026-06-22 | „Done" überstrapaziert: FR-RBAC-02 hat offene Akzeptanzteile (Löschen, Audit). | DoD-Regel: Story erst „Done", wenn **alle** Akzeptanzkriterien als Tests grün sind; sonst „In Progress". | angewandt |
