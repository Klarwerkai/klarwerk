# Prüfaufgaben, Aktionen und Fehlerzustände am Prüfboard — Bestandsaufnahme

*Aufnahme 20260922 · gesamt-pruefboard-bedienung. **Lauf 1** (Aufgabenrevision 2, Runde 1 auf
Basis `1.0.0-beta.1.643`, Commit `972c469b`). Nutzen laut Auftrag: Parität zur Bibliothek
(Funktionsbeschreibung §8.2). Alle Angaben unten sind am Code dieses Stands gelesen; „heute“ heißt
Commit `972c469b`.*

## Quellenlage — was dieser Lauf NICHT hatte

Der Auftrag dieses Laufs nennt nur die sechs allgemeinen Kriterien. Die **verknüpften
Aufnahmepunkte** (R-Nummern samt Originalwortlaut, Einschränkungen und Erledigungsbelegen) wurden
nicht mitgegeben. Andere Aufnahme-Läufe vom 20260922 haben sie im Auftrag erhalten, zum Beispiel
`gesamt-loeschung-aufbewahrung` mit R-0634 … R-1564. Im Repository liegen sie nicht. Folge:

- Eine Gegenüberstellung **je Aufnahmepunkt** ist in diesem Lauf nicht möglich. Unten steht der
  Abgleich gegen Funktionsbeschreibung §8.2 und gegen die sechs Kriterien.
- Die geforderte Zuordnung „Ergebnis oder verbleibende Entscheidung je Punkt“ bleibt offen, bis die
  Punkte vorliegen. Sie ist ausdrücklich eine **fehlende Quelle** und kein erledigter Teil.

## Kurzbild (§8.2 und Kriterien)

| Anliegen | Stand bei `972c469b` | Urteil |
| --- | --- | --- |
| §8.2 nur offene Beiträge | Board-Route liefert offene; entschiedene verlassen die Liste | geliefert |
| §8.2 Status-Filter + „Mir zugewiesen“ | Facette „Prüfstand“ (Pille), Kästchen „Mir zugewiesen“ (URL-Parameter) | geliefert |
| §8.2 Volltext, Domäne, Kategorie, Tag | Volltext über Titel/Aussage/Bedingungen/Maßnahmen/Kategorie/Tags; „Domäne“ = Wissensart (kein eigenes Domänenfeld am KO) | geliefert (s. Widerspruch 1) |
| §8.2 Fortschritt je Karte `grün/needed` | Stimmenpunkte im Fußband + Zeile „Stimmen“ im „Mehr“ | geliefert |
| §8.2 Konfliktkennzeichnung | Nur Reiter „Konflikte“ mit Zähler, **keine Markierung an der Karte** | offen, Entscheidung 1 |
| §8.2 Klick öffnet Beitrag | Titel-Link (Tastatur) + Flächenklick (Maus) | geliefert |
| §8.2 Kennzahlen Offen/Prüfung/Pending/Konflikte | Reiterzähler aus echten Abrufen (`PruefenKopf.tsx`) | geliefert |
| K1 KI-Prüfung getrennt von menschlicher Entscheidung | eigene Zeile „KI-Prüfung“ (`AiCheckBadge`) neben „Stimmen“/„Status“; Sperre der menschlichen Knöpfe während laufender Prüfung | geliefert |
| K1 Zuständigkeiten | bisher nur „zugewiesen“ ohne Namen, Zuweisen-Fehler ohne Meldung | **in diesem Lauf behoben** |
| K2 Rückfrage/Ablehnung begründen | Begründungspflicht (Absenden ohne Text gesperrt) | geliefert |
| K2 an den richtigen Verantwortlichen | `warn`/`down` gibt an den Eigentümer zurück, nicht an den Erzeuger (JOB 557) | geliefert |
| K2 Teilerfolg Begründung/Bewertung | bisher „Konnte nicht gespeichert werden“, zweiter Versuch schrieb die Begründung doppelt | **in diesem Lauf behoben** |
| K2 keine ungefragte Freigabe/Rollenänderung | Stufenfrage vor jeder Freigabe, nichts vorbelegt; Admin-Weg mit Rückfrage | geliefert |
| K3 Quellen, Stufe, Zeitpunkt, Original, fehlende Belege | Quellennachweis je Quelle (Zeitpunkt, Adresse, Belegstelle, Datei); Stufe mit Herkunft; kein „keine Quellen“-Satz | geliefert (schmaler Nachweis wiederverwendet) |
| K4 Liste/Tastatur | Pfeiltasten und Mausrad nur an der Liste, eigene Rollbereiche | geliefert |
| K4 Mobil | schmale Bauform mit Vollbild-Filterblatt, Blickführung zur Karte, Umbruch langer Belege | geliefert |
| K4 Sprache | alle Texte DE/EN/NL, neue Texte als Textmodul | geliefert |
| K4 Fehlerfälle Laden | Erstfehler mit „Erneut laden“, gescheiterte Auffrischung behält die Liste | geliefert |

## In diesem Lauf geändert

### 1. Rückfrage/Ablehnung: der Teilerfolg wird wahr gemeldet

Rückfrage und Ablehnung sind zwei Aufrufe: `comment` (Begründung) und danach `rate`. Scheiterte nur
`rate`, meldete die Karte „Konnte nicht gespeichert werden“, obwohl die Begründung am Server lag.
Der nächste Versuch schrieb sie ein zweites Mal.

Jetzt (`apps/web/src/pages/Validation.tsx`, `reviewWithFeedback`; Fehlerklasse
`BegruendungFehler` in `apps/web/src/lib/validationFeedback.ts`):

- Scheitert `rate` nach gespeicherter Begründung, steht der Satz „Die Begründung ist gespeichert,
  die Bewertung nicht. …“. Der Knopf heißt „Bewertung erneut senden“ und schickt **nur** `rate`.
- Die gespeicherte Begründung bleibt auch über Abbrechen und erneutes Öffnen erhalten
  (schreibgeschützt). Eine geänderte Fassung käme ja nie am Server an.
- Scheitert schon `comment`, bleibt es bei der bisherigen, dann wahren Meldung. Die Wiederholung
  schickt dann beides.
- Keine Quittung ohne erfolgreiche Bewertung. Das ist dieselbe Regel wie an der Stufenfrage
  (`val.stufenfrage.fehlerNachStufe`).

### 2. Zuständigkeit sichtbar, Zuweisen meldet sich

- Im „Mehr“ steht die Zeile „Zugewiesen an: <Namen>“ für die **offenen** Zuweisungen. Die
  Board-Route reicht nur offene durch, siehe `ValidationService`.
- Wer bereits offen zugewiesen ist, steht im Auswahlfeld als „<Name> (bereits zugewiesen)“ und ist
  nicht noch einmal wählbar.
- Zuweisen meldet Erfolg („Zugewiesen an <Name>.“) und Fehler mit dem Servertext. Bisher sprang das
  Feld bei einem Fehler nur still zurück.

Neue Texte: `apps/web/src/texte/pruefboard.ts` (DE/EN/NL). `i18n.ts` ist unberührt.

Beleg: `tests/pruefboard-bedienung/rueckfrage-und-zuweisen-fehlerwege.test.tsx` (gemountete
Prüffläche, jsdom, 8 Fälle). Gegenprobe ohne die Produktänderung: 7 von 8 rot. Der achte Fall prüft
die Abwesenheit der Zeile ohne Zuweisung und ist in beiden Fassungen grün.

## Bereits geliefert — abgegrenzt, nicht neu gebaut

| Teil | Ort | Beleg |
| --- | --- | --- |
| Reiter „Offen“: Liste links, eine Karte rechts, Funktionsinventar | JOB 3061 | `tests/design/h2-funktionsinventar.test.ts` (Browser, Prüfserver) |
| Stufenfrage vor Freigabe, Teilerfolg, Sperre im Folgezustand | JOB 3112 · V3 | `tests/validierung-stufe/*` |
| Paarhinweis „zweites Exemplar“ | JOB 3112 · V3 | `tests/validierung-stufe/doppelhinweis-*` |
| Listennavigation Tastatur/Rad, Rollbereiche | JOB 3504/3593/3625/3812 | `tests/pruefen-listennavigation/*`, Block L in `tests/design/job2935-validierung-fussband.test.ts` (Browser) |
| Volltext | Prüfen-Volltext | `tests/pruefen-volltext/*` |
| Schmaler Quellennachweis (Zeitpunkt, Adresse, Belegstelle) | JOB 4013 | `tests/pruefen-quellennachweis/nachweis-an-der-pruefkarte.test.tsx` |
| Dateiname am Nachweis | JOB 4077 | `tests/quelle-dateiname-am-nachweis/*` |
| Lange Belege schmal | JOB 4361 | `tests/pruefen-quellennachweis/lange-quellen-schmal-chromium.test.ts` (Browser) |
| Stufe und Erfassungsweg am Brett | JOB 3027 | `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx` |
| Zustandsmodell Laden/Fehler/Auffrischung | Auftrag §9 | `tests/pruefseite/zustandsmodell-cache.test.tsx`, `abhaengiger-ladezustand-mounted.test.tsx` |
| Rückgabe an den Eigentümer | JOB 557 · D7 | `services/validation/src/rueckgabe-eigentuemer.test.ts` |
| KI-Sperre im Folgezustand | WP-SHIP9-B3FIX2 | `tests/validation/ai-gate-lock-followstate-mounted.test.tsx` |
| Schmale Auswahl | review26 | `tests/review26-pruefen-schmal/pruefen-schmal-auswahl.test.tsx` |

Die Browser-Belege oben wurden in diesem Lauf **nicht** wiederholt. Ihre Nennung bestellt keinen
Prüflauf.

## Offene Entscheidungen

1. **Konfliktkennzeichnung an der Karte (§8.2).** Ein `KnowledgeObject` trägt kein Konfliktfeld.
   Die Konfliktlage lebt in `useConflicts`. Sie an die Karte zu holen, hängt dem Board eine zweite
   Lade- und Fehlerquelle an. Das wurde schon in mega45 als Umbau gemeldet und angehalten
   (`apps/web/src/lib/validationFacets.ts:12-17`). Zu entscheiden ist: Markierung je Karte aus
   `useConflicts` (mit eigenem Fehlerzustand) oder Verbleib beim Reiterzähler.
2. **Zuordnung je Aufnahmepunkt.** Sie folgt, sobald die verknüpften Punkte vorliegen (siehe
   Quellenlage).

## Quellenwidersprüche

1. §8.2 nennt einen **Domänen**-Filter. Das KO hat kein Domänenfeld. Das Board filtert, wie die
   Bibliothek, nach **Wissensart** (`lib.facet.type`). Ob „Domäne“ die Wissensart meint, sagt die
   Quelle nicht.
2. §8.3 verlangt echte E-Mail-/Push-Zustellung von Zuweisungen. Heute gibt es nur In-App
   (`notifyAssignment`, FR-VAL-07). Das gehört nicht zu diesem Board-Auftrag und bleibt unverändert.
