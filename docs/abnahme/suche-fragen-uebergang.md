# Bestandsabgleich: Aus Bibliothekstreffern quellengebundene Fragen stellen

Auftrag `aufnahme:20260922:gesamt-suche-fragen-uebergang` (Revision 1). Abgeglichen am 08.10.2026
gegen Basis `6f19c27e` (Fassung `1.0.0-beta.1.766`). Ergebnis dieses Abgleichs: **keine
Codeänderung**. Der Zielzustand aus R-0436 ist im Bestand gebaut und durch vorhandene Tests belegt;
der Rest aus R-0429 (Slice 2) ist eine offene Produktrichtungs-Entscheidung und wird hier nicht
eigenmächtig gebaut.

**Nachtrag 11.10.2026:** Die offene Entscheidung zu Slice 2 hat Peter getroffen (Frage 52, s.
Abschnitt „Slice 2 — Entscheidung und Umsetzung" unten). Slice 2 ist auf Kandidatenbasis `9b5accba`
gebaut. Der Abschnitt zum Stand vom 08.10.2026 bleibt als historischer Stand unverändert stehen.

## R-0436 — „Fragen" direkt am Bibliothekstreffer

Zielzustand (Originalwortlaut): „Aus der Bibliothek heraus laesst sich zu einem Treffer sofort eine
echte Frage stellen, statt die Fragenseite getrennt aufzurufen."

Heutiger Stand, aus dem Code gelesen:

- Jeder gewählte Treffer zeigt auf der Lesefläche den Knopf „Fragen" (`data-testid="bib-fragen"`),
  unabhängig vom Zustand (validiert, offen, in Prüfung):
  `apps/web/src/components/bibliothek/BibliothekLesen.tsx` (`fragenHref(ko.id, suchtext.trim() ||
  ko.title, ko.confidentiality)`), Adresse aus `apps/web/src/components/bibliothek/fragen.ts`.
- Vorbelegt wird der aktuelle Suchtext, ohne Suche der Titel des Treffers.
- Bei bekannt nicht vertraulichen Einträgen trägt die Adresse `ask=1`; die Fragenseite sendet die
  Frage dann genau einmal selbst (`apps/web/src/pages/Ask.tsx`, Auto-Ask SCRUM-460 / R-0474). Ein
  Klick in der Bibliothek ergibt damit eine echte, gesendete Frage an die quellengebundene
  Antwortstrecke.
- Bei vertraulichen oder unbekannt eingestuften Einträgen wird die Frage nur vorbelegt
  (`vertraulich=1`); der Mensch sendet bewusst selbst. Das ist die bestehende Vertraulichkeitsregel
  des Hauses und bleibt wirksam.
- Ohne nutzbares KI-Modell wird nicht gesendet; die Frage bleibt vorbelegt.

Belegende Tests im Bestand:

- `tests/app/h4-ko-marker-vertrag-mounted.test.tsx` — Klick auf „Fragen" in der echten Bibliothek →
  echte Fragenseite → genau ein Aufruf `ask(Suchtext, "de")`.
- `tests/library/h4-fragen-vertrag-mounted.test.tsx` — Knopf und Adresse für alle drei Zustände;
  Titel als Vorbelegung ohne Suchtext.
- `tests/library/h4-fragen-rolle-mounted.test.tsx` — der Knopf ist auch für die Rolle Viewer ein
  begehbarer Link.
- `tests/app/ask-confidential-autoask-mounted.test.tsx` — vertrauliche Vorbelegung sendet nicht
  automatisch.

Grenzen, ausdrücklich benannt:

- Der Knopf steht auf der Lesefläche des **gewählten** Treffers, nicht in jeder Trefferzeile der
  Liste (H4, Pedi 04.09.2026: keine Bedienelemente und Erklärtexte im Sichtfeld der Liste).
- Die Antwort wird auf `/fragen` angezeigt, nicht in der Bibliothek.
- `ko=<id>` ist nur ein Herkunftsmarker. Die Antwort ist **nicht** auf den einen Treffer
  beschränkt; „quellengebunden" heißt hier: die übliche Antwortstrecke mit Quellenangaben über den
  ganzen erlaubten Bestand. Eine echte Bindung an den Treffer verlangt keine der beiden
  Originalquellen; sie wäre ein eigener Auftrag.

## R-0429 — Suche liefert zusätzlich eine KI-Antwort mit Quellen

- **Slice 1 (geliefert, SCRUM-460):** Weg von der Suche zur Antwort über `askAnswerHref` und
  `shouldAutoAskFromSearch` (`apps/web/src/lib/askQuestion.ts`, Test `tests/ask/ask-question.test.ts`).
- **Quellenwiderspruch zum Originalwortlaut:** „Sobald man in der Bibliothek tippt, erscheint oben
  das Angebot …" beschreibt die Karte „Antwort statt nur Treffer?". Diese Karte gibt es seit JOB
  3063/H4 nicht mehr (`apps/web/src/pages/Library.tsx`, Tabelle im Kopf von
  `apps/web/src/components/bibliothek/BibliothekFlaeche.tsx`: „Karte ‚Antwort statt nur …?' → Knopf
  ‚Fragen' auf der Lesefläche"). Ihre Funktion — Suchtext als Frage, ein Klick zur Antwort — lebt im
  Knopf „Fragen" weiter. Die Sichtung im Erstnutzerlauf vom 27.07.2026 bezieht sich auf die
  abgelöste Karte und ist kein Beleg für die heutige Fläche.
- **Slice 2, Stand 08.10.2026 (historisch, überholt durch den Nachtrag unten): offen, nicht
  gebaut.** Verdichtete Antwort inline in der Bibliothek, sichtbar getrennt
  von der wörtlichen Trefferliste. Der Zwischenbericht führt sie unter „Offene
  Produktrichtungs-Entscheidungen (warten auf Boss)" (`PROJECT_CONTEXT/13_ASSISTENT_ZWISCHENBERICHT.md:72-75`);
  das Originalkriterium (R-0429) übernimmt das wörtlich: „offene Produktrichtungs-Entscheidung,
  Design bei Boss/Pedi - insoweit nicht erledigt". Im Bestand liegt dazu keine jüngere
  Entscheidung; die jüngere Entscheidung vom 04.09.2026 (Liste ohne Karte und Erklärtext) spricht
  eher gegen einen zusätzlichen Antwortblock über der Liste. Ohne Entscheidung zu Ort, Gestalt und
  Kennzeichnung „gefunden" / „von der KI verdichtet" bleibt Slice 2 offen.
- **Quellenwiderspruch im Interview Paul (06.07.2026, Selbstauskunft):**
  `docs/boss-assistant/interviews/paul.md` sagt zu Slice 2 zweierlei.
  - Boss-abhängig: Zeile 29 „Zurückgestellt (Boss): … Suche-Slice 2" und Zeile 53, unter „Offene
    Boss-Entscheidungen", „Suche-Slice-2-Design".
  - Nicht Boss-abhängig: Zeile 49 „Nächster nicht-Boss-abhängiger Kandidat: **Suche-Slice 2**
    (Antwort inline in Bibliothek)".

  Die Aussage aus Zeile 49 ist **keine Freigabe**. Sie ist eine unverifizierte Selbstauskunft;
  das Interview widerspricht ihr selbst zweimal (Zeilen 29, 53), und Paul nennt dort Produktrichtung
  ausdrücklich „außerhalb Mandat" (Zeile 17). Maßgeblich bleiben der Zwischenbericht und das
  Originalkriterium. Beide führen das Design als offene Entscheidung bei Boss/Pedi.

### Slice 2 — Entscheidung und Umsetzung (Nachtrag 11.10.2026)

**Entscheidung.** `QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011.json` in den
Auftragsunterlagen, `human_decisions[0]`, Frage 52: „Wo erscheint die verdichtete Antwort innerhalb
der Bibliothekssuche?" Empfehlung: „In einem klar erkennbaren Antwortbereich oberhalb der Treffer,
mit anklickbaren Quellen. Die ursprünglichen Suchtreffer bleiben erreichbar." Peters Antwort im
Original: „deine empfehlung". Damit ist die bis 08.10.2026 offene Designentscheidung geklärt. Die
Quelle vermerkt selbst: „Beschluss dokumentiert; Umsetzung separat prüfen".

**Umsetzung.**

- `apps/web/src/components/bibliothek/BibliothekAntwort.tsx` (neu): Sobald der Suchbegriff
  mindestens drei Zeichen hat, steht über den Treffern ein abgesetzter Bereich „Von der KI
  verdichtet" mit dem Knopf „Antwort aus den Quellen". Darunter beginnt die Liste mit der Zeile
  „Gefunden". Das ist die vom Berater verlangte sichtbare Trennung.
- Ein Klick schickt den Suchbegriff genau einmal über denselben Anfragevertrag wie die Fragenseite
  (`endpoints.ask.ask`). Gezeigt werden:
  - die Antwort mit Fußnoten (`AntwortText`),
  - die KI-Kennzeichnung (`AiGeneratedNotice`), Modellangabe und Kostenhinweis (`AiModelInfo`),
  - die Einstufung aus `effectiveAnswer`,
  - dieselben Vorbehaltstexte wie auf `/fragen`.

  Die Quellen sind Knöpfe; ein Klick öffnet die Quelle rechts in der Lesefläche. Liste und Suche
  bleiben stehen.
- Tippen allein schickt nichts an ein Modell. Ohne nutzbares Modell wird nicht gesendet, und der
  Sperrhinweis steht da. Ohne belegte Antwort steht „Wissenslücke" mit dem Satz, dass nichts
  erfunden wurde.
- „Ausblenden" klappt den Bereich zu, ohne die Antwort zu verwerfen. Ein neuer Suchbegriff
  beginnt wieder beim Angebot.
- Eingebaut über den neuen, optionalen Steckplatz `antwort` in
  `apps/web/src/components/bibliothek/BibliothekListe.tsx`, gesetzt in `BibliothekFlaeche.tsx`.
  Ohne Suchbegriff ist die Bibliothek unverändert.
- Texte in DE/EN/NL: `lib.antwort.*` in `apps/web/src/woerterbuch/{de,en,nl}.ts`.

**Gegenprobe.** `tests/library/bibliothek-antwort-slice2-mounted.test.tsx` misst an der gemounteten
Seite `Library`:

- S1 Lage über den Treffern, Trennung „Gefunden", keine Anfrage durch Tippen;
- S2 genau eine Anfrage, Antwort, Kennzeichnung und anklickbare Quellen, die die Lesefläche öffnen;
- S3 ohne Modell keine Anfrage;
- S4 Lücke statt Erfindung;
- S5 ohne Suchbegriff kein Bereich;
- S6 Ausblenden ohne zweite Anfrage.

**Grenzen von Slice 2.**

- Die Antwort beruht auf dem ganzen Bestand, den die Person lesen darf. Sie ist nicht auf die
  sichtbaren Treffer beschränkt; der Anfragevertrag kennt keine solche Bindung.
- Modellangabe und Kostenhinweis stehen im Bereich erst nach dem Klick, zusammen mit der laufenden
  Anfrage. Das ist dasselbe wie beim bestehenden Weg „Fragen" → `/fragen?ask=1`. Grund: Vor dem
  Klick liest das Angebot bewusst keinen Modellstand.
- Die Vorbehalte erscheinen als Text ohne die Weiterleitungsknöpfe der Fragenseite (Validierung,
  Konflikte); diese Wege bleiben über „Fragen" erreichbar.
- Ob die Darstellung Peters Vorstellung trifft, ist nicht durch eine menschliche Bedienung belegt.
  Ebenso fehlt ein Lauf mit echtem Modell und echtem Bestand.
- Die ausgelieferte Fassung steht erst nach der Veröffentlichung fest.

## Fehlende Belege

- Keine echte menschliche Bedienung der heutigen Fläche (Knopf „Fragen" mit echtem Modell und
  echtem Bestand) nach H4 im Bestand belegt; der Ship-8-Prüfpunkt „Fragen-Knopf stellt echte
  Frage?" (Handover 23.07.2026) ist in der Quelle nicht als bestanden geführt.
- Der Lieferbeleg mit ausgelieferter Fassung entsteht erst mit der Veröffentlichung.
