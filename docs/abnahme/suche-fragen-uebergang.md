# Bestandsabgleich: Aus Bibliothekstreffern quellengebundene Fragen stellen

Auftrag `aufnahme:20260922:gesamt-suche-fragen-uebergang` (Revision 1). Abgeglichen am 08.10.2026
gegen Basis `6f19c27e` (Fassung `1.0.0-beta.1.766`). Ergebnis dieses Abgleichs: **keine
Codeänderung**. Der Zielzustand aus R-0436 ist im Bestand gebaut und durch vorhandene Tests belegt;
der Rest aus R-0429 (Slice 2) ist eine offene Produktrichtungs-Entscheidung und wird hier nicht
eigenmächtig gebaut.

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
- **Slice 2 (offen, nicht gebaut):** verdichtete Antwort inline in der Bibliothek, sichtbar getrennt
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

## Fehlende Belege

- Keine echte menschliche Bedienung der heutigen Fläche (Knopf „Fragen" mit echtem Modell und
  echtem Bestand) nach H4 im Bestand belegt; der Ship-8-Prüfpunkt „Fragen-Knopf stellt echte
  Frage?" (Handover 23.07.2026) ist in der Quelle nicht als bestanden geführt.
- Der Lieferbeleg mit ausgelieferter Fassung entsteht erst mit der Veröffentlichung.
