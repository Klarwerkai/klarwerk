# Gemeinsamer Office-Kontext (KLARA-OFFICE-01)

*Auftrag `produkt:20261010:klara-office-gemeinsamer-kern`, Basis `3cb8a929` (`1.0.0-beta.1.875`).*

## Zuordnung (KO-01-01) — Stand 10.10.2026, frisch am Quelltext abgeglichen

### Bereits geliefert, wiederverwendet (nicht neu gebaut)

| Fähigkeit | Ort im Bestand | Herkunft |
| --- | --- | --- |
| Word-Aufgabenfenster, Manifest, Rückgabe ins Dokument | `apps/web/public/word-addin/taskpane.*`, `docs/word-addin/klara-manifest.xml` | `aufnahme:20260922:word-echter-arbeitsweg`, Bestand .874 |
| Klara-Sitzung: Konto, Add-in-Instanz, serverseitige Dokumentkennung, Ablauf, Rebind, Zustimmung | `services/app/src/services/klara-session-service.ts`, `routes/klara-ai-routes.ts` | W1 S4 |
| Frage, Quellenbelege, Referenzprüfung | `POST /api/ask`, `POST /api/check-text` | Bestand |
| Dokumenttext an KI nur über Sitzungstor + Riegel | `pruefeDokumenttextFreigabe` | F-0295 / R-0639 |
| Rechte | `ko.read` über `guards.requirePermission`, Konto frisch je Anfrage | Bestand |
| Persönlicher Name/Avatar (Leseeinstieg, noch ohne Kontoablage) | `apps/web/src/components/klara-vorschau/profil.ts` | `produkt:20261010:assistenz-name-avatar` (läuft separat) |

### Mit diesem Auftrag ergänzt (Delta)

| Teil | Datei |
| --- | --- |
| Vertrag Assistenzkern ↔ Hostadapter (`klarwerk.office-kontext/1`) | `services/app/src/office-kontext.ts` |
| Enger Kanal über die bestehende Anwendung | `services/app/src/routes/office-kontext-routes.ts`, verdrahtet in `build-app.ts` an derselben `klaraSessions`-Instanz |
| Erster Adapter: Word, für die Begleitapp | `apps/web/public/word-addin/office-host-word.js` (`taskpane.html` lädt ihn nicht); seit Nacharbeit 2 mit Kontextgeneration und eingefrorener Bindung |
| Gemeinsamer Einstieg der Begleitapp (Nacharbeit 2) | `apps/web/public/word-addin/begleitung.html` + `begleitung.js`, eigenes Manifest `docs/word-addin/klara-begleitung-manifest.xml`, CSP-Ausnahme in `services/app/src/security-headers.ts` |
| Nachweise | `tests/office-kontext/kern.test.ts`, `kanal-am-server.test.ts`, `word-adapter.test.ts`, `begleitung.test.ts`, `tests/app/word-addin-csp.test.ts` |

### Offen — sichtbar, nicht behauptet

- **Outlook, Excel, PowerPoint**: im Vertrag benannt, vom Kern abgelehnt (`adapter_nicht_geliefert`).
- **Native Mac-App** (freie Begleitfigur außerhalb von Word): nicht Teil dieser Lieferung; ihre Bereitstellung koordiniert die Führung.
- **Bereitstellung der Begleitseite**: Seite und Manifest liegen im Arbeitsbaum; ein kandidatgebundener Sideload in Word und eine reale Bedienung sind NICHT belegt.
- **Kontobezogenes Assistenzprofil**: der Kanal hat dafür einen Leseweg (`assistenzProfil`), der nicht verdrahtet ist; die Antwort sagt `auftritt.quelle: "nicht-geliefert"`. Gespeichert wird es von `produkt:20261010:assistenz-name-avatar`, Zustandsmotive von `produkt:20261010:assistenz-avatarzustaende`.
- **Reale Hostbedienung** (Word für Mac/Web, Sideload, echtes office.js): nicht gemessen. Gemessen ist der Adapter mit einer office.js-Attrappe und gegen den echten Server.
- **Auftrag 55**: bleibt ausgenommen; seine Fähigkeit fehlt.

### Bearbeiter

- Führung, Hostbereitstellung, lokale Bedienprüfung: `codex:01a11f14-b2c4-7743-9883-d4b181578549`.
- Produktbau dieses Laufs: der reguläre Produktionsdienst; das Modell dieses Laufs war Claude (`claude-opus-5-5`).
- Unabhängige Prüfung: Ben über den regulären Produktionsdienst; die Modellidentität wird nach dessen Start belegt.

## Der Vertrag

```
Adapter                                   Server (bestehende Anwendung)
-------                                   -----------------------------
Word.run → document.getSelection()        POST /api/klara/sessions/:id/office-kontext
  Länge + SHA-256 (nie Text)        ───▶    ko.read · Pflicht-Origin · Sitzungsbindung (x-klara-*)
  host {word, Plattform, Version}           Folge muss steigen · antwortet Bezug + Marke (2 min)
  sequenz n
DocumentSelectionChanged ⇒ Marke weg
vor dem Einfügen                          POST …/office-kontext/ziel
  SHA-256 der jetzigen Auswahl      ───▶    Marke gültig? Konto, Sitzung, Instanz, Dokument gleich?
                                            letzte Folge? Ziel gleich?  ⇒ zweiter Klick
Konto-/Dokumentwechsel                    DELETE …/office-kontext
```

- **Office-Bezug ≠ Wissensobjekt.** Kennung `office:word:<documentContextId>#<n>`, `pruefstand: "ungeprueft"`, nie `koId`.
- **Begrenzter Kontext.** Jedes Feld ausser den Vertragsfeldern wird abgelehnt (`felder_unzulaessig`), auch der Auswahltext.
- **Auswahl nur vom Host.** `auswahl.quelle` muss `host-api` sein; Seitenfenster und Tutorialanker sind keine Dokumentauswahl.
- **Wechsel.** `konto_gewechselt`, `sitzung_gewechselt`, `instanz_gewechselt`, `dokument_gewechselt`, `sitzung_nicht_aktiv` ⇒ `verwerfen`; `auswahl_veraltet`, `ziel_abweichend`, `marke_*` ⇒ `aktualisieren`.
- **Bestätigung.** Nur `einfuegen` verlangt den zweiten Klick und die Zielprüfung; Lesen, Fragen und Prüfen nicht. Externe KI bleibt an der Sitzungszustimmung.
- **Grenze.** Folgezähler und Markenschlüssel liegen im Prozess; ein Neustart macht Marken ungültig (Adapter meldet neu). Mehrere Prozesse teilen sie nicht.

### Nebenläufigkeit im Adapter (Nacharbeit 2, Befund Ben `office-host-word.js:118`)

- Jeder Vorgang (`melde`, `pruefeZiel`, `fuegeEin`) hält beim Start die **Kontextgeneration** und eine **eingefrorene Kopie der Bindung** fest; gesendet wird nur mit dieser Kopie.
- Nach dem Auswahllesen, nach dem Hashen, vor dem Senden, vor der Zustandsübernahme und vor der Zielbestätigung werden Generation, Bindung (und bei der Zielprüfung die Marke) erneut verglichen. Weicht etwas ab, ändert der Vorgang **keinen** Zustand; `pruefeZiel` antwortet `kontext_gewechselt`.
- Jede Auswahländerung, `kontextWechsel()`, `verwerfe()` und jede beobachtete Bindungsänderung (auch in-place, auch A→B→A, sobald B einmal gesehen wurde) erhöht die Generation — auch im Zustand „getrennt“ und während der ersten Meldung.
- Meldungen tragen eine Laufnummer: nur die jüngste darf übernehmen. Alte Erfolgs- **und** Fehlerantworten verändern keinen neueren Zustand.
- `fuegeEin` schreibt erst nach Serverzusage und vergleicht im selben `Word.run` die Auswahl noch einmal mit der gemeldeten Prüfsumme.

### Bindung in der Begleitseite (Nacharbeit 4, Befunde Ben `begleitung.js:93/233/309`)

- Zwei Generationen: `auswahlGen` steigt **sofort** bei jeder Auswahländerung, `bindungsGen` bei Konto-, Sitzungs- und Dokumentwechsel — vor dem asynchronen Rebind bzw. Sitzungsstart.
- Frage, Antwort und Einfügebestätigung tragen beide Generationen, Sitzung, Konto und die Office-Marke ihres Bezugs. Jeder Wechsel verwirft Antwort und offene Bestätigung sofort; vor Antwortübernahme und Einfügen wird erneut verglichen. Eine Antwort zu Auswahl A kann B nicht ersetzen, auch nicht nach A→B→A.
- Dokumentidentität: verglichen wird der **vollständige** Beschreiber (gespeichert-A → gespeichert-B ist ein Wechsel). Während des Rebinds gibt es keine nutzbare Sitzung; ein verspäteter Rebind oder Sitzungsstart einer älteren Bindungsgeneration ändert nichts, ein paralleler zweiter Start unterbleibt.
- Anzeige: Name des **gebundenen** Dokuments und dessen Stand (`properties.lastSaveTime`, WordApi 1.3), sonst ausdrücklich „von Word nicht gemeldet“ bzw. „noch nicht gespeichert“. Word-Version und Nummer der Kontextmeldung stehen getrennt und gelten nicht als Dokumentfassung.

### Senden und Ausfall (Nacharbeit 5, Befunde Ben `begleitung.js:305/442`)

- Vor jedem Senden an `…/execute` werden Konto, Sitzung, Bindungs- und Auswahlgeneration geprüft — auch ohne Office-Marke. Markierungstext geht nur mit gültigem Auswahlbezug (unveränderte Marke) hinaus; sonst unterbleibt der Aufruf. Kontextlose Fragen ohne `selection` bleiben möglich.
- Sitzungsstart und Umbinden tragen eine Vorgangsnummer. Scheitern sie (Absage oder Netzabbruch), löst nur der eigene, noch aktuelle Vorgang die Sperre, zeigt „Verbindung getrennt“ und lässt den nächsten Kontoabgleich neu aufbauen. Ein alter Fehler entsperrt oder überschreibt keinen neueren Vorgang.

### Verbindung zur nativen Begleitfigur (Nacharbeit 6, Befund Ben `begleitung.js:306`)

- Die native Figur (`produkt:20261010:klara-office-mac-maskottchen`, Kandidat `61748e3c`) liest ausschließlich den Begleiterkanal `/api/me/klara/begleiter/*`. Dessen Server (`services/app/src/klara-begleiter.ts`, `routes/klara-begleiter-routes.ts`) und seine Servertests (`tests/klara-office/begleiter-kanal-*.test.ts`) sind **bytegleich** aus jenem Kandidaten übernommen und an derselben Stelle in `build-app.ts` registriert; Inventareinträge wortgleich. Keine zweite Kanalfassung.
- Die Begleitseite meldet sich dort **nach ausdrücklichem Einschalten** („Mit Begleitfigur verbinden“) als weiteres Word-Fenster an — gespeist aus dem Office-Kern: gebundenes Dokument der Klara-Sitzung (Kennung als Prüfsumme, Dateiname), Markierung nur bei gültigem Bezug (sonst „keine Auswahl“), Auswahlstand steigt sofort bei jeder Änderung.
- Aktionen der Figur laufen über die Tore der Seite: „einfuegen“ nur für den gemeldeten Stand mit gültigem Bezug, über die Zielprüfung des Office-Kanals, hinter die Auswahl (Vertrag der Figur); „frage“ über Klaras Ausführungszugang mit Sitzungsbindung. Ergebnisse gehen an die Figur zurück.
- Konto-/Dokumentwechsel: altes Fenster abgemeldet (beim Kontowechsel mit dem neuen Konto nicht möglich — das alte Fenster erlischt beim alten Konto nach 12 s Inaktivität, nach 60 s ganz), neues angemeldet. Ausfall: „unterbrochen“, die nächste Meldung verbindet neu.
- Das alte Aufgabenfenster bleibt unverändert; sein eigener Adapter (`begleiter.js`) gehört zum nativen Auftrag und ist hier nicht enthalten.

## Integrationsblatt der gemeinsamen Fassung (AW01-K05)

**Stand:** Fassung im Arbeitsbaum dieses Auftrags nach Nacharbeit 2, aufsetzend auf Kandidat `506bbd05`. **Nicht bereitgestellt:** Es gibt keinen belegten Sideload dieser Fassung in Word und keine native Mac-App. Alles unten beschreibt den gebauten Datenweg, nicht eine abgenommene Hostbedienung.

| Punkt | Tatsächlicher Weg in dieser Fassung | Beleg |
| --- | --- | --- |
| Hosts / Versionen | Word mit WordApi 1.1 (Manifest `klara-begleitung-manifest.xml`, Version 1.0.0.0). Plattform und Word-Version liest der Adapter aus `Office.context.diagnostics` und meldet sie je Kontext mit. Outlook/Excel/PowerPoint: abgelehnt. Reale Plattform/Version einer Bereitstellung: **nicht belegt**. | `kern.test.ts`, `word-adapter.test.ts`, `begleitung.test.ts` |
| Einstieg | `https://<App-Domain>/word-addin/begleitung.html` als Aufgabenfenster; lädt `office.js` (Microsoft-CDN), `office-host-word.js`, `begleitung.js`. Ersatz-CSP wie das Taskpane. | `begleitung.test.ts`, `tests/app/word-addin-csp.test.ts` |
| Lesen | Word-Auswahl über `Word.run` → `document.getSelection()`; Auswahländerung über `DocumentSelectionChanged`; Dokumentidentität über `Office.context.document.url` (sonst Einmalwert für ungespeichert). | `word-adapter.test.ts` |
| Schreiben | Nur `Range.insertText(…, "Replace")` an der Markierung, nur nach zweitem Klick, Serverzusage (`…/office-kontext/ziel`) und erneutem Prüfsummenvergleich. Keine Speicherung in KLARWERK. | `word-adapter.test.ts`, `begleitung.test.ts` |
| Identität | Konto aus der bestehenden Anmeldung (`/api/auth/me`; in Word über `anmeldung.html` → einmaliger Übergabecode → `/api/auth/office-handover/redeem`, Schlüssel nur im Speicher der Seite). Dokument: serverseitig vergebene `documentContextId` der Klara-Sitzung. | `kanal-am-server.test.ts`, `begleitung.test.ts` |
| Quellstand | Antworten über Klaras Ausführungszugang `POST /api/klara/sessions/:id/execute` (nur validierte Quellen; Modell nur mit Sitzungszustimmung). Office-Inhalt ist `pruefstand: "ungeprueft"` und wird nie Wissensobjekt. | `kanal-am-server.test.ts` |
| Notwendige Kopien | Office-Kanal: nur Länge + SHA-256 der Auswahl, im Prozessspeicher (Folgezähler). Auswahltext verlässt Word nur, wenn der Mensch „Markierung mitsenden“ wählt — dann an `…/execute` mit Einstufung (ohne Wahl „vertraulich“), dort gilt der Dokumenttext-Riegel. Antworttext liegt nur im Speicher der Seite. | `begleitung.test.ts`, `kern.test.ts` |
| Empfänger | Ausschließlich die eigene KLARWERK-Anwendung (gleiche Herkunft, Pflicht-`Origin` am Office-Kanal). Externe KI nur über das bestehende Sitzungstor mit Zustimmung. Kein Loopback, kein Broadcast. | `kanal-am-server.test.ts` |
| Ausfallverhalten | Server/Netz weg ⇒ „Keine aktive Verbindung“, Marke verworfen, kein Einfügen. Neustart ⇒ alte Marken ungültig, neu melden. Konto-/Dokumentwechsel ⇒ Bezug und Antwort verworfen, neue Sitzung bzw. Rebind. KI aus ⇒ Ausführungszugang antwortet nur aus geprüftem Bestand oder sagt, dass es keine belegte Antwort gibt. | `word-adapter.test.ts`, `begleitung.test.ts`, `kanal-am-server.test.ts` |
| Native Figur | Übergabe an eine native Mac-Figur: **nicht gebaut**. | — |
