# 80 — Definition of Done

Ein Stück Arbeit gilt als fertig, wenn **alle** Punkte erfüllt sind:

- [ ] `tools/build` grün
- [ ] `tools/lint` grün (Biome)
- [ ] Architekturregeln grün (dependency-cruiser)
- [ ] `tools/test` grün — alle Akzeptanzkriterien der Spec als Tests vorhanden und grün
- [ ] Dokumentation aktualisiert (`/docs`, Logbuch in Notion)
- [ ] Keine Secrets im Code, keine offenen TODOs
- [ ] Bei sensiblen Aktionen: menschliche Freigabe eingeholt

`tools/check` führt Build + Lint + Architektur + Tests in einem Lauf aus. Nur grün = lieferbar.
