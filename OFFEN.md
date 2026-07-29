# OFFEN — das Gedächtnis des Projekts

**Stand: 29.07.2026 · Basis `93c6bd9` · gepflegt vom Kopf bei jeder Zustandsänderung**

Diese Datei liegt im Repository, nicht in einem Chat-Gedächtnis und nicht in einem Ordner, den sich jemand ausgedacht hat. Sie wandert mit jedem Klon mit, jeder neue Kopf sieht sie, und sie überlebt jeden Fensterwechsel.

## Die eine Regel

**Was hier nicht steht, existiert nicht.** Kein Auftrag, keine Idee, kein Wunsch, keine offene Entscheidung. Nicht als Drohung — als Tatsache: Was hier nicht steht, wird vergessen. Der Beleg dafür ist die Sichtung vom 28.07., die zwei fertig geschriebene Aufträge, vier unbeantwortete Vorschläge und einen ganzen Epos wiedergefunden hat, die alle irgendwo lagen, nur nicht an einer Stelle, die jemand liest.

## Wie eine Zeile gelesen wird

**Zustand** — `ENTSCHEIDUNG` liegt bei Pedi und blockiert etwas · `OFFEN` ist entschieden und wartet auf einen Auftrag · `BEAUFTRAGT` läuft gerade · `ERLEDIGT` · `VERWORFEN` mit Begründung.

**Anker** — wann es drankommt. **Niemals ein Datum.** Datums-Anker sind der Grund, warum fünf Vorgänge und zwei Konzepte auf „nach VIP-2" warten, seit es VIP-2 nicht mehr gibt. Erlaubt sind Ereignisse, die wir selbst herbeiführen: `SOFORT`, `VOR-VORTEST`, `MIT-SHIP3`, `NACH-SHIP3`, `MIT-SHIP4`, `MIT-ZUGRIFFSSCHUTZ`, `MIT-DESIGN`, `MIT-JAHRESRING`, `MIT-GROSSKUNDE`, `MIT-ADOPTION`.

**Kennung** — bleibt stabil, auch über Aufträge und Ship-Runden hinweg. Die ausführliche Begründung zu jeder Kennung steht in der Entscheidungsgrundlage vom 28.07. (Artefakt `klarwerk-entscheidungsgrundlage`).

---

## 1 — Entscheidungen, die bei Pedi liegen

Sortiert nach Alter. **Die oberste ist die älteste und wird bei jedem Kassensturz genannt, bis sie beantwortet ist.**

| Kennung | gefragt seit | Sache | blockiert |
|---|---|---|---|
| E10 | 27.07. | Wo landen Zugangsdaten: Umgebungsvariable · Schlüsselbund · verschlüsselte Ablage | Block C des Import-Auftrags; bis dahin nimmt kein Feld ein Geheimnis entgegen |
| E3 | 26.07. | Swap auf beiden Maschinen einrichten — kostet nichts, ist nicht gemacht | nichts, aber ein Speicherausschlag killt sonst den größten Prozess auf der Produktion |
| E5 | 26.07. | Rolle `klarwerk` und Schema in der Jahresring-Datenbank | der ganze Jahresring |
| E9 | 26.07. | Papierkorb vor dem Vortest leeren (72 % des Bestands) | erledigt sich mit dem Bestandsreset, wenn der den Papierkorb einschließt |
| L1 | 26.07. | 120 undokumentierte Anhänge (ATT-000061–000180) — Begleittabellen nachfordern | Jahresring-Import |
| E12 | 28.07. | Die vier Schnitte sind durch, 86 von 99 Vorgängen stehen in keinem — neu schneiden | die Auftragsplanung nach Ship 3 |
| J1–J6 | 28.07. | Dateileichen endgültig löschen: 3 × `_to_delete` (31 Einträge), ~40 Dubletten, 5 Board-Sicherungen, 6 tote Artefakte | nichts, aber sie kosten Aufmerksamkeit |

---

## 2 — Beauftragt, läuft gerade

| Kennung | Zustand | Sache |
|---|---|---|
| B3 | OFFEN | MIT-SHIP4 | **SCRUM-557** — Smoke-Kalibrierung erwartet den Leerzustand auch dort, wo der `@modell`-Fall das Board füllt. Auflage zum bedingten GO von Ship 3; reist in der nächsten Scheibe mit. Bis dahin meldet `npm run smoke:ui` diesen einen Fall bauartbedingt rot |
| B2 | ERLEDIGT | mega49 — der Browser-Beleg hing an einer Datenlage (Leerzustands-Knopf aus `emptyStateActions.ts`). Nur Prüfwerkzeug, Produktcode nachgerechnet unberührt. ben sammel47: **GRÜN**, Inhalts-SHA `7df464af…6081` vom Kopf nachgerechnet. Wartet auf Handlauf 1 und Ship 3 |
| B1 | ERLEDIGT | mega48 — Modalgrenze für die ganze App. ben sammel46: **GRÜN ohne Einschränkung**, Inhalts-SHA `e6901c4a…9d77` vom Kopf nachgerechnet. Wartet auf Handlauf 1 und Ship 3 |

Danach: Kopf-Gegenproben → ben sammel46 → **Ship 3**.

---

## 3 — Vor dem Vortest

Fester Termin: **Freitag 14:00**, Natascha, sieben Aufgaben, kein Vorwissen.

| Kennung | Zustand | Anker | Sache |
|---|---|---|---|
| A7 | ERLEDIGT | — | Rolle `Experte` — von Pedi entschieden |
| A14 | ERLEDIGT | — | Lars-Paket gegenstandslos |
| A1 | OFFEN | VOR-VORTEST | Interviewleitfaden gegenlesen — existiert seit 23.07. vollständig, nicht neu schreiben |
| A2 | OFFEN | VOR-VORTEST | „Lieferanten" muss im neuen Testbestand vorkommen, sonst scheitert Aufgabe 4 an einer unlösbaren Aufgabe |
| A3 | OFFEN | VOR-VORTEST | Sichtbarer Knopf „Datei auswählen" — **Kopf prüft am Code, ob mega38–47 es geschlossen haben** |
| A4 | OFFEN | VOR-VORTEST | Zur Antwort scrollen + Ladezustand — **Kopf prüft am Code** |
| A5 | OFFEN | VOR-VORTEST | Ein Urteil je Antwort statt zwei widersprechenden — **Kopf prüft am Code** |
| A6 | OFFEN | VOR-VORTEST | Aufgabenkarte abgleichen — nennt noch „Anfang August" (VIP-2, abgesagt) |
| A8 | OFFEN | VOR-VORTEST | Klara-Manifest sideloaden |
| A9 | OFFEN | VOR-VORTEST | Testordner mit `Arbeitsanweisung Hallenkran.docx` auf ihrem Schreibtisch |
| A10 | OFFEN | VOR-VORTEST | Erstnutzerlauf auf ihrem Konto wiederholen — der bisherige lief als Admin |
| A12 | OFFEN | VOR-VORTEST | Zugangsdaten an Natascha |
| G3b | OFFEN | VOR-VORTEST | Beispieldaten nachrüsten: **verschiedene Vertraulichkeitsstufen und Anhänge**, sonst lässt sich der Zugriffsschutz nicht vorführen |
| E6 | OFFEN | VOR-VORTEST | Confluence-Testseiten anlegen — verschachtelt, in Untergruppen; der heutige Aufbau reicht zum Testen nicht |
| D4 | OFFEN | SOFORT | Artefakt-Prompt neu formulieren (die letzte Fassung war zu schwach) — heute Abend |
| D5 | OFFEN | SOFORT | Klara-Zweitmeinung einholen — Prompt liegt fertig |
| A17 | OFFEN | NACH-SHIP3 | Der Modal-Sammler ist ein statischer Musterwächter, kein AST-Wächter: Alias-Nutzung, `createElement`, Spread-gesetztes `aria-modal` und Modalität ohne die Zeichenfolge gehen vorbei (ben sammel46, Anmerkung 1/2 — färbt nicht). Gehört mit A16 zusammen |
| A18 | OFFEN | NACH-SHIP3 | Die Browsermessungen prüfen Bedienbarkeit, Fokus und `inert`, nicht die Sprachausgabe. Ein manueller VoiceOver-/NVDA-Kurzlauf würde den Wächter verbessern (ben sammel46, Anmerkung 4 — keine Ship-Auflage) |
| A19 | OFFEN | NACH-SHIP3 | Firefox und WebKit liefen einmalig grün, im Tor läuft nur Chromium — keine dauerhafte Drei-Engine-Garantie (ben sammel46, Anmerkung 3) |
| A15 | OFFEN | VOR-VORTEST | **Bildbeschreibung: Formular und KI-Vorschlag fehlen auf der Vordertür.** `onDescribeImage` ist ein OPTIONALER Prop des Editors; `CaptureFrontDoor.tsx` und `KnowledgeInputStudio.tsx` übergeben ihn nicht. Ohne ihn rendert weder der Knopf „Bildbeschreibung bearbeiten" (`RichTextEditor.tsx:1129`) noch die Vorschlagsleiste (`captionSuggestVisible`, dritter Parameter). Von Pedi mehrfach angefordert |
| A16 | OFFEN | VOR-VORTEST | Sammler über optionale Verträge: **derselbe Fehler wie `FacetFilter` ohne `backgroundRef`** — ein Aufrufer lässt einen optionalen Prop weg, nichts wird rot. Zwei Fälle in zwei Tagen |
| E4d | OFFEN | VOR-VORTEST | D2 Klara-Refresh vor Freitag schneiden |

---

## 4 — Nach Ship 3, vor dem Großkunden

| Kennung | Zustand | Anker | Sache |
|---|---|---|---|
| K4 | OFFEN | MIT-ADOPTION | **Adoption: wie bringen wir Anwender dazu, das System zu benutzen.** Die KO-Frage. Sieben Konzeptvorgänge SCRUM-475–481. Läuft parallel als Kopf-Arbeit, kostet keinen Code-Takt |
| D1 | OFFEN | MIT-DESIGN | Bibliotheksfilter nach mobile.de-Vorbild — von Pedi als wesentliche Verbesserung angenommen |
| D3a | OFFEN | MIT-DESIGN | Design v2: E1 Werkbank-Richtung ja · E2 Klara-Prototyp ja · E3 Reihenfolge D1→D2→D3→D4 ja |
| F27 | OFFEN | MIT-DESIGN | Markentext einen Tick dunkler (4,497:1 → AA), damit `--kw-funke-soft` nutzbar wird; Klara in Word muss dem gewählten Thema folgen |
| F16 | OFFEN | MIT-DESIGN | Beispielklick auf `/fragen` vorher als echten, kostenpflichtigen Aufruf kenntlich machen |
| F21 | OFFEN | NACH-SHIP3 | Zitierte gegen herangezogene Quellen — inhaltlich wichtigster offener Posten des Produkts |
| W1 | OFFEN | NACH-SHIP3 | **Antwort zieht fachfremde offene Quellen heran**, obwohl ausschließlich validiertes Wissen zugesichert ist (P0, Handlauf 2) |
| W2 | OFFEN | NACH-SHIP3 | EN/NL übersetzen nur die Metadaten, nicht den Antwortkörper; „klep X" findet „Ventil X" nicht (P0, Handlauf 2) |
| W3 | OFFEN | NACH-SHIP3 | Word übergibt Bilder nicht — der Verlust wird ehrlich gemeldet, die Bilder fehlen trotzdem |
| C1 | OFFEN | NACH-SHIP3 | Import-Seite: „In Planung" einklappen · Quellenwahl wählt wirklich · Freigaben ehrlich · Konfliktsatz · Deckelkommentar. Auftrag liegt fertig, Block C wartet auf E10 |
| C3 | OFFEN | NACH-SHIP3 | Vier Befunde aus Pedis Live-Durchlauf (Stufe-2-Schalter vergisst sich · „OHNE KI GRUPPIERT" trotz aktivem Reasoner · Such-Leerzustand · rohe Kennung statt Titel) — jeder einzeln am heutigen Code nachsehen |
| F1–F20, F22–F26 | OFFEN | NACH-SHIP3 | Erstnutzer- und Weboberflächenbefunde: bejahender Startsatz, Kopfzeilen-Chips, deutsche Wörter, eine Handlung je Fläche, Zahlen mit Bezug, Rohwerte, „gesichert"-Kollision, „1 Beiträge", Re-Import zu prominent, unbeschrifteter Balken, Trefferzeile, Tadel vor der ersten Handlung, alle acht Quellen, Hauptknopf, Audit-Kette, Vertraulichkeits-Facette, Anlagenkopplung, sechs Routen ohne Live-Beleg, Arbeitszahlen ins Leere, Trust→Vertrauenswert, `apps/web`-tsc ins Tor, Validierungs-Interaktionstest, Computed-Style-Pin |
| E2g | OFFEN | MIT-GROSSKUNDE | 12.08. **bestätigt** — elf Vorgänge leben wieder: Cloud-Instanz, Confluence in Scheibchen, Microsoft-365-Anmeldung, Spracheingabe, Demo-Drehbuch, Nullschulungs-Test |

---

## 5 — Zugriffsschutz

Pedis Anordnung: „nach Freitag, aber nicht vergessen."

| Kennung | Zustand | Anker | Sache |
|---|---|---|---|
| G1 | OFFEN | MIT-ZUGRIFFSSCHUTZ | Freigabestufe je Nutzer; heute sieht jeder angemeldete Nutzer jedes Objekt, auch „streng vertraulich" |
| G2 | OFFEN | MIT-ZUGRIFFSSCHUTZ | **Entschieden: Rückkante.** Der Anhang trägt die Kennung seines Wissensobjekts und wird behandelt wie es — keine Stufen-Propagation, kein Kompromiss |
| G3 | OFFEN | MIT-ZUGRIFFSSCHUTZ | **Entschieden: fail-closed.** Es gibt keinen Altbestand, wir arbeiten nur mit Beispieldaten. Der Bestandsfall entfällt |
| G4 | OFFEN | MIT-ZUGRIFFSSCHUTZ | Anhang bleibt ein Jahr im Browser gültig — Loch, sobald gesperrt wird |
| G5 | OFFEN | MIT-ZUGRIFFSSCHUTZ | Drei Nebenwege: Benachrichtigungen, Duplikat-Eigenanteile, Konfliktzitate |
| G6–G8 | OFFEN | MIT-ZUGRIFFSSCHUTZ | Export umgeht Vertraulichkeit (SCRUM-506) · systemisch auf allen Lesewegen (508) · Medien-Egress vertraut dem Browser (521) |
| G9 | OFFEN | MIT-ZUGRIFFSSCHUTZ | SCRUM-533, 449, 508 und 556 zu **einem** Vorgang zusammenführen — vier Tickets für eine Sache |
| B6 | OFFEN | MIT-ZUGRIFFSSCHUTZ | Der Platzhalter in `provenance-routes.ts` darf nicht scharf gehen, bevor G1 steht |

---

## 6 — Wissensnetz

| Kennung | Zustand | Anker | Sache |
|---|---|---|---|
| H1 | OFFEN | NACH-SHIP3 | **Die Anwendersicht.** Pedis Anweisung: nicht im Admin verstecken. Serverseite steht (mega45), die Sicht fehlt ganz |
| H3 | OFFEN | NACH-SHIP3 | SCRUM-545–551: Beziehungen erheben · Lücken schließen · Graph-Lesemodell · kuratierte Sicht „So arbeitet Klarwerk" · Adminseite · Qualitätsblick |
| H4 | OFFEN | MIT-JAHRESRING | Modellläufe werden nicht protokolliert (SCRUM-554) — vor dem ersten großen Lauf zu klären |
| H2 | VERWORFEN | — | Das „Zeitprojekt"-Verfahren mit fallenlassbarem Block Z. Es hat siebzehn Aufträge lang genau das bewirkt, was es verhindern sollte |

---

## 7 — Jahresring und Testbestand

| Kennung | Zustand | Anker | Sache |
|---|---|---|---|
| L2 | OFFEN | MIT-JAHRESRING | **Entschieden: neu gestalten, in geringerer Anzahl.** Die 24.000 Kennungen gegen 12.480 Objekte waren ein Fehler; Mehrfachverwendung kommt zurück |
| L3 | OFFEN | MIT-JAHRESRING | **Entschieden: weniger, dafür realistischer.** Keine Vektorzeichnungen als „Fotos", keine eingebrannte Kennung im Bild — **muss ausdrücklich im Erzeugungsprompt stehen** |
| L4 | OFFEN | MIT-JAHRESRING | Aufgabe A nie geliefert: Anhangsgerüst neu herleiten, Datenbankgröße neu rechnen, Losgröße begründen |
| L5 | OFFEN | MIT-JAHRESRING | Löschanteil aus dem Firmenalltag herleiten — die 72 % Papierkorb sind Entwicklungsschutt, kein Vorbild |
| L6 | OFFEN | MIT-JAHRESRING | Vier Datenbankbefunde: kein Fremdschlüssel auf der Objekttabelle, Lücken ohne Objektbezug, kein Waisen-Sweep, Prüfspur auf gelöschte Objekte |
| L7 | ERLEDIGT | — | Ladeweg entschieden: Bulk-Import ohne Modellaufruf, Erzeugung in Losen mit Halt |
| E4s | OFFEN | MIT-JAHRESRING | Zweiter Server aufsetzen (entschieden: eigene Maschine) — nach Freitag |
| E7 | OFFEN | SOFORT | Produktionsdatenbank umbenennen — Pedi gibt frei, Kopf führt aus |
| E8 | OFFEN | MIT-JAHRESRING | RESERVE und leeren Jahresring-Container löschen, erst nach dem Nachweis |

---

## 8 — Prozess: was das Vergessen verursacht hat

| Kennung | Zustand | Anker | Sache |
|---|---|---|---|
| I1 | OFFEN | SOFORT | **Diese Datei.** Ersetzt die unerfüllbare Gedächtnis-Regel aus SCRUM-532 (Gedächtnis ist für das Konto abgeschaltet) |
| P1 | OFFEN | SOFORT | **Der Prozess-Wächter im Prüftor** — siehe unten. Ohne ihn ist diese Datei nur ein weiteres Dokument |
| I2 | OFFEN | NACH-SHIP3 | KOMMUNIKATIONSWEGE und SCRUM-530 zu **einem** Dokument zusammenführen, Widerspruch beim Startbefehl auflösen |
| I8 | OFFEN | SOFORT | Scheiben-Zusatz an ben-Auftragsnamen wieder anhängen **und in der Regel verankern** |
| I6 | OFFEN | SOFORT | Täglicher Kassensturz — ab jetzt gefahren, nicht mehr nur beschrieben |
| I12 | OFFEN | NACH-SHIP3 | Inventur aller Verhaltensbehauptungen; sechste Regel für SCRUM-553: jede Behauptung braucht eine Deckung |
| I3 | OFFEN | NACH-SHIP3 | SCRUM-531 nachziehen — steht vier Ships hinterher |
| I4 | OFFEN | NACH-SHIP3 | SCRUM-530: Code-Freeze und VIP-2 als KO streichen, Prozess-Freeze streichen |
| I5 | OFFEN | NACH-SHIP3 | sammel26–45 in SCRUM-469 verankern — neunzehn Verdikte stehen nur in `_relay/` |
| I7 | OFFEN | SOFORT | Projekt-Instruktionen laden nicht; Selbstprüfung zu Sitzungsbeginn wird Pflicht |
| I9 | OFFEN | SOFORT | Stichprobengröße nennen, wenn über eine Menge geurteilt wird |
| I10 | OFFEN | SOFORT | Keine interaktiven Datenbank-Transaktionen mehr |
| I11 | OFFEN | NACH-SHIP3 | Coolify-Eigenheiten selbst nachprüfen oder als unbelegt kennzeichnen |
| I13 | OFFEN | NACH-SHIP3 | Ship-Tor braucht ein Cloud-Geheimnis (SCRUM-552) — die Frist „bis nach VIP-2" ist verfallen |
| K2 | OFFEN | SOFORT | `_relay/kopf/wartet/` auflösen, Inhalt nach `_relay/hand/queue/` |
| E1v | ERLEDIGT | — | VIP-2 entfällt endgültig; der Vermerk „nach VIP-2" wird überall durch einen Ereignis-Anker ersetzt |

---

## Der Prozess-Wächter (P1)

Alles in diesem Projekt, was halten soll, hängt an einem Sammler im Prüftor. Der Prozess bisher nicht — er hing an Disziplin, und Disziplin überlebt keinen Kopfwechsel. Der Wächter prüft, was eine Maschine prüfen kann:

**Erstens: keine Datums-Anker.** Ein Anker, der ein Kalenderwort trägt („nach VIP-2", „Anfang August", ein Datum), macht das Tor rot. Das ist die Regel, die fünf Vorgänge und zwei Konzepte gerettet hätte.

**Zweitens: kein zweiter Ablageort.** Eine auftragsförmige Datei irgendwo unter `_relay/kopf/` außerhalb von `queue/` macht das Tor rot. Genau so sind zwei fertige Aufträge verschwunden.

**Drittens: keine Waisen.** Jeder ben-Bericht in `outbox/` und jeder Hand-Bericht braucht eine Zeile hier. Wer prüft, ohne dass es hier ankommt, prüft ins Leere.

**Viertens: nichts altert stumm.** Eine `ENTSCHEIDUNG`-Zeile, die älter ist als drei Ship-Runden, macht das Tor gelb und steht namentlich im Kassensturz.

**Fünftens: eine Übergabe, nicht drei.** Mehr als ein Übergabedokument ohne Überholt-Vermerk macht das Tor rot.

## Der Kassensturz

Einmal je Arbeitstag, ungefragt, drei Zeilen: was sich bewegt hat · was auf Pedi wartet, **mit der ältesten zuerst** · was am längsten liegt. Das ist der Mechanismus, der die vier unbeantworteten Vorschläge am zweiten Tag sichtbar gemacht hätte statt am neunten.

## Der Anlauf beim Kopfwechsel

Bevor irgendetwas anderes passiert: diese Datei lesen, den Prozess-Wächter fahren, und die drei ältesten offenen Punkte sowie alle unbeantworteten Entscheidungen melden. Laden die Projekt-Instruktionen nicht, ist das ein Befund für Pedi, kein Achselzucken.

## Die Bündelgröße

Ein Auftrag wird nach **Thema** geschnitten, nicht nach Größe: Blöcke gehören zusammen, wenn sie dieselbe Fläche oder denselben Vertrag berühren. Sechs bis zehn Blöcke sind normal. Die Ausnahme sind Ship-Blocker — die bleiben klein und schnell, wie mega48. Alles andere bündelt, weil jede Runde einen vollen Kopf-Code-ben-Takt kostet und ein Rückstau schneller wächst, als kleine Scheiben ihn abtragen.
