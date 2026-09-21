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

Der Bestand von `i18n.ts` wurde **nicht** umgezogen. Dort stehen weiterhin rund 4.400 Schlüssel,
und das ist in Ordnung: ein Massenumzug wäre ein Risiko ohne Nutzen. Umgezogen wurde genau das,
woran als Nächstes gearbeitet wird. Wer einen Bereich anfasst, nimmt seine Texte bei der
Gelegenheit mit — ein Schlüssel nach dem anderen, jeder mit unverändertem Wert.
