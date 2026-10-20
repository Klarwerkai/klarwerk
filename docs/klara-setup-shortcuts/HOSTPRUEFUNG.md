# Klara im Setup · AA-05 Nutzerwege, Hostprüfung und Lieferstand

Auftrag `produkt:20261012:klara-setup-shortcuts-hostpruefung` (Revision 2). Diese Datei nennt, was die
Lieferung AA-02 bis AA-04 ist, welche Nutzerwege womit belegt werden und welche Hostfälle **offen**
sind. Sie ist kein Prüfbericht: Ergebnisse stehen ausschliesslich in den nativen Berichten des
regulären Prüflaufs. `tests/klara-setup-shortcuts/hostpruefung-doku.test.ts` hält diese Datei mit den
genannten Testdateien zusammen.

## 1. Produktquelle

- `PO-KLARA-SETUP-SHORTCUTS-20261012/ARBEITSAUFTRAEGE.txt`, Abschnitt AA-05, in der Quellfassung
  `9391bc8dbe77eba3fc8adb7abd6a7c03776fdf7eb1b3c5fab56680a32742666f`
  (`gespraech/produktquellen/klara-setup-shortcuts-peter-antwort-20261012.txt`).
- Peters Antwort vom 12.10.2026 („es soll auch andere funktionen unterstuetzen, wie diktat, record
  usw. erstma 1“): Option 1 — Kürzel innerhalb des aktiven Klarwerk-Fensters, systemweit vorgemerkt.
- Grundlage: [`BESTAND.md`](./BESTAND.md), [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md) (AA-01),
  [`UMSETZUNG.md`](./UMSETZUNG.md) (AA-02 bis AA-04),
  [`ENTSCHEIDUNG-SYSTEMWEIT.md`](./ENTSCHEIDUNG-SYSTEMWEIT.md).

## 2. Geänderte Komponenten

**Lieferung AA-02 bis AA-04** (Auftrag `produkt:20261012:klara-setup-shortcuts-umsetzung`, in der Basis
dieses Auftrags enthalten, Commit `78eb5667943414ccd57a5acf6233928d93469e9c`):

| Komponente | Datei |
| --- | --- |
| Bereich „Klara“ in Persönliche Einstellungen | `apps/web/src/pages/Profile.tsx` |
| Gruppen, Unterbereich Tastenkürzel | `apps/web/src/components/klara-setup/KlaraSetup.tsx` |
| Ein Ausführungsweg der Kürzel | `apps/web/src/components/klara-setup/KlaraKuerzelAusfuehrung.tsx`, `apps/web/src/shell/AppShell.tsx` |
| Regeln, Anzeige, Speicher im Browser | `apps/web/src/lib/klaraTastenkuerzel.ts` |
| Drahtvertrag | `apps/web/src/api/assistenzTastenkuerzel.ts` |
| Ausführung im Gespräch und in der Seitenhilfe | `apps/web/src/components/klara-vorschau/KlaraVorschau.tsx`, `apps/web/src/components/KlaraAssistant.tsx` |
| Texte und Nutzerhilfe (de, en, nl) | `apps/web/src/texte/klarasetup.ts` |
| Server: Ablage, Prüfung, Route | `services/app/src/assistenz-tastenkuerzel.ts`, `services/app/src/routes/assistenz-profil-routes.ts` |

**Dieser Auftrag (AA-05)** ändert am Produkt nichts. Neu sind:

- `tests-smoke/klara-tastenkuerzel-browser.spec.ts` — die Nutzerwege im echten Browser (Abschnitt 3).
- diese Datei und `tests/klara-setup-shortcuts/hostpruefung-doku.test.ts`.

**Nutzerhilfe im Bereich Tastenkürzel:** das „?“ der Karte Klara (`klarasetup.hilfe.titel`,
`klarasetup.hilfe.text`) erklärt Festlegen, Escape, Entfernen, Standard, „ab Werk unbelegt“ und das
Verhalten in Aufnahme, Dialogen und Textfeldern; im Bereich selbst stehen Geltungsbereich und die
Grenze der Konflikterkennung.

## 3. Nutzerwege und ihre automatisierten Belege

Abkürzungen: **M** = `tests/klara-setup-shortcuts/setup-klara-mounted.test.tsx` (jsdom am echten
Server), **S** = `tests/klara-setup-shortcuts/tastenkuerzel-am-server.test.ts`, **R** =
`tests/klara-setup-shortcuts/kuerzel-regeln.test.ts`, **V** =
`tests/klara-setup-shortcuts/kuerzel-speicher.test.ts`, **PG** =
`tests/klara-setup-shortcuts/tastenkuerzel-pg.integration.test.ts`, **B** =
`tests-smoke/klara-tastenkuerzel-browser.spec.ts` (Chromium und WebKit über Playwright).

| Nutzerweg | Belege |
| --- | --- |
| Setup › Klara über Zahnrad › Persönliche Einstellungen | M (B1), B (Test 1) |
| Shortcut festlegen, speichern, Klara auslösen (genau einmal, Fokus im Gespräch) | M (B2), B (Test 1) |
| Ändern: neue Belegung wirkt sofort, alte nicht mehr | M (B2), R (R2), B (Test 1, Test 2) |
| Entfernen: bleibt entfernt, auch nach Neuladen | M (B2, B3), S (S2), PG, B (Test 1, Test 2) |
| Zurücksetzen: eine Aktion und alle | M (B3), S (S1), PG, B (Test 1) |
| Aufnahme-Abbruch mit Escape | M (B2), B (Test 1); Abbruch über Tab oder Klick daneben nur Quelleninspektion (`onBlur` in `KlaraSetup.tsx`) |
| Konflikte: Doppelbelegung, Control+Command+K, VoiceOver-Taste, Browser/macOS | R (R3), S (S3), M (B2), B (Test 1) |
| Texteingabe und Bearbeitungskürzel | M (B2), B (Test 1, Test 2) |
| Wiederholung (gedrückt gehalten), offene Dialoge | M (B2), B (Test 1, Test 2) |
| Neuladen | M (B3), B (Test 1) |
| Neue Sitzung | S (S2), B (Test 1, neuer Browserkontext) |
| Neustart des Servers | PG |
| Speicherfehler, unklarer Ausgang | M (B2, B5), V, B (Test 1, Fehler 500) |
| Rollen und Konten | S (S4), M (B4), B (Test 4, Leserolle) |
| Diktat, Aufnahme/„Auftrag sprechen“, Aufnahme stoppen | M (B3), B (Test 2) |
| Seitenhilfe öffnen | M (B3), B (Test 2) |
| Vorlesen stoppen | B (Test 2) |
| Voraussetzungen: ohne Spracherkennung, Mikrofon abgelehnt | M (B3, abgelehnt), B (Test 3) |
| Mac-Symbole, deutsches/englisches Layout (Erkennung über `KeyboardEvent.code`) | R (R1, R3, R4) |
| Tastaturbedienung, Rollen und Namen im Zugänglichkeitsbaum | M (B1, B2), B (Test 1) |

## 4. Hostmatrix

| Host | Stand |
| --- | --- |
| Web-App in Chromium, Prüfrechner (Playwright) | automatisiert, Smoke B |
| Web-App in WebKit, Prüfrechner (Playwright) | automatisiert, Smoke B; WebKit ist die Engine von Safari, nicht Safari auf macOS |
| Safari oder Chrome auf einem echten Mac | **nicht geprüft** — siehe Abschnitt 5 |
| VoiceOver auf dem Mac | **nicht geprüft**; automatisiert sind nur Rollen und Namen im Zugänglichkeitsbaum des Browsers |
| Physische deutsche und englische Mac-Tastatur | **nicht geprüft**; Playwright drückt mit US-Belegung, die Layout-Regeln belegt nur R |
| Echtes Mikrofon und Freigabedialog des Browsers | **nicht geprüft**; Smoke und M ersetzen die Spracherkennung durch eine Attrappe |
| Firefox | nicht im Prüfplan dieses Auftrags |
| Browser-Erweiterung, Word-Add-in | keine Klara-Kürzel in Klarwerk (UMSETZUNG Abschnitt 3); Chrome verwaltet das Kürzel der Erweiterung |
| Systemweiter Aufruf (Word, Mail, Finder) | **offen** — vorgemerkt (Option 1), nicht entschieden, nicht implementiert, nicht nachgewiesen |

Ein grüner Lauf auf dem Prüfrechner ist keine Abnahme sämtlicher Hosts.

## 5. Mac-Hostprotokoll (nicht durchgeführt)

Für eine Person am unterstützten Mac (aktuelles macOS, Safari und Chrome, eigenes Testkonto). Bis
jemand den Weg dort tatsächlich bedient und das Ergebnis mit Datum, Gerät, Browser und Layout
einträgt, gilt jede Zeile als **offen**. Ein automatischer Lauf füllt diese Tabelle nicht.

| Nr. | Schritt am Mac | Ergebnis |
| --- | --- | --- |
| P1 | Zahnrad › Persönliche Einstellungen › Klara › Tastenkürzel; „?“ zeigt die Nutzerhilfe | offen |
| P2 | „Klara öffnen“ festlegen (z. B. ⌃⇧E), speichern, im Fenster auslösen: Gespräch öffnet einmal | offen |
| P3 | Ändern auf eine zweite Kombination; die alte wirkt nicht mehr | offen |
| P4 | Escape während der Aufnahme: bisherige Belegung bleibt | offen |
| P5 | Control+Command+K und Control+Option+Taste werden mit Grund abgelehnt | offen |
| P6 | In einem Textfeld schreiben, ⌘A, ⌘C, ⌘V, ⌘Z: unverändert, nichts ausgelöst | offen |
| P7 | Fenster neu laden und Browser neu starten: Belegung steht da und wirkt | offen |
| P8 | Entfernen, dann Standard wiederherstellen, dann alle zurücksetzen | offen |
| P9 | Diktieren und „Auftrag sprechen“ über ihre Kürzel mit echtem Mikrofon; Freigabe erteilen und ablehnen; „Aufnahme stoppen“ | offen |
| P10 | „Vorlesen stoppen“ und „Seitenhilfe öffnen“ über ihre Kürzel | offen |
| P11 | Deutsches Layout (Y/Z getauscht) und englisches (US/UK) Layout: Anzeige und Auslösung | offen |
| P12 | VoiceOver an: Bereich, Liste, Knöpfe, Aufnahmehinweis und Meldungen werden verständlich angesagt; VO-Tasten bleiben frei | offen |
| P13 | Leserolle: eigener Bereich, eigene Belegung, keine Verwaltungsverknüpfung | offen |
| P14 | Speicherfehler (z. B. Netz trennen beim Speichern): sichtbarer Fehler, bisherige Belegung wirkt | offen |
| P15 | Ein Klarwerk-Kürzel in Word, Mail oder Finder wirkt **nicht** (Geltungsbereich wie angezeigt) | offen |

## 6. Integrationsstand

- Zweig `codex/auftrag-1a0822cb7276dc2a836f`, Basis `78eb5667943414ccd57a5acf6233928d93469e9c` (laut
  Auftragsunterlagen); die Lieferung AA-02 bis AA-04 ist in dieser Basis enthalten.
- Die Änderungen dieses Auftrags (Smoke, Doku, Doku-Test) laufen über den regulären Weg: Kandidat,
  Prüflauf nach `CLAUDE/PRUEFPLAN.json`, unabhängige Prüfung, Auslieferung. Bis dahin sind sie nicht
  integriert; Commit und Veröffentlichung übernimmt dieser Weg.

## 7. Verbleibende Einschränkungen

- Der echte Mac-Hostnachweis (Abschnitt 5), VoiceOver, physische Layouts und das echte Mikrofon
  fehlen; die Abnahme „durch einen echten Hostnachweis belegt“ ist damit **nicht erfüllt**.
- Der Smoke drückt Tasten über Playwright; Browser- oder Systemkürzel, die vor der Seite greifen,
  kann er nicht zeigen. Die Konfliktliste bleibt eine Auswahl bekannter Kombinationen, keine Garantie.
- Control+Command+K bleibt ein ungeprüfter Kandidat; in der Web-App ist er wegen der Befehlspalette
  abgelehnt. Ab Werk ist keine Aktion belegt.
- Die Aufnahme mit Server-Verschriftlichung im Fragefeld (R-0104) ist keine Klara-Aktion und hat kein
  Kürzel (UMSETZUNG Abschnitt 3).
- Systemweiter Aufruf bleibt offen (Abschnitt 4).
