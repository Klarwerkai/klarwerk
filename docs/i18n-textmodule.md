# Textmodule — wo neue Texte hinkommen

*JOB 4367. Gilt für die Web-App (`apps/web`). Klara (Word-Add-in) ist hier nicht gemeint.*

## Die kurze Fassung

Neue Texte kommen **nicht** in `apps/web/src/i18n.ts`, sondern in eine eigene Datei
`apps/web/src/texte/<nutzerweg>.ts`. Sie wird automatisch eingesammelt — niemand muss `i18n.ts`
dafür anfassen.

```ts
// apps/web/src/texte/ux31.ts
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ux31.",
  legacySchluessel: [],
  de: { "ux31.titel": "Ablage prüfen" },
  en: { "ux31.titel": "Check the filing" },
  nl: { "ux31.titel": "Opslag controleren" },
} satisfies Textmodul;
```

Fertig. `useTranslation()` kennt `ux31.titel` ab dem nächsten Lauf.

## Warum überhaupt

`apps/web/src/i18n.ts` war eine Datei mit über 18.000 Zeilen, in die **jeder** Nutzerweg seine
Texte schrieb. Zwei Bahnen, die gleichzeitig an zwei verschiedenen Funktionen bauten, änderten
damit dieselbe Datei und sperrten sich gegenseitig. Seit JOB 4367 wohnen Texte bei ihrer Funktion.
Das Muster stammt aus `apps/web/src/lib/lesevariante.ts` (JOB 3326) und ist hier nur
verallgemeinert.

Für Anwender ändert das **nichts**: Beim Umbau wurde kein einziger Text geändert. Dass das stimmt,
misst `tests/i18n-textmodule/bestand-unveraendert.test.ts` gegen einen Schnappschuss, der vor dem
Umbau erzeugt wurde.

## Die zwei Regeln

**1. Präfix.** Das `praefix` eines Moduls ist sein Dateiname plus Punkt: `ux31.ts` → `"ux31."`.
Jeder **neue** Schlüssel des Moduls beginnt damit. So kann kein zweites Modul denselben Namen
erfinden, und man sieht jedem Schlüssel an, wo er wohnt.

**2. Altnamen stehen in `legacySchluessel`.** Ein Schlüssel, den es schon vor dem Umzug gab, darf
seinen alten Namen behalten — sein Name steht ja in Tests, in `services/` und in Playwright-Spuren.
Dann muss er aber ausdrücklich in `legacySchluessel` eingetragen sein, und er muss in `i18n.ts`
**entfernt** worden sein. Zwei Fundstellen für denselben Schlüssel gibt es nicht; wenn etwas
ersetzt wird, wird der alte Weg entfernt, nicht daneben belassen.

Beispiel: `apps/web/src/texte/ux08.ts` trägt `capture.sourceMissingNext`, `ext.attachBlocked` und
`ext.gate.how` — alles Altnamen, alle in `legacySchluessel`, alle aus `i18n.ts` gelöscht.

## DE, EN und NL sind Pflicht

Jeder Schlüssel liegt in **allen drei** Sprachen vor. Fehlt eine, ist das ein Fehler und kein
stiller Rückfall auf Deutsch: i18next würde sonst wegen `fallbackLng: "de"` einen deutschen Satz in
eine niederländische Oberfläche setzen, und niemand merkt es.

Wer eine Übersetzung nicht kennt, hat eine Wissenslücke und keine Ausrede — nachfragen, nicht
erfinden. Ein Platzhaltertext wäre eine Behauptung über einen Text, den es nicht gibt.

## Eine weitere Sprache ergänzen — nur über Ressourcen (R-0997, FR-I18N-02)

DE, EN und NL sind die Untergrenze, nicht die Obergrenze. Eine weitere Sprache (Beispiel `fr`)
kommt ohne Programmänderung dazu:

1. `apps/web/src/woerterbuch/fr.ts` anlegen wie `en.ts`: `const fr: typeof de = {` … `};` und
   `export { fr };`. Die Bindung `typeof de` lässt den Typcheck jede fehlende Zeile melden; eine
   Datei ohne diese Bindung meldet keine Sprache an und hält den Bau als „unbekannte Sprache" an.
2. Jedem Textmodul unter `texte/` seinen `fr`-Block geben. Der Bau hält an, solange einer fehlt.
3. Den Sprachnamen `lib.facet.lang.fr` in jedes Wörterbuch eintragen (Beschriftung im Schalter).

Daraus leiten sich ab, ohne dass jemand eine Liste anfasst: der Sprachschalter, `/profil`, die
Anmeldung, die gespeicherte Wahl, der Textmodulvertrag und das Nachladen (`lib/sprachregister.ts`,
`sprachenAusRessourcen`; im Bau `registrierteSprachen` in `texte/intern/sprachwaechter.ts`).

Was dabei bewusst NICHT mitwächst: `<html lang>` bleibt nach der Ownerentscheidung JOB 536 auf
genau `de|en|nl` (`ERLAUBTE_SPRACHEN` in `lib/htmlLang.ts`), der Linkvertrag `?lang=` auf `de|en`,
und das Word-Seitenfenster führt eigene Wörterbücher. Diese Grenzen zu verschieben ist je eine
eigene Entscheidung.

## Was ein Textmodul nicht darf

* **Nichts importieren** ausser Typen (`import type`). Textmodule sind reine Datenmodule; sie
  werden vom Build-Plugin ausgeführt, und ein Wertimport bricht dort mit einer klaren Meldung ab.
* **Keine Unterordner.** Eingesammelt werden nur direkte Kinder von `texte/`.
  `texte/intern/` trägt die Werkzeuge und ist bewusst aussen vor.
* **Keinen Schlüssel doppelt** — weder gegen ein anderes Modul noch gegen `i18n.ts` samt der
  Blöcke, die dort hineingespreadet werden (heute `lib/lesevariante.ts`).

## Wo das geprüft wird

Dreimal, mit derselben Funktion (`apps/web/src/texte/intern/pruefung.ts`):

| Wo | Wann | Womit |
| --- | --- | --- |
| Tor | `./tools/check` | `tests/i18n-textmodule/` |
| Produktbuild | `vite build`, auch im Docker-Bau | Plugin `textmodul-vertrag` in `apps/web/vite.config.ts` |
| Browser | beim Start der App | `apps/web/src/i18n.ts` |

Die dritte Stelle ist die schwächste — sie meldet erst nach dem Ausliefern. Sie steht trotzdem da,
weil ein lauter Abbruch besser ist als ein still überschriebener Text.

## Testbefehl

```
KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --pool=forks --poolOptions.forks.maxForks=4 \
  --poolOptions.forks.minForks=1 tests/i18n-textmodule
```

Jede Fehlermeldung nennt Modul **und** Schlüssel — es muss niemand suchen.

## Was dieser Umbau ausdrücklich nicht getan hat

Der Bestand von `i18n.ts` wurde in JOB 4367 **nicht** in Textmodule umgezogen. Umgezogen wurde
genau das, woran als Nächstes gearbeitet wurde. Wer einen Bereich anfasst, nimmt seine Texte bei der
Gelegenheit mit — ein Schlüssel nach dem anderen, jeder mit unverändertem Wert.

## Die Grundwörterbücher je Sprache (I18N-AUFTEILUNG, Aufnahme 20260922)

Der übrige Bestand (rund 4.400 Schlüssel je Sprache) stand bis dahin als drei große Blöcke in
`apps/web/src/i18n.ts` (18.928 Zeilen). Er ist jetzt **nach Sprache** aufgeteilt:

| Datei | Inhalt |
| --- | --- |
| `apps/web/src/woerterbuch/de.ts` | `const de = { … }` — der deutsche Grundbestand |
| `apps/web/src/woerterbuch/en.ts` | `const en: typeof de = { … }` |
| `apps/web/src/woerterbuch/nl.ts` | `const nl: typeof de = { … }` |
| `apps/web/src/i18n.ts` | nur noch Importe, Textmodul-Sammler, R-0801-Nachladen und i18next-Start (120 Zeilen) |

Jeder Block ist **Zeile für Zeile verschoben**, kein Schlüssel und kein Wert ist geändert; die
Lesevariante spreadet jede Sprachdatei selbst hinein. `typeof de` bindet `en` und `nl` weiter an
die deutsche Schlüsselmenge.

**Wo neue Texte hinkommen, ändert sich nicht:** in ein Textmodul unter `texte/`. Die
Grundwörterbücher sind kein Ablageort für neue Texte; wer einen bestehenden Text ändert, ändert ihn
dort, wo er steht.

**Nachladen von en und nl (R-0801) bleibt.** Im Produktionsbau nimmt das Plugin
`sprachpaketeNachladen` (`texte/intern/sprachpakete.ts`) die Importe von `woerterbuch/en.ts` und
`woerterbuch/nl.ts` aus `i18n.ts` heraus und liefert beide Blöcke als eigene, nachgeladene Stücke;
Deutsch bleibt im Eintritt. Gegenprobe: `tests/erstladezeit/sprachpakete-nachladen.test.ts`, am
gebauten Bündel der Block DECKEL in `tests/erstladezeit/eintritt-ohne-seiten.test.ts`.

**Der Duplikatwächter bleibt derselbe.** `basisQuellen` (`texte/intern/sammeln.ts`) folgt von
`i18n.ts` aus den Importen nach `woerterbuch/` und von dort den Spreads (Lesevariante); Build-Plugin,
Tor und Browser prüfen also weiter gegen den VOLLEN Grundbestand.

**Belege:**

| Aussage | Prüfstand |
| --- | --- |
| Die vier Dateien ergeben Byte für Byte die frühere `i18n.ts` | `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` W1 gegen `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt` (unveränderte Kopie der ungeteilten Datei von `main` 1147c026, nachprüfbar mit `git hash-object` gegen `git rev-parse 1147c026:apps/web/src/i18n.ts`); Gegenproben W2 |
| i18next trägt jeden Schlüssel der drei Dateien mit genau ihrem Wert | dieselbe Datei, W3; dazu unverändert `tests/i18n-textmodule/bestand-unveraendert.test.ts` K1.1 |
| Der Duplikatwächter sieht die drei Dateien samt Lesevariante | W4; `tests/i18n-textmodule/grundbestand.test.ts` |

**Für Prüfstände, die das Wörterbuch als Text lesen:** `tests/support/woerterbuchquelle.ts`,
`woerterbuchQuelle()` bzw. `woerterbuchQuelleAus(pfad)` — liefert genau den früheren Text von
`i18n.ts`. Neue Prüfstände sollten Werte lieber über `tests/support/i18nBestand.ts` (das laufende
i18next) lesen.
