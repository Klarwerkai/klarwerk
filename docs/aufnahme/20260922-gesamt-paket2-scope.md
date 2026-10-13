# Aufnahme 20260922 · Paket 2 — historischer Gegenstand und Umfang (Klärungsakte)

Auftrag `aufnahme:20260922:gesamt-paket2-scope` („Historischen Gegenstand und Umfang von Paket 2
klären“), Lauf 1, 13.10.2026. Basis `06468f05` (`1.0.0-beta.1.953`). Die Fassung, in der dieser
Lauf ausgeliefert wird, steht erst nach der Veröffentlichung fest; bis dahin ist „dieser Lauf“ der
Kandidat auf dieser Basis.

Quelle des Anliegens: `QUELLEN.json` des Auftrags, einziger Punkt **R-1395** (Alias F-1395).

**Ergebnis in einem Satz:** Was „Paket 2“ in R-1395 meint, lässt sich aus den Quellen und dem
Produktbestand nicht eindeutig bestimmen. Im Bestand tragen fünf verschiedene Programme je ein
eigenes „Paket 2“, und keines nennt JOB 534 oder eine Scopeanalyse. Die Einordnung braucht eine
Entscheidung von Pedi. Dieser Lauf ändert keinen Produktcode.

## Originalpunkt R-1395 (wörtlich, mit Herkunft)

| Feld | Inhalt |
|---|---|
| Name | „Scopeanalyse Paket 2“ |
| Anforderung | „Abgrenzung, was zu Paket 2 gehoert und was nicht.“ |
| Bereich / Kategorie | „Maschine“ / „KLARWERK-intern“, `kundenrelevant: false` |
| Zustand / Prüfstatus | `angedacht` / `nur_altquelle`; Aufnahmezustand `klaerung` |
| Altbestand | F-1395, Status `IN_ARBEIT`, Begründung „Begruendung nicht dokumentiert“ |
| Herkunft | `03_AUFTRAEGE/archiv_stale/verbraucht_20260810/MAKROAUFTRAG-PRO-JOB-534-D1-PAKET2-SCOPEANALYSE.md`, 10.08.2026 |
| Damaliger Beleg | „JOB 534, kein BEN-Urteil; Auftragsdatei liegt in verbraucht_20260810.“ |
| Quell-Kennungen | `JOB 534`, `PAKET2-SCOPEANALYSE` |
| Entscheidungen | keine (`entscheidung: null`, `entscheidungen: []`, `pedi_override: null`) |
| Hinweis | „Altbestand: Einordnung offen. Der damalige Zustand ist kein aktueller Funktionsnachweis.“ |

## Kandidaten im heutigen Bestand

Gesucht wurde im Produktarbeitsbaum nach „Paket 2“, „PAKET 2“, „paket2“, „JOB 534“, „F-1395“ und
„R-1395“ (Quelleninspektion am 13.10.2026, Basis `06468f05`). Jeder Treffer gehört zu einem
benannten Programm mit mehreren nummerierten Paketen. Die Tabelle nennt je Programm eine Auswahl der
Fundstellen und die vorhandenen Tests, die das Paket pinnen. Ob diese Tests heute grün sind, belegt
diese Akte nicht. Sie wurden in diesem Lauf nicht ausgeführt.

| Alt. | Programm | Gegenstand von „Paket 2“ im Bestand | Herkunft laut Kommentar | Fundstellen (Auszug) | Belegtests | Weitere Pakete desselben Programms |
|---|---|---|---|---|---|---|
| A | `D-AISTATE` | „Reasoner aktiv“ nur bei echter Erreichbarkeit; Achse 1 „Extern“ als eigene Anzeige; KI beurteilt jeden deterministischen Kandidaten zusätzlich | Pedi 23.07., „bens V2/V3“ | `apps/web/src/lib/reasonerReachability.ts`, `apps/web/src/lib/externalStagePill.ts`, `apps/web/src/shell/StatusZeilen.tsx`, `services/conflicts/src/overlap-service.ts` | `tests/reasoner/reasoner-reachability.test.ts`, `tests/reasoner/aistate-availability.test.ts` | 1, 3, 4 |
| B | `WP-SHIP9-S2` | Import-UX D2–D7: Suche, Filter, Gruppen und Auswahl der Trefferliste; B1 Auswahlkarten | keine Datumsangabe | `apps/web/src/lib/importSelectView.ts`, `apps/web/src/components/ChoiceCards.tsx`, `apps/web/src/components/ImportSelect.tsx` | `tests/app/import-select-view.test.ts`, `tests/app/import-ux-b1-d6.test.tsx` | 3, 4 |
| C | `uxpol1` | gemeinsames Dateityp-Kachel-Bauteil für Erfassen und Import, Quellen-Galerie | keine Datumsangabe | `apps/web/src/components/FileTypePicker.tsx`, `apps/web/src/components/ImportSourceGallery.tsx` | `tests/app/file-type-picker-mounted.test.tsx` | keine gefunden |
| D | `klara1` | Word-Add-in: Bearbeitungsstatus und Deep-Links der Antwortquellen (K2/K3) | keine Datumsangabe | `apps/web/src/lib/wordAddin.ts` | `tests/app/word-addin.test.ts` | keine gefunden |
| E | `nacht24` | SCRUM-506: Bibliotheks-Export durchsetzt dieselbe Lese-Policy wie das normale Lesen | keine Datumsangabe | — | `tests/security/library-export-egress.test.ts` | 3, 5, 6 |

Kein Treffer: „JOB 534“, „Scopeanalyse“, „F-1395“ und „R-1395“ kommen in `apps/`, `services/` und
`docs/` außer in dieser Akte nicht vor. Ein Fehltreffer ist „Projektaudit-Paket 2026-07-01“ in
`docs/qm/IST_ANALYSE_DEV_KLARWERK_2026-07-01.md`. Dort ist „Paket“ ein Datumspaket, kein Paket 2.

Zwei Deutungen ohne Fundstelle im Produkt kommen hinzu:

- **F — internes Arbeitspaket der damaligen Steuerung.** Bereich „Maschine“, Kategorie
  „KLARWERK-intern“, `kundenrelevant: false` und die Ablage als Makroauftrag der Spur „PRO“ deuten
  auf ein Paket der Auftragssteuerung, nicht des Produkts. Diese Steuerungsarchitektur ist laut
  Auftragsumfang ausdrücklich verworfen und wird nicht wiederaufgebaut.
- **G — nicht mehr zuordenbar.** Die Auftragsdatei ist das einzige Dokument, das den Gegenstand
  benennen würde. Sie liegt außerhalb des Produktarbeitsbaums und dieses Auftrags
  (`Projekt_klarwerk/03_AUFTRAEGE/…`) und wurde nicht gelesen.

## Abgrenzung: was zu Paket 2 gehört und was nicht

Belegt ist nur dies:

1. **Kein Programm-Paket 2 ist R-1395.** Keine der Alternativen A–E nennt JOB 534 oder eine
   Scopeanalyse. Umgekehrt nennt R-1395 kein Programm. Eine Zuordnung von R-1395 zu A–E wäre geraten.
2. **A–E sind eigene, bereits gelieferte Teilumfänge** mit eigener Herkunft und eigenen Tests. Sie
   werden durch diesen Auftrag weder erweitert noch neu gebaut und gehören nicht zu seinem Lieferumfang.
3. **R-1395 bestellt eine Analyse, keine Produktfunktion.** Der Satz verlangt eine Abgrenzung. Eine
   Fläche, ein Verhalten oder ein Zielzustand im Produkt ist nicht benannt. Eindeutig bestellt und in
   diesem Lauf umgesetzt ist daher nur diese Akte.

## Erforderliche Entscheidung (Pedi)

Offen ist die Frage: **Welches „Paket 2“ meinte JOB 534 am 10.08.2026, und soll R-1395 danach
weiterbestehen?** Zur Wahl stehen:

| Wahl | Folge |
|---|---|
| A, B, C, D oder E | R-1395 bezieht sich auf dieses Programm-Paket. Die Abgrenzung ist dann die Spalte „Gegenstand“ oben, ergänzt um die Pakete 1/3/4 … desselben Programms. Ob das Paket heute vollständig ist, klärt ein gesonderter Abgleich mit der Originalbestellung des Programms. |
| F | R-1395 betrifft die verworfene Steuerung und ist gegenstandslos. Schließen ohne Produktlieferung. |
| G | R-1395 ist ohne die Auftragsdatei nicht zu beantworten. Entweder liefert Pedi die Datei oder ihren Inhalt nach, oder der Punkt wird als historisch geschlossen. |

Empfehlung: **F oder G.** Kategorie und Bereich zeigen nach innen, ein Produktbezug ist nirgends
belegt, und A–E sind ohne R-1395 bereits geliefert. Dieser Lauf trifft die Entscheidung nicht.

## Quellenwidersprüche und fehlende Belege

1. **Zustand:** R-1395 steht auf `angedacht`, der Altbestand F-1395 auf `IN_ARBEIT`, und die Datei
   liegt unter `verbraucht_20260810`. Ob JOB 534 je lief, ist damit unklar.
2. **„Alte Pedi-Auswahl“:** Der Hinweis kündigt eine historische Pedi-Entscheidung „unten“ an. Im
   Punkt steht keine (`entscheidungen: []`, `pedi_override: null`, `override_am: null`). Erhalten
   bleibt also nichts. Der Satz ist offenbar ein allgemeiner Altbestandshinweis.
3. **Begründung:** „Begruendung nicht dokumentiert“, kein BEN-Urteil. Ein Ergebnis von JOB 534 ist
   nicht belegt.
4. **Auftragsdatei:** Die einzige Quelle für den Gegenstand ist nicht Teil dieses Auftrags und liegt
   außerhalb des Produktarbeitsbaums. Sie fehlt als Beleg.
5. **Zielpfad:** `paths` des Auftrags nennt nur die Aufnahmeakte (`auftragsquellen/paket2-scope.json`),
   keinen Produktpfad. Das passt zu einer reinen Klärung.

## Geliefert in diesem Lauf

- Diese Akte, `docs/aufnahme/20260922-gesamt-paket2-scope.md`.
- `tests/aufnahme-paket2-scope/zuordnung.test.ts` pinnt die Akte gegen den Bestand. Jede Fundstelle
  und jeder Belegtest der Kandidatentabelle muss existieren und Programmkennung und „Paket 2“ tragen.
  „JOB 534“, „Scopeanalyse“, „F-1395“ und „R-1395“ dürfen in `apps/`, `services/` und `docs/` nur in
  dieser Akte stehen. Und die Akte muss die offene Entscheidung nennen, statt eine Alternative als
  gewählt auszugeben.

## Offen (mit Grund)

- **Entscheidung A–G:** nur Pedi. Bis dahin bleibt R-1395 in Klärung.
- **Heutiger Funktionsstand von A–E:** In diesem Lauf nicht gemessen. Die genannten Belegtests
  wurden nicht ausgeführt; ihre Nennung bestellt keinen Prüflauf.
- **Inhalt von JOB 534:** nicht eingesehen (außerhalb des Auftrags).
