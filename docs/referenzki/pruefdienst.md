# Referenz-KI-Prüfdienst (produkt:20261009:referenzki-pruefdienst · REF-02)

Ein gemeinsamer, ausschließlich **lesender** Dienst. Er prüft, ob die Fundstellen einer
ausgelieferten Antwort deren Aussagen tragen. Er erzeugt keine Antworten. Er ändert keine Quellen,
Artikel, Aufgaben oder Rechte und gibt nichts frei. „Vier-Augen" heißt hier: eine zweite KI prüft.
Es heißt nicht: menschliche Freigabe oder Fehlerfreiheit.

## Bausteine

| Teil | Ort |
| --- | --- |
| Prüfdienst (technische Prüfung, Prüfauftrag, Auswertung, Cache, Grenzen, erneute Prüfung) | `services/ask/src/referenz-pruefung.ts` |
| Aussagebindung und Prüfpaket (Bestand REF-01) | `services/ask/src/aussage-fundstellen.ts` |
| Prüferwahl aus der Adminliste, ein Aufruf über Laufbuch und Chokepoint | `Reasoner.referenzPruefer` in `services/reasoner/src/service.ts` |
| Tatsächliches Antwortmodell je Anfrage | `antwortRolleVon` (Reasoner) → `AskService.antwortRolleVon` |
| Einbindung in beide Antwortwege (Fragekonsole, Klara) | `antwortLauf` in `services/app/src/routes/ask-routes.ts` |
| Erneute Prüfung | `POST /api/ask/referenzpruefung/:pruefId/erneut` |
| Adminliste | `PUT /api/reasoner/config` mit `referenzpruefung: ["openai" \| "anthropic" \| "local", …]`; Einstieg REF-03: `GET`/`PUT /api/reasoner/referenzpruefung` |

## Ablauf je beantworteter Frage

1. **Technisch, ohne KI:** Jede Fundstelle wird mit den aktuellen Rechten des Fragenden in ihrer
   gebundenen Fassung neu aufgelöst (`loeseFundstelleAuf`). Nicht zugänglich, beschädigt, gelöscht,
   entfernt oder ersetzt heißt: kein Beleg. Links werden nie abgerufen. Ein Titel ist keine
   Fundstelle.
2. **Prüfer:** Der Dienst wählt die erste administrativ erlaubte Option. Sie muss eingerichtet und
   freigegeben sein und ein **anderes** tatsächliches Modell haben als die konkrete Antwort. Gibt es
   keine solche Option, bleibt der Nachweis offen (`pruefer_nicht_unabhaengig` u. a.). Es gibt
   keinen Ersatzmodus.
3. **Freigabe:** An einen externen Prüfer geht nur, was die bestehende Freigabe für externe
   Verarbeitung trägt. Der Rest ist `nicht_pruefbar` mit dem Grund
   `keine_freigabe_externe_verarbeitung`.
4. **Ein Aufruf:** Es gelten feste Grenzen: Eingabedeckel (40 Posten, 24 000 Zeichen),
   Antwortbudget (1 500 Token), Zeitlimit (25 s, das Client-Limit des Anbieters gilt zusätzlich)
   und der Anfrageabbruch. Es gibt keinen automatischen zweiten Versuch.
5. **Strikte Auswertung:** Gültig ist nur die erwartete JSON-Form. Gewertet werden nur gesendete
   Posten und nur deren Fundstellen. Ungültiges ergibt `nicht_pruefbar`.

Der wörtliche Antwortweg (`retrievalOnly`, Add-in) sichert null Modellaufrufe zu. Dort findet
keine Referenzprüfung statt. Das Ergebnis steht sichtbar als `nicht_pruefbar` mit dem Grund
`modellaufruf_ausgeschlossen` da.

## Versionierter Prüfauftrag

Die Prüfrichtlinie `referenzpruefung-v1` liefert `referenzPruefauftrag(locale)`. Der Systemteil
ist fest. Quell- und Antwortinhalte reisen ausschließlich als **eine JSON-Zeichenkette** im
Datenteil (`PRUEFDATEN`). Darin enthaltene Anweisungen sind Material. Sie können Richtlinie,
Modellwahl, Freigaben oder Ausgabeformat nicht ändern. Anweisungsähnlicher Text wird zusätzlich
als Hinweis ausgewiesen.

## Strukturiertes Ergebnis (`referenzpruefung` an der Antwort)

- `status`: `geprueft` oder `nicht_pruefbar`, dazu der benannte `grund`.
- `aussagen[]`: **genau ein** Zustand je Aussage: `belegt`, `teilweise_belegt`, `widersprochen`
  oder `nicht_pruefbar`. Jede Aussage trägt Fundstellen (Objekt, Fassung, Bereich) und eine
  Begründung, je Teilaussage einzeln. Eine fehlende Quelle ist nie ein Widerspruch.
- `hinweise[]`: Aktualität und Konflikte stehen getrennt von der Unterstützung (`neuere_fassung`,
  `abruf_nicht_belegt`, `bekannter_konflikt`, `gegenpassage`, `fundstelle_verworfen`,
  `nicht_aufgeloeste_modellangabe`, `anweisungsaehnlicher_text`).
- `globaleAktualitaet: "nicht_behauptet"`.
- `bindung`: Antwort-, Beleg-, Paket- und Ergebnisfingerabdruck sowie die Richtlinie. Ein
  Cachebeleg gilt nur bei exakt gleichem Paket, gleichem aktuellem Quellenstand, gleicher
  Richtlinie und gleichem tatsächlichem Prüfmodell. Die Rechte werden bei jedem Zugriff neu geprüft.
- `rollen`: Für den Fragenden zeigt das Feld nur Stufen. Anbieter und Modell beider Rollen stehen
  im Prüfprotokoll (Audit `ask.referenzpruefung`), zusammen mit Fingerabdrücken, Zustandszahlen,
  Dauer und Tokenverbrauch. Das Laufprotokoll erhält die Laufart `referenz`; die Kosten rechnet es
  mit der Preisliste des Betreibers.
- `versuch`: Nummer und Höchstzahl (erster Lauf plus höchstens eine ausdrücklich angestoßene
  erneute Prüfung).

## Nachweise

- Technische Simulation (Doppelgänger, kein Netz): `tests/referenzki-pruefdienst/`.
- Echte Modellbeobachtung der sieben fiktiven Fälle (korrekter Beleg, teilweise gedeckt,
  Gegenpassage, sachfremde Quelle, erfundener Link, Prompt-Injection, Prüferausfall):
  `tests/referenzki-pruefdienst/modellbeobachtung.test.ts` im regulären Prüfablauf. V0 belegt
  immer, welche erlaubten Optionen in der Umgebung des Prüflaufs eingerichtet sind, je mit dem
  geheimnisfreien Grund der Fabrik. V1 beobachtet die sieben Fälle, sobald eine Option
  eingerichtet ist; der Bericht steht im Protokoll des Laufs. Von Hand derselbe Lauf mit
  Berichtsdatei: `scripts/referenzki/beobachtung.ts`. Das ist keine allgemeine Fehlerfreiheit.

## Oberfläche (Ben nacharbeit-3)

- **KI-Verwaltung** (`pages/AdminKiDetails.tsx`, Karte „KI"): Abschnitt „Referenz-KI für die
  Quellenprüfung". Er bietet ein Kontrollkästchen je Option (ChatGPT, Claude, eigenes Modell); nicht
  eingerichtete Optionen sind sichtbar und gesperrt. Die erlaubten Optionen stehen in ihrer
  Vorzugsreihenfolge vorn und lassen sich mit „nach vorn" umsortieren. Gespeichert wird über
  denselben Kanal und denselben Adminweg wie Zuordnung, Freigabe und Zweitmeinung.
- **Fragenseite** (`components/fragen/Referenzpruefung.tsx` an der Antwort): Gesamtstand; je
  Aussage Zustand, Fundstelle als Link auf die Quelle in ihrer Fassung und Begründung; Teilaussagen
  aufklappbar. Getrennt davon stehen Aktualität/Konflikte und technische Hinweise. Bei Ausfall,
  Zeitlimit, verweigerter Freigabe oder fehlender Referenz-KI steht sichtbar „nicht prüfbar" mit
  Grund. Dazu kommen Grenze, Versuch und, solange erlaubt, „Erneut prüfen". Das Ergebnis reist mit
  der Antwort im Arbeitsstand. Eine wiederhergestellte Prüfung gilt als UNBESTÄTIGT und zeigt
  kein Urteil, bis der Server sie bestätigt hat (Ben nacharbeit-4, K8). Die Bestätigung läuft über
  `POST …/erneut` mit `{ bestaetigen: true }` und berücksichtigt aktuelle Rechte, den aktuell
  gewählten Prüfer und die aktuelle Richtlinie. Übernommen wird nur ein exakt passender, gültiger
  Cachebeleg, ohne Modellaufruf und ohne gezählten Versuch. Sonst steht „nicht prüfbar" mit
  `bestaetigung_abgelaufen` da, und nur die begrenzte erneute Prüfung startet einen neuen Lauf.
- **Stichtagsvergleich** (`POST /api/ask/vergleich`, `components/fragen/WissensstandVergleich.tsx`):
  Beide Antworten werden mit ihrer eigenen Bindung (heute: aktuelle Fassungen, damals: Fassungen
  zum Stichtag) und ihrem tatsächlichen Antwortmodell geprüft (`referenzpruefung: { heute, damals }`).

## Einstieg „Referenzprüfung" in der Verwaltung (REF-03)

`produkt:20261009:referenzki-adminauswahl`. Unter Verwaltung → KI → Referenzprüfung
(`pages/AdminKiReferenz.tsx`, Detailkennung `kiReferenz`) steht die eigene Prüfrolle. Die Auswahl
in der KI-Karte ist dorthin umgezogen; die KI-Karte verweist nur noch darauf.

- **Optionen** sind die registrierten Zugänge der bestehenden Providerverwaltung (ChatGPT, Claude,
  eigenes Modell). Es gibt keine eigene Schlüsselablage. Je Option stehen Anbieter, Modell,
  intern/öffentlich und genau ein Zustand: `nicht_eingerichtet`, `ausgeschaltet` (nicht erlaubt),
  `nicht_verfuegbar` (mit Sperre: KI abgeschaltet, Freigabe für externe Verarbeitung fehlt, nicht
  erreichbar, kein Prüfmodell), `konfiguriert`, `letzte_pruefung_erfolgreich` oder
  `letzte_pruefung_fehlgeschlagen`. „Konfiguriert" ist kein Prüfnachweis. Ein Funktionscheck gilt
  nur für das Modell, mit dem er lief.
- **Unabhängigkeit**: Jede Option zeigt, ob sie dasselbe Modell nutzt wie die heutige Antwort-KI.
  Gibt es keine einsatzbereite Option mit anderem Modell, erklärt die Karte das mit nächstem
  Schritt. Erzwungen wird es weiterhin je Anfrage in `Reasoner.referenzPruefer`.
- **Freigabe**: Öffentliche Optionen ohne Grundfreigabe sind gesperrt und nennen den Weg zur Freigabe.
  Vertrauliche Inhalte brauchen zusätzlich die zweite Freigabe. Space-, Nutzer- und Mandantenrechte
  gelten je Fundstelle unverändert.
- **Speichern**: `PUT /api/reasoner/referenzpruefung` (`users.manage`) über denselben Schreibweg wie
  `PUT /api/reasoner/config`. Zuordnung und Freigaben bleiben so, wie der Server sie hält. Das Audit
  `reasoner.referenzpruefung` nennt zusätzlich die Modelle vorher und nachher.
- **Grenzen** stehen sichtbar: Zeitlimit, Antwortbudget, Posten- und Zeichendeckel, eine erneute
  Prüfung, keine automatische Wiederholung, Preisgrundlage.
- **Funktionscheck**: `POST /api/reasoner/referenzpruefung/funktionscheck` startet nur auf
  ausdrücklichen Klick. Er sendet ausschließlich fiktiven Prüfstoff (einen belegten und einen
  widersprochenen Posten) über denselben Prüfauftrag. Es gibt genau einen Aufruf und einen Lauf zur
  Zeit. Zeit, Modell, Ergebnis, Dauer, Verbrauch und Kosten (nur mit Preisliste) stehen im Audit
  `reasoner.referenzpruefung-funktionscheck`. Beim Seitenaufruf wird kein Modell gerufen.

## Abbruch bis zum Transport (Ben nacharbeit-3)

Anfrageabbruch und Prüfzeitlimit lösen ein eigenes Abbruchsignal des Prüfdienstes aus
(`mitGrenzen`). Es reist über `ReferenzPruefer.pruefe` → `ModelProvider.pruefeQuellenbeleg` →
`cappedModelClient.complete` bis in den Transport-Controller von `anthropicClient` bzw.
`openAiCompatibleClient` und bricht dort die laufende HTTP-Übertragung ab. Ist schon vor der
Übertragung abgebrochen, geht nichts hinaus. Der Fehlerlauf steht mit Modell im Laufprotokoll.

## Antwortstatus und Prüfprotokoll (REF-04)

`produkt:20261009:referenzki-antwortstatus`. Ergänzt nur, was REF-02/REF-03 offen ließen.

- **Alle Antwortwege, ein Dienst:** Fragekonsole, Klara-Zugang, Add-in (Kernaussagen),
  Stichtagsvergleich, `POST /api/reasoner` mit `task: "ask"` und die beiden Antworten einer
  angeforderten Zweitmeinung (`referenzpruefungZweitmeinung: { erste, zweite }`, je mit ihrem
  tatsächlichen Antwortmodell aus `answerMitZweitmeinung`) rufen denselben `ReferenzPruefdienst`.
- **Gesamtkennzeichnung** (`referenzGesamt`, `QuellenStatusMarke` in
  `components/fragen/Referenzpruefung.tsx`): „Quellen geprüft" nur bei `status: geprueft`, jede
  Aussage `belegt` mit Fundstelle, kein laufender oder gescheiterter Lauf und — soweit bekannt —
  gleichem Antwortfingerabdruck. Sonst steht die Antwort als „Entwurf" mit dem Stand: teilweise
  bestätigt, nicht prüfbar, Prüfung läuft, Prüfung nicht abgeschlossen, Quellenprüfung offen oder
  Prüfung einer anderen Antwortfassung. Ohne prüfpflichtige Aussage steht „Keine prüfpflichtige
  Aussage", ohne erfundene Quelle. Jeder Zustand trägt Zeichen und Wort, nicht nur Farbe.
- **Fundstelle und Rückweg:** Je Aussage öffnet „Fundstelle und Begründung zeigen" den Bereich mit
  Passage (soweit die Antwort sie mitlieferte), Fundstelle in ihrer Fassung und Begründung; Fokus
  springt hinein, „Zurück zur Aussage" oder Escape setzt ihn zurück. Dazu der Satz „Belegt heißt:
  die Fundstelle trägt die Aussage — nicht: garantiert wahr oder aktuell".
- **Nächster Schritt:** Zu jedem Grund von „nicht prüfbar" steht ein konkreter nächster Schritt;
  wo erlaubt, zusätzlich „Erneut prüfen" (aktuelle Konfiguration, neuer gebundener Lauf).
- **Prüfprotokoll** `ask.referenzpruefung`, Fassung `referenzprotokoll-v1`: Zeitpunkt, Antwortkennung
  und -weg, beide Rollen mit tatsächlichem Modell, Richtlinie, Fingerabdrücke, gebundene
  Quellenfassungen und je Aussage Zustand, Grund, Belegverweise und Begründungsfingerabdruck —
  ohne Texte (Inventar: `docs/datenschutz/pruefprotokoll-nutzdaten.md`). Die kurzen Begründungen
  je Teilaussage stehen dauerhaft im eigenen Eintrag `ask.referenzpruefung-begruendung` desselben
  Laufs (Ziel = Prüfkennung). Dort sind sie Inhaltsfeld der Audit-Sicht: lesbar nur, wer jede
  zitierte Quelle jetzt öffnen darf; nach Papierkorb oder Endlöschung einer Quelle geschwärzt.
  Abruf: `GET /api/audit?action=ask.referenzpruefung-begruendung&target=<pruefId>`.

## Offene Grenzen

- Die Antworten der Zweitmeinung werden seit REF-04 referenzgeprüft; Abgleich und Gegenüberstellung
  selbst bleiben Gegenstand ihres eigenen Auftrags.
- Die Fragekonsole streamt nicht: die Antwort kommt mit ihrem Prüfergebnis. Zwischenstände sind die
  serverseitige Bestätigung einer wiederhergestellten Antwort und die erneute Prüfung; beide stehen
  als „Entwurf · Prüfung läuft". Klaras Panel zeigt die Prüfung nicht an (kein Klara-Ausbau).
- Im Stichtagsvergleich lösen damalige Fundstellen aus dem Volltext nur auf, wenn die gespeicherte
  Suchprojektion dieser Fassung lesbar ist. Sonst verwirft die technische Prüfung sie sichtbar
  (`fundstelle_verworfen`).
- Die echte Modellbeobachtung (K10) braucht in der Umgebung des Prüflaufs eine eingerichtete,
  erlaubte Option (`ANTHROPIC_API_KEY` bzw. `KLARWERK_SHIP_SMOKE_API_KEY`, `OPENAI_API_KEY` mit
  Modell oder ein lokaler LLM). Fehlt sie, belegt V0 die konkreten Gründe, und V1 wird
  übersprungen. Kosten erscheinen nur mit `KLARWERK_KI_PREISLISTE`, sonst `null`.
- Betreiberweg (Ben nacharbeit-6): `tests-smoke/referenzki-modellbeobachtung.spec.ts` (`@modell`)
  läuft im vollen Smoke (`npm run smoke:ui`, Projekt `chromium`). Dort setzt der Startbefehl den
  vorhandenen `KLARWERK_SHIP_SMOKE_API_KEY` als Anthropic-Zugang. Bericht und Ausgabe hängen als
  native Anhänge am Lauf. Ohne Zugang wird der Lauf rot, statt übersprungen zu werden.
- Tarif und Kostenstelle: `docs/referenzki/tarif-kostenstelle-vorlage.md`. Im Produkt gibt es keine
  Kostenstelle, und die Preisliste kennt keine Zusatzkosten. Preise ermittelt der Betreiber; hier
  ist keiner eingetragen.
- Ist im regulären Testlauf ein Anbieter eingerichtet, ruft V1 je Lauf bis zu sechs begrenzte
  Prüfungen auf. `KLARWERK_REFERENZ_BEOBACHTUNG=aus` schaltet das ab.
- Die Prüfrichtlinie ist eine Konstante im Code (`referenzpruefung-v1`) und Teil des Cache-
  schlüssels. Eine neue Richtlinie ist eine neue Codefassung; deren Cache ist leer, frühere
  Bestätigungen gelten dann nicht (Bestätigung ergibt `bestaetigung_abgelaufen`).
