# R-0570 · Wissen ohne Anmeldung — Unternehmenswissen nur angemeldet, anonyme Vorführung nur erfunden

*Aufnahme 20260922 · gesamt-anmeldung-sitzungen (`aufnahme:20260922:gesamt-anmeldung-sitzungen`),
Nacharbeit 4 auf Kandidat `e48d2f2b`. Diese Seite ordnet die Entscheidung dem Originalpunkt zu; sie
ändert weder dessen Wortlaut noch die Kriterien des Auftrags.*

## Die drei Quellen, wörtlich und unverändert

| Quelle | Wortlaut | Stand |
| --- | --- | --- |
| Originalpunkt R-0570 (Auftragskriterium K10) | „Wissen ohne Anmeldung lesen oder Fragen stellen." | Aufgenommener Zielzustand, Wortlaut bleibt erhalten |
| Historische Registerquelle (Anhang A der Frontend-Anforderungsbeschreibung, 24.06.2026) | „kein öffentlicher oder anonymer Zugang, jeder Zugang ist freigegeben und rollengebunden" — Registerstatus VERWORFEN | Historisch; bleibt als Herkunft erhalten |
| Entscheidung zu Frage 14 (Peter, 11.10.2026, `QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011.json`, `human_decisions[0]`) | „Firmenwissen authentifiziert; anonyme Demo nur öffentlich/fiktiv." | **Maßgeblich** — jüngste ausdrückliche Nutzerentscheidung |

## Die geltende Einordnung

Der Widerspruch zwischen Originalpunkt und historischer Verwerfung ist durch die Entscheidung
aufgelöst. Keiner der beiden Texte wird gestrichen; beide gelten mit klarer Grenze:

- **Unternehmenswissen** — alles im Wissensspeicher, ausdrücklich auch geladene Vorführdaten
  (`KLARWERK_DEMO_SEED`) — ist **nur nach Anmeldung** lesbar und befragbar. Insoweit gilt die
  historische Aussage unverändert weiter.
- **Anonymes Lesen und Fragen** (R-0570) gibt es **ausschließlich** in einer Vorführung mit
  ausdrücklich **erfundenen** Inhalten. Insoweit ist der Originalpunkt umgesetzt.

## Umsetzungsstand (dieser Arbeitsbaum, nach Kandidat `e48d2f2b`)

| Teil | Umsetzung |
| --- | --- |
| Inhalte | `services/app/src/vorfuehrung/inhalte.ts` — fester, erfundener Bestand des fiktiven Betriebs „Musterwerk", DE/EN/NL, jeder Titel als „fiktiv" gekennzeichnet. Die Datei importiert nichts. |
| Server | `GET /api/vorfuehrung` (lesen) und `GET /api/vorfuehrung/frage?q=…` (fragen) in `services/app/src/routes/vorfuehrung-routes.ts`. Beide öffentlich, nur lesend, ohne Modell; „Fragen" ist eine Suche im festen erfundenen Bestand. Jede Antwort trägt `fiktiv: true` und die Kennzeichnung. |
| Schalter | `KLARWERK_VORFUEHRUNG_ANONYM`, Vorgabe **aus** (`feature-flags.ts`, Startvertrag, `env.demo.beispiel`). Aus → beide Wege 404 ohne Inhalt, kein Verweis auf der Anmeldemaske. |
| Oberfläche | `/vorfuehrung` vor dem Anmeldetor (`apps/web/src/App.tsx`, `apps/web/src/vorfuehrung/VorfuehrungScreen.tsx`); Verweis auf der Anmeldemaske nur bei eingeschaltetem Schalter. |
| Routenvertrag (R-0557) | Beide Wege mit Begründung in `tests/security/routeGuardAudit.ts` und in der Rollenabnahme (`tests/beta-rollenabnahme/tabelle.ts`). |
| Abgrenzung, gemessen | `tests/vorfuehrung-anonym/abgrenzung.test.ts`: erlaubt (lesen, fragen, Sprache), ausgeschlossen (ein echtes Wissensobjekt ist weder über die Vorführung noch über `/api/kos`, `/api/kos/:id`, `/api/ask` ohne Anmeldung erreichbar), Isolation am Quelltext. `tests/vorfuehrung-anonym/flaeche-mounted.test.tsx`: dieselbe Fläche gemountet gegen den echten Server. `tests/demo-zugang-gaeste/kein-offener-zugang.test.ts` bleibt unverändert gültig. |

## Was ausdrücklich nicht entschieden und nicht gebaut ist

- **Ob eine Installation die Vorführung zeigt**, ist eine Betriebsentscheidung (Vorgabe aus). Diese
  Lieferung schaltet sie nirgends ein.
- **Eine KI-Antwort für Unangemeldete** ist nicht gebaut: Sie wäre ein offener Kostenweg und eine
  Übermittlung an einen Dritten ohne Kenntnisnahme; darüber gibt es keine Entscheidung.
- **„Öffentliche" (statt erfundener) Inhalte** — etwa veröffentlichte Dokumente eines Betriebs — sind
  nicht vorgesehen. Die Entscheidung erlaubt sie; welche Inhalte das wären und wer sie freigibt, ist
  nicht festgelegt.
