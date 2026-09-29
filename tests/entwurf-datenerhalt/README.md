# Entwürfe ohne Datenverlust speichern und ändern — Bestandsabgleich

Auftrag `aufnahme:20260922:gesamt-entwurf-datenerhalt` (Revision 2, Lauf 1), Basis `c04ec239`
(1.0.0-beta.1.612). Die Auftragsquelle mit den Originalwortlauten der Nummern R-/N-/P-/K-
lag diesem Lauf nicht vor; abgeglichen wurde gegen die Kriterien im Auftrag und gegen Code, Tests
und Commit-Verlauf dieses Repositories. „Beleg“ nennt die Testdatei, die das Verhalten heute
pinnt, und den Commit (mit Fassung, wo es einen Ship-Commit gibt), mit dem es geliefert wurde.

**Runde 2 — Korrektur zu Runde 1:** Die in Runde 1 hier beschriebene Produktänderung (N-0062,
N-0064) fehlte im festgehaltenen Commit `6c1bdc0d`: Eine Gegenprobe gegen den Basisstand hatte
`Blatt.tsx` und `captureFrontDoor.ts` vorübergehend zurückgesetzt, und die Sitzung endete, bevor sie
wieder eingespielt waren. Ben hat das zu Recht gemessen (T1/T1b/T3–T5 rot, lokal und am Server).
Diese Fehlschläge sind zugleich der Rot-Beleg der Tests am Basisstand. Seit Runde 2 ist die
Änderung wieder im Stand; die Tabelle unten beschreibt diesen Stand.

**Lauf `2-v9` (Aufgabenrevision 11), Basis `1530dfeb` (1.0.0-beta.1.628):** Der Kandidat des ersten
Laufs (`863024b8`, 1.0.0-beta.1.616) war nie in `main` gelangt. Seine drei Commits sind hier
unverändert übernommen; einziger Konflikt war das Smoke-Sollmanifest, das neu erhoben ist
(chromium-zustand 9→16, gesamt 185→192). Neu in diesem Lauf sind nur Bens zwei offene Befunde zu
CAP-P1: der native Fall mit TATSÄCHLICH verwaister Beschreibung (Fall 12) und die Begrenzung der
Aussagen unten auf den belegten Umfang.

## Neu in diesem Lauf

| Kriterium | Befund am Basisstand | Änderung | Beleg |
|---|---|---|---|
| N-0062 Titel vollständig gespeichert | `deriveFrontDoorTitle` kürzte auch den GETIPPTEN Titel still auf 90 Zeichen (`apps/web/src/lib/captureFrontDoor.ts`, `compactTitle`). Entwurfsdienst und Wissensobjekt kennen keine Titelgrenze. | Getippter Titel wird ungekürzt gespeichert (nur Leerraum verdichtet). Die 90er-Grenze gilt weiter für den aus dem Text **abgeleiteten** Titel und die beiden KI-Wege. | `blatt-titel-und-ladefenster.test.tsx` T1, T1b (am Basisstand rot), Gegenfall T2 |
| N-0064 Titel direkt am Feld vollständig | Einzeiliges `<input>`, langer Titel lief aus dem Blick. | Gewählt: „vollständige Titelanzeige direkt am Feld“ (zweite Option des Kriteriums). Läuft der Titel im Feld wirklich über (`scrollWidth > clientWidth`), steht er darunter vollständig und umbrochen (`blatt-titel-voll`, `aria-hidden`, das Feld selbst trägt den Wert für Hilfstechnik). | T3, T5; Gegenfall T4 |
| R-1541 frühe **und** geladene Gegenfälle DE/EN | Gemountet nur Deutsch belegt (`tests/cap-p1-fruehe-eingabe`, F1–F5); Englisch nur als Textschlüssel (F6). | Keine Produktänderung; englische Gegenfälle ergänzt. | E1 (Ladefenster EN), E2 (geladen EN, Sichern in denselben Entwurf) |
| FR-STR-05 Vorschau/Bearbeiten ohne Verlust inkl. Bilder | Kein eigener Test; der Moduswechsel kam nur als Nebenweg in `tests/editor-fremdfassung` F4 vor. | Keine Produktänderung; Abnahmetest ergänzt. | `vorschau-bearbeiten-ohne-verlust.test.tsx` V1, V2 |
| CAP-P1 nativer Rundlauf DE/EN mit Sichern und Wiederöffnen (Runde 2) | Fälle 6/7 enden vor dem Sichern; EN nur gemountet (jsdom). | Keine Produktänderung; Smoke-Fall 9 (de) und 9 (en): natives Tastatur-Einfügen in Titel und Rumpf → „Entwurf sichern“/„Save draft“ → `GET /api/drafts/:id` → Wiederöffnen über die Adresse. Sollmanifest `tests/smoke/smoke-mengen-manifest.json` nachgeführt (Stand dieses Laufs siehe oben). | `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts` Fall 9 |
| P-KI-UEBERNAHME-SPEICHERN Server-/Persistenzbeleg (Runde 2) | Der Test von JOB 3408 lief gegen eine eigene Map-Attrappe. | Keine Produktänderung; Beleg gegen die echte Fastify-App (Anmeldung, Entwurfsrouten, `CaptureService`), nur das Sprachmodell ist an der Brücke ersetzt. Gegenprobe: ohne die Zeile `saveRequestedRef.current = false` in `save.onSuccess` werden S1–S3 rot, G1 bleibt grün. | `tests/ki-uebernahme-speichern/adopt-then-save-echter-dienst.test.tsx` S1 (DE), S2 (EN), S3 (Struktur/Titel), G1 (Doppelklick) |

Warum nicht das mehrzeilige Titelfeld (erste Option von N-0064): Ein `<textarea>` ändert den
Elementtyp von `blatt-titel`; mindestens neun bestehende Testdateien setzen den Titel über
`HTMLInputElement.prototype.value` und würden ohne fachlichen Grund rot. Das Kriterium lässt die
Anzeige am Feld ausdrücklich zu.

## Bereits geliefert — nicht neu gebaut

| Kriterium | Geliefert mit | Beleg (Test) |
|---|---|---|
| R-0018 Studio-Maßnahmen gehen beim Speichern in der Vordertür nicht verloren | JOB 2695 D5 `0fc486c6` (Speichern), JOB 2966 D1 `da97a2f2` (Einreichen) | `tests/capture/f0018-vordertuer-behaelt-felder.test.ts` |
| R-0040 kein fremder Entwurf beim Öffnen | JOB 2974 D3 `fdec0c2c` (Rücksprung), JOB 3782 D2 `a2f70e78` · 1.0.0-beta.1.368; Rechte: JOB 2531 | `tests/entwurf-laden-zeitgrenze/entwurf-laden-zeitgrenze.test.tsx` T6, `tests/capture/frontdoor-draft-deeplink-mounted.test.tsx`, `tests/security/job2531-fremder-entwurf-in-eigener-liste.test.ts` |
| R-0044 Text während des Speicherns | JOB 2705 D1 `4946e301` | `tests/capture/job2705-drei-wege-textverlust.test.tsx` C1 |
| R-0074 überholter Entwurf als eigener Fehlerfall | JOB 2684 D9 `c393f26d` (`DRAFT_STALE`); Mobil/Desktop JOB 4193 D6 `e12d1849` · 1.0.0-beta.1.539 | `tests/capture/job2684-*.test.ts(x)`, `tests/app/job2684-draft-stale-route.test.ts`, `tests/entwurf-mobil-desktop/kein-ungeschuetztes-ueberschreiben-mounted.test.tsx` |
| R-0097 geleerter Fließtext nicht ohne Warnung | mega7 Block A (Löschmarker), mega9 Block B / mega11 (ehrliches Dirty-Prädikat, Wächter) `d3fe69da` | `tests/capture/frontdoor-navguard-exits-mounted.test.tsx` („der ausdrücklich GELEERTE Body ist dirty …“), `tests/capture/draft-body-empty-semantics.test.ts` |
| N-0079 beide Bearbeitungsansichten zeigen denselben Text | JOB 3377 D3 `b6177ca1` · 1.0.0-beta.1.232, JOB 4193 · 1.0.0-beta.1.539 | `tests/entwurf-mobil-desktop/ein-text-zwei-flaechen-nach-dem-konflikt.test.ts`, `entwurfsformular-traegt-den-body.test.ts` |
| N-0081 Warnung nur bei echter Abweichung | mega9 Block B (Dirty-Prädikat), JOB 3256 N3 | `frontdoor-navguard-exits-mounted.test.tsx` („ohne Änderung wechselt sofort“), `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx` F5, N3 |
| P-KI-UEBERNAHME-SPEICHERN | JOB 3408 D1 `ae8d4a17` · 1.0.0-beta.1.234 (`save.onSuccess` löst `saveRequestedRef`) | `tests/ki-uebernahme-speichern/adopt-then-save.test.tsx` R1–R3, G1–G3 |
| P-CAP-P1-R (a) Öffnen fragt nach, (b) Verwerfen trennt Diktat, Kette Sperre→Ladefehler | JOB 3256 D1 `c157a4a1` · 1.0.0-beta.1.179 | `blatt-fruehe-eingabe.test.tsx` N1–N8 |
| CAP-P1 frühe Eingaben im Ladefenster | JOB 3141 D2 `cd608fc8` · 1.0.0-beta.1.174 (Weg B: Bedienung bis Bereitschaft verhindern) | `blatt-fruehe-eingabe.test.tsx` F1–F7d |
| CAP-P1-R2 native Zwischenablage im Browser | JOB 3257 D2 `97288302` · 1.0.0-beta.1.209 | `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts` Fälle 6–8 |

## Offen, widersprüchlich oder nicht belegt

- **R-1541 / CAP-P1 — akustische Screenreader-Ausgabe:** weiterhin offen (so auch im Kriterium).
  Belegt ist nur die DOM-Seite (`aria-describedby` auf den Ladehinweis, F1/E1).
- **CAP-P1 / CAP-P1-R2 — Abnahme „echter Clipboardweg DE/EN, Maus/Tastatur, positive Paarung und
  verwaiste Caption“:** nativ in Chromium als Smoke-Fälle geschrieben
  (`tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts`), jeweils nur Tastatur-Einfügen von Klartext:
  - Fall 9 (de/en): Einfügen in Titel und Rumpf bis Sichern, Serverstand und Wiederöffnen.
  - Fall 8 (de), Fall 10 (en): Einfügen im Ladefenster kommt nicht an.
  - Fall 11 (de/en): **nur positive Paarung** — ein Bild mit seiner Beschreibung bleibt über
    Einfügen, Sichern und Wiederöffnen gepaart, und es ENTSTEHT keine Beschreibung ohne Bild. Eine
    tatsächlich verwaiste Beschreibung kommt in Fall 11 nicht vor; das war Bens Befund.
  - Fall 12 (de/en, neu in Lauf `2-v9`): der Entwurf trägt neben der Paarung eine TATSÄCHLICH
    verwaiste `figcaption` (Kennung ohne Bild, außerhalb jeder figure). Geprüft wird am Editor
    (bleibt sichtbar, trägt `data-kw-nicht-zugeordnet`, hängt nicht am vorhandenen Bild), am Server
    (`GET /api/drafts/:id`: beide Beschreibungen, die verwaiste außerhalb der Bild-figure, ein Bild)
    und nach dem Wiederöffnen (unverändert). Das Soll-Verhalten ist das bestehende aus
    `editorFigures.ts` (`enhanceFiguresForEditing`/`imageForCaption`); vorab gegen die Funktion
    selbst (jsdom) und gegen `sanitizeHtml` des Entwurfsdienstes nachgeprüft, beide lassen die
    Waise stehen. **Fall 12 ist in diesem Lauf nicht im Browser ausgeführt worden** (keine
    Browserläufe auf dem Produktions-Mac); sein Ergebnis liefert erst der Smoke-Lauf am festen Commit.
  **Nicht belegt:** Einfügen über das Kontextmenü (Maus) — nicht maschinell bedienbar, als Grenze
  benannt, nicht nachgestellt; Einfügen eines BILDES aus der Zwischenablage (Bilder stammen in
  Fall 11/12 aus dem geladenen Entwurf); HTML-Zwischenablage im nativen Weg (nur Klartext). Alle
  Smoke-Fälle laufen gegen den In-Memory-Smoke-Server, nicht gegen PostgreSQL.
- **K13 — echter Browser→Persistenz→Wiederöffnen-Weg am Blatt:** seit Runde 3 als EIN durchgehender
  Fall ergänzt: `tests/entwurf-datenerhalt/blatt-rundlauf-pg-im-browser.integration.test.ts`
  (K1 de, K2 en) — Chromium tippt Titel und Rumpf, drückt „Entwurf sichern“/„Save draft“, echter
  Socket → Fastify → `PgDraftRepo`, unabhängige SQL-Probe der `drafts`-Zeile, zweites Sichern
  aktualisiert dieselbe Zeile, frische Seite über `?draft=<id>` und Neuladen zeigen Titel und Rumpf.
  Nicht mit T009 kombiniert, nicht aus Teilbelegen zusammengesetzt. Er läuft nur mit gesicherter
  `KLARWERK_PG_TEST_URL` (Testserver, `--gezielt`); ohne sie meldet er den Überspringen-Grund laut.
  Ausführung: laut Betriebshinweis der Führung vom 27.09.2026 am Kandidaten `863024b8` mit bereit
  gestellter PG16-URL 2 Fälle ausgeführt, 0 übersprungen (Beleg der Steuerung
  `PG-DIREKTREPARATUR-20260927/PRUEFBERICHT.json`, nicht in diesem Repository). Die Testdatei ist in
  Lauf `2-v9` unverändert übernommen; ein eigener Lauf am neuen Commit steht aus (Serverprüfung).
- **P-KI-UEBERNAHME-SPEICHERN — „jeder abgewiesene Speicherversuch muss sichtbar sein“:** bei
  `!canSave` ist „Entwurf sichern“ sichtbar gesperrt (`disabled`); die Gründe (`fd.unsavable.*`)
  nennt der Weggeh-Dialog, nicht der Knopf. Ein zweiter Klick während desselben laufenden Vorgangs
  wird bewusst verschluckt (Doppelklickschutz, G1) — der Knopf trägt dann `busy`. Ein eigener Test,
  der für jeden Sperrgrund die Sichtbarkeit am Knopf misst, wurde in diesem Lauf nicht ergänzt.
- **Quellenwiderspruch Nummern:** Im Code heißen die Befunde zu R-0018/R-0040/R-0044 `F-0018`,
  `F-0040`, `F-0044` bzw. `R2-19`/`R2-23`; dieselbe Nummer kann in den Quellen unterschiedlich
  präfixiert sein. Die Zuordnung oben folgt dem Wortlaut, nicht der Nummer.
