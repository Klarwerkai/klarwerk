# Aufnahme 20260922 · Gesamt-Aufgabenansicht — Zuordnung geliefert / abgelöst / offen

Stand: Lauf `lauf:b3:aufnahme:20260922:gesamt-aufgabenansicht:2`, Runde 2, 27.09.2026, auf Basis
`1.0.0-beta.1.622`. „Ship-Fassung“ = erster `ship:`-Commit, dessen Vorfahr der Liefercommit ist.

## Lauf 3 (29.09.2026): Übernahme ohne Neubau

Die Lieferung aus Lauf 2 (`6c0ed6dc` R1, `a5767d8a` R2; Ship-Fassungen `1.0.0-beta.1.622`
`de8e8a7b` und `1.0.0-beta.1.623` `431fe018`) war nicht in `main`. Lauf 3 übernimmt beide
Commits unverändert auf `1.0.0-beta.1.628` (`1530dfeb`). Beim Übernehmen gab es keinen Konflikt, und
`main` hat seit der Basis von Lauf 2 (`a7d699eb`) keine der berührten Dateien geändert. Neu gebaut
wurde nichts. Die Tabelle unten gilt deshalb unverändert. Die Fassungsangaben „dieser Lauf“ meinen
den Code aus Lauf 2, der jetzt in der Fassung von Lauf 3 steht.

Vorhandene Serverbelege aus Lauf 2 (Linux, `waechter/zustand/pruefauftraege/…_2/`):

| Prüfauftrag | Commit | Umfang | Ausgang |
|---|---|---|---|
| `pa-1790500582-c41b96cd` | `de8e8a7b` (R1) | `tools/check` | bestanden, exit 0 |
| `pa-1790500612-95287120` | `de8e8a7b` (R1) | 21 gezielte Dateien | bestanden, 215/215 |
| `pa-1790509669-4615d89f` | `a2cfef46` (R1, zweiter Ship-Commit „1.623“) | 21 gezielte Dateien | bestanden, 215/215 |
| `pa-1790512722-1c59fd95` | `431fe018` (R2) | 19 gezielte Dateien, darunter beide Chromium-Abnahmen | bestanden, 394/394 |

Für die R2-Fassung gibt es keinen Vollcheck. Für die Fassung von Lauf 3 gibt es noch keinen
Serverbeleg. Die Admin-Freigabe `f1eedb99` nennt die Prüfvoraussetzungen nur im Text, das
strukturierte Feld `answer.pruefvoraussetzungen` fehlt. Das ist ein Formmangel der Freigabe und
nicht Gegenstand des Codes.
Quelle der Anliegen: Funktionsregister (`register.json`, Einträge R-0905, R-0961, R-0962; Herkunft
`FUNKTIONSREGISTER.json:21028/22351/22373`).

## Übersicht

| Anliegen | Stand | Fassung | Beleg |
|---|---|---|---|
| R-0962 Menüname/Leitsatz | **geliefert** (dieser Lauf) | R1 + R2 dieses Laufs | `tests/aufgaben-ansicht/gegenstand-statt-besitzer.test.tsx` |
| R-0961 Absprung zum Objekt | **geliefert** (dieser Lauf, R2) | R2 dieses Laufs | `tests/aufgaben-ansicht/direkter-absprung-zum-fall.test.tsx` |
| R-0961 Bündelung/Sortierung/Filter (5 Arten) | geliefert (vorher) | SCRUM-247/-158/-260, JOB 690 | `tests/aufgaben-ansicht/*`, `tests/app/work-center.test.ts` |
| R-0961 Entwurf fortsetzen, einreichen | **abgelöst** | R-0962 (13.08.), JOB 3503 (Pedi, 10.09., ab 1.270) | siehe „Quellenwidersprüche“ |
| R-0961 Autorenübergabe | **abgelöst, Bestätigung durch Pedi offen** | R-0962 (13.08.) | siehe „Quellenwidersprüche“ |
| N-0015 / P-UX-04 | geliefert (vorher) | JOB 3101, `6564c732`, ab 1.115 | `tests/aufgaben-ansicht/aufgabenart-in-der-adresse.test.tsx`, `rueckkehr-aus-der-aufgabe.test.tsx` |
| P-H1b (Frist 30 s) | geliefert (vorher), Abnahme am Bündel **dieser Lauf** | JOB 3113, `539299c7`, ab 1.133 | `tests/kopfzaehler-frische/frische-im-echten-browser-chromium.test.ts` (neu), `kopfzaehler-frische-mounted.test.tsx` |
| P-H1c (Löschweg) | geliefert (vorher) | JOB 3125, `b5fa6fbb`, ab 1.138 | `tests/kopfzaehler-frische/loeschen-kopfzaehler-mounted.test.tsx` |
| P-H1d (laufender Folgeabruf) | geliefert (vorher, mit H1c) | JOB 3125, `b5fa6fbb`, ab 1.138 | ebd., Fälle „frischem Board-Stand“ (1 s) mit hängendem Abruf, Erfolg/404/Fehler |
| P-H1e (Wächter, Kommentar) | geliefert (vorher) | JOB 3136, `703bc25c`, ab 1.156 | `tests/kopfzaehler-frische/kein-frischer-cache-eingriff.test.ts` |
| R-1558 (H1b-Rest) | **geliefert bis auf Livebetrieb** (dieser Lauf, R2) | R2 dieses Laufs | Chromium-Test oben; offen: Messung am öffentlichen Betrieb |
| R-1576 (H1-Gesamtinventar) | **geliefert für die Hülle** (dieser Lauf, R2) | R2 dieses Laufs | `tests/h1-gesamtinventar/rollen-sprachen-zustaende.test.tsx` |
| R-0905 (Sammelauftrag) | Sammelposten | — | erfüllt im Umfang der Zeilen oben; Rest unter „Offen“ |

## Was dieser Lauf gebaut hat

- **R-0962:** Menüpunkt, Hilfekapitel und Seitenhilfe heißen „Offene Aufgaben“ / „Open tasks“ /
  „Open taken“ (der Name der Quelle, D-003). Der Satz unter der Überschrift nennt die fünf Arten
  (`apps/web/src/texte/aufgaben.ts`, `PageHeader lead`). Die Hilfetexte sprechen von „der offenen
  Arbeit“ statt von „deiner Arbeit“.
- **R-0961, Absprung:** Konflikt-, Re-Validierungs- und Lückenzeilen führen auf
  `/konflikte?fall=<id>`, `/lebenszyklus?fall=<id>` und `/risiko?fall=<id>`
  (`apps/web/src/lib/fallAbsprung.ts`). Die Zielflächen wählen genau diesen Fall vor, und die
  Risikoseite markiert die Lücke (`aria-current`) und holt sie in Sicht. Kennen die Flächen den Fall
  nicht (mehr), verhalten sie sich wie bisher. Rückgaben (`reworkHref`) und Validierungen
  (`/wissen/:id`) waren schon objektbezogen.
- **R-1558 / P-H1b, Abnahme am gebauten Bündel:** Chromium mit `apps/web/dist` gegen die echte
  Fastify-App, je Sprache (DE, EN) eine frische, leere Instanz, Seitenuhr über `page.clock`:
  - N — ungefilterter Nullbestand: alle fünf Zählquellen antworten, das Board ist leer, es steht
    keine Zahl, und der Punkt steht.
  - A — Zahl 2 im Kopfband und in „Weitere Bereiche“ (per Tastatur geöffnet). Nach 35 s ohne
    einen einzigen Abruf einer Zählquelle ist sie an beiden Orten weg, ohne Ersatzzeichen. Der
    Tastaturweg auf „Prüfen“ holt neu, und die richtige neue Zahl 3 steht da; der Tastaturweg auf
    „Start“ bringt die Zahl 3 auch nach „Weitere Bereiche“ zurück.
  - B — dasselbe im Drawer bei 390 px.
  - Die Herkunftszeiten je Zählquelle (Anzahl der Abrufe, Seitenzeit des letzten Abrufs) werden
    je Phase einzeln ausgegeben.
- **R-1576, H1-Gesamtinventar:** 4 Rollen × Stufe 2 aus/an × DE/EN/NL × 7 Zählerzustände = 168
  gemountete Fälle. Die Zustände sind: lädt, geladen, echte 0, Fehler, gestörte Auffrischung,
  abgelaufen, offline. Je Fall werden die drei Orte der Hülle gemessen:
  - Das Punkte-Inventar ist je Rolle ausgeschrieben.
  - Kein angebotener Weg endet am Rollentor.
  - Jede Beschriftung steht in der Sprache des Falls.
  - Eine Zahl steht nur im Zustand „geladen“, dann mit dem Wert ihrer Quelle.

  Gemessen: Stufe 2 wirkt nur beim Admin.

## Quellenwidersprüche

1. **R-0961 (24.06.) gegen R-0962 (13.08.):** R-0961 nennt acht Aufgabenarten, darunter „Entwurf
   fortsetzen“, „einreichen“ und „Autorenübergabe“. Die jüngere Designlieferung D-003 (R-0962)
   bestimmt die Fläche als fünf Arten („zurückgegebene Entwürfe, fällige Prüfungen, Konflikte,
   Wissenslücken und Re-Validierungen“, nur eine davon personenbezogen).
   - Für die Entwürfe kommt Pedis Entscheidung vom 10.09. hinzu (JOB 3503, `deefd049`,
     `pages/MeineEntwuerfe.tsx:15`): eigener Menüpunkt „Meine Entwürfe“ mit eigener Übersicht.
     Daher sind „Entwurf fortsetzen/einreichen“ auf der Aufgabenfläche abgelöst.
   - Die Autorenübergabe ist serverseitig vorhanden (FR-LIF-02, `setAuthor`, Audit
     `ko.author-transferred`), aber sie ist eine Admin-Handlung und keine wartende Aufgabe mit
     Abschlusskriterium. Außer R-0962 gibt es keine ausdrückliche jüngere Entscheidung.
     **Bestätigung durch Pedi erbeten.**
2. **R-0962 Name:** Das Register nennt „Offene Aufgaben“, der Kriteriensatz nennt nur „kein
   Besitzversprechen“. Runde 1 hatte „Aufgaben“ gewählt, Runde 2 folgt der Quelle.
3. **P-H1c:** Die Quelle verlangt `schreibeOhneNeueBestaetigung` aus `cacheStand.ts`. Diese Datei
   gibt es nicht. Geliefert wurde gleichwertig `{ updatedAt: 0 }` (`pages/Validation.tsx`,
   `removeDeletedKoFromCaches`).
4. **Zeilenangaben der Quellen** (`Validation.tsx:220`, `useNavBadges.ts:103`,
   `loadingState.ts:96–101`) beziehen sich auf die damaligen Fassungen. Heute stehen die Stellen bei
   `Validation.tsx:262`, `useNavBadges.ts:103` (unverändert) und `loadingState.ts:143–153`.

## Offen (mit Grund)

- **Livebetrieb (R-1558):** Eine Messung an der öffentlich ausgelieferten Fassung hat dieser Lauf
  nicht durchgeführt. Die Auslieferung ist Aufgabe des Starters/CI, und der öffentliche Commit ist
  unbekannt. Belegt ist das gebaute Bündel dieser Fassung gegen den echten Server in Chromium, nicht
  der Betrieb.
- **R-1576, Grenzen:** Das Raster deckt die Hülle ab. Nicht belegt sind die Funktionen hinter jedem
  Menüziel in jeder Rolle/Sprache/Breite, NL im Chromium-Lauf und die Admin-Rollenvorschau im neuen
  Raster (sie bleibt bei `tests/design/h1-funktionsinventar.test.ts`).
- **R-0905:** Das Designpaket JOB 701 D1 („gebaut, wartet auf Einbau, kein Commit im Produkt-Repo“
  laut Quelle) liegt nicht in diesem Repository. Ob dort weitere Gestaltungsteile der Aufgabenstrecke
  stehen, ist hier nicht prüfbar.
- **Rollentor an Aufgabenzeilen:** Konfliktzeilen sind für Rollen unter „controller“ weiterhin
  Links auf ein gesperrtes Ziel. Das ist bekannt aus `tests/seitenhilfe-luecken`, A2, und ein
  gesonderter Auftrag.
- Die älteren Q4/Q8-Prüfungen und die 48 Menü-Kombinationen behalten ihre eigenen Versionen und
  Zeiten. Sie wurden nicht neu datiert.
