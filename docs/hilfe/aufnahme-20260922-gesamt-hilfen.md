# Aufnahme 20260922 · Gesamt-Hilfen — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-hilfen`, Revision 1, Lauf 1.
Abgeglichen am 08.10.2026 gegen den Stand **1.0.0-beta.1.741** (Basis `6f9e961b`).

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
| R-0935, R-0924, R-1671 | Die 77 ausformulierten FAQ-Antworten (`lib/faqContent.ts`) hatten genau einen Leser: Klaras Suche (`lib/klaraRegistry.ts`, `allFaqEntries`). Auf der Hilfeseite gab es keine „Sammlung häufiger Fragen". | `pages/Help.tsx`: Abschnitt „Häufige Fragen" unter den Kapiteln. Jede Frage ist ein natives `details`/`summary`, die Antwort steht wörtlich darunter. Dieselbe Suche filtert Kapitel und Fragen. Ein reiner FAQ-Treffer ist kein Nulltreffer mehr. Der Sprung in den Bereich steht nur bei bekannter Rolle mit Zugang (dieselbe Regel wie die Einstiegsführung) und nie auf `/hilfe` selbst. In EN/NL steht statt einer halben Liste der ehrliche Satz, dass die Antworten nur deutsch vorliegen. Texte: `texte/hilfefaq.ts` (DE/EN/NL). | `tests/hilfe-faq-sammlung/hilfe-faq-sammlung-mounted.test.tsx` (S1–S6) |
| R-0942 | `components/KlaraAssistant.tsx` war nicht sperrend und Escape schloss. Es fehlten der gemeldete Zustand am Auslöser (`aria-expanded`), der Fokussprung beim Öffnen und die bedingte Fokusrückkehr. | Auslöser mit `aria-expanded` und (offen) `aria-controls`. Die Fläche erhält beim Öffnen den Fokus (`tabIndex=-1`, bewusst nicht das Suchfeld wegen der Telefontastatur). Escape und „Schließen" geben den Fokus nur dann an den Auslöser zurück, wenn er noch in der Fläche stand. | `tests/hilfe-ausklappflaeche/ausklappflaeche-fokus-mounted.test.tsx` (A1–A6); im Klara-Regressionsinventar nachgetragen (`tests/app/klara-regressionsinventar.test.ts`, Achse `komponente`) |
| P-DOK1 (Teil OFFEN.md) | `OFFEN.md` C4 (am 06.09. Zeile 111) stand weiter als ENTSCHEIDUNG, obwohl Pedi die Frage am 05.09. entschieden hatte (Entscheidung 23) und JOB 3089 sie umgesetzt hat. | Zeile C4 auf ERLEDIGT mit Beleg (`6d8d4c27`, `services/confluence/src/mapper.ts:180-182`), ursprüngliche Frage als Vorgeschichte erhalten. Reine Textänderung. | keine Testpflicht (Dokument) |

## Abgleich je Anliegen

| Anliegen | Stand | Geliefert (Commit · Ort) | Grenze / offen |
|---|---|---|---|
| **R-0443** Seite „So arbeitet Klarwerk" | teilweise | Die Quelle führt R-0443 als Kreuz-Dublette der „kuratierten Sicht" (verwandt R-1983). Geliefert als aufklappbare Vorführsicht auf dem Wissensnetz: `SoArbeitetKlarwerk` in `pages/Stufe2.tsx:2826-2842`, eingeführt mit `976142be` (1.0.0-beta.1.661), geprüft in `tests/wissensnetz-flaeche/netz-verwaltung.test.tsx` (S1–S4). Wie mit Klarwerk gearbeitet wird, erklären die Einstiegsführung auf `/hilfe` und `docs/onboarding/user-quickstart.md`. | **Keine eigene Route.** Die Sicht liegt auf `/wissensnetz` (Stufe 2, Admin). Ob eine eigenständige Seite für alle Rollen gewollt ist, sagt die Quelle nicht. R-1983 gehört zu einem anderen Aufnahmeauftrag. |
| **R-0888** ?-Hilfen an Feldern und Abschnitten | geliefert für die genannten Stellen | `HelpTip` (`components/HelpTip.tsx`), Erfassen `lib/captureHelp.ts`, Prüfbereich `lib/reviewHelp.ts` (SCRUM-404/406/407). | `docs/hilfe/HILFE-REGISTER.md` bilanziert mit Stand 05.07. 79 Überschriften, davon 49 ohne ?-Hilfe. Das Register ist laut Kopf aus dem Code generiert, der Generator liegt nicht im Repo. **Eine heutige Zählung fehlt.** |
| **R-0890** Bibliothek nach festem Bauplan | **offen** | Bauplan und Gliederung liegen vor: `docs/qm/HILFE_LIEFERUNG-1_GLIEDERUNG-UND-FAQ_2026-07-04.md:10-20` (Was/Wie/Warum/Was danach/Missverständnisse). | Die ausformulierten Bibliotheksartikel (Berater-Lieferung 3b) liegen nicht im Repo. Kein Hilfetext der App trägt den Fünf-Teil-Bauplan. Diese redaktionelle Lieferung ist **nicht ersetzt** worden. Fehlendes Mittel: Lieferung 3b. |
| **R-0924** Fragenkatalog je Seite/Funktion mit Antworten | geliefert (DE) | Katalog: Lieferung 1 (C). Antworten: `lib/faqContent.ts`, 77 Antworten in 12 Bereichen mit Absprungroute. **Neu:** als Sammlung auf `/hilfe` (s. oben). Vorher nur über Klara. | Nur deutsch, die EN-Fassung (Lieferung 3b) fehlt. |
| **R-0935** eingebaute Hilfe: Themenkarten, Suche, zwei Sprachen, Direktsprung, FAQ, Startführung | geliefert, FAQ nur DE | Themenkarten mit Suche und „Bereich öffnen": `pages/Help.tsx`, `lib/helpTopics.ts` (SCRUM-219, Texte DE/EN/NL). Startführung: Einstiegsführung auf `/hilfe` (JOB 4022 `db9aa4d2`). **Neu:** FAQ-Sammlung. | FAQ in EN/NL nur als ehrlicher Hinweis (Lieferung 3b fehlt). |
| **R-0941** Element antippen, Klara erklärt, vorlesen, Beispiel | teilweise | Zeige-Modus und Vorlesen: `components/KlaraAssistant.tsx` (Zeige-Modus mit Capture-Listener, `speakButton` per Browser-Sprachausgabe, SCRUM-403/404 `b543574c`). | **„mit einem konkreten Beispiel" ist nicht gebaut.** Die Erklärung zeigt den Hilfetext ohne eigenen Beispielteil. **Quellenwiderspruch:** Laut Quelle führt Landkarte v3 die „Sprachausgabe der Antworten" (J8) als gestrichen, das Vorlesen ist aber im Code vorhanden. |
| **R-0942** Ausklappfläche statt sperrendes Fenster | geliefert in diesem Lauf | s. oben. Kleine Bildschirme: N-0033 (JOB 3144 `ee189360`, `w-[min(340px,calc(100vw-2.5rem))]`), Chromium-Matrix `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts`. | Den in der Quelle verlangten Gegentest „markerlose Tastatur-Fokusfalle" gibt es nicht. Die Fläche hat bewusst **keine** Fokusfalle: Tab verlässt sie, weil sie nicht sperrt. |
| **R-0943** Assistent erklärt Seite, Felder, markierte Begriffe, ehrliche Lücke | geliefert | `KlaraAssistant.tsx`: Seite (`pageEntryFor`), Feld (`data-help`-Fokus), Markierung (`explainSelection`). Antworten aus Registry und FAQ. Ohne Grundlage keine KI-Antwort (`aiNoGrounding`). Prüfung: `tests/app/f0304-klara-assistenzflaeche.test.tsx`. | — |
| **R-0966** Kurzanleitung in fünf Minuten | geliefert (Dokument) | `docs/onboarding/user-quickstart.md`: Was ist Klarwerk, In 5 Minuten starten, Arbeitskreis & wer was darf, ehrliche Grenzen. | Ein Sichtungs- oder Abnahmebeleg fehlt weiterhin. |
| **R-1017** Erklärung an der Stelle des Stockens | teilweise | ?-Hilfen am Element (R-0888), Seitenhilfe je Seite im Zahnrad (SEITENHILFE-LÜCKEN), Klara mit Feldkontext. | Die in OFFEN.md U4/mega92 Block E verlangte Erhebung „welche Flächen tragen eine Hilfe" liegt für Seiten vor (SEITENHILFE-LÜCKEN), für Felder nicht. |
| **R-1031** Synonymsuche | geliefert (Grundform) | `KLARA_SYNONYMS` und tolerante Suche: `lib/klaraRegistry.ts:241-330`. Wortzerlegung/Synonyme als eigener Auftrag („Wortzerlegung, Synonyme und fachliche Komposita", `dab4e20c`, 1.0.0-beta.1.659). | Die Quelle verweist auf eine Synonymtabelle Pedis („um deine Tabelle"). Ob diese Tabelle vorliegt und vollständig eingepflegt ist, ist **nicht belegt**. |
| **R-1038** weiterführendes Assistenten-Konzept | **offen** | — | Berater-Lieferung 4, laut Quelle „zurückgestellt bis Bibliothek steht" (hängt an R-0890). Nicht ersetzt. |
| **R-1671** In-App-Hilfe zweisprachig, durchsuchbar (FE-FND-05) | geliefert | wie R-0935. Kapitel DE/EN/NL, ISO-Kapitel DE/EN. | FAQ nur DE. |
| **R-2196** dauerhafte erklärende Hilfen, alte Zielbilder 27.08. | entschieden | Laut Quelle „Bewusst ersetzt, Inhalt soll in Untermenüs erhalten bleiben" (09_ENTSCHEIDUNGEN.md:12). Die Seitenhilfe steht im Zahnradmenü je Seite (`HelpTip` meldet an, JOB 3741 `f32b14a4`). | Kein Bauauftrag. Die alte Sichtbarkeit ist keine geltende Designpflicht. |
| **N-0033** Panelbreite im Viewport | geliefert | JOB 3144 `ee189360` (1.0.0-beta.1.150). `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts` F1–F7, 320/390/1280, DE/EN. | Die Live-Gegenprüfung nach der Behebung ist laut Quelle offen. |
| **N-0042** Word-Einstieg: Verfügbarkeit und nächster Schritt | teilweise | JOB 3144: `KlaraPathTeaser` sagt „Verfügbar ist das noch nicht", trägt das Etikett „Demnächst" und bietet den Link zur Webhilfe (`klara.path.helpLink`). Geprüft in `tests/klara-webhilfe-schmal/word-weg-naechster-schritt.test.tsx` und in der Chromium-Matrix. | Der Menüeintrag heißt weiter „Klara in Word", ohne „Vorschau" (`start.menu.klara`). **Quellenwiderspruch:** Die Fläche sagt „noch nicht verfügbar", das Repo führt aber Sideload- und Host-Abnahmeanleitungen für das Add-in (`docs/word-addin/`, `docs/operations/word-*-hostabnahme/`). Ob die Fläche reine Vorschau bleiben soll, ist eine Produktentscheidung. P-UX-16 schließt einen Word-Auftrag aus. |
| **N-0086** Hilfe findet den Dateiimport | geliefert | JOB 3468 `598a1270`: Kapitel `fileimport` mit Link und geltenden Upload-Grenzen. `tests/review26-hilfe-import/*`. | Die Live-Gegenprüfung ist laut Quelle offen. |
| **P-HILFE-ANWENDERSPRACHE** | geliefert | JOB 4067 `7bbe1185`, JOB 4071 `17fe4db2`. `tests/hilfe-anwendersprache/*`, `tests/hilfe-altkapitel-anwendersprache/*`. | Die neue FAQ-Sammlung verlängert die Seite. Sie steht deshalb unter den Kapiteln und zeigt nur die Fragen, die Antworten sind zugeklappt. Die verbotenen Begriffe des Wortwahl-Wächters kommen in `faqContent.ts` nicht vor (Quelltextsuche). Die Merkmalspillen unter den Kapiteln zeigen weiter Fachwörter (`helpTopics.ts`, Kopf JOB 4071) — so bekannt. |
| **P-ISO-HILFE** | geliefert | JOB 3338 `552b7ae6`: `lib/helpTopics.iso.ts` (Alias „2701", DE/EN), `tests/iso-hilfe/*` inklusive `zusagen.ts` (kein Konformitätsversprechen). | — |
| **P-UX-16** | geliefert | JOB 3144 `ee189360`. | wie N-0033/N-0042. |
| **P-UX-16b**, **UX-16b-R2** | geliefert | JOB 3269 `8fb2b8a6` (1.0.0-beta.1.220): Browsermatrix `/start` und `/import`, DE/EN, 320/390/Desktop, Tab/Shift+Tab, Reload in `klara-hilfe-chromium.test.ts`. | **Quellenwiderspruch:** P-UX-16b nennt den zweiten Aufrufer `/kapital`. Im Code trägt `/kapital` keinen `KlaraPathTeaser`, der zweite Aufrufer ist `/import` (`pages/Stufe2.tsx:1285`). UX-16b-R2 nennt richtig `/import`. |
| **P-DOK1** | geliefert | FAQ-Dokument: `docs/team2-austausch/HILFE_LIEFERUNG-3a_FAQ-ANTWORTEN_2026-07-05.md:112/115/143` nennen die Rollenausnahme (JOB 3263 `d172cefc`). `OFFEN.md` C4: in diesem Lauf nachgeführt. | — |
| **DOK1-R** | geliefert | JOB 3263 `d172cefc`: `tests/dok1-export-wahrheit/faq-export-rollenausnahme.test.ts` unterscheidet Lesen und Exportieren (`action` „read" bzw. „export"). Der `/hilfe`-Anschluss wird über `faq-anzeigeweg.test.tsx` am Klara-Weg belegt. | Mit diesem Lauf stehen die FAQ-Antworten **zusätzlich** auf `/hilfe` (belegt in `hilfe-faq-sammlung-mounted.test.tsx` S2). |
| **TEST-A18** Verständlichkeit, Hilfe, Fehlerrückmeldungen | teilweise | Interne Begriffe von `/hilfe` entfernt (JOB 4022/4067/4071), Wächter `tests/hilfe-anwendersprache/wortwahl-waechter.test.ts`. | Außerhalb von `/hilfe` stehen in ?-Hilfen weiter „Peer-Prüfung"/„Peer-Bewertung" (`woerterbuch/de.ts` u. a. bei `:3792`, `:6548`, `:6554`). Ob das unter den Befund „Peers" fällt, ist **nicht entschieden**. Eine erneute Gesamtprüfung A18 liegt nicht vor. |
| **SEITENHILFE-LÜCKEN** | geliefert | JOB 3741 `f32b14a4`, JOB 3980 `2cd83543`. `tests/seitenhilfe-luecken/*`. | — |

## Abgrenzung zu anderen Aufträgen

- `aufnahme:20260922:gesamt-klara-assistenz` (`docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md`):
  Bausteine KA1–KA8 und Word-Weg. Hier nicht bearbeitet.
- Wissensnetz/R-1983 („kuratierte Sicht") ist ausgeliefert (`976142be`) und wird hier nur als Beleg für
  R-0443 genannt.
- Wortzerlegung und Synonyme (`dab4e20c`) sind ein eigener Auftrag. Hier nur der Beleg für R-1031.
- Word-Add-in, Sideload und Host-Abnahme: ausdrücklich kein Gegenstand (P-UX-16 „kein Word-Auftrag").

## Fehlende Mittel und Belege

- Berater-Lieferung 3b (Bibliotheksartikel, EN-FAQ) und Lieferung 4 (Assistenten-Konzept) fehlen.
  Daran hängen R-0890, R-1038 und die englische FAQ.
- Pedis Synonymtabelle (R-1031) ist im Repo nicht auffindbar.
- Ein Live-Abnahmebeleg für N-0033, N-0042, N-0086 nach Behebung fehlt; die Quelle meldet die
  Gegenprüfung als offen.
- Der Lieferbeleg dieses Laufs (Fassung, Livestand) entsteht erst nach Veröffentlichung.
