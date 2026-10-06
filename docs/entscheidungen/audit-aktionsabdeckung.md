# Audit-Aktionsabdeckung: jede §12.3-Aktion → Auditereignis → Test

*Aufnahme 20260922 · gesamt-auditprotokoll:aktionsabdeckung (R-0607, R-0733, R-1743, R-2125, R-2206,
FR-AUD-01). Teil (2) der Aufteilung nach `entscheidung:4b2300be`. Setzt die Restmatrix aus R-2206 fort
und damit `tests/audit-gesamt/aktionsmatrix-12-3.test.ts` aus dem Integritätskern
(`docs/entscheidungen/gesamt-auditprotokoll.md`). Was dort schon belegt ist, wird hier nur verwiesen.*

## Abgleich vor der Umsetzung

Am Basisstand `3264ad7d` gemessen (Quelleninspektion):

- Jede in §12.3 genannte Aktionsart schreibt einen Eintrag mit `actor`, `action`, `target`, `at`;
  die HTTP-Matrix des Kerns fährt jede Art einmal mit der Rolle, die sie im Betrieb fährt.
- **Lücke R-0733:** Die Entscheidungsbelege `conflict.resolved` und `conflict.dismissed` trugen keine
  Nutzlast — das Protokoll sagte „es wurde entschieden", aber nicht wie und über welche Objekte.
  `conflict.escalated` nannte die Objekte ebenfalls nicht. Die drei Dublettenentscheidungen nannten die
  Objekte, nicht den Ausgang.
- **Lücke Varianten:** Validieren über die Admin-Freigabe und über die Übernahme eines
  Änderungsvorschlags, Ablehnen eines Änderungsvorschlags, Konflikt-Fehlalarm, die drei
  Dublettenentscheidungen sowie Nutzerverwaltung über Freigabe, Passwort-Setzen und Löschen hatten
  keinen Test am Draht in der §12.3-Matrix.

## Lieferung

- `ConflictService.resolve`/`dismiss`: Nutzlast `{ koIds: [koA, koB], resolutionReason }`
  (`"decided"` / `"dismissed"`); `escalate`: `{ koIds }`. `OverlapService.close` (getrennt lassen,
  verwandt, Fehlalarm, auch über `/status`): zusätzlich `resolutionReason`.
- Der Begründungstext einer Entscheidung bleibt am Konflikt bzw. an der Dublette
  (`decision`/`decidedBy`, `resolution.note`). In die unlöschbare Kette kommt kein Freitext.
- Neue Testdatei `tests/audit-gesamt/aktionsabdeckung-entscheidungen.test.ts`: ein Fall je offener
  Variante, jeweils auf eigener Bühne über HTTP; geprüft werden genau ein Eintrag je Aktion,
  Handelnder, Ziel, Zeitstempel innerhalb des Falls, die Nutzlast und danach die Kette.

## Matrix

| §12.3-Aktion | Auditereignis (`action`) | Test |
| --- | --- | --- |
| Erfassen | `ko.created` | `aktionsmatrix-12-3.test.ts` |
| Validieren (Bewertung Grün) | `ko.rated` (`verdict: up`) | `aktionsmatrix-12-3.test.ts` |
| Validieren (Admin-Freigabe) | `ko.admin-validated` (`koVersion`) | `aktionsabdeckung-entscheidungen.test.ts` |
| Validieren (Vorschlag übernommen) | `ko.revised` (Einreicher) + `ko.admin-validated` (`proposalId`) | `aktionsabdeckung-entscheidungen.test.ts` |
| Ablehnen (Bewertung Rot) | `ko.rated` (`verdict: down`) | `aktionsmatrix-12-3.test.ts` |
| Ablehnen (Vorschlag) | `ko.proposal-rejected` (`proposalId`) | `aktionsabdeckung-entscheidungen.test.ts` |
| Kommentieren | `ko.commented` | `aktionsmatrix-12-3.test.ts` (s. Quellenwiderspruch) |
| Konflikt | `conflict.created` (`koIds`) | `aktionsmatrix-12-3.test.ts` |
| Eskalation | `conflict.escalated` (`koIds`) | `aktionsmatrix-12-3.test.ts`, Nutzlast: `aktionsabdeckung-entscheidungen.test.ts` |
| Konfliktauflösung (Entscheidung) | `conflict.resolved` (`koIds`, `resolutionReason: decided`) | `aktionsmatrix-12-3.test.ts`, Nutzlast: `aktionsabdeckung-entscheidungen.test.ts` |
| Konflikt-Fehlalarm (Entscheidung) | `conflict.dismissed` (`koIds`, `resolutionReason: dismissed`) | `aktionsabdeckung-entscheidungen.test.ts` |
| Dublettenentscheidung | `overlap.dismissed` / `overlap.kept-separate` / `overlap.linked-related` (`koIds`, `resolutionReason`) | `aktionsabdeckung-entscheidungen.test.ts` |
| Zuweisung | `ko.assigned` (`userIds`) | `aktionsmatrix-12-3.test.ts` |
| Kategorie | `ko.category-changed` | `aktionsmatrix-12-3.test.ts` |
| Neu-Validierung | `ko.revalidated` (`version`) | `aktionsmatrix-12-3.test.ts` |
| „Hat geholfen" | `answer.helpful` | `aktionsmatrix-12-3.test.ts` |
| Export | `library.export` (`format`, `koIds`, `count`) | `aktionsmatrix-12-3.test.ts` |
| Import (Einreihen über `POST /api/library/import`) | `import.candidates-created` (`count`) | `aktionsmatrix-12-3.test.ts` |
| Import (Annahme des Kandidaten) | `import.candidate-accept` (`koId`, `duplicate`) | `aktionsmatrix-12-3.test.ts` |
| Anmeldung / Abmeldung | `auth.login` / `auth.logout` | `aktionsmatrix-12-3.test.ts` |
| Nutzerverwaltung (Rolle) | `user.role-change` (`previousRole`, `role`) | `aktionsmatrix-12-3.test.ts` |
| Nutzerverwaltung (Freigabe, Passwort, Löschen) | `user.approve`, `user.password-reset`, `user.delete` | `aktionsabdeckung-entscheidungen.test.ts` |
| Autorenübergabe | `ko.author-transferred` | `aktionsmatrix-12-3.test.ts` |

Append-only-Verweigerung über die schreibenden Schnittstellen (R-2206, zweiter Satz): geliefert und
belegt im Kernauftrag (`tests/audit-gesamt/append-only-http.test.ts`,
`tests/audit-gesamt/append-only-verweigerung.integration.test.ts`); hier nicht wiederholt.

## Grenzen

- **Konto anlegen** (Selbstregistrierung, `POST /api/users`) schreibt weiterhin keinen eigenen
  Eintrag. Ein vom Admin angelegtes Konto erscheint im Protokoll über `user.approve` (und ggf.
  `user.role-change`, `user.access-expiry-set`) mit dem Admin als Handelndem; eine Selbstregistrierung
  erst mit ihrer Freigabe. Ein eigenes `user.created` hätte die Zählungen vieler bestehender
  Kontotests verschoben und ist hier nicht eingeführt.
- **Import seit R-0143:** `POST /api/library/import` reiht nur noch Kandidaten ein; `library.import`
  schreibt nur der Dienstweg `importJson`, den keine Route mehr ruft. Die Matrix belegt deshalb
  Einreihen und Annahme (Nacharbeit 1: die Kernmatrix erwartete noch `library.import` und war rot).
  Ablehnen/Rückfrage eines Kandidaten (`import.candidate-reject`/`-info`) sind nicht eigens gefahren.
- **Server-Protokoll (R-0733, Lesart des Kerns):** die Protokollierung von Fehler- und
  Abweisungsentscheidungen des Servers ist im Kern belegt (`tests/security/log-keine-inhalte.test.ts`);
  diese Lieferung ergänzt die fachlichen Entscheidungen im Auditprotokoll.
- **PostgreSQL:** die Änderung betrifft nur die Nutzlast bestehender Einträge, nicht ihre
  Schreibreihenfolge oder Transaktion; der Nachweis läuft im Speicherweg. Der PostgreSQL-Weg des
  Integritätskerns bleibt dort offen (Entscheidung `f43fa030`).
- **Kein Leistungsprotokoll (R-0669):** es entsteht keine Auswertung je Person.

## Quellenwiderspruch

R-0607 nennt das Kommentieren als fehlend; `ko.commented` wird seit `5471af3b` geschrieben und ist in
der Kernmatrix gefahren. Die Ausnahme „solange diese Funktion fehlt" greift damit nicht mehr.
