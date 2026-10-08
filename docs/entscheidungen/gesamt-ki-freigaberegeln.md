# Externe KI und Recherche je Aufgabe und Datenklasse freigeben

*Aufnahme 20260922 · gesamt-ki-freigaberegeln, Revision 1 · Basis `064ded35` (`1.0.0-beta.1.746`).
Lauf vom 08.10.2026, Nacharbeit 2 auf Kandidat `d1e79dca`. Die Fassung, unter der diese Lieferung live
geht, entsteht erst bei der Veröffentlichung. Bis dahin ist hier nichts als „ausgeliefert" belegt (K12).*

Grundlage sind die Kriterien K1–K12 aus `AUFTRAG-B1.json` und ihre Originalpunkte in `QUELLEN.json`.
Massgeblich für alle KI-Wege ist Pedis Entscheidung vom 10.09. (`decision-evidence:K18`,
Originalstellen 3924/3927/3934/4022): eine zentrale Adminfreigabe für öffentliche KI, getrennt davon
eine für vertrauliche Inhalte, verbindlich in ALLEN KI-Wegen einschliesslich Word, ohne
widersprüchliche Zusatzsperren. Der Beschluss vom 18.08. („Vertraulich Markiertes bleibt IMMER
draußen") ist der ältere und gilt für die Ausleitung nicht mehr.

## Was dieser Auftrag geändert hat

| Kriterium | Änderung | Beleg (Test) |
| --- | --- | --- |
| K1 (R-0586) | Deklarierte Liste aller ausgehenden Ziele des Servers samt Word-Add-in (`services/app/src/ausgehende-ziele.json`; Daten statt Modul, weil der Egress-Wächter die Modellhosts in keiner `.ts`-Datei ausser den Chokepoint-Clients zulässt) | `tests/ki-freigaberegeln/ausgehende-ziele.test.ts` |
| K8/K9 · Grundfreigabe auch für die Transkription | `/api/media/analyze` fragt die zentrale Grundfreigabe; vorher ging ein Medium ohne Freigabe hinaus | `services/media/src/service.test.ts`, `tests/admin-ki-freigabe/transkription-grundfreigabe.test.ts` |
| K8/K9/K10 · zweite Freigabe bis zum Anbieter (Ben Nacharbeit 2, Befund 1) | Einstufung und Ausleitungsberechtigung sind getrennt. Der Reasoner setzt je Versuch einen Merker (`ModellAufrufSpur.vertraulichFreigegeben`), wenn der Text vertraulich ist, beide Freigaben stehen und die Anfrage den Anbieter zulässt. Nur dann lässt der gekapselte Client (`cappedModelClient`, weiter `rejectsConfidential: true`) Vertrauliches durch; ohne Merker weist er es ab wie bisher. Fehlende Klara-Zustimmung und ungültige Bindung sperren unabhängig davon (`bindeAnbieter(null)` → `anbieterZugelassen`) | `tests/admin-ki-freigabe/vertrauliche-freigabe-bis-zum-anbieter.test.ts` (gekapselter Client), `tests/admin-ki-freigabe/ka4-direktwege-volle-kette.test.ts` (echte Wurzel, Transport mitgeschrieben) |
| K8/K10 · Word-Dokumenttext (Befund 2) | `pruefeDokumenttextDeckung`: Stufe „vertraulich" hebt nur die zweite Freigabe auf (`KlaraPolicyQuelle.vertraulichFreigegeben`, aus `Reasoner.vertraulicheAusleitungFreigegeben()`). Zustimmung je Dokument, Klasse `document_text`, Dokumentbindung und Riegel bleiben. Geht vertraulicher Dokumenttext hinaus, reist die Einstufung bis in den Reasoner (`dokumenttextVertraulich`) | `tests/admin-ki-freigabe/vertrauliche-freigabe-bis-zum-anbieter.test.ts` V5 |
| K8/K10 · Wissenscheck (Befund 2) | `check-text-routes.ts`: `ausleitungGesperrt` (Klara-Bindung ohne Zustimmung, sperrt immer) getrennt von `eingestuftVertraulich` (öffnet mit der zweiten Freigabe); die Urteile bekommen die Einstufung mit | `services/app/src/routes/check-text-routes.test.ts` (drei neue Fälle), `tests/r1864-w9-zuordnung/w9-quelle-und-zuordnung.test.ts` E2 (nachgeführt) |
| K8/K10 · Transkription (Befund 2) | Vertrauliche Medien gehen mit beiden Freigaben hinaus; der Chokepoint `cappedTranscriber` fragt dieselbe Entscheidung (`vertraulichFreigegeben`) | `services/media/src/service.test.ts`, `tests/admin-ki-freigabe/transkription-grundfreigabe.test.ts` (zweiter Fall) |
| K2 (R-0606) · Kopfzeile (Befund 3) | `shell/ExternStatus.tsx` zeigt über dem Kopfband „Extern: Blockiert" / „Extern: Freigegeben" / „Extern: Freigegeben, auch Vertrauliches", gebunden an `publicStatus().extern` (dieselbe Entscheidungsstelle `oeffentlicheKiErlaubt`). Eigene Zeile wie die Demo-Kennzeichnung: die vermessene Kopfbandzeile verliert keine Breite | `tests/admin-ki-freigabe/vertrauliche-freigabe-bis-zum-anbieter.test.ts` V6, `tests/ki-freigaberegeln/extern-kopfzeile.test.tsx` |
| K5 (R-0628) | Gleichlauf-Messung der Vertraulichkeitslesart | `tests/ki-freigaberegeln/vertraulichkeit-eine-lesart.test.ts` |
| K7 (R-2066) | Prinzipien dokumentiert (`docs/compliance/vertrauenswuerdige-ki.md`) | `tests/ki-freigaberegeln/prinzipien-beleg.test.ts` |

Nachgeführte Bestandsfestschreibungen, die genau die abgelöste Zusatzsperre festhielten:
`ka4-direktwege-volle-kette.test.ts` (Stufe „beide": der gespeichert vertrauliche Entwurf mit Zustimmung
ist jetzt ein Positivfall; Sperrfälle ohne Zustimmung/mit fremder Bindung bleiben Null-Abruf-Fälle, Ursache
`confidential`), `w9-quelle-und-zuordnung.test.ts` E2 samt `docs/entscheidungen/r1864-w9-zwei-wege.md`.
Keine Sperre gegen fehlende Zustimmung wurde gelockert.

## Stand je Kriterium

- **K1 · R-0586:** gebaut. Geltungsbereich Server (`services/**`) und Word-Aufgabenfenster; nicht erfasst
  `desktop-app/`, `scripts/`, `tools/`.
- **K2 · R-0606:** Vorgabe gesperrt; die Kopfzeile zeigt den wirksamen Stand. Die Stufen sind zweistufig
  steuerbar (intern / vertraulich einschliesslich streng vertraulich), siehe K6.
- **K3 · R-0615:** Bestand (vier Stufen, Vorgabe `search_on_click`, `blocked` serverseitig), belegt durch
  `tests/app/external-policy-e2e.test.ts`.
- **K4 · R-0627:** `dropConfidential` hält vertrauliche Objekte aus Antwortkontext und Export — für alle
  Nutzer und unabhängig davon, ob ein lokales oder öffentliches Modell antwortet. Das ist die
  Sichtbarkeitsregel von R-0627 selbst und keine Zusatzsperre gegen die Adminfreigabe; sie bleibt.
  Die Ausleitung vertraulichen Texts an ein Modell folgt dagegen jetzt der zweiten Freigabe.
- **K5 · R-0628:** eine Stufengrenze (`services/knowledge-object/src/confidentiality.ts`), Abschrift
  gemessen; die je Rolle verschiedene Lesart von „keine Stufe" ist festgehalten.
- **K6 · R-1665:** gesteuert über die zwei Schalter der Entscheidung vom 10.09.
- **K7 · R-2066:** dokumentiert; technische Zuordnung, keine Rechtsbewertung.
- **K8 · P-ADMIN-KI-FREIGABE:** Bestand (Kern, Rollen `users.manage`, Warn- und Bestätigungsdialog,
  Protokoll, Anbieter sichtbar) plus dieser Auftrag: Grundfreigabe auch für die Transkription, zweite
  Freigabe wirksam bis zum Anbieter in Erfassen/Bearbeiten, Urteilen, Wissenscheck, Word-Dokumenttext und
  Transkription.
- **K9 · package:kiwahl:** „Freigegebene Funktionen bleiben tatsächlich nutzbar" ist jetzt für
  Vertrauliches über den Betriebsweg belegt (gekapselter Client, echte Wurzel).
- **K10/K11:** Wegevertrag unten.
- **K12:** dieses Dokument; Lieferbeleg erst mit Veröffentlichung.

## Der Serververtrag je Weg (K10/K11)

„Grundfreigabe" heisst `kiFreigabe.oeffentlicheKi`, „zweite Freigabe" `kiFreigabe.vertraulicheInhalte`;
beide wirken nur mit `true`, die zweite nur zusammen mit der ersten.

| Weg | Ohne Grundfreigabe | Nicht vertraulich, Grundfreigabe | Vertraulich, beide Freigaben |
| --- | --- | --- | --- |
| Erfassen/Bearbeiten (`/api/reasoner`) | gesperrt | geht hinaus; mit Klara-Bindung nur mit Dokumentzustimmung | geht hinaus; mit Klara-Bindung nur mit Dokumentzustimmung für diesen Anbieter |
| Konflikt-/Dublettenurteil | gesperrt | geht hinaus | geht hinaus |
| Fragen (`/api/ask`) | gesperrt | geht hinaus | vertrauliche **Objekte** bleiben nach R-0627 aus dem Kontext (K4) |
| Word/Klara-Dokumenttext | gesperrt | Zustimmung je Dokument, Klasse `document_text`, Riegel `KLARA_DOCUMENT_TEXT_EGRESS_ENABLED` | dieselben Bedingungen; vertraulich markierter Text nicht mehr pauschal gesperrt |
| Wissenscheck, tiefe Prüfung | Urteile gesperrt | mit Modell | mit Modell; mit Klara-Bindung ohne Zustimmung immer deterministisch |
| Transkription | gesperrt | geht hinaus | geht hinaus |
| Externe Wissenssuche | Regler K3, nicht an die KI-Freigabe gebunden | — | — |

UI-Einwilligung (Klara-Zustimmung je Dokument), Berechtigung (`users.manage` für die Freigabe) und
serverseitiges Ausleiten (Kern `oeffentlicheKiErlaubt` plus Chokepoint-Merker) sind getrennte Stellen.

## Offene Belege und gesonderte Prüfungen

- **R-0628, Zuordnung der vier historischen Stellen:** Die Entscheidungsvorlage liegt nicht im
  Repository. Gemessen sind die heutigen Stellen; ob sie den vier der Vorlage entsprechen, ist eine
  Quellenlücke, keine fehlende Implementierung.
- **Menschenprobe und echte Instanz:** Kein Lauf gegen einen echten Anbieter und keine Bedienung durch
  einen Menschen. Kein Umschalten auf Pedis Instanz (Pedi erlaubt die Einstellung, nicht das Umschalten
  durch uns).
- **Word-Dokumenttext Ende-zu-Ende:** Belegt ist die Deckungsprüfung (V5) und die Weitergabe der
  Einstufung im Code. Der vorhandene Ende-zu-Ende-Test `tests/klara-dokumenttext/riegel-haelt-den-dokumenttext.test.ts`
  ist an der Basis unabhängig von diesem Auftrag rot (R5d, R5e, R7b, R7f, R7g: kein Modellaufruf auch
  auf der ungebundenen Konsole); deshalb gibt es dafür noch keinen grünen Ende-zu-Ende-Beleg.

## Abgrenzung

Abgeschlossene Bestandteile, nicht neu gebaut: JOB 3549 (Kern), 3502 (Klara/Word-Verbraucher), 3783
(Adminoberfläche), 3767 (fail-closed), 3666 (Wurzelverdrahtung), SCRUM-414 (Regler), SCRUM-502
(Chokepoint), R-0639/F-0295 (Dokumenttext-Riegel). Angaben aus den Quellen; nachgelesen wurde der Code.

## Prüfstand

Lokal ausgeführt wurde nichts. Nacharbeit 1 (`a7de8eb9`): grün waren `tools/build`, Biome und alle
Suiten dieses Auftrags. Rot und fremd/unverändert waren
`tests/klara-dokumenttext/riegel-haelt-den-dokumenttext.test.ts` (s. oben) und
`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts` F1/F4 (Register kennt fremde Helfer-Benutzer
`tests/uebernahme-standard-intern/…`, `tests/vertraulichkeit-pflicht/…` und neue Fälle in
`services/reasoner/src/anbieterbindung.test.ts`). `ka4-direktwege-volle-kette.test.ts` gehört seit
Nacharbeit 2 zum Umfang dieses Auftrags und ist nachgeführt.
