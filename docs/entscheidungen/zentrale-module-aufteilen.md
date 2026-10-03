# Häufig gemeinsam geänderte Sammeldateien fachlich aufteilen — Lieferstand

*Aufnahme 20260922 · gesamt-zentrale-module-aufteilen (Aufgabenrevision 2). Basis `3b79c5d1`,
Programmversion `1.0.0-beta.1.657`. Lieferung dieses Laufs: der echte Drei-Datei-Schnitt des
Word-Aufgabenfensters (R-1611, P11). Alles andere ist hier mit seinem heutigen Stand und Beleg
festgehalten, nicht neu gebaut.*

**Prüfstatus dieses Dokuments:** In dieser Lieferung wurde kein Test, kein Build und kein Dienst
gestartet. Jeder Beleg unten ist entweder eine **Quelleninspektion** (Datei und Stelle genannt) oder
ein **Prüfstand, den der Cloud-Lauf ausführt** (Testdatei genannt). Eine Prüfung gilt erst mit dem
Ergebnis dieses Laufs als bestanden.

## Was geliefert ist

`apps/web/public/word-addin/taskpane.html` ist in drei Dateien geschnitten — `taskpane.html`
(Markup, 497 Zeilen), `taskpane.css` (733), `taskpane.js` (12.497). Bytebilanz:
37.414 + 44.584 + 721.743 = 803.741 = 803.665 (vorher) − 38 (vier Tags) + 114 (zwei Verweise).
Beschreibung, Testhilfe und Grenzen: [`docs/word-addin/aufgabenfenster-dateien.md`](../word-addin/aufgabenfenster-dateien.md).

Geänderte Produktdateien: die drei Fensterdateien, `apps/web/src/lib/klaraStand.ts` (stempelt jetzt
auch `taskpane.js`), `biome.json` (zwei `files.ignore`-Einträge wie für `rueckweg.js`).
Neu: `tests/support/panelquelle.ts`, `tests/klara-zerlegung/schnitt-echt.test.ts`.
Umgestellt: alle Prüfstände, die Skript- oder Stilinhalte aus `taskpane.html` lasen
(Mitfahrerverzeichnis `tests/klara-zerlegung/schnitt-pins.test.ts`, Griff `panelquelle`).

## Kriterien

| # | Kriterium | Stand | Beleg |
| --- | --- | --- | --- |
| K1 | R-1141 Zusammenschaltung als lesbarer Vertrag | **offen, nicht in dieser Lieferung** | Quelleninspektion: die Dienste werden an EINER Stelle verdrahtet (`services/app/src/build-app.ts`: `assembleServices`, `buildServices`, `buildPgServices`, `buildApp`; 3.226 Zeilen). Ein lesbarer Vertrag neben dem Code existiert nicht. |
| K2 | R-1148 ein Auslieferungsstück, getrennte Module, gemeinsame DB-Klammern, Infrastruktur über Adapter | **im Bestand weitgehend vorhanden, nicht neu belegt** | Quelleninspektion: Module unter `services/<modul>/` mit öffentlicher `index.ts`; je Modul InMemory- und Pg-Ablage hinter einer Schnittstelle (Importe in `build-app.ts`); gemeinsame Klammer `withPgTx`/Rücknahme-Klammer (`docs/entscheidungen/dubletten-rueckzug.md`). Ob JEDE Infrastruktur über Adapter läuft, ist nicht geprüft. |
| K3 | R-1304 Architekturdrift und Modulgrenzen messen | **im Bestand vorhanden** | Quelleninspektion: `.dependency-cruiser.cjs` (`no-circular`, `module-boundaries` = nur über `index.ts`, `no-orphans` als Warnung), gefahren in `tools/check` (Zeile „architecture") und `npm run arch`. Grenze: misst nur `services/`, nicht `apps/web` und nicht `tests/`. Eine eigene Architekturentscheidung als Dokument fehlt; die Regel steht im Kopf der Konfiguration. |
| K4 | R-1337 ein Typname, zwei Definitionen | **ungeklärt** | Die Quelle nennt weder Typ noch Fundstelle und spricht in der Vergangenheit („war … mussten abgeglichen werden"). Eine Erhebung doppelter Typnamen wurde in dieser Lieferung nicht ausgeführt. |
| K5 | R-1499 Sammeldateien, die fast jeder Auftrag anfasst | **für das Aufgabenfenster geliefert; Rest offen** | Geliefert: Markup, Stil und Skript des Fensters sind getrennte Dateien. Offen und gemessen: `apps/web/src/i18n.ts` 18.928 Zeilen, `services/app/src/build-app.ts` 3.226 Zeilen, `taskpane.js` 12.497 Zeilen. |
| K6 | R-1514 Rest aus JOB 3014 | **teilweise; der Rest bleibt NICHT GEPRÜFT** | Der Hinweis „nach dem echten Schnitt trägt nur HTML den Fassungskopf" ist jetzt gemessen statt vermutet: `tests/klara-zerlegung/probeschnitt.test.ts` B4 (Kopf nur an HTML, Cachekennung `?v=<Fassung>` an beiden Verweisen, Server liefert unter jeder Kennung die aktuelle Datei). NICHT GEPRÜFT, und ohne Mensch mit Word nicht prüfbar: echtes Word-WebView, Sideload, echtes Office-CDN, visuelles Layout, UI-Smoke. Ein voller `tools/check`-Lauf wurde nicht gestartet. |
| K7 | R-1611 Markup/Stil/Skript trennen, Funktion vorher und nachher belegen | **geliefert** | `tests/klara-zerlegung/schnitt-echt.test.ts` (E2: Git-Blob `95226f65…` des Basisstands; E3/E4 Gegenproben); `probeschnitt.test.ts` A1 (Schnitt = Textoperation), D2/D7 (vorher/nachher gleich, Word- und Nicht-Word-Zustand), D3–D6 (Gegenproben); `tests/app/mega69-klara-waechter.test.ts` (Inhalts-Pin unverändert). |
| K8 | R-2076 modularer, getesteter Code; Coverage-Ziel + API-Doku | **teilweise im Bestand; API-Doku offen** | Quelleninspektion: Coverage-Ziel steht in `vitest.config.ts` (`thresholds: { lines: 80, functions: 80 }`); ob ein Tor es durchsetzt, ist nicht belegt. Eine API-Dokumentation der HTTP-Schnittstelle (z. B. OpenAPI) gibt es nicht; `Frontend-API-Abgleich.md` (Stand 24.06.2026) ist ein Abgleich, keine Referenz. Diese Lieferung dokumentiert nur die Testschnittstelle des Fensters (`aufgabenfenster-dateien.md`). |
| K9 | P-I18N-TEXTMODULE Textmodule je Funktion | **früher geliefert (JOB 4367), nicht wiederholt** | `docs/i18n-textmodule.md`; `apps/web/src/texte/` (11 Module + `intern/`); `tests/i18n-textmodule/`; Plugin `textmodul-vertrag` in `apps/web/vite.config.ts`. |
| K10 | I18N-AUFTEILUNG Wörterbuch nach Sprache/Bereich aufteilen, Wächter gegen Doppelschlüssel | **kurzfristig anders gelöst; dauerhaft offen** | Quelleninspektion: `biome.json` `files.maxSize` = 2 MiB global (JOB 3364), festgehalten in `tests/lesevariante/i18n-groessendeckel.test.ts`; Doppelschlüssel-Wächter über die Textmodule (JOB 4367). Die Aufteilung von `i18n.ts` selbst ist nicht gemacht. |
| K11 | P11 `taskpane.html` in lesbare Teile zerlegen, ohne Verhalten zu ändern | **Schritt 1 geliefert; weitere Teile offen** | wie K7. `taskpane.js` ist noch ein Block; der Schnittplan (`schnittflaechen.test.ts` C1) nennt die nächsten Stücke; B3 bewacht die Größe (Schranke 12.500 Zeilen, von der Inline-Grenze übernommen). |
| K12 | NFR-MNT-02 (Wortlaut wie R-2076) | wie K8 | wie K8 |
| K13 | Lieferstand, Abgrenzung, Widersprüche, fehlende Belege | dieses Dokument | — |

## Abgrenzung

- **JOB 3014** (Probeschnitt, Messgeräte, Mitfahrerverzeichnis) und **JOB 3667** (`rueckweg.js`)
  sind vorhandene Teilumfänge; ihre Messgeräte sind weiterverwendet und auf den echten Schnitt
  umgestellt, nicht neu gebaut.
- **JOB 4367** (Textmodule) ist abgeschlossen und hier nur als Stand genannt.
- **`services/app/addin-static/`** (das ältere, gebaute Add-in unter `/addin/`) ist eine andere
  Auslieferung und von diesem Schnitt nicht berührt.
- Die CSP ist absichtlich unverändert. Seit dem Schnitt trägt `taskpane.html` kein Inline-Skript mehr
  (gemessen in `tests/app/word-addin-csp.test.ts`); `'unsafe-inline'` in `script-src` bleibt stehen,
  weil dieselbe CSP auch für `anmeldung.html` gilt und eine CSP-Änderung kein Teil eines
  verhaltensgleichen Schnitts ist.

## Widersprüche in den Quellen

1. **Zeilenzahl der Sprachdatei.** R-1499 nennt „über 13.000 Zeilen", P-I18N-TEXTMODULE „18.706
   Zeilen"; heute sind es 18.928. Die Quellen sind zu verschiedenen Zeitpunkten erhoben.
2. **Größe des Aufgabenfensters.** P11 nennt 375 KB; vor dem Schnitt waren es 803.665 Bytes. Die
   Datei ist seit der Erhebung gewachsen.
3. **Deckel für `i18n.ts`.** I18N-AUFTEILUNG verlangt kurzfristig einen Override **nur** für
   `i18n.ts`; umgesetzt ist (JOB 3364) eine globale Anhebung von `files.maxSize` auf 2 MiB, und der
   Wächter verbietet ausdrücklich eine Ausnahme für `i18n.ts`. Dauerhaft verlangt die Quelle eine
   Aufteilung nach Sprache oder Bereich; `docs/i18n-textmodule.md` hält dagegen fest, dass der
   Bestand bewusst NICHT umgezogen wird („ein Massenumzug wäre ein Risiko ohne Nutzen"). Diese
   Entscheidung ist jünger als die Quelle; eine Nutzerentscheidung dazu liegt nicht vor.
4. **R-2076 und NFR-MNT-02** tragen denselben Wortlaut; sie sind ein Anliegen.

## Fehlende Belege

- Kein Lauf im echten Word (Mac/Windows/Web), kein Sideload, kein echtes Office-CDN, kein visuelles
  Urteil über das Fenster nach dem Schnitt. Das braucht einen Menschen mit Word und ist nicht ersetzt.
- Kein in dieser Lieferung gestarteter Test- oder Buildlauf; die Belege oben gelten mit dem
  Cloud-Lauf.
- K2, K3, K8: Quelleninspektion, kein Lauf.
- K4: keine Erhebung.
