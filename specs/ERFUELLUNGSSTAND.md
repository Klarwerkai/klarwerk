# Erfüllungsstand gegen das Pflichtenheft (R-1137)

> **Eine Nachweisquote, keine Fortschrittsanzeige.** Gezählt wird eine Anforderung nur, wenn es
> für sie **sowohl Code als auch einen Testfall gibt, der das Abnahmekriterium prüft**. „Teilweise"
> zählt nicht anteilig. Die Zahl gilt für einen festen Stand und altert mit jedem Einbau.

- **Gemessener Stand:** Basis `6ebcf0be` (1.0.0-beta.1.759), Abgleich durch Quelleninspektion am 08.10.2026.
  Am 09.10.2026 auf den Stand nach R-1349 nachgezogen (Kandidat `3fb14443`): Die dort entfernten, ungenutzten
  Stellen `services/rbac/src/guard.ts` und `InterviewSession` sind durch die tatsächlichen Produktwege ersetzt;
  alle übrigen Pfade und Testtitel sind gegen diesen Stand erneut abgeglichen.
- **Quelle der Anforderungen:** `specs/reference/Pflichtenheft.md` v1.0 (78 FR + 27 NFR = 105).
- **Was die Tabelle belegt:** dass der genannte Code und der genannte Testfall (Datei + wörtlicher
  Testtitel) im Bestand stehen. Ob diese Tests grün sind, belegt der Testlauf, nicht diese Tabelle.
- **Wächter:** `tests/pflichtenheft-nachweis/erfuellungsstand.test.ts` prüft, dass jede Anforderung des
  Pflichtenhefts genau einmal mit ihrer Priorität hier steht, jeder genannte Code- und Testpfad existiert,
  jeder Testtitel in seiner Datei vorkommt und die Quote unten aus den Zeilen gerechnet stimmt.

Nachweisquote: **63 von 105**

| Status | Anzahl | Bedeutung |
|---|---|---|
| nachgewiesen | 63 | Code und Testfall, der das Abnahmekriterium prüft |
| teilweise | 19 | Code und Test vorhanden, der Test deckt das Abnahmekriterium nur zum Teil |
| ohne Testnachweis | 0 | Code vorhanden, kein Testfall zum Abnahmekriterium |
| Code fehlt | 2 | ein Teil des Abnahmekriteriums ist im Code nicht umgesetzt |
| Abnahme außerhalb Tests | 19 | Abnahmekriterium ist kein Testfall (Review, Audit, Lasttest, SLA, Vertrag, Dokument) — Abnahmeschuld, keine Bauschuld |
| nicht zugeordnet | 2 | im Abgleich weder tragender Code noch Testfall zugeordnet; Stand ungeklärt |

## Herkunft und frühere Messung

Die Aufnahme R-1137 (Meilensteinplan 21.08.2026, JOB 1482) nennt 65 von 105 gegen den Stand `449d76b`
und eine Datei `ERFUELLUNGSSTAND.md` aus Commit `454b776`. Diese Datei liegt in diesem Repository nicht
vor; laut Quelle stand der Push am 21.08. aus und ein Sichtungsbeleg fehlte. Die alte Zahl ist hier
deshalb nicht nachprüfbar und mit der heutigen nicht zeilengleich vergleichbar. Diese Tabelle ersetzt sie
für den oben genannten Stand.

## Funktionale Anforderungen

| ID | Prio | Status | Code | Testfall | Anmerkung |
|---|---|---|---|---|---|
| FR-AUTH-01 | MUSS | nachgewiesen | `services/auth/src/service.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-01: erstes Konto einer leeren Instanz wird Admin“ | — |
| FR-AUTH-02 | MUSS | nachgewiesen | `services/auth/src/service.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-02: weitere Konten sind Experte und bis zur Freigabe gesperrt“<br>`tests/einstieg-vor-start/anmeldemaske-fuehrt-nicht-in-die-absage.test.tsx` › „der abgewiesene Versuch bekommt eine eigene Fläche“ | — |
| FR-AUTH-03 | MUSS | nachgewiesen | `services/auth/src/service.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-03: falsche Daten werden klar abgewiesen“ | — |
| FR-AUTH-04 | MUSS | nachgewiesen | `services/auth/src/service.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-04: Logout beendet die Sitzung serverseitig“ | — |
| FR-AUTH-05 | MUSS | nachgewiesen | `services/auth/src/password.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-05: Passwort nur als Salt+Hash gespeichert“<br>`tests/auth-speicherung/kennwort-nur-salz-und-hash.test.ts` › „alle vier Kennwortwege: PBKDF2-SHA256“ | — |
| FR-AUTH-06 | MUSS | nachgewiesen | `services/auth/src/service.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-06: Admin-Reset macht alte Sitzungen ungültig, neues Passwort gilt“ | — |
| FR-AUTH-07 | SOLL | nachgewiesen | `services/auth/src/oidc.ts` | `services/auth/src/oidc.test.ts` › „OIDC-Provider Code-Flow (FR-AUTH-07)“<br>`services/auth/src/oidc.test.ts` › „Rollen-Mapping (FR-AUTH-07)“ | Anbindung an einen echten Identitätsanbieter ist nicht Teil des Tests. |
| FR-AUTH-08 | KANN | nachgewiesen | `services/auth/src/service.ts`<br>`services/notifications/src/mailer.ts` | `services/auth/src/service.test.ts` › „FR-AUTH-08: Reset per Token; unbekannte E-Mail verschwiegen, Token einmalig“ | Zustellung über einen echten Mailanbieter ist nicht Teil des Tests. |
| FR-RBAC-01 | MUSS | nachgewiesen | `services/rbac/src/policy.ts` | `services/rbac/src/policy.test.ts` › „FR-RBAC-01: Rechtematrix wirkt je Rolle“ | — |
| FR-RBAC-02 | MUSS | nachgewiesen | `services/auth/src/service.ts` | `services/auth/src/service.test.ts` › „FR-RBAC-02: Admin-Aktionen mit Audit“ | — |
| FR-RBAC-03 | MUSS | nachgewiesen | `services/rbac/src/policy.ts`<br>`services/auth/src/service.ts` | `services/rbac/src/policy.test.ts` › „FR-RBAC-03: Admin kann sich nicht selbst die Admin-Rolle entziehen“<br>`services/auth/src/service.test.ts` › „der letzte aktive Admin kann sich nicht selbst herabstufen“ | — |
| FR-RBAC-04 | MUSS | nachgewiesen | `services/app/src/http.ts` | `services/auth/src/service.test.ts` › „FR-RBAC-04: Approve-Route ohne Adminrecht“ | Der Rechteweg ist `makeGuards().requirePermission` in `services/app/src/http.ts`; der frühere, ungenutzte Wächter `services/rbac/src/guard.ts` ist mit R-1349 entfernt. Ergänzend: `tests/security/route-guard-audit.test.ts`, `tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts`. |
| FR-CAP-01 | MUSS | teilweise | `apps/web/src/pages/Capture.tsx` | — | Laut `tests/erfassung-einstieg/README.md` sind alle vier Modi erreichbar, führen aber nicht zu demselben Datenstand (Blatt speichert Rumpf-HTML, Arbeitsraum Formularfelder). |
| FR-CAP-02 | MUSS | nachgewiesen | `services/reasoner/src/service.ts`<br>`services/reasoner/src/provider.ts`<br>`services/app/src/routes/reasoner-routes.ts` | `services/reasoner/src/service.test.ts` › „eine Frage pro Turn entlang der Fragenfolge“<br>`services/reasoner/src/service.test.ts` › „Abschluss bei ausreichendem Inhalt (Kernaussage + Bedingung + Maßnahme)“<br>`services/reasoner/src/service.test.ts` › „verdichtet die Antworten nachvollziehbar zum Entwurf“ | Das Interview läuft über den Reasoner (Aufgabe `interview`); die frühere, ungenutzte `InterviewSession` in `services/capture` ist mit R-1349 entfernt. Belegt ist der modellfreie Weg; wann ein Modell abschließt, hängt vom Modell ab. |
| FR-CAP-03 | MUSS | teilweise | `apps/web/src/lib/speechDictation.ts` | — | Diktat-Tests in `tests/diktat-fragefeld/sprechen-und-vorlesen.test.tsx`; „iOS friert nicht ein“ verlangt Bedienung auf einem echten iOS-Gerät, die kein Test ersetzt. |
| FR-CAP-04 | MUSS | Code fehlt | `apps/web/src/lib/files.ts` | `tests/app/upload-limits-visible.test.ts` › „MOBIL hat gar keine Dateiauswahl“ | Bilder lassen sich am Desktop aus Dateien wählen; eine Kamera-Aufnahme gibt es nicht, und der genannte Test hält fest, dass `/mobile` weder Dateifeld noch Kamera hat. |
| FR-CAP-05 | SOLL | teilweise | `apps/web/src/lib/ocr.ts` | `tests/capture/ocr-extract.test.ts` › „success: liefert getrimmten Text“ | Der OCR-Adapter ist getestet; dass OCR-Text in Strukturierung/Interview einfließt, ist keinem Testfall zugeordnet. |
| FR-CAP-06 | MUSS | nachgewiesen | `services/app/src/sichtbarkeit.ts` | `tests/entwurf-pool/pool-rechte.test.ts` › „Liste: Otto und Ada sehen den Pool-Entwurf mit Autorangabe“<br>`tests/entwurf-pool/pool-rechte.test.ts` › „Fortsetzen: Otto schreibt im Pool-Entwurf weiter“ | Umgesetzt nach den jüngeren Entscheidungen `debbb8e8`/`297afc57`: Entwurf standardmäßig privat, Pool nur auf bewusste Freigabe durch den Autor (s. Quellenwidersprüche). |
| FR-CAP-07 | MUSS | nachgewiesen | `services/capture/src/service.ts` | `services/capture/src/service.test.ts` › „FR-CAP-07: KO-Eingabe trägt den Entwurfs-Autor, nicht den Bearbeiter“ | — |
| FR-CAP-08 | MUSS | nachgewiesen | `services/capture/src/service.ts`<br>`services/knowledge-object/src/service.ts` | `services/capture/src/service.test.ts` › „FR-CAP-08: ungültige Validierungsanzahl wird abgewiesen“<br>`services/capture/src/service.test.ts` › „eine im Entwurf gesetzte Prüferanzahl wandert unverändert in die KO-Eingabe“<br>`services/knowledge-object/src/service.test.ts` › „FR-KO-01: erzeugt KO mit allen Pflichtfeldern“ | — |
| FR-CAP-09 | KANN | nachgewiesen | `apps/web/src/lib/offlineQueue.ts`<br>`apps/web/src/app/useOfflineQueue.ts` | `tests/app/f0027-entwuerfe-ohne-netz.test.tsx` › „offline geoeffnet: vorher kein Versand, nach dem Verbindungsereignis genau einer“<br>`tests/capture/offline-queue.test.ts` › „Status-Übergänge queued“ | Der erste Fall prüft am echten Hook: offline abgelegter Entwurf wird ohne Netz nicht gesendet und nach dem `online`-Ereignis genau einmal übertragen. Der zweite prüft nur die lokalen Statuswechsel. |
| FR-STR-01 | MUSS | teilweise | `services/reasoner/src/service.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-01: Aufgaben verfügbar (structure/answer/select)“ | Der Test prüft nur, dass `structure` ein Ergebnis liefert; ein Testfall, der alle Felder einschließlich Wissensart verlangt, ist nicht zugeordnet. |
| FR-STR-02 | MUSS | teilweise | `apps/web/src/components/RichTextEditor.tsx` | — | Datei-/Bildanbindung im Rumpf ist getestet (`tests/app/body-file-link.test.ts`, `tests/structure/session-file-object-linking-e2e.test.ts`); ein Testfall über alle Elemente (Überschriften, Listen, Hervorhebung, Panels, Links, Bilder, Anhänge) ist nicht zugeordnet. |
| FR-STR-03 | SOLL | teilweise | `apps/web/src/lib/editorDropPaste.ts` | `tests/app/editor-drop-paste.test.ts` › „partitionDropMedia trennt einbettbare Bilder von Evidence-Dateien“ | Getestet ist die Einordnung beim Ablegen/Einfügen, nicht das Einfügen an der Cursorposition. |
| FR-STR-04 | SOLL | nachgewiesen | `apps/web/src/lib/captureAiAssist.ts`<br>`apps/web/src/lib/bodyAiAssist.ts` | `tests/capture/capture-ai-assist.test.ts` › „bildet Label- und Instruction-Keys stabil je Aktion ab“<br>`tests/ki-assist-leer/assist-budget-und-anweisung.test.ts` › „die Anweisung erreicht das Modell auch über den Dienst“<br>`tests/ki-assist-leer/assist-route-ehrliche-meldung.test.ts` › „GEGENPROBE: antwortet das Modell wirklich, kommt der Vorschlag mit 200 an“<br>`tests/ki-assist-leer/assist-leere-antwort.test.ts` › „GEGENPROBE zur Regel: ein Ersatz, der WIRKLICH etwas ändert, wird geliefert“<br>`tests/capture/capture-ai-assist.test.ts` › „applyAssist: 'replace' ersetzt, 'append' hängt mit Leerzeile an“ | Vorschlag: jede Aktion trägt ihre Anweisung, die Anweisung erreicht das Modell, die Route liefert den Vorschlag (ohne Modell der deterministische Ersatz). Übernahme: `applyAssist`. |
| FR-STR-05 | MUSS | nachgewiesen | `apps/web/src/pages/Capture.tsx` | `tests/entwurf-datenerhalt/vorschau-bearbeiten-ohne-verlust.test.tsx` › „V1: Getipptes samt Bild und Bildunterschrift steht in der Vorschau und nach der Rückkehr unverändert da“ | — |
| FR-STR-06 | MUSS | nachgewiesen | `services/capture/src/service.ts` | `tests/entwurf-einreichen/kein-geister-entwurf.test.ts` › „Normalfall: 201, genau ein Wissensobjekt, der Entwurf ist aus dem Pool verschwunden“ | — |
| FR-KO-01 | MUSS | nachgewiesen | `services/knowledge-object/src/types.ts` | `services/knowledge-object/src/service.test.ts` › „FR-KO-01: erzeugt KO mit allen Pflichtfeldern“ | — |
| FR-KO-02 | MUSS | nachgewiesen | `services/knowledge-object/src/service.ts` | `services/knowledge-object/src/service.test.ts` › „FR-KO-02: Wissensart setzbar und filterbar“ | — |
| FR-KO-03 | MUSS | nachgewiesen | `services/knowledge-object/src/service.ts` | `services/knowledge-object/src/service.test.ts` › „FR-KO-03: Kategorie und Tags nachträglich änderbar und filterbar“ | — |
| FR-KO-04 | MUSS | nachgewiesen | `services/knowledge-object/src/service.ts` | `services/knowledge-object/src/service.test.ts` › „FR-KO-04: Überarbeiten erhöht Version, setzt Bewertungen zurück, erzeugt History“ | — |
| FR-VAL-01 | MUSS | nachgewiesen | `services/validation/src/trust.ts` | `services/validation/src/service.test.ts` › „FR-VAL-01: eine rote Bewertung hält Status offen und senkt Trust“ | — |
| FR-VAL-02 | MUSS | nachgewiesen | `services/validation/src/service.ts` | `services/validation/src/service.test.ts` › „FR-VAL-02: n grüne, 0 rote“ | — |
| FR-VAL-03 | MUSS | nachgewiesen | `services/validation/src/service.ts` | `services/validation/src/service.test.ts` › „FR-VAL-03: validierte KOs erscheinen nicht mehr im Board“ | — |
| FR-VAL-04 | MUSS | teilweise | `services/validation/src/service.ts` | `services/validation/src/service.test.ts` › „FR-VAL-04: Board filtert nach Kategorie (nur offene)“ | Zugeordnet ist nur der Kategoriefilter; die Kombination aller sechs Filter ist keinem Testfall zugeordnet. |
| FR-VAL-05 | MUSS | nachgewiesen | `services/validation/src/service.ts` | `services/validation/src/service.test.ts` › „FR-VAL-05: Zuweisung wird durch Bewertung erledigt“ | — |
| FR-VAL-06 | MUSS | nachgewiesen | `services/validation/src/service.ts` | `services/validation/src/service.test.ts` › „FR-VAL-06: Übersicht zählt offen/erledigt pro Person“ | — |
| FR-VAL-07 | SOLL | nachgewiesen | `services/app/src/notify.ts`<br>`services/notifications/src/mailer.ts` | `services/app/src/build-app.test.ts` › „Zuweisung schickt dem Zugewiesenen eine E-Mail“ | Zustellung über einen echten Mailanbieter ist nicht Teil des Tests. |
| FR-CON-01 | MUSS | nachgewiesen | `services/conflicts/src/service.ts` | `services/conflicts/src/service.test.ts` › „FR-CON-01: Widerspruch erzeugt klassifizierten Konflikt“ | — |
| FR-CON-02 | MUSS | nachgewiesen | `services/conflicts/src/service.ts` | `services/conflicts/src/service.test.ts` › „FR-CON-02: nur Wahrheitskonflikte eskalieren“ | — |
| FR-CON-03 | MUSS | nachgewiesen | `services/conflicts/src/service.ts` | `services/conflicts/src/service.test.ts` › „FR-CON-03: vollständiger Ablauf Eskalation“ | — |
| FR-CON-04 | MUSS | nachgewiesen | `services/conflicts/src/service.ts` | `services/conflicts/src/service.test.ts` › „FR-CON-04: ungelöste Konflikte werden gelistet, Badge zählt korrekt“ | — |
| FR-ASK-01 | MUSS | nachgewiesen | `services/ask/src/service.ts` | `services/ask/src/service.test.ts` › „FR-ASK-01/02: begründete Antwort mit Quelle bei passender Frage“ | — |
| FR-ASK-02 | MUSS | nachgewiesen | `services/reasoner/src/provider.ts` | `services/reasoner/src/service.test.ts` › „semantische Auswahl findet das passende KO trotz anderer Worte“ | — |
| FR-ASK-03 | MUSS | nachgewiesen | `services/ask/src/service.ts` | `services/ask/src/service.test.ts` › „FR-ASK-03: ohne Grundlage keine erfundene Antwort, Wissenslücke entsteht“ | — |
| FR-ASK-04 | MUSS | nachgewiesen | `services/ask/src/service.ts` | `services/ask/src/service.test.ts` › „erhöht Trust und erzeugt Audit-Eintrag“ | — |
| FR-ASK-05 | MUSS | nachgewiesen | `services/ask/src/service.ts` | `services/ask/src/service.test.ts` › „FR-ASK-05: Wissenslücke zuweisen, schließen, mit Bestätigung löschen“ | — |
| FR-ASK-06 | KANN | nachgewiesen | `services/reasoner/src/provider.ts` | `services/reasoner/src/service.test.ts` › „klassifiziert validiertes Wissen als gesichert mit Quellen“ | Der Fall prüft die Belegstelle (`steps[0].snippet`). |
| FR-LIB-01 | MUSS | teilweise | `services/library-analytics/src/service.ts`<br>`apps/web/src/lib/facetFilter.ts` | `services/library-analytics/src/service.test.ts` › „FR-LIB-01: Suche findet KO über Text“<br>`tests/library/g27-bibliothek-volltext.test.ts` › „Kategorie-Filter und Volltextsuche greifen gemeinsam“<br>`tests/library/facet-filter-logic.test.ts` › „KOMBINIERBAR: fremde Auswahl senkt die Zähler“ | Belegt sind Textsuche, Kategoriefilter zusammen mit der Volltextsuche und die allgemeine Facettenlogik. Kein Testfall ist der KI-Suche der Bibliothek und den Filtern nach Domäne, Status und Tags zugeordnet. |
| FR-LIB-02 | MUSS | teilweise | `services/library-analytics/src/service.ts`<br>`apps/web/src/lib/libraryExport.ts` | `services/library-analytics/src/service.test.ts` › „FR-LIB-02: Export als JSON und MediaWiki“<br>`services/library-analytics/src/service.test.ts` › „FR-LIB-02: Import ohne Duplikate“<br>`tests/library/library-export.test.ts` › „kennt alle vier Formate mit Label-Key + Endung“ | JSON, MediaWiki, Markdown und Import sind belegt; einen PDF-Export gibt es nicht (HTML ist laut Code eine Druckansicht, s. Quellenwidersprüche). |
| FR-LIB-03 | SOLL | nachgewiesen | `services/library-analytics/src/service.ts` | `services/library-analytics/src/service.test.ts` › „FR-LIB-03: Bus-Faktor erkennt Einzelquellen“ | — |
| FR-LIB-04 | SOLL | nachgewiesen | `services/library-analytics/src/service.ts` | `services/library-analytics/src/service.test.ts` › „FR-LIB-04: Graph verbindet KOs mit gemeinsamem Tag“ | — |
| FR-ANA-01 | MUSS | nachgewiesen | `services/library-analytics/src/service.ts` | `services/library-analytics/src/service.test.ts` › „FR-ANA-01: Analytics aggregiert nach Status/Art/Kategorie“<br>`services/validation/src/service.test.ts` › „FR-VAL-06: Übersicht zählt offen/erledigt pro Person“ | — |
| FR-ANA-02 | SOLL | nachgewiesen | `services/library-analytics/src/service.ts`<br>`apps/web/src/lib/analyticsMetrics.ts` | `services/app/src/build-app.test.ts` › „FR-ANA-02: Wirkungs-Dashboard zählt Antwortquote ohne Lücke“<br>`tests/analytics/analytics-metrics.test.ts` › „weeklyValidated sortiert chronologisch und begrenzt“ | — |
| FR-AUD-01 | MUSS | nachgewiesen | `services/audit/src/service.ts` | `tests/audit-gesamt/aktionsmatrix-12-3.test.ts` › „alle Aktionen belegt, Kette danach nachrechenbar“ | — |
| FR-AUD-02 | MUSS | nachgewiesen | `services/audit/src/chain.ts` | `services/audit/src/service.test.ts` › „FR-AUD-02: nachträglich geänderter Eintrag bricht die Kette“<br>`services/audit/src/service.test.ts` › „Ändern und Löschen über jeden Leseweg wird verweigert“ | — |
| FR-LIF-01 | SOLL | nachgewiesen | `services/lifecycle/src/service.ts` | `services/lifecycle/src/service.test.ts` › „FR-LIF-01: Anlagenänderung markiert gekoppelte KOs, Bestätigung erzeugt Version“ | — |
| FR-LIF-02 | MUSS | nachgewiesen | `services/lifecycle/src/service.ts` | `services/lifecycle/src/service.test.ts` › „FR-LIF-02: Autor-Übergabe ändert Autor, Originalautor bleibt“ | — |
| FR-LIF-03 | SOLL | nachgewiesen | `services/lifecycle/src/service.ts` | `services/lifecycle/src/service.test.ts` › „FR-LIF-03: Lernpfad mit Fortschritt“ | — |
| FR-LIF-04 | MUSS | teilweise | `apps/web/src/lib/koAuthor.ts` | `tests/ko/ko-author.test.ts` › „aktueller + Originalautor bei Transfer (abweichend)“ | Getestet ist die Autorzeile selbst; „Autor überall sichtbar“ ist keinem flächenübergreifenden Testfall zugeordnet. |
| FR-RSN-01 | MUSS | teilweise | `services/reasoner/src/service.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-01: Aufgaben verfügbar (structure/answer/select)“<br>`services/reasoner/src/service.test.ts` › „eine Frage pro Turn entlang der Fragenfolge“<br>`services/reasoner/src/service.test.ts` › „FR-RSN-03: assistText glättet deterministisch“ | Strukturieren, Beantworten, Auswahl, Interview und Schreibhilfe sind belegt; die Zweitmeinung über die Reasoner-Schicht ist keinem Testfall zugeordnet. |
| FR-RSN-02 | MUSS | nachgewiesen | `services/reasoner/src/service.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-05: Status spiegelt verfügbares Modell“<br>`services/reasoner/src/service.test.ts` › „loadPersistedPolicy: ohne ENV“ | Der erste Fall tauscht den Provider bei unveränderter Fachlogik. |
| FR-RSN-03 | MUSS | nachgewiesen | `services/reasoner/src/provider.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-03: ohne belastbares Wissen keine erfundene Antwort“ | — |
| FR-RSN-04 | MUSS | nachgewiesen | `services/reasoner/src/service.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-04: fällt auf deterministisch zurück, wenn das Modell offline ist“<br>`services/reasoner/src/service.test.ts` › „Fallback-Pfad: primary scheitert“ | — |
| FR-RSN-05 | MUSS | nachgewiesen | `services/reasoner/src/service.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-05: Status spiegelt verfügbares Modell“<br>`services/reasoner/src/service.test.ts` › „FR-RSN-04/05: ohne Modell deterministischer Fallback, Status offline“ | — |
| FR-RSN-06 | MUSS | teilweise | `services/reasoner/src/model-client.ts` | `services/reasoner/src/service.test.ts` › „liefert keinerlei Secret-/Key-/Prompt-Felder“<br>`tests/security/egress-encapsulation.test.ts` › „reasoner-Index exportiert keinen rohen Client“ | Statusauskunft und Kapselung sind belegt; eine Prüfung des gebauten Frontend-Bundles auf Schlüssel ist keinem Testfall zugeordnet. |
| FR-MOB-01 | MUSS | teilweise | `apps/web/public/manifest.webmanifest` | `tests/capture/sw-rules.test.ts` › „Manifest ist installierbar: standalone + 192/512-Icons + maskable“ | Belegt ist die technische Voraussetzung; „Zum Home-Bildschirm liefert Vollbild-App“ verlangt Bedienung auf einem echten Gerät. |
| FR-MOB-02 | MUSS | Code fehlt | `apps/web/src/pages/Mobile.tsx` | — | Die Mobilfläche hat die Reiter Erfassen/Fragen/Nachschlagen; einen Interview-Modus gibt es dort nicht. Die Abnahme in `specs/stories/mobile.md` ist offen. |
| FR-MOB-03 | MUSS | teilweise | `apps/web/src/lib/mobileConfirm.ts`<br>`apps/web/src/pages/Mobile.tsx` | `tests/capture/mobile-confirm.test.ts` › „confirm erkennt den finalen Löschschritt nur für den pending-Eintrag“ | Getestet ist nur die Hilfsfunktion. Kein Testfall prüft am mobilen Löschweg, dass Löschen erst nach der Inline-Bestätigung ausgeführt wird. |
| FR-I18N-01 | MUSS | teilweise | `services/i18n/src/service.ts` | `services/i18n/src/service.test.ts` › „FR-I18N-01: liefert DE und EN je nach Locale“<br>`services/reasoner/src/service.test.ts` › „liefert die nächste Frage auf Englisch bei locale 'en'“ | Belegt sind der Sprachdienst an einem Testschlüssel, englische Interviewfragen und DE/EN-Texte einzelner Flächen. Kein Testfall prüft die komplette Oberfläche (alle Texte, keine fest verdrahteten) und alle KI-Aufgaben in beiden Sprachen. |
| FR-I18N-02 | SOLL | nachgewiesen | `services/i18n/src/service.ts` | `services/i18n/src/service.test.ts` › „FR-I18N-02: neue Sprache ohne Code-Umbau ergänzbar“ | — |
| FR-EXT-01 | KANN | teilweise | `apps/web/src/lib/extConcept.ts` | `tests/library/ext-concept.test.ts` › „Schritte in konzeptioneller Reihenfolge“<br>`tests/library/ext-concept.test.ts` › „candidateFindings leitet Badges ehrlich ab“ | Pipeline-Logik und Befunde sind belegt; der Bildschirm selbst ist keinem Testfall zugeordnet. |
| FR-EXT-02 | KANN | nachgewiesen | `services/library-analytics/src/service.ts` | `tests/json-herkunft-rundlauf/herkunft-identitaet-importeur.test.ts` › „direkter JSON-Import: als importiert gekennzeichnet, ungeprüft und in der Prüfmenge“ | — |
| FR-EXT-03 | KANN | nachgewiesen | `services/output/src/service.ts` | `services/app/src/output-routes.test.ts` › „eligible listet nur validierte KOs; generate erzeugt Markdown + Provenance in koIds-Reihenfolge“ | Gültigkeit wird mangels Ablaufdatum im Datenmodell abgeleitet (FR-EXT-07 ist Konzept). |
| FR-EXT-04 | KANN | nachgewiesen | `services/management/src/metrics.ts`<br>`apps/web/src/components/WissensPriorisierung.tsx` | `services/management/src/metrics.test.ts` › „Werte aus nachvollziehbaren Eingangsdaten; Score = Mittel der bekannten Faktoren; gerankt“<br>`services/management/src/metrics.test.ts` › „Flags für die Filter der Quelle: Bus-Faktor 1, veraltet, hoher Schutzwert“<br>`tests/analytics/wissens-priorisierung-mounted.test.tsx` › „Rang, Score, Flags und Faktor-Detail; fehlende Eingangsdaten heissen so, nicht 0“<br>`tests/analytics/wissens-priorisierung-mounted.test.tsx` › „die Filter der Quelle: alles, Bus-Faktor 1, veraltet, hoher Schutzwert“ | Dienst: Werte, Score, Ranking, Flags. Fläche: gerankte Liste mit Score, Flags, Faktor-Detail und Filtern. |
| FR-EXT-05 | KANN | teilweise | `services/management/src/metrics.ts`<br>`apps/web/src/pages/Stufe2.tsx` | `services/management/src/metrics.test.ts` › „house markiert fragile Domänen“ | Domänen-Füllgrad ist belegt; der Bildschirm mit KPIs ist keinem Testfall zugeordnet. |
| FR-EXT-06 | KANN | teilweise | `apps/web/src/lib/extConcept.ts` | `tests/library/ext-concept.test.ts` › „outputEligible true + freshness validiert“ | Aktualität ist belegt; IP-Sensitivität mit Deployment-Empfehlung ist keinem Testfall zugeordnet. |
| FR-EXT-07 | SOLL | Abnahme außerhalb Tests | — | — | Abnahmekriterium ist die Dokumentation; die Felder stehen in `specs/reference/Funktionsbeschreibung.md`. |

## Nichtfunktionale Anforderungen

| ID | Prio | Status | Code | Testfall | Anmerkung |
|---|---|---|---|---|---|
| NFR-SEC-01 | MUSS | nachgewiesen | `services/auth/src/password.ts` | `tests/auth-speicherung/kennwort-nur-salz-und-hash.test.ts` › „alle vier Kennwortwege: PBKDF2-SHA256“<br>`tests/auth-speicherung/kennwort-nur-salz-und-hash.test.ts` › „alle Kennwortwege samt Fehlversuch: kein Passwort im Log“ | — |
| NFR-SEC-02 | MUSS | Abnahme außerhalb Tests | `services/app/src/csrf.ts`<br>`services/app/src/security-headers.ts` | — | TLS ist Sache des Betriebs; Abnahme am ausgelieferten Deployment. Cookie-/CSRF-Strategie ist in `services/app/src/csrf.test.ts` getestet. |
| NFR-SEC-03 | MUSS | Abnahme außerhalb Tests | `services/app/src/http.ts` | — | Abnahmekriterium ist ein Pen-Test; unterstützend `tests/security/route-guard-audit.test.ts`. |
| NFR-SEC-04 | MUSS | Abnahme außerhalb Tests | `services/structure/src/sanitize.ts`<br>`services/app/src/csrf.ts` | `services/structure/src/sanitize.test.ts` › „NFR-SEC-04: data:image/svg+xml wird abgelehnt“ | Abnahmekriterium ist ein bestandenes Security-Review; die Tests stützen es, ersetzen es nicht. |
| NFR-SEC-05 | SOLL | Abnahme außerhalb Tests | — | — | Secrets-Management und Schlüsselrotation sind Betriebsnachweise. |
| NFR-PRV-01 | MUSS | Abnahme außerhalb Tests | — | — | Abnahme über Dokumentation und Verhalten je Deployment-Modell. |
| NFR-PRV-02 | MUSS | Abnahme außerhalb Tests | — | — | Abnahme über die Prüfung von Marketing- und Produkttexten. |
| NFR-PRV-03 | MUSS | Abnahme außerhalb Tests | — | — | Vertraglicher Nachweis (No-Training, EU-Residenz, Subauftragsverträge). |
| NFR-PRV-04 | MUSS | nicht zugeordnet | — | — | Auskunft, Löschung und Verarbeitungsverzeichnis sind im Abgleich keinem Code und keinem Testfall zugeordnet; Stand ungeklärt. |
| NFR-TAI-01 | MUSS | nachgewiesen | `services/audit/src/service.ts`<br>`services/ask/src/service.ts` | `tests/audit-gesamt/aktionsmatrix-12-3.test.ts` › „alle Aktionen belegt, Kette danach nachrechenbar“<br>`services/ask/src/service.test.ts` › „FR-ASK-01/02: begründete Antwort mit Quelle bei passender Frage“ | — |
| NFR-TAI-02 | MUSS | nachgewiesen | `services/conflicts/src/service.ts` | `services/conflicts/src/service.test.ts` › „FR-CON-02: nur Wahrheitskonflikte eskalieren“<br>`services/conflicts/src/service.test.ts` › „FR-CON-03: vollständiger Ablauf Eskalation“ | — |
| NFR-TAI-03 | SOLL | Abnahme außerhalb Tests | — | — | Abnahme über dokumentierte Prinzipien. |
| NFR-PERF-01 | SOLL | Abnahme außerhalb Tests | — | — | Abnahmekriterium ist ein Lasttest; `tests/wiki-grossbestand-nutzerweg/k1-k10-facetten-pg-browser.integration.test.ts` nennt NFR-PERF-01 als Teilmessung. |
| NFR-PERF-02 | SOLL | Abnahme außerhalb Tests | — | — | Abnahme über Messung am laufenden Modell. |
| NFR-PERF-03 | SOLL | Abnahme außerhalb Tests | — | — | Lasttest oder Architekturnachweis; `services/ask/src/retrieval-topk.test.ts` ist ausdrücklich kein 100k-Lasttest. |
| NFR-OPS-01 | SOLL | Abnahme außerhalb Tests | — | — | SLA-Nachweis aus dem Betrieb. |
| NFR-OPS-02 | MUSS | teilweise | `scripts/backup/backup.sh`<br>`scripts/backup/restore-drill.sh` | `tests/backup-drill/echter-wiederanlauf.integration.test.ts` › „dieselbe Datei, Byte für Byte“ | Ein Restore-Test liegt vor (PostgreSQL); festgelegte RPO/RTO-Werte sind keinem Beleg zugeordnet. |
| NFR-OPS-03 | SOLL | Abnahme außerhalb Tests | — | — | Abnahme über vorhandene Dashboards. |
| NFR-OPS-04 | SOLL | Abnahme außerhalb Tests | — | — | Abnahme über grüne Pipeline und Ein-Klick-Deploy. |
| NFR-UX-01 | MUSS | Abnahme außerhalb Tests | — | — | Abnahmekriterium ist ein Usability-Test mit Menschen. |
| NFR-UX-02 | SOLL | Abnahme außerhalb Tests | — | — | Abnahmekriterium ist ein Accessibility-Audit. |
| NFR-UX-03 | SOLL | Abnahme außerhalb Tests | — | — | Abnahmekriterium ist ein geräteübergreifender Test. |
| NFR-MNT-01 | MUSS | nachgewiesen | `services/reasoner/src/service.ts` | `services/reasoner/src/service.test.ts` › „FR-RSN-05: Status spiegelt verfügbares Modell“<br>`services/reasoner/src/service.test.ts` › „loadPersistedPolicy: ohne ENV“ | — |
| NFR-MNT-02 | SOLL | Abnahme außerhalb Tests | — | — | Abnahme über Coverage-Ziel und API-Doku; `tests/architektur-vertrag/http-api-referenz.test.ts` stützt die API-Doku. |
| NFR-MNT-03 | SOLL | nicht zugeordnet | — | — | Mandantenisolation ist im Abgleich keinem Code und keinem Testfall zugeordnet; das Mandantenmodell ist laut Pflichtenheft §7 offen. |
| NFR-DAT-01 | MUSS | nachgewiesen | `services/knowledge-object/src/service.ts` | `tests/datenhaltung-last/konsistenz-unter-last.integration.test.ts` › „zwei Instanzen, viele gleichzeitige Überarbeitungen: der Bestand bleibt widerspruchsfrei“ | — |
| NFR-DAT-02 | SOLL | nachgewiesen | `services/library-analytics/src/service.ts` | `services/library-analytics/src/service.test.ts` › „FR-LIB-02: Import ohne Duplikate“ | — |

## Quellenwidersprüche und fehlende Belege

1. **FR-CAP-06 gemeinsamer Pool.** Das Pflichtenheft verlangt, dass jeder Entwurf für alle Schreibberechtigten
   sichtbar ist. Die jüngeren Entscheidungen `debbb8e8` („Beides“) und `297afc57` machen Entwürfe standardmäßig
   privat; der Autor gibt einzelne bewusst in den Pool. `services/app/src/build-app.test.ts` hält fest: „Draft-Liste
   zeigt JEDEM nur die eigenen Entwuerfe“. Bewertet ist nach der jüngeren Entscheidung.
2. **FR-LIB-02 PDF-Export.** Das Pflichtenheft nennt PDF; `apps/web/src/lib/libraryExport.ts` sagt ausdrücklich
   „kein dedizierter PDF-Export“ (HTML als Druckansicht).
3. **FR-CAP-04 Kamera.** Das Pflichtenheft verlangt Kamera und Mediathek; `tests/app/upload-limits-visible.test.ts`
   hält fest, dass `/mobile` keine Datei- oder Kamera-Auswahl hat.
4. **FR-MOB-02 Interview mobil.** Das Pflichtenheft verlangt Notiz und Interview im Mobile; die Mobilfläche hat
   keinen Interview-Modus.
5. **„Jede Anforderung ist test-fähig“.** `specs/README.md` sagt das, aber 19 Abnahmekriterien sind Reviews,
   Audits, Lasttests, SLA-, Vertrags- oder Dokumentnachweise. Das ist die Abnahmeschuld, die R-1137 benennt.
6. **Altquelle R-1137.** Die Aufnahme führt den Eintrag als `IN_ARBEIT`, laut ihrer eigenen Notiz führte `extract_07`
   ihn als erledigt. Die damalige Datei und ihr Sichtungsbeleg fehlen (s. oben).

## Abgrenzung

- R-1280 (unabhängige Zweitprüfung gegen ein lebendes Anforderungsregister) ist historisch erledigt belegt. Auf dem
  heutigen Arbeitsweg leistet das die unabhängige Prüfung jeder Lieferung; diese Tabelle ist der feste Stand,
  an dem eine Lücke nur mit Code- und Testbeleg geschlossen wird. Gebaut wird dafür nichts Neues.
- Diese Tabelle schließt keine der Lücken. Fehlender Code (FR-CAP-04, FR-MOB-02), fehlende Testfälle („teilweise“)
  und die Abnahmen außerhalb von Tests bleiben eigene Aufgaben.
