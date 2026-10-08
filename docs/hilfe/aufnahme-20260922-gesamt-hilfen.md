# Aufnahme 20260922 · Gesamt-Hilfen — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-hilfen`, Revision 1, Lauf 1, Nacharbeit 3.
Abgeglichen am 08.10.2026 gegen den Stand **1.0.0-beta.1.741** (Basis `6f9e961b`); Nacharbeit 3 am
Kandidaten `28f3bc69` (1.0.0-beta.1.744), Nacharbeit 5 am Kandidaten `4905373d` (Befunde Bens:
Artikel im Suchraum, Funktionsabdeckung gegen die Quellengliederung, eigene Erklärseite R-0443).
Nacharbeit 6 am Kandidaten `33aad029`: Klara lädt die Bibliotheksartikel erst beim Öffnen nach
(`lib/klaraBibliothek.ts`), weil sie statisch eingebunden den Eintritt über den Deckel aus R-0801
hoben (gemessen 1403861 B gegen 1360000 B); im Diktieren-Artikel (EN) ersetzt „goes“ das Wort
„flows“ (Wortwahlregel).
Nacharbeit 14 am Kandidaten `f8441b15`: Der Eintritt stand 3567 B über dem Deckel aus R-0801. Klara
lädt die Elementbeispiele (`lib/klaraBeispiele.ts`, R-0941) jetzt wie die Bibliothek erst beim
Öffnen nach.
Nacharbeit 13 am Kandidaten `df501851` (Befunde Bens): Die Erklärungen stehen an der Stelle. Die
Wissensobjekt-Handlungen und „Noch gültig“ melden ihre Erklärung an, ebenso alle gezeichneten
Register-Abschnitte. Die Löschhilfe nennt den Papierkorb, und Klara führt jedes Prüf-Thema an seine
Fläche. Drei Fehlaussagen aus Nacharbeit 10 sind berichtigt (Abschnitt „Zuordnung …“).
Nacharbeit 10 am Kandidaten `1a6d1d1a` (Befund Bens): Die vorhandenen Hilfen sind den heutigen
Feldern und Abschnitten zugeordnet, eingeteilt in erledigt, bewusst ersetzt, fehlend und entfallen
(Abschnitt „Zuordnung der Hilfen zu Feldern und Abschnitten“).
Nacharbeit 7 am Kandidaten `4405cfb3` (Befunde Bens):
- **R-0943:** Klaras KI-Grundlage nimmt jetzt auch Bibliotheksauszüge (je Artikelteil einer,
  `bibliothekAuszuege`). Höchstens drei kommen in die zwölf Schnipsel (`klaraGrundlage`). Sie füllen
  freie Plätze oder verdrängen nur einen Eintrag, der weniger Suchwörter trifft, und nie eine
  FAQ-Antwort. Bei „Leimzeit“ geht die Frage damit mit dem passenden Auszug an das Modell.
- **R-0935:** Jeder Funktionsartikel auf `/hilfe` führt mit „Bereich öffnen“ in seinen Bereich, mit
  derselben Rollenprüfung wie die FAQ (`routePathAllows`, nie auf `/hilfe`).
- **R-0890:** B5-6 „Eine Antwort weitergeben“ hat den Funktionsartikel `antwort-weitergeben`
  (abgeglichen an `pages/Ask.tsx`: „Kopieren“, „Als Markdown“, „Drucken / PDF“). Die übrigen vier
  Auslassungen tragen eine Art, die der Test am Bestand nachmisst: B2-9 Rollenvertrag, B10-1/B10-4
  keine Route dieses Namens, B10-3 fester fünfter Teil jedes Artikels. Ein Begründungstext allein
  reicht nicht mehr.

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
| **R-0443** Seite „So arbeitet Klarwerk" | geliefert in Nacharbeit 5 | Eigene Seite `/so-arbeitet-klarwerk` (`pages/Arbeitsweise.tsx`, Texte `texte/arbeitsweise.ts`, DE/EN/NL) für alle angemeldeten Rollen: Aufbau des Wissensnetzes (Knoten, Themen, gesetzte Fachbeziehungen, Stand) und Arbeitsweg (Erfassen → Prüfen → Nutzen → Aktuell halten → Lücken schließen) mit rollengerechtem Weg in jeden Bereich. Sie verwendet die gelieferte Vorführsicht `SoArbeitetKlarwerk` (`pages/Stufe2.tsx`, R-1983, `976142be`) mit den Daten von `/api/graph` wieder. Erreichbar über den Einstieg oben auf `/hilfe`. | Kein eigener Menüpunkt (Erklärseite wie `/einstieg/:thema`). Die Bauteil-Zählung in `tests/app/mega84-…` ist dafür um eins nachgeführt (gerechnet, nicht gemessen). |
| **R-0888** ?-Hilfen an Feldern und Abschnitten | geliefert für Katalog und Register (Nacharbeit 13); Form bewusst ersetzt | Erfassen `lib/captureHelp.ts` (23), Prüfbereich `lib/reviewHelp.ts` (26) (SCRUM-404/406/407); seit Nacharbeit 3 je mit konkretem Beispiel in Klara. Das „?“ neben dem Feld ist seit Pedis Entscheidung vom 04.09. (JOB 3060, `components/HelpTip.tsx:5-10`) durch das „?“-Menü der Fläche bzw. die Seitenhilfe im Zahnrad ersetzt. Zuordnung je Feld und Abschnitt: Abschnitt „Zuordnung der Hilfen zu Feldern und Abschnitten“ (Nacharbeit 10). | Seit Nacharbeit 13 stehen die Erklärungen der Wissensobjekt-Handlungen und von „Noch gültig“ an der Stelle. Die Löschhilfe ist auf den Papierkorb berichtigt. Von den 79 Register-Überschriften haben alle 62 noch gezeichneten eine eigene Erklärung; 17 sind entfallen. Offen: Felder und Überschriften nach dem 05.07. außerhalb der Kataloge sind nicht erhoben (kein Generator im Repo). |
| **R-0890** Bibliothek nach festem Bauplan | geliefert (Nacharbeit 3 und 5) | `lib/hilfeBibliothek.ts`, fünf Teile nach dem Bauplan aus Lieferung 1 (`docs/qm/HILFE_LIEFERUNG-1_GLIEDERUNG-UND-FAQ_2026-07-04.md:14-20`), DE/EN/NL: 22 Bereichsartikel (unter jeder Kapitelkarte auf `/hilfe`) und **21 Funktionsartikel** (Nacharbeit 5; Nacharbeit 7: „Eine Antwort weitergeben“, Abschnitt „Funktionen ausführlich“, gegliedert nach den Teilen der Quelle) — darunter eigene Artikel für Diktieren, das geführte Interview und die Wissensarten. `GLIEDERUNG` ordnet jeden der 70 Punkte B0-1 … B10-4 einem Artikel zu; je Zuordnung muss ein Stichwort in allen drei Sprachen im Artikel stehen (`tests/hilfe-bibliothek/bibliothek-bauplan.test.tsx` G1–G4, Punkte aus dem Quelldokument gelesen). Alle Artikel sind durchsuchbar — auf `/hilfe` und in Klaras Suchfeld (S1–S3, `tests/hilfe-elementbeispiel/…` E5). | Vier Punkte ohne Artikel, je mit nachgemessener Art (seit Nacharbeit 7; B5-6 hat jetzt seinen Artikel): B2-9 (Prüfen als Experte — laut Rollenvertrag kein Prüfrecht), B10-1 (Glossar — keine solche Fläche), B10-3 (Missverständnisse — fester fünfter Teil jedes Artikels), B10-4 (Schnellwege „Ziel → Klickweg“ — keine solche Sammlung; die Schnellwahl ⌘K springt nur zu Seiten und Einträgen). Glossar und Schnellwege sind Sammlungen der Quelle, keine Funktionen der Anwendung; ob sie als eigene Hilfeinhalte gebaut werden sollen, ist eine offene Produktentscheidung. Zusammengefasste Funktionsartikel decken mehrere Punkte ab, wenn das Stichwort jedes Punkts darin steht. Die Wissensarten folgen der heutigen Auswahl (`ktype.*`: Intuition, Best Practice, Lernkurve, Technik, Negativwissen); die ältere Kurzhilfe `chelp.knowledgeType` nennt andere Arten — Abweichung im Bestand, nicht in diesem Auftrag geändert. Eine Fachsichtung durch Menschen steht aus. |
| **R-0924** Fragenkatalog je Seite/Funktion mit Antworten | geliefert | Katalog: Lieferung 1 (C). Antworten: `lib/faqContent.ts` (77, DE, Klaras Wissensbasis). Auf `/hilfe`: Lesefassung `lib/hilfeFaq.ts`, 36 Fragen aus allen zwölf Bereichen, DE/EN/NL, Anwendersprache. | Nicht auf `/hilfe` übernommen sind 41 Fragen (Liste unten), weil ihre Antwort Rollenmechanik erklärt oder eine Fläche bzw. Beschriftung nennt, die am heutigen Quelltext nicht mehr so besteht oder hier nicht nachgeprüft wurde. Klara führt alle 77 auf Deutsch weiter. |
| **R-0935** eingebaute Hilfe: Themenkarten, Suche, zwei Sprachen, Direktsprung, FAQ, Startführung | geliefert | Themenkarten mit Suche und „Bereich öffnen": `pages/Help.tsx`, `lib/helpTopics.ts` (Texte DE/EN/NL). Startführung: Einstiegsführung auf `/hilfe` (JOB 4022 `db9aa4d2`). FAQ-Sammlung in DE/EN/NL (Nacharbeit 3). Nacharbeit 5: die Suche durchsucht auch die Bibliotheksartikel (Feld `suchtext` in `filterHelpTopics`); ein Treffer im Artikel öffnet ihn. | Klara findet die Artikel im Suchfeld und im Zeige-Modus über die Beschriftung. Seit Nacharbeit 7 gehen höchstens drei Auszüge auch in die zwölf KI-Schnipsel, ohne eine FAQ-Antwort zu verdrängen (`klaraGrundlage`). Jeder Funktionsartikel auf `/hilfe` führt rollengeprüft in seinen Bereich. |
| **R-0941** Element antippen, Klara erklärt, vorlesen, Beispiel | geliefert in Nacharbeit 3 | Zeige-Modus und Vorlesen: `components/KlaraAssistant.tsx` (SCRUM-403/404 `b543574c`). Beispiel: `lib/klaraBeispiele.ts` für alle 49 Elementerklärungen, angezeigt und mit vorgelesen. | Seiten- und Abschnittserklärungen (`page:*`, `sec:*`) tragen kein Beispiel. **Quellenwiderspruch:** Laut Quelle führt Landkarte v3 die „Sprachausgabe der Antworten" (J8) als gestrichen, das Vorlesen ist aber im Code vorhanden. |
| **R-0942** Ausklappfläche statt sperrendes Fenster | geliefert in diesem Lauf | s. oben. Kleine Bildschirme: N-0033 (JOB 3144 `ee189360`, `w-[min(340px,calc(100vw-2.5rem))]`), Chromium-Matrix `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts`. | Den in der Quelle verlangten Gegentest „markerlose Tastatur-Fokusfalle" gibt es nicht. Die Fläche hat bewusst **keine** Fokusfalle: Tab verlässt sie, weil sie nicht sperrt. |
| **R-0943** Assistent erklärt Seite, Felder, markierte Begriffe, ehrliche Lücke | geliefert | `KlaraAssistant.tsx`: Seite (`pageEntryFor`), Feld (`data-help`-Fokus), Markierung (`explainSelection`). Antworten aus Registry und FAQ, seit Nacharbeit 7 auch aus Auszügen der Hilfebibliothek (`klaraGrundlage`, FAQ-Antworten werden nicht verdrängt). Ohne Grundlage keine KI-Antwort (`aiNoGrounding`). Prüfung: `tests/app/f0304-klara-assistenzflaeche.test.tsx`. | — |
| **R-0966** Kurzanleitung in fünf Minuten | geliefert (Dokument) | `docs/onboarding/user-quickstart.md`: Was ist Klarwerk, In 5 Minuten starten, Arbeitskreis & wer was darf, ehrliche Grenzen. | Ein Sichtungs- oder Abnahmebeleg fehlt weiterhin. |
| **R-1017** Erklärung an der Stelle des Stockens | teilweise | ?-Hilfen am Element (R-0888), Seitenhilfe je Seite im Zahnrad (SEITENHILFE-LÜCKEN), Klara mit Feldkontext. | Die in OFFEN.md U4/mega92 Block E verlangte Erhebung „welche Flächen tragen eine Hilfe“ liegt seit Nacharbeit 10 auch für Felder und Abschnitte vor (Abschnitt „Zuordnung …“, Gegenprobe `tests/hilfe-zuordnung/hilfen-an-der-stelle.test.ts`). Seit Nacharbeit 13 sind die dort als „fehlend“ geführten Stellen an der Fläche erklärt (Gegenproben Z3, Z7, Z8). |
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

## Zuordnung der Hilfen zu Feldern und Abschnitten (R-0888 / R-1017, Nacharbeit 10 und 13)

Erhoben am Quelltext des Arbeitsbaums am 08.10.2026, ohne eigenen Prüflauf. Die Aussagen zu den
dichten Flächen und zu den entfallenen Überschriften hält
`tests/hilfe-zuordnung/hilfen-an-der-stelle.test.ts` (Z1–Z6) am Quelltext fest.

**Die entschiedene Form.** Pedi hat am 04.09. die Sprechblase neben dem Feld abgelehnt: „Erklärung
gehört hinter Zahnrad/Profil, nicht ins Sichtfeld“. Belegt ist das in `components/HelpTip.tsx:5-10`
(JOB 3060) und im Wächter `tests/seitenhilfe-luecken/erster-weg-hat-seitenhilfe.test.tsx:21-23`;
der Originalwortlaut selbst liegt nicht im Repo. Diese Entscheidung ist jünger als die Quelle zu
R-0888 (03.07.). Das „?“ am Element ist deshalb **bewusst ersetzt**. Die Erklärung erreicht man
heute an derselben Fläche auf drei Wegen:
(a) im „?“-Menü der Fläche (Erfassen-Blatt, Prüfkopf);
(b) in der Seitenhilfe im Zahnrad: Jeder `HelpTip` und jede Kartenhilfe (`Detailkarte` mit `hilfe`)
meldet sich dort an;
(c) über Klara, die beim Antippen eines Elements mit Anker (`data-help`) dessen Erklärung samt
Beispiel zeigt.
Erledigt heißt unten: Das Element oder der Abschnitt hat auf einem dieser Wege eine eigene
Erklärung.

### Die dichten Flächen je Element (R-0888: „Prüfbereich und Erfassen“)

| Fläche | Hilfequelle | Weg an der Stelle | Stand |
|---|---|---|---|
| Erfassen (`/erfassen`, `/erfassen/vordertuer`, `/erfassen/neu` → `components/erfassen/Blatt.tsx`) | alle 23 `chelp.*` + 9 eigene Themen (Bilder, Vertraulichkeit, Kategorie, Validierungen, Prüfer, Kernaussage, Hilfen, Dateisuche, Dateisprache) + 5 KI-Werksaktionen = `BLATT_HILFE_THEMEN` | „?“-Werkzeug des Blattes (`Blatt.tsx:3007`, `blatt-hilfe-<id>`) und Seitenhilfe (`Blatt.tsx:2473`); „Entwurf speichern“/„Einreichen“ zusätzlich am Knopf (`KnopfUnterschied.tsx`); Klara-Anker `cap:tellRaw`, `cap:interview`, `cap:knowledgeType`, `cap:tagsField` im Arbeitsraum | erledigt (Form bewusst ersetzt) · Z1, Z4 |
| Prüfbereich (`/validierung`) | 11 `vhelp.*`: originFilter, reviewFocus, filters, mineOnly, signals, approve, query, reject, feedbackForm, assign, markTrue | „?“-Menü im Prüfkopf (`Validation.tsx:1520`; SCRUM-406: „an EINEM Ort statt als sieben ?-Symbole“); Klara-Anker `rev:filters`, `rev:reviewFocus`, `rev:originFilter`, `rev:mineOnly` | erledigt (Form bewusst ersetzt) · Z2, Z4 |
| Konflikte (`/konflikte`) | 3 `vhelp.*`: conflictEscalate, conflictSecondOpinion, conflictResolve | „?“-Menü im Prüfkopf (`Conflicts.tsx:214`) | erledigt · Z2 |
| Wissensobjekt (`/wissen/:id` → `BibliothekLesen`, „Mehr“-Blatt `MehrAbschnitte`) | 11 `vhelp.*`: reportConflict, conflictForm, sourcesLevel2, sourceFields, sourceAdd, sourceSearch, contribution, helpful, validity, transfer, deleteKo | seit Nacharbeit 13 in der Seitenhilfe, angemeldet an der Handlung und unter ihrer Bedingung (Konflikt: `canReview`; Quelle beschreiben/hinzufügen: `canEdit`; extern suchen: `canEdit` + Freigabestufe; Autor übertragen: `canTransfer`; Löschen: `darfLoeschen`); „Hat geholfen“ und „Löschen“ neben dem „…“-Menü der Leseansicht, weil das Menü erst beim Öffnen gezeichnet wird | erledigt · Z3 |
| Lebenszyklus, Reiter „Erneut“ (`/lebenszyklus`) | `vhelp.stillValid` | seit Nacharbeit 13 im „?“-Menü des Reiters (`Lifecycle.tsx`), neben dem Knopf „Noch gültig → neue Version“ (`lcy.stillValid`) | erledigt · Z3 |

**Berichtigung zu Nacharbeit 10:**
- **„Noch gültig“ ist nicht entfallen.** Der Knopf steht im Reiter „Erneut“
  (`pages/Lifecycle.tsx:336-344`). Er ruft `action: "revalidate"` auf, bestätigt die Gültigkeit und
  setzt die Frist neu. Dieselbe Serverhandlung heißt in der Leseansicht „Re-Validierung starten“
  (`BibliothekLesen.tsx`, Kommentar dort). Die Erklärung steht deshalb dort, wo der Knopf
  „Noch gültig“ heißt, und wird nicht der Bibliotheks-Beschriftung zugeordnet. Klara führt das Thema
  nach `/lebenszyklus` (`REVIEW_HELP_ROUTE`, `lib/reviewHelp.ts`).
- **Die Löschhilfe ist berichtigt.** Sie stand unter `vhelp.deleteKo.body` und sagte „endgültig“.
  Jetzt steht sie unter `loeschhilfe.deleteKo.body` (`texte/loeschhilfe.ts`, DE/EN/NL) und nennt
  Papierkorb, 30 Tage (`TRASH_RETENTION_DAYS`, `services/knowledge-object/src/service.ts:220`),
  Wiederherstellung durch den Admin und die sofortige Löschung von Demodaten. Die Wächter, die den
  toten Stamm „papierkorb“ führten, sind nachgeführt (`tests/help/klara-registry.test.ts`,
  `tests/klara-ranking-sprachen/ranking-sprachweise.test.ts`).
- **Klaras Ziele:** Die Prüf-Themen führen jetzt an ihre Fläche: Handlungen am Wissensobjekt nach
  `/bibliothek`, Konfliktwege nach `/konflikte`, „Noch gültig“ nach `/lebenszyklus`. Die übrigen
  bleiben bei `/validierung`.

### Die 79 Überschriften des Hilfe-Registers (Stand 05.07.) — heute

Quelle: `docs/hilfe/HILFE-REGISTER.md` Teil 1. Für jeden Schlüssel wurde geprüft, ob eine Fläche ihn
heute zeichnet und ob der Abschnitt auf einem der Wege (a)–(c) eine eigene Erklärung hat. Stand
Nacharbeit 13: Die vorhandenen Abschnittserklärungen (`shelp.*`, Berater-Lieferung 05.07.) waren bis
dahin nur in Klaras Suche zu finden (`KLARA_SECTIONS`, `lib/klaraRegistry.ts`). Jetzt meldet jede
gezeichnete Überschrift ihre Erklärung bei der Seitenhilfe an (`HelpTip` unter der Überschrift;
Gegenprobe Z7).

| Seite | erledigt (eigene Hilfe) | fehlend | entfallen |
|---|---|---|---|
| Verwaltung (15) | alle 15. Seit dem 05.07. neu belegt: `adm.seedTitle` (Kartenhilfe, solange Demodaten ladbar), `adm.createTitle`, `adm.auditTitle` | — | — |
| Analytics (6) | `ana.exec.title`, `health.title`, `ana.impact`, `ana.audit`; seit NA13 `ana.byType`, `ana.weekly` | — | — |
| Fragen (2) | `ask.sources` (seit 05.07. `ask.help.sources`); seit NA13 `ask.steps` | — | — |
| Erfassen (5) | `capture.raw` (`chelp.tellRaw`), `capture.readyTitle` ×2 (`chelp.readiness`); seit NA13 `capture.resumeTitle` (berichtigt, s. u.) und `ext.title` | — | — |
| Externes Wissen (1) | seit NA13 `extpage.resultsTitle` | — | — |
| Wissensobjekt (18) | `ko.sourcesTitle`: der Abschnitt „Quellen“ trägt seit NA13 `vhelp.sourcesLevel2` | — | 17: die 14 aus dem Umbau auf die Leseansicht (`ko.conflictTitle`, `ko.helpfulTitle`, `ko.sourceTitle`, `ko.provenance`, `ko.couple.title`, `ext.validity.title`, `ko.lineageTitle`, `ko.relatedTitle`, `ko.history`, `ko.evidenceTitle`, `ko.snapshotsTitle`, `ko.comments`, `ko.attachments`, `ext.title`) und `ko.statement`, `ko.conditions`, `ko.measures`: sie stehen nur noch in `components/ko/KoRead.tsx`, und den Baustein `KoReadView` montiert keine Fläche (Z6). Berichtigt: NA10 führte diese drei als „fehlend“. |
| Lebenszyklus (3) | alle 3. Das „?“-Menü des Reiters „Erneut“ erklärte sie schon vor NA13 (`lcy.banner`, Lernpfad, `lcy.assetHint`). Berichtigt: NA10 führte sie als „fehlend“, weil dort kein `HelpTip` steht. | — | — |
| Risiko (4) | alle 4 | — | — |
| Stufe 2 (25; Verwaltung + Schalter) | seit NA13 alle 25 (Output, Import einschließlich `imp.uploadTitle` in `ImportJsonUpload.tsx`, Management, QM) | — | — |
| **Summe 79** | **62** | **0** | **17** |

Berichtigt beim Einbinden:
- `shelp.capture.resumeTitle` sagte „nichts davon sehen die Prüfer, solange du es nicht einreichst“.
  Seit dem gemeinsamen Entwurfspool (R-2099) kann ein Entwurf bewusst geteilt werden. An der Fläche
  steht deshalb `abschnittshilfe.capture.resumeTitle` (`texte/abschnittshilfe.ts`, DE/EN/NL).
  Klaras Sektionseintrag `sec:capture.resumeTitle` liest weiterhin den alten Schlüssel (Rest).

Grenzen dieser Erhebung:
- **Am Quelltext, nicht live:** Die Spalte „erledigt“ beruht auf der Lesung des Quelltexts (Aufruf
  von `HelpTip`, „?“-Menü bzw. Kartenhilfe am Abschnitt). Gemounted geprüft sind davon die Seiten aus
  SEITENHILFE-LÜCKEN (JOB 3741/3980) und die Verwaltungskarten (`tests/seitenhilfe-admin/`). Dass
  eine Anmeldung per `HelpTip` im Zahnrad erscheint, belegen diese Wächter für den Baustein selbst.
- **Inhalt der Texte:** Die eingebundenen `shelp.*`- und `vhelp.*`-Texte habe ich gegen die heutige
  Fläche gelesen. Berichtigt habe ich nur die drei oben genannten. Kleinere Unschärfen bleiben:
  `vhelp.conflictForm` nennt „drei Angaben“, das Formular verlangt heute zusätzlich die Arbeitsart.
  `vhelp.sourcesLevel2` und `vhelp.stillValid` sprechen von „Peer“-Prüfung (TEST-A18, unentschieden).
  Der Knopf heißt „Noch gültig → neue Version“, obwohl er keine neue Version anlegt (`Lifecycle.tsx:11-16`
  benennt das selbst). Diese Beschriftung gehört nicht zu den Hilfetexten und ist hier nicht geändert.
- **Seitenebene:** Jeder Menüpunkt hat einen Erklärsatz im Zahnrad
  (`tests/seitenhilfe-navkapitel/jeder-menuepunkt-hat-einen-erklaersatz.test.ts`).
- **„Fehlend“ heißt:** keine eigene Erklärung für diesen Abschnitt. Es heißt nicht, dass die Seite
  ohne Hilfe ist.
- **Nicht erhoben:** Überschriften und Felder, die nach dem 05.07. dazugekommen sind und in keinem
  der beiden Kataloge stehen. Eine Vollerhebung bräuchte den Generator des Registers, und der liegt
  nicht im Repo.

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
- R-0888/R-1017: Die Zuordnung je Feld und Abschnitt liegt seit Nacharbeit 10 vor (Abschnitt
  „Zuordnung …“). Nicht erhoben sind Felder und Überschriften, die weder im Hilfe-Register vom 05.07.
  noch in den beiden Hilfekatalogen stehen. Der Generator des Registers liegt nicht im Repo, eine
  neue Vollerhebung aller Überschriften fehlt deshalb.
- Ein Live-Abnahmebeleg für N-0033, N-0042, N-0086 nach Behebung fehlt; die Quelle meldet die
  Gegenprüfung als offen.
- Der Lieferbeleg dieses Laufs (Fassung, Livestand) entsteht erst nach Veröffentlichung.
