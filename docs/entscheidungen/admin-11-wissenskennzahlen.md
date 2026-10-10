# ADMIN-11 · Wissenskennzahlen mit Trends und nächsten Schritten erklären

Auftrag `produkt:20261009:admin-wissenskennzahlen`. Fläche: oberster Abschnitt auf `/analytics`
(`components/Wissenskennzahlen.tsx`), Draht `GET /api/wissenskennzahlen`.

## Was die Fläche ist

Eine **Auswertung vorhandener Quellen**. Es gibt keine neue Erhebung, keinen neuen Speicher und
kein neues Protokollereignis.

| Bereich | Quelle (vorhanden) | Art |
|---|---|---|
| Jetzt offen (Prüfung, Revalidierung, Konflikt, Duplikat, Lücke, Rückmeldung neu/ohne Abschlusssignal) | `ladeQualitaetsaufgaben` (ADMIN-10) | Momentaufnahme |
| Gestellte Fragen, ohne Lücke beantwortet, Antwortquote | Protokoll `ask.query` (ohne Fragetext, ohne Space) | Zeitraum |
| Neue Wissenslücken | `AskService.listGaps`, `createdAt` | Zeitraum |
| Häufig gefragt, noch offen | offene Lücken mit `askCount` (D-032) | Momentaufnahme |

Reihenfolge auf der Seite: Kennzahlen (Handlungsbedarf zuerst) → Zustand der Wissensbasis →
Bestandszahlen → Protokoll. Die Rechnung des Qualitätswerts (Faktoren, Grund der Unsicherheit,
bekannter Abzug) steht zugeklappt unter „Wie der Wert entsteht“; die Kennzeichnung selbst
(„Einstufung unbelegt“, schlechtester Wert groß, Spanne) bleibt sichtbar.

## Lage je Zahl

Jede Kennzahl trägt `lage`:

- `gemessen` — Quelle geliefert, Zeitraum liegt ganz nach dem ersten belegten Ereignis. Nur hier
  steht eine 0 als Null. Eine Quote mit Nenner 0 heißt „nicht berechenbar“.
- `unvollstaendig` — der Zeitraum beginnt vor dem ersten belegten Ereignis (oder es gibt noch keins).
  Der Wert steht da, mit „Erhoben seit …“ bzw. „Erhebungsbeginn nicht belegt“.
- `nicht_erhoben` — die Quelle führt das Merkmal nicht. Fragen und Lücken tragen keinen Space; mit
  Space- oder Teamfilter steht dort deshalb keine Zahl statt einer ungefilterten.
- `unbekannt` — die Quelle hat nicht geliefert.

Jede Karte nennt unter „So gezählt“ Bedeutung, Grundmenge (bei Quoten Zähler und Nenner), Zeitraum
und Datenstand. Die Bestandszahlen darunter tragen ihre Grundmenge als Unterzeile und gemeinsam den
Stand des Abrufs; Quoten über eine leere Grundmenge zeigen „—“.

## Trend

Nur Zeitraumzahlen haben einen Trend, und nur wenn der Vorzeitraum gleicher Länge vollständig nach
dem ersten belegten Ereignis liegt. Momentaufnahmen haben keinen Verlauf, weil frühere Stände nicht
gespeichert werden. Der frühere Balken „Validiert je Woche“ ist entfallen: er gruppierte heute
validierte Objekte nach ihrer Erstellungswoche und war damit kein erhobener Verlauf der Freigaben.

## Filter und Detaillisten

Zeitraum 7/30/90 Tage, Space, Team. Die Auswahl steht in der Adresse (`tage`, `space`, `team`) und
übersteht Rückweg und Neuladen. Wählbar sind nur Spaces, deren Inhalte der Betrachter lesen darf,
und aktive Teams, die an mindestens einen davon gebunden sind; ein Team steht für die Spaces, an die
es gebunden ist. Ein nicht wählbarer Wert antwortet 400 — gleich für unbekannt und nicht lesbar.

Jede Handlungsbedarf-Zahl trägt genau ihre Vorgänge (`eintraege`); die Zahl ist deren Länge. Jeder
Eintrag öffnet den vorhandenen Arbeitsweg. „In der Arbeitsliste öffnen“ führt nach
`/qualitaetsaufgaben` mit derselben Art, demselben Zustand (bei Rückmeldungen) und demselben Space.
Mit Teamfilter fehlt dieser Weg, weil die Arbeitsliste kein Team kennt; die Liste steht dann nur
hier.

## Fragebedarf ohne Doppelaufgaben

Dieselbe Frage ist bereits eine Lücke mit Häufigkeit (D-032). Die Liste nennt die häufigsten offenen
Lücken mit ihrem vorhandenen Vorgang (`luecke:<id>`, `/risiko?fall=<id>`). Hier wird nichts angelegt.

## Rechte und Datensparsamkeit

`GET /api/wissenskennzahlen` fordert `users.manage`. Die Vorgänge laufen durch denselben
Sichtbarkeitsfilter wie ADMIN-10. Fragetexte stehen nur nach `redactGapForViewer`; die Auswertung
nennt keine fragenden Personen und keine Namen von Zugeordneten. Erfolglose Suchen
(`nulltreffer.ts`) sind je Person für die eigene Liste geführt; eine Sicht über die Suchbegriffe
anderer ist dort bewusst nicht gebaut — die Fläche sagt „nicht ausgewertet“.

## Export

„Als CSV exportieren“ schreibt die gezeigte Antwort: Stand, Zeitraum, Auswahl, je Kennzahl Wert,
Lage, Zähler, Nenner, Erhebungsbeginn und Trend. Keine Titel, keine Fragetexte.

## Wortwahl

Antwortquote, Fragen und Aktivität beschreiben Nutzung. Die Texte sagen ausdrücklich, dass sie keine
gemessene Zeit- oder Geldersparnis sind. Die Bewertung in `Stufe2.tsx` (Abschnitt `mgmt.valuation`,
als Schätzmodell mit eigenen Annahmen gekennzeichnet, Grundlage validierte Objekte) ist davon
getrennt und unverändert.

## Grenzen

- Fragen und Lücken tragen keinen Space. Mit Space- oder Teamfilter sind sie „nicht erhoben“.
- Der Erhebungsbeginn ist das erste belegte Ereignis der Quelle. Ob es davor Fragen gab, ist nicht
  erhoben.
- Die vorhandenen Texte `ana.impact`, `ana.help.impact` und `shelp.ana.weekly` stehen unverändert im
  eingefrorenen Textbestand. Die Fläche liest sie nicht mehr; Klaras Registry (angehalten) führt
  `sec:ana.weekly` weiter.
