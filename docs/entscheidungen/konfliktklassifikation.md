# Konfliktart, Geltungsbereich und zulässige Eskalation — Bestand, Lieferung, offene Entscheidung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-konfliktklassifikation` (Revision 1). Grundsatz G-5:
kein stilles Überschreiben; Widersprüche sind Wissen, kein Fehler. Basisstand `d59159dc`
(`1.0.0-beta.1.752`). Das Verhalten prüfen die Tests unter `tests/konfliktklassifikation/`; dieses
Dokument selbst liest kein Test.*

Die Auftragsquelle führt für alle elf Punkte nur Altquellen („Historische Aussage, heutige Erfüllung
nicht erneut geprüft“). Dieses Dokument ordnet jeden Punkt dem heutigen Bestand zu. „Belegt durch“
nennt Verhaltenstests; ob sie auf diesem Stand grün sind, sagt erst ihr Lauf, nicht dieses Dokument.

## Zuordnung je Originalpunkt

| Punkt | Heute | Belegt durch |
| --- | --- | --- |
| R-0209, R-1713, R-2103, FR-CON-01 — klassifizierter, sichtbarer Konflikt statt stillem Überschreiben | **Vorhanden vor diesem Auftrag.** `ConflictType` mit den fünf Arten (`services/conflicts/src/types.ts`); `ConflictService.create` legt einen offenen Konflikt mit Art und Beschreibung an und ändert keines der beiden Objekte; die Konfliktseite zeigt die Art als Pille. | `tests/konfliktklassifikation/klassifikation-und-eskalation.test.ts` (alle fünf Arten, Dienst und Route), `services/conflicts/src/service.test.ts` |
| R-0215, R-1714, R-2104, FR-CON-02 — nur der Wahrheitskonflikt eskaliert | **Vorhanden vor diesem Auftrag.** `ConflictService.escalate` lehnt jede andere Art mit `NOT_ESCALATABLE` ab; die Oberfläche bietet „Eskalieren“ nur beim offenen Wahrheitskonflikt an; die anderen vier bleiben offen nebeneinander stehen. | wie oben (alle fünf Arten, Dienst und Route), `services/app/src/conflict-routes.test.ts` |
| R-2065 (NFR-TAI-02) — kein automatischer „Wahrheits“-Entscheid | **Vorhanden vor diesem Auftrag.** Die automatische Erkennung legt nur offene Konflikte an (ohne Entscheider, Entscheidung, Abschlussgrund); entschieden wird ausschließlich über `resolve`/`dismiss` mit Recht `conflict.resolve`. Systemische Abschlüsse (`participant_deleted`, `superseded`) entscheiden keine Wahrheit. | `klassifikation-und-eskalation.test.ts` (R-2065), `tests/konflikt-aufraeumwege-vermerk/grundbedeutung-kein-menschlicher-entscheider.test.ts` |
| R-0252 — Konflikttyp benennen: Regel, Sache oder Version; Knöpfe je Typ | **In diesem Auftrag geliefert** (siehe unten). | `klassifikation-und-eskalation.test.ts` (R-0252), `tests/konfliktklassifikation/konfliktseite-arbeitsart-mounted.test.tsx` |
| R-0263 — Geltungsbereich und Vorrang zwischen Anweisungen | **Nicht gebaut — offene Entscheidung** (siehe unten). | — |

## Geliefert: R-0252, die Arbeitsart

Eine zweite Achse neben der Konfliktart, wie es die Registernotiz verlangt („Nicht zu verwechseln
mit den fünf Konfliktarten … hier geht es um die Art der nötigen Arbeit“).

- **Datenmodell.** `Conflict.arbeitsart?: "regel" | "sache" | "version"` — optional, im JSONB-Dokument
  (keine Migration). Gesetzt nur, wenn ein Mensch sie bei der manuellen Anlage wählt
  (`MehrAbschnitte.tsx`, Feld „Art der Arbeit“, Vorgabe „Aus der Art ableiten“). Die Route
  `PUT /api/kos/:id {action:"conflict"}` nimmt nur die drei Werte an, sonst 400.
- **Ableitung, als solche gekennzeichnet.** Fehlt die Wahl, leitet `conflictWorkKind`
  (`apps/web/src/lib/conflictView.ts`) ab: Wahrheit, Erfahrung → Sache; Zeit → Version; Kontext,
  Rolle → Regel. Der Satz auf der Seite sagt dann „Eingeordnet nach der Art …“, bei einer Wahl
  „Bei der Anlage so eingeordnet.“
- **Vorab gesagt.** Auf der Konfliktseite steht vor dem Kartenpaar ein Satz
  (`data-testid="konflikt-arbeitsart"`), welche Arbeit vorliegt.
- **Knöpfe je Typ** (`conflictWorkActions`):
  - *Sachkonflikt* — unverändert: Links gilt · Rechts gilt · Beide gelten, je nach Kontext ·
    (Kein Widerspruch beim automatisch erkannten) · Zweitmeinung.
  - *Regelkonflikt* — ohne Zweitmeinung: keine Quelle entscheidet, eine befugte Person tut es
    (Recht `conflict.resolve`).
  - *Versionskonflikt* — Linker Stand gilt · Rechter Stand gilt · (Kein Widerspruch); kein
    „Beide gelten“, keine Zweitmeinung.
- **Nächster Schritt.** Ein offener Wahrheitskonflikt eskaliert weiterhin zuerst (R-0215); Regel-
  und Versionskonflikte werden danach direkt entschieden. Die Erwartung für den Kontextkonflikt in
  `tests/conflicts/conflict-view.test.ts` ist deshalb von „Zweitmeinung“ auf „Entscheiden“ gezogen.
- **Umriss-Pin.** `tests/conflict-description/beschreibung-sichtbar.test.tsx` (F3) ist absichtlich um
  genau die eine Zeile `p#konflikt-arbeitsart` nachgeführt; sonst unverändert.

**Grenzen.** Ein automatisch erkannter Widerspruch zweier *interner Festlegungen* wird als
Wahrheitskonflikt angelegt und erscheint deshalb als Sachkonflikt — die Erkennung unterscheidet
Regel und Sache nicht. Eine Umordnung nach der Anlage gibt es nicht. Beides wäre ein eigener
Ausbau (Erkennungsaufgabe bzw. eigener Schreibweg mit Recht).

## Offen: R-0263, Geltungsbereich und Vorrang

Die Quelle selbst führt den Punkt als **offene Entscheidung, kein Auftrag**: Registerstatus `IDEE`,
„Vor dem Grosskunden zu entscheiden“; `OFFEN.md` W10 nennt unter „Offene Entscheidungen“ ausdrücklich
das „Geltungsbereich-Modell“ und die „Weisungsbefugnis“. Ein Datenmodell vorweg zu bauen hieße, diese
Entscheidung an Pedis Stelle zu treffen — deshalb ist hier nichts gebaut.

Was heute **vorhanden** ist: der Konflikt verbindet je zwei Wissensobjekte (nicht Dokumente);
Überarbeitungen schließen alte Befunde systemisch als `superseded` (`ConflictService.onKoRevised`,
`OverlapService`); eine Entscheidung ändert keines der beiden Objekte; Kontextkonflikte lassen beide
Aussagen nebeneinander gelten („Beide gelten, je nach Kontext“).

Was **fehlt** (Wortlaut der Quelle): ein Geltungsbereich am Wissenspunkt, eine Vorrang-Beziehung
zwischen Punkten, die Unterscheidung Widerspruch/Präzisierung („10 Nm für Bolzen X“ schränkt „alle
handfest“ ein, statt es aufzuheben) und die Teiländerung (eine neue Anweisung überstimmt nur die
betroffenen Punkte, das Quelldokument bleibt mit Vermerk Herkunft).

**Zu entscheiden** (befugte Person): wie der Geltungsbereich am Punkt aussieht; ob die Vorrang-
Beziehung eine eigene Kante ist; wer Präzisierung gegenüber Widerspruch festlegt (die Quelle: „Klara
soll den Unterschied vorschlagen, entscheiden muss die befugte Person“); wie die Weisungsbefugnis im
Rechtemodell verankert wird.

## Quellenwidersprüche und fehlende Belege

- `specs/stories/conflicts.md` führt FR-CON-01 und FR-CON-02 mit offenen Kästchen `[ ]`, die
  Altquelle (FUNKTIONSREGISTER) mit „Jira Done, 5 Tests“, `Frontend-Funktions-Checkliste.md`
  FE-CON-03/04 mit „✅“ und offenen Prüfspalten. Keiner dieser Stände ist ein Lauf; der heutige
  Beleg sind die oben genannten Tests.
- **„Zwingend“ in R-0215** ist im Bestand so umgesetzt: nur ein Wahrheitskonflikt *kann* eskalieren,
  und sein nächster Schritt ist die Eskalation. Erzwungen *vor* der Entscheidung wird sie nicht —
  „Links gilt“ steht auch beim offenen Wahrheitskonflikt; entschieden wird in jedem Fall von einem
  Menschen mit `conflict.resolve`. Ob „zwingend“ eine Sperre der Entscheidung bis zur Eskalation
  meint, sagt die Quelle nicht.
- Der **manuell** angelegte Wahrheitskonflikt holt validierte Bezugsobjekte zurück in die Prüfung
  (`markTruthConflictReview`); der **automatisch** erkannte tut das nicht. Die Quelle äußert sich
  dazu nicht; hier unverändert.
- Keine echte menschliche Bedienung und kein Produktivlauf sind Teil dieses Belegs.
