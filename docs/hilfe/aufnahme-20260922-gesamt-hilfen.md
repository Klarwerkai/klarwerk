# Aufnahme 20260922 · Gesamt-Hilfen — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-hilfen`, Revision 1, Lauf 1, Nacharbeit 3.
Abgeglichen am 08.10.2026 gegen den Stand **1.0.0-beta.1.741** (Basis `6f9e961b`); Nacharbeit 3 am
Kandidaten `28f3bc69` (1.0.0-beta.1.744).

Dies ist zuerst eine **Bestandsaufnahme**. Erledigte Teile werden nicht neu gebaut. Gebaut wurde nur,
wo am Quelltext eine konkrete Lücke eines Originalkriteriums stand (Abschnitt „In diesem Lauf
geändert"). Was offen ist, steht als offen da.

**Grenzen der Quellen.** Die Erledigungsangaben der Auftragsquelle (JOB-Nummern, „LIVE",
„erledigt") sind Aussagen der Quelle. Hier geprüft ist, ob der genannte Commit im Baum liegt und ob
der Quelltext heute trägt, was er verspricht. Ein Live-Abnahmebeleg je Anliegen liegt diesem
Arbeitsbaum nicht vor. In diesem Lauf wurde **kein Test gestartet**; die Spalte „Prüfung" nennt die
vorhandenen bzw. neuen Testdateien, die der Prüflauf ausführt.

## In diesem Lauf geändert

| Anliegen | Lücke am Basisstand | Änderung | Prüfung |
|---|---|---|---|
| R-0935, R-0924, R-1671, P-HILFE-ANWENDERSPRACHE | Die 77 ausformulierten FAQ-Antworten (`lib/faqContent.ts`) hatten genau einen Leser: Klaras Suche. Auf der Hilfeseite gab es keine „Sammlung häufiger Fragen". | `pages/Help.tsx`: Abschnitt „Häufige Fragen" unter den Kapiteln, in **DE/EN/NL**. **Nacharbeit 3 (Ben):** Quelle ist nicht mehr `faqContent.ts` wörtlich (das Rollen- und Prüfbegriffe auf `/hilfe` zurückbrachte und nur deutsch war), sondern die Lesefassung `lib/hilfeFaq.ts`: 36 Fragen aus dem Katalog, in Anwendersprache neu gefasst und übersetzt, mit derselben Absprungroute. Rollennamen stehen nur in den zwei Einträgen zur Export-Rollenausnahme (P-DOK1), dort verständlich erklärt. Dieselbe Suche (ein Aufruf) filtert Kapitel und Fragen; der Sprung in den Bereich steht nur bei bekannter Rolle mit Zugang und nie auf `/hilfe` selbst. `faqContent.ts` bleibt Klaras Wissensbasis und DOK1-Prüfgegenstand, unverändert. | `tests/hilfe-faq-sammlung/hilfe-faq-sammlung-mounted.test.tsx` (S1–S6), `tests/hilfe-faq-sammlung/hilfe-faq-anwendersprache.test.ts` (A0–A5, Rollenausnahme gegen `policy.ts` und `library-routes.ts`) |
| R-0890 | Kein Hilfetext trug den Fünf-Teil-Bauplan. | **Nacharbeit 3:** `lib/hilfeBibliothek.ts` — je Funktion (= jedes der 22 Hilfekapitel) ein Artikel mit „Was ist das? / Wie funktioniert es? / Warum ist es so gebaut? / Was passiert danach? / Typische Missverständnisse“, in DE/EN/NL, aus den geprüften Kapiteltexten, Kurzhilfen und FAQ abgeleitet. Auf `/hilfe` zugeklappt unter jeder Kapitelkarte („Ausführlich erklärt“). Beschriftungen: `texte/hilfebibliothek.ts`. | `tests/hilfe-bibliothek/bibliothek-bauplan.test.tsx` (B1–B4) |
| R-0941 | Elementerklärung ohne konkretes Beispiel. | **Nacharbeit 3:** `lib/klaraBeispiele.ts` — je der 49 Elementerklärungen (Erfassen `cap:*`, Prüfbereich `rev:*`) ein Beispiel in DE/EN/NL. `KlaraAssistant.tsx` zeigt es am aktiven Element, im Zeige-Modus und bei Suchtreffern und liest es mit vor. | `tests/hilfe-elementbeispiel/elementbeispiel-mounted.test.tsx` (E1–E4), im Klara-Regressionsinventar nachgetragen |
| N-0042 | Menüeintrag „Klara in Word“ ohne Vorschau-Kennzeichnung; der Hilfelink klärt keinen Word-Zugang. | **Nacharbeit 3:** Menüpunkte auf Start und im Erfassen-Menü heißen „Klara in Word (Vorschau)“ / „(preview)“ / „(voorvertoning)“ (`texte/wordvorschau.ts`, `components/start/startPunkte.ts`, `components/erfassen/Blatt.tsx`). Unter dem Hilfelink nennt die Fläche die Anlaufstelle: den Support dieser Installation, den die Hilfeseite oben zeigt. Keine Verfügbarkeit und kein Freischaltweg behauptet. | `tests/klara-webhilfe-schmal/word-weg-naechster-schritt.test.tsx`, `klara-hilfe-chromium.test.ts` (Menütext nachgeführt), `tests/design/h3-funktionsinventar.test.ts`, `tests/design/h5-funktionsinventar.test.ts` (Beschriftung aus `startPanelLabelKey`) |
| R-1038 | Kein Assistenten-Konzept. | **Nacharbeit 3:** `docs/klara/assistenten-konzept-fuehrung.md` — Ausgangslage mit Fundstellen, Bausteine F1–F5 mit Abnahmesätzen, Reihenfolge, offene Produktentscheidungen (nicht getroffen). | Dokument, kein Test |
| R-0942 | `components/KlaraAssistant.tsx` war nicht sperrend und Escape schloss. Es fehlten der gemeldete Zustand am Auslöser (`aria-expanded`), der Fokussprung beim Öffnen und die bedingte Fokusrückkehr. | Auslöser mit `aria-expanded` und (offen) `aria-controls`. Die Fläche erhält beim Öffnen den Fokus (`tabIndex=-1`, bewusst nicht das Suchfeld wegen der Telefontastatur). Escape und „Schließen" geben den Fokus nur dann an den Auslöser zurück, wenn er noch in der Fläche stand. | `tests/hilfe-ausklappflaeche/ausklappflaeche-fokus-mounted.test.tsx` (A1–A6); im Klara-Regressionsinventar nachgetragen (`tests/app/klara-regressionsinventar.test.ts`, Achse `komponente`) |
| P-DOK1 (Teil OFFEN.md) | `OFFEN.md` C4 (am 06.09. Zeile 111) stand weiter als ENTSCHEIDUNG, obwohl Pedi die Frage am 05.09. entschieden hatte (Entscheidung 23) und JOB 3089 sie umgesetzt hat. | Zeile C4 auf ERLEDIGT mit Beleg (`6d8d4c27`, `services/confluence/src/mapper.ts:180-182`), ursprüngliche Frage als Vorgeschichte erhalten. Reine Textänderung. | keine Testpflicht (Dokument) |

## Abgleich je Anliegen

| Anliegen | Stand | Geliefert (Commit · Ort) | Grenze / offen |
|---|---|---|---|
| **R-0443** Seite „So arbeitet Klarwerk" | teilweise | Die Quelle führt R-0443 als Kreuz-Dublette der „kuratierten Sicht" (verwandt R-1983). Geliefert als aufklappbare Vorführsicht auf dem Wissensnetz: `SoArbeitetKlarwerk` in `pages/Stufe2.tsx:2826-2842`, eingeführt mit `976142be` (1.0.0-beta.1.661), geprüft in `tests/wissensnetz-flaeche/netz-verwaltung.test.tsx` (S1–S4). Wie mit Klarwerk gearbeitet wird, erklären die Einstiegsführung auf `/hilfe` und `docs/onboarding/user-quickstart.md`. | **Keine eigene Route.** Die Sicht liegt auf `/wissensnetz` (Stufe 2, Admin). Ob eine eigenständige Seite für alle Rollen gewollt ist, sagt die Quelle nicht. R-1983 gehört zu einem anderen Aufnahmeauftrag. |
| **R-0888** ?-Hilfen an Feldern und Abschnitten | geliefert für die genannten Stellen | `HelpTip` (`components/HelpTip.tsx`), Erfassen `lib/captureHelp.ts` (23 Kurzhilfen), Prüfbereich `lib/reviewHelp.ts` (26 Kurzhilfen) (SCRUM-404/406/407); seit Nacharbeit 3 je mit konkretem Beispiel in Klara. | **Beleglücke, keine fehlende Funktion:** `docs/hilfe/HILFE-REGISTER.md` bilanziert mit Stand 05.07. 79 Überschriften, davon 49 ohne ?-Hilfe; der Generator liegt nicht im Repo. Heutige Quelltextzählung (08.10., Grep, kein Generator): 77 Vorkommen von `SectionLabel` in 29 Dateien und 53 Vorkommen von `HelpTip` in 27 Dateien. `SectionLabel` trägt keine Hilfe-Eigenschaft (`components/ui.tsx:138`); welche Überschrift eine ?-Hilfe neben sich hat, lässt sich aus dieser Zählung nicht ableiten. **Eine heutige Abdeckung auf Feld- und Überschriftenebene ist damit weiter nicht belegt.** |
| **R-0890** Bibliothek nach festem Bauplan | geliefert in Nacharbeit 3 | `lib/hilfeBibliothek.ts`: 22 Artikel, je Funktion fünf Teile nach dem Bauplan aus Lieferung 1 (`docs/qm/HILFE_LIEFERUNG-1_GLIEDERUNG-UND-FAQ_2026-07-04.md:14-20`), DE/EN/NL, auf `/hilfe` unter jeder Kapitelkarte. | „Jede Funktion“ ist hier als jede Funktion mit eigenem Hilfekapitel geschnitten (22 Bereiche). Die feinere Gliederung aus Lieferung 1 (rund 70 Artikel, etwa getrennte Artikel für Diktieren oder Wissensarten) ist nicht einzeln ausgeschrieben; ihr Inhalt steckt in den Artikeln der zugehörigen Funktion. Die Beispiele stammen aus wechselnden Branchen. Eine Fachsichtung durch Menschen steht aus. |
| **R-0924** Fragenkatalog je Seite/Funktion mit Antworten | geliefert | Katalog: Lieferung 1 (C). Antworten: `lib/faqContent.ts` (77, DE, Klaras Wissensbasis). Auf `/hilfe`: Lesefassung `lib/hilfeFaq.ts`, 36 Fragen aus allen zwölf Bereichen, DE/EN/NL, Anwendersprache. | Nicht auf `/hilfe` übernommen sind 41 Fragen (Liste unten), weil ihre Antwort Rollenmechanik erklärt oder eine Fläche bzw. Beschriftung nennt, die am heutigen Quelltext nicht mehr so besteht oder hier nicht nachgeprüft wurde. Klara führt alle 77 auf Deutsch weiter. |
| **R-0935** eingebaute Hilfe: Themenkarten, Suche, zwei Sprachen, Direktsprung, FAQ, Startführung | geliefert | Themenkarten mit Suche und „Bereich öffnen": `pages/Help.tsx`, `lib/helpTopics.ts` (Texte DE/EN/NL). Startführung: Einstiegsführung auf `/hilfe` (JOB 4022 `db9aa4d2`). FAQ-Sammlung in DE/EN/NL (Nacharbeit 3). | — |
| **R-0941** Element antippen, Klara erklärt, vorlesen, Beispiel | geliefert in Nacharbeit 3 | Zeige-Modus und Vorlesen: `components/KlaraAssistant.tsx` (SCRUM-403/404 `b543574c`). Beispiel: `lib/klaraBeispiele.ts` für alle 49 Elementerklärungen, angezeigt und mit vorgelesen. | Seiten- und Abschnittserklärungen (`page:*`, `sec:*`) tragen kein Beispiel. **Quellenwiderspruch:** Laut Quelle führt Landkarte v3 die „Sprachausgabe der Antworten" (J8) als gestrichen, das Vorlesen ist aber im Code vorhanden. |
| **R-0942** Ausklappfläche statt sperrendes Fenster | geliefert in diesem Lauf | s. oben. Kleine Bildschirme: N-0033 (JOB 3144 `ee189360`, `w-[min(340px,calc(100vw-2.5rem))]`), Chromium-Matrix `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts`. | Den in der Quelle verlangten Gegentest „markerlose Tastatur-Fokusfalle" gibt es nicht. Die Fläche hat bewusst **keine** Fokusfalle: Tab verlässt sie, weil sie nicht sperrt. |
| **R-0943** Assistent erklärt Seite, Felder, markierte Begriffe, ehrliche Lücke | geliefert | `KlaraAssistant.tsx`: Seite (`pageEntryFor`), Feld (`data-help`-Fokus), Markierung (`explainSelection`). Antworten aus Registry und FAQ. Ohne Grundlage keine KI-Antwort (`aiNoGrounding`). Prüfung: `tests/app/f0304-klara-assistenzflaeche.test.tsx`. | — |
| **R-0966** Kurzanleitung in fünf Minuten | geliefert (Dokument) | `docs/onboarding/user-quickstart.md`: Was ist Klarwerk, In 5 Minuten starten, Arbeitskreis & wer was darf, ehrliche Grenzen. | Ein Sichtungs- oder Abnahmebeleg fehlt weiterhin. |
| **R-1017** Erklärung an der Stelle des Stockens | teilweise | ?-Hilfen am Element (R-0888), Seitenhilfe je Seite im Zahnrad (SEITENHILFE-LÜCKEN), Klara mit Feldkontext. | Die in OFFEN.md U4/mega92 Block E verlangte Erhebung „welche Flächen tragen eine Hilfe" liegt für Seiten vor (SEITENHILFE-LÜCKEN), für Felder nicht. |
| **R-1031** Synonymsuche | geliefert (Grundform) | `KLARA_SYNONYMS` und tolerante Suche: `lib/klaraRegistry.ts:241-330`. Wortzerlegung/Synonyme als eigener Auftrag („Wortzerlegung, Synonyme und fachliche Komposita", `dab4e20c`, 1.0.0-beta.1.659). | Die Quelle verweist auf eine Synonymtabelle Pedis („um deine Tabelle"). Ob diese Tabelle vorliegt und vollständig eingepflegt ist, ist **nicht belegt**. |
| **R-1038** weiterführendes Assistenten-Konzept | Konzept geliefert in Nacharbeit 3 | `docs/klara/assistenten-konzept-fuehrung.md` | Nur Konzept; gebaut ist davon nichts. Offene Produktentscheidungen sind dort benannt und nicht getroffen. Eine Berater-Lieferung 4 liegt nicht vor und wird nicht behauptet. |
| **R-1671** In-App-Hilfe zweisprachig, durchsuchbar (FE-FND-05) | geliefert | wie R-0935. Kapitel, FAQ und Bibliothek DE/EN/NL, ISO-Kapitel DE/EN. | — |
| **R-2196** dauerhafte erklärende Hilfen, alte Zielbilder 27.08. | entschieden | Laut Quelle „Bewusst ersetzt, Inhalt soll in Untermenüs erhalten bleiben" (09_ENTSCHEIDUNGEN.md:12). Die Seitenhilfe steht im Zahnradmenü je Seite (`HelpTip` meldet an, JOB 3741 `f32b14a4`). | Kein Bauauftrag. Die alte Sichtbarkeit ist keine geltende Designpflicht. |
| **N-0033** Panelbreite im Viewport | geliefert | JOB 3144 `ee189360` (1.0.0-beta.1.150). `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts` F1–F7, 320/390/1280, DE/EN. | Die Live-Gegenprüfung nach der Behebung ist laut Quelle offen. |
| **N-0042** Word-Einstieg: Verfügbarkeit und nächster Schritt | geliefert (Vorschau-Zweig) | JOB 3144: `KlaraPathTeaser` sagt „Verfügbar ist das noch nicht", trägt „Demnächst" und den Link zur Webhilfe. Nacharbeit 3: Menüpunkte als Vorschau gekennzeichnet (DE/EN/NL), Anlaufstelle (Support dieser Installation) unter dem Link genannt. | **Quellenwiderspruch, nicht entschieden:** Die Fläche sagt „noch nicht verfügbar“, das Repo führt aber Sideload- und Host-Abnahmeanleitungen für das Add-in (`docs/word-addin/`, `docs/operations/word-*-hostabnahme/`). Umgesetzt ist der Zweig, den der Befund für eine reine Vorschau vorgibt. Ob der Einstieg künftig echten Zugang vermitteln soll, ist eine Produktentscheidung; eine Word-Startanleitung wurde nicht verlinkt, weil keine Freigabe für Konten belegt ist. |
| **N-0086** Hilfe findet den Dateiimport | geliefert | JOB 3468 `598a1270`: Kapitel `fileimport` mit Link und geltenden Upload-Grenzen. `tests/review26-hilfe-import/*`. | Die Live-Gegenprüfung ist laut Quelle offen. |
| **P-HILFE-ANWENDERSPRACHE** | geliefert | JOB 4067 `7bbe1185`, JOB 4071 `17fe4db2`. `tests/hilfe-anwendersprache/*`, `tests/hilfe-altkapitel-anwendersprache/*`. Nacharbeit 3: FAQ und Bibliothek auf `/hilfe` geprüft durch `tests/hilfe-faq-sammlung/hilfe-faq-anwendersprache.test.ts` und `tests/hilfe-bibliothek/bibliothek-bauplan.test.tsx` (gemeinsame Regeln `tests/hilfe-faq-sammlung/wortwahl.ts`). | FAQ und Artikel verlängern die Seite. Beide stehen deshalb zugeklappt (Fragen ohne Antwort sichtbar, Artikel hinter „Ausführlich erklärt“). Rollennamen erscheinen nur in der Export-Rollenausnahme. Die Merkmalspillen unter den Kapiteln zeigen weiter Fachwörter (`helpTopics.ts`, Kopf JOB 4071) — so bekannt. |
| **P-ISO-HILFE** | geliefert | JOB 3338 `552b7ae6`: `lib/helpTopics.iso.ts` (Alias „2701", DE/EN), `tests/iso-hilfe/*` inklusive `zusagen.ts` (kein Konformitätsversprechen). | — |
| **P-UX-16** | geliefert | JOB 3144 `ee189360`. | wie N-0033/N-0042. |
| **P-UX-16b**, **UX-16b-R2** | geliefert | JOB 3269 `8fb2b8a6` (1.0.0-beta.1.220): Browsermatrix `/start` und `/import`, DE/EN, 320/390/Desktop, Tab/Shift+Tab, Reload in `klara-hilfe-chromium.test.ts`. | **Quellenwiderspruch:** P-UX-16b nennt den zweiten Aufrufer `/kapital`. Im Code trägt `/kapital` keinen `KlaraPathTeaser`, der zweite Aufrufer ist `/import` (`pages/Stufe2.tsx:1285`). UX-16b-R2 nennt richtig `/import`. |
| **P-DOK1** | geliefert | FAQ-Dokument: `docs/team2-austausch/HILFE_LIEFERUNG-3a_FAQ-ANTWORTEN_2026-07-05.md:112/115/143` nennen die Rollenausnahme (JOB 3263 `d172cefc`). `OFFEN.md` C4: in diesem Lauf nachgeführt. | — |
| **DOK1-R** | geliefert | JOB 3263 `d172cefc`: `tests/dok1-export-wahrheit/faq-export-rollenausnahme.test.ts` unterscheidet Lesen und Exportieren (`action` „read" bzw. „export"). Der `/hilfe`-Anschluss wird über `faq-anzeigeweg.test.tsx` am Klara-Weg belegt. | Auf `/hilfe` steht die Exportregel in Anwendersprache (`lib/hilfeFaq.ts`, `faq.bibliothek.6`, `faq.vertrauen.5`); ihre Rollen sind gegen `policy.ts` und `library-routes.ts` gehalten (`hilfe-faq-anwendersprache.test.ts` A4/A5). |
| **TEST-A18** Verständlichkeit, Hilfe, Fehlerrückmeldungen | teilweise | Interne Begriffe von `/hilfe` entfernt (JOB 4022/4067/4071), Wächter `tests/hilfe-anwendersprache/wortwahl-waechter.test.ts`. | Außerhalb von `/hilfe` stehen in ?-Hilfen weiter „Peer-Prüfung"/„Peer-Bewertung" (`woerterbuch/de.ts` u. a. bei `:3792`, `:6548`, `:6554`). Ob das unter den Befund „Peers" fällt, ist **nicht entschieden**. Eine erneute Gesamtprüfung A18 liegt nicht vor. |
| **SEITENHILFE-LÜCKEN** | geliefert | JOB 3741 `f32b14a4`, JOB 3980 `2cd83543`. `tests/seitenhilfe-luecken/*`. | — |

## Abgrenzung zu anderen Aufträgen

- `aufnahme:20260922:gesamt-klara-assistenz` (`docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md`):
  Bausteine KA1–KA8 und Word-Weg. Hier nicht bearbeitet.
- Wissensnetz/R-1983 („kuratierte Sicht") ist ausgeliefert (`976142be`) und wird hier nur als Beleg für
  R-0443 genannt.
- Wortzerlegung und Synonyme (`dab4e20c`) sind ein eigener Auftrag. Hier nur der Beleg für R-1031.
- Word-Add-in, Sideload und Host-Abnahme: ausdrücklich kein Gegenstand (P-UX-16 „kein Word-Auftrag").

## Nicht auf `/hilfe` übernommene FAQ-Fragen

Klara führt sie weiter (Deutsch, `lib/faqContent.ts`). Auf der Hilfeseite fehlen sie, weil ihre
Antwort Rollenmechanik erklärt oder eine Fläche, Beschriftung oder Zahl nennt, die für diese
Lesefassung nicht am heutigen Quelltext nachgeprüft wurde:
`faq.grund.2`, `.4`, `.5`, `.6`; `faq.erfassen.2`, `.4`, `.8`, `.9`, `.10`; `faq.pruefen.4`, `.7`,
`.8`, `.9`, `.10`; `faq.vertrauen.2`, `.3`, `.4`, `.6`; `faq.bibliothek.2`, `.3`, `.4`;
`faq.fragen.2`, `.5`, `.6`, `.7`; `faq.konflikte.3`, `.4`, `.5`; `faq.busfaktor.2`, `.4`, `.5`;
`faq.ki.2`, `.5`, `.6`; `faq.verwaltung.1`, `.2`, `.4`, `.6`; `faq.mobil.3`; `faq.meta.1`, `.3`.
Konkrete Abweichungen, die dabei aufgefallen sind: `faq.meta.1` nennt ein „Glossar der Hilfeseite“,
das es nicht gibt; `faq.meta.3` eine „Schnellwege-Sammlung“, die es auf `/hilfe` nicht gibt;
`faq.ki.1`/`faq.ki.3` nennen die Kennzeichnung „Im Haus“, die Oberfläche sagt „DSGVO-konform“
(`reasoner.taskInfo.dsgvoInhouse`). In der Lesefassung sind diese Stellen korrigiert;
`faqContent.ts` selbst ist unverändert (Klara, DOK1).

## Fehlende Mittel und Belege

- Eine Berater-Lieferung 3b oder 4 liegt nicht vor. Sie ist für R-0890, die zweisprachige FAQ und
  R-1038 **keine** zwingende Voraussetzung; diese Inhalte sind in Nacharbeit 3 aus dem vorhandenen
  Bestand erarbeitet. Eine fachliche Sichtung der neuen Texte durch Menschen steht aus.
- Pedis Synonymtabelle (R-1031) ist im Repo nicht auffindbar. Ihre Übernahme ist nicht belegt.
- R-0443: Die kuratierte Vorführsicht im Wissensnetz ist belegt; eine eigene Erklärseite für alle
  Rollen ist es nicht. Ob die Dublettenzuordnung der Quelle den Zielzustand ablöst, ist nicht
  belegt; eine eigene Seite ist nicht gebaut.
- R-0888/R-1017: Die Abdeckung auf Feldebene ist nicht belegt (siehe Zählung oben).
- Ein Live-Abnahmebeleg für N-0033, N-0042, N-0086 nach Behebung fehlt; die Quelle meldet die
  Gegenprüfung als offen.
- Der Lieferbeleg dieses Laufs (Fassung, Livestand) entsteht erst nach Veröffentlichung.
