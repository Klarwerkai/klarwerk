# Teams — Mitgliedschaftsweg auf bestehenden Konten

Auftrag `produkt:20261009:admin-teams` (ADMIN-06). Code: `services/app/src/teams.ts`,
`services/app/src/routes/teams-routes.ts`, Oberfläche `apps/web/src/pages/AdminTeams.tsx`
(Verwaltung › Benutzer und Rollen › Teams).

## Was ein Team ist

- Name, Zweck, zuständige Person und die **Kennungen** der Mitglieder. Ein Team ist keine Kopie von
  Nutzerkonten: Name, Rolle, Zugang und Befristung stehen weiter nur am Konto.
- Ein Team hat **keine Rolle** und ändert keine globale Rolle.
- Zuständig sein heisst nicht Mitglied sein: die Teamzuständigkeit gewährt keinen Zugang.
- Jede Änderung ist eine neue, unveränderliche Fassung (`teams_fassungen`); auch das Archivieren.

## Drei Wege zu einem Space, getrennt erklärt

| Weg | Wo gepflegt | Wirkung |
| --- | --- | --- |
| Globale Rolle | Konto (Benutzer und Rollen) | Keine Inhalte geschlossener Spaces; im offenen Space entscheidet sie über Schreiben (`ko.create`). |
| Direkte Space-Mitgliedschaft | Space bearbeiten → Mitglieder | Lesen oder Schreiben in diesem Space. |
| Teammitgliedschaft | Team → Mitglieder; Space bearbeiten → Teams | Jedes aktive Mitglied eines gebundenen Teams hat das Recht der Bindung. |

Die Wirkungsvorschau vor dem Hinzufügen, Entfernen und Archivieren nennt je Person und gebundenem
Space das Recht vorher und nachher und **alle** Wege, die danach noch bestehen (zuständig, direkt,
andere Teams, offener Zugang). Entfernen aus einem Team nimmt nur, was dieses Team gewährt hat.

## Wann ein Entzug wirkt (Frist)

**Ab der nächsten Anfrage des betroffenen Kontos — ohne Wartezeit, auch aus einem schon offenen
Tab.** Grundlage ist das bestehende Sitzungs-/Berechtigungsmodell: die Sitzung trägt nur die
Identität; welche Spaces lesbar sind, erhebt `makeGuards` (`services/app/src/http.ts`) bei **jeder**
Anfrage neu aus dem aktuellen Space- und Teamstand (`TeamAufloesendeSpaces` → `lesbareSpaces` →
`sichtbarkeit.ts`). Detailabruf, Liste, Suche, Anhänge und Klara verweigern danach serverseitig;
ein unsichtbarer Artikel antwortet mit 404.

Grenze: Was ein offener Tab **vor** dem Entzug bereits geladen hat, bleibt in dessen Anzeige, bis
er neu lädt oder die nächste Anfrage stellt — der Server liefert nichts mehr nach. Eine Sitzung
wird durch den Entzug nicht beendet; das ist auch nicht nötig, weil sie keine Rechte zwischenspeichert.

## Archivieren

- Vor der Bestätigung zeigt die Karte die gebundenen Spaces und wer dort den Zugang verliert bzw.
  über einen anderen Weg behält.
- Danach: keine neuen Mitglieder, keine Änderungen, keine neue Bindung an einen Space; das Team
  gewährt keinen Zugang mehr. Bestehende Bindungen bleiben in der Space-Fassung als „archiviert"
  sichtbar.
- Inhalte, Autorschaft, Fassungen und Prüfprotokoll bleiben unverändert — ein Team besitzt keine
  Inhalte. Alle Teamfassungen bleiben lesbar.

## Bestätigung und Nebenläufigkeit

Mitgliederänderung und Archivieren tragen die `grundlage` der gezeigten Vorschau. Hat sich seither
das Team, ein gebundener Space oder ein anderes Team so geändert, dass die Wirkung anders wäre,
schreibt der Server nichts und gibt die neue Vorschau zurück (409 `VORSCHAU_VERALTET`).

## Rechte und Nachweis

- Alle Teamwege verlangen `users.manage` (Kontoverwaltung); andere Rollen erhalten 403 und es wird
  nichts geschrieben oder protokolliert.
- Prüfprotokoll: `team.angelegt`, `team.geaendert` (mit hinzugefügt/entfernt), `team.archiviert`;
  Spacebindungen in `space.angelegt`/`space.geaendert` (`teams`, `vorherTeams`).
- Der Teamverlauf (`GET /api/teams/:id`) nennt je Fassung Vorgang, Person, Zeitpunkt und wer
  hinzukam oder ging — nach Neuladen aus der Datenbank.

## Abgrenzung

Keine Verzeichnissynchronisation, kein SCIM, keine Chatgruppen. Der Space-Anschluss (Bindung eines
Teams an einen Space) nutzt die bestehende Spacepflege; seine Abnahme erfolgt gemeinsam mit ADMIN-07.
