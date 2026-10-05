# FE-002 · Diagnose des roten Capture-Falls 12 (en) im Volllauf (Lauf 5, Runde 2)

**Status: Ursache aus den vorhandenen Belegen nicht bestimmbar. Kein FE-002-Produktfehler belegt,
aber auch nicht ausgeschlossen. Keine Produkt- oder Teständerung. FE-002 noch nicht menschlich
abgenommen.**

Gebunden an: Ben-Beleg `beleg:0379556e-f12f-479b-85d7-303e99127c9a`, Kandidat
`98ee0c059c646a0f6438ad102bd8dbca2dceb864` (= `d0e2bb4f` + Versionsschritt .632), Prüfauftrag
`pa-1790870498-2c0f9fbb` (`./tools/check`, exit 1).

## 1. Was rot war

| Zeile im Beleg | Bewertung |
|---|---|
| `FAIL abbau-0.test.ts`, `FAIL abbau-1.test.ts`, `✖ Browserdeckel Zeitgrenze …`, `überlappende Haltezeiträume` | **Kein Fehlfall.** Das ist die Ausgabe der Vorrichtungstests `tests/tor-bereitschaft/t1b-hooks.test.ts` (legt bewusst Wegwerfdateien `abbau-${i}.test.ts` an) und der Browserdeckel-Tests. Dieselben Zeilen stehen im **bestandenen** Volllauf `pa-1790873435-29f514c0` (Commit `8ad4a268`, exit 0). Die Vitest-Summen sind vollständig grün: 2104/2104 und 123/123 Dateien. |
| `[chromium-zustand] tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts:821` · Fall 12 (en) | **Einziger echter Fehlfall.** Zeile 837: `locator('[contenteditable="true"]').first()` wurde in 15 s nicht gefunden (`element(s) not found`). Vorher erfolgreich: Anmeldung (`ensureLoggedIn` wartet auf `kopfband`) und `POST /api/drafts` (201, sonst wäre der Fall früher rot). |

Zuvor sind im selben Lauf auf derselben Seite und am selben Server grün: Fall 9 (en), Fall 10 (en),
Fall 11 (en) (gleicher Weg ohne verwaiste Beschreibung) und Fall 12 (de). Ein deterministischer
Fehler des Kopfbands auf `/capture/frontdoor?lang=en` wird durch denselben Lauf deshalb
**widerlegt**. Offen bleibt ein zeit- oder zustandsabhängiger Fehler.

**Häufigkeit** (alle `ergebnis.json` unter `waechter/belege/testserver`, die den Fall enthalten):
24 Läufe. Davon sind 23 grün, unter anderem der Hauptstand `cd54531f` (3×) und 20 andere
Kandidaten. **Rot ist nur dieser Lauf.** Er ist zugleich der **erste** Volllauf mit FE-002, der
diesen Fall enthält: Fall 12 kam erst mit `cd54531f` (.631) in den Hauptstand. Ein Fall in einem Lauf
reicht nicht aus, um zwischen „seltener Wackler“ und „FE-002 erhöht die Fehlerrate“ zu unterscheiden.

**Was fehlt:** Playwright hat Screenshot, `error-context.md` und `trace.zip` erzeugt
(`playwright.smoke.config.ts`: `screenshot: "only-on-failure"`, `trace: "retain-on-failure"`).
Der Beleg enthält aber nur `ausgabe.txt`, `ergebnis.json`, `MANIFEST.json` und
`pruefwerkzeug-diff.txt`; `test-results/` wurde nicht zurückgegeben. Deshalb ist nicht feststellbar,
was die Seite in diesen 15 s zeigte. Die Webserver-Ausgabe hat zwischen Fall 12 (de) und dem Fehler
keine Zeile.

## 2. Was der Code an dieser Stelle sagt

- `apps/web/src/components/erfassen/Blatt.tsx:1353, 2853-2873`: Der Editor wird nur montiert,
  wenn `blattNimmtAn = !loadingDraft`. Sonst steht `blatt-nicht-bereit` da.
- `Blatt.tsx:906-1027`: `loadingDraft` wird beim Laden über `?draft=` gesetzt und im `.finally` von
  `endpoints.drafts.get` zurückgenommen. Das gilt auch bei einem Ladefehler: Dann wird der Editor
  mit Fehlermeldung montiert. Ausnahme: Ein vorher abgebrochener Lauf (`cancelled`) gibt die Sperre
  nicht frei.
- Daraus folgen für „kein `contenteditable` über 15 s“ genau drei Möglichkeiten:
  **(a)** Die Antwort auf `GET /api/drafts/:id` kam in 15 s nicht an.
  **(b)** Der Ladeeffekt wurde abgeräumt, ohne dass ein neuer Lauf die Sperre übernahm.
  **(c)** Das Blatt war gar nicht montiert, etwa wegen einer anderen Seite, einer weißen Seite oder
  einer Fehlergrenze.
- **FE-002-Bezug geprüft** (`git diff cd54531f d0e2bb4f -- apps/web/src`): Geändert sind nur
  `shell/*`, `index.css`, `styles/modern.css`, `texte/fe002.ts`, `app/navigationGliederung.ts` und
  `tutorial/TutorialRahmen.tsx`. Weder `Blatt.tsx` noch `RichTextEditor`, die Entwurfs-API oder der
  Server wurden geändert.
  - Der Meldungsabruf ist derselbe wie vorher (`useMeldungenZustand`, jetzt einmal in
    `MeldungenUndKonto` statt in `KontoMenue`). Es gibt **keine zusätzliche Anfrage** pro Seite.
  - Neue Effekte schließen nur Menüs bei einem Pfadwechsel (`ArbeitsbereicheMenue`,
    `MeldungenMenue`) und lösen die vorgemerkte Palettenöffnung ein (`CommandPalette`). Keiner
    navigiert, ändert Suchparameter oder Sprache.
  - `shell/kopfbandStufe.ts` misst in `useLayoutEffect`, `ResizeObserver` und `requestAnimationFrame`
    und schreibt nur `data-stufe`/`min-width` an die Gruppe. Das kostet Hauptthread-Zeit, kann
    (a) oder (b) aber nicht auslösen. Zu (c) wäre nur ein Wurf im Layout-Effekt denkbar. Dafür findet
    sich im Code kein Anlass; `Math.max` über eine leere Liste ist durch die Längenprüfung
    geschützt.
  - **Ergebnis:** Kein belegter Weg, über den FE-002 das Laden des Entwurfs oder das Montieren des
    Blatts verhindert. Ausgeschlossen ist ein Einfluss über die Zeitabfolge damit nicht.

## 3. Entscheidung dieser Runde

Für eine Produkt- oder Testkorrektur gibt es **keine belegte Ursache**. Nach Auftrag wird deshalb
nichts auf Verdacht geändert. Diese Runde liefert nur diesen Bericht. Produktcode, Tests,
Prüfwerkzeug und Konfiguration bleiben unverändert.

## 4. Minimaler Diagnoseplan für den Prüfserver (von Ben zu binden)

Alle Schritte laufen auf dem Prüfserver und nicht auf dem Produktions-Mac. Entscheidend ist in jedem
Schritt, dass **`test-results/`** (Screenshot, `error-context.md`, `trace.zip`) in die Belegablage
zurückkommt.

```
# D1 · Kandidat (98ee0c05 oder der unveränderte Nachfolger mit diesem Bericht)
./tools/build
npm run smoke:ui:gate -- tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts --repeat-each=15
#   → test-results/ zurückgeben. Die Wiederholung erhöht auch den gemeinsamen Bestand des
#     chromium-zustand-Servers (Fall 12 lief im roten Lauf als letzter Fall dieses Servers).

# D2 · derselbe Befehl am Hauptstand cd54531f (Basis ohne FE-002), gleiche Maschine/Last

# D3 · falls D1 und D2 grün sind: einmal die vollständige UI-Smoke-Folge wie im Volllauf
npm run smoke:ui:gate          # test-results/ zurückgeben
```

**Lesart:**
- `error-context.md`/Screenshot zeigt `blatt-nicht-bereit` und im Trace die offene Anfrage
  `GET /api/drafts/:id` → (a) oder (b). Das liegt im Lade-/Serverweg und nicht bei FE-002. Die
  Zuständigkeit liegt beim Entwurfsweg (`gesamt-entwurf-datenerhalt`).
- Der Trace zeigt einen `pageerror` aus `shell/*` oder eine weiße Seite → (c) mit FE-002-Ursache.
  Das ist dann ein FE-002-Befund und wird an genau dieser Stelle korrigiert.
- D1 rot und D2 bei gleicher Wiederholung grün → FE-002 verändert die Fehlerrate. Ursache weiter
  über den Trace eingrenzen.
- D1, D2 und D3 grün → kein reproduzierbarer Befund. Der rote Volllauf bleibt als Tatsachenbeleg
  stehen. Für E8 ist dann ein neuer vollständiger `./tools/check` am Kandidaten nötig. Grün ist erst
  dieser Lauf; die Diagnose ersetzt ihn nicht.

**Fehlendes Prüfmittel:** Die Belegablage des Volllaufs gibt `test-results/` nicht zurück. Ohne diese
Rückgabe ist auch ein erneuter roter Lauf nicht diagnostizierbar.

## 5. Offen

- E8: Der vollständige `./tools/check` am Kandidaten ist nicht grün. Ben-Endabnahme ist offen.
- E7: Die menschliche Verständlichkeitsprobe ist offen. **FE-002 noch nicht menschlich abgenommen.**
