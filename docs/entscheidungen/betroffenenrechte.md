# Betroffenenrechte — Auskunft, Datenmitnahme, Löschantrag, Verarbeitungsverzeichnis

*Aufnahme 20260922 · gesamt-betroffenenrechte (Revision 1). Gebaut auf Basis `1.0.0-beta.1.730`,
Commit `863a0974`. Erfasst die Lieferung zu R-0583, R-0661, R-0663, R-0667, R-1645, R-2063 und
SOLL:NFR-PRV-04. Die Fassung, in der die Lieferung live geht, und ihr Deploy-Beleg entstehen erst
mit der Veröffentlichung; bis dahin gilt hier: **gebaut und im Prüflauf, nicht ausgeliefert**.*

## Kurzbild

| Anliegen | Geliefert | Beleg (Tests) | Offen |
| --- | --- | --- | --- |
| R-0583 Datenklassifikation aller Datenflächen | Dateninventar im Code (`services/app/src/dateninventar.ts`): jede migrierte Tabelle in genau einer Datenart, dazu Sicherungen, Server-Protokolle, Endgerät; je Datenart Inhalt, Personenbezug, Ablage, Löschweg, Frist, Auskunftsstand, Befund | `tests/betroffenenrechte/dateninventar.test.ts` (I1–I3, I5) | Fristen je Datenart (Betreiber, Ownerfrage 1 in `loeschung-aufbewahrung.md`); Folgenabschätzung selbst |
| R-0661 Löschantrag durch den Nutzer selbst | Profil → „Konto löschen lassen": Antrag mit optionaler Begründung, Frist ein Monat; Aufgabe in Glocke und Datenschutzkarte der Verwaltung, überfällig nach Fristablauf; Erledigen über den vorhandenen Löschweg (`user.delete`), Ablehnen nur mit Grund, Zurückziehen durch den Antragsteller | `tests/betroffenenrechte/auskunft-und-loeschantrag.test.ts` (L1–L4), `…/flaechen.test.tsx` (F2, F3), `…/betroffenenrechte-pg.integration.test.ts` (P1, P2) | Verweisumschreibung bei Kontolöschung (R-0642, gesonderter Auftrag) |
| R-0663 Selbstauskunft und Datenmitnahme „Meine Daten" | Profil → „Meine Daten": Zählung je Bereich und Download als JSON — Konto (ohne Passwort-Hash), eigene Objekte, Bearbeitungen, Kommentare, Entwürfe, Fragen, Antworten, Bewertungen, Zuweisungen, Kenntnisnahmen, Uploads (Metadaten), Lernpfade, Bereichsverantwortung/Ruhestandshorizont, Löschanträge, Protokollzeilen; dazu die Liste dessen, was nicht enthalten ist, mit Grund | `…/auskunft-und-loeschantrag.test.ts` (A1–A3), `…/flaechen.test.tsx` (F1), `…/betroffenenrechte-pg.integration.test.ts` (P3) | — (Nacharbeit 4: KI-Läufe der Person sowie Klara-Sitzungen und Zustimmungen stehen jetzt in Selbst- und Verwaltungsauskunft; Lesewege `ModelRunRepo.vonAkteur`, `KlaraSessionRepo.sitzungenVon`/`consentsVon`) |
| R-0667 Verarbeitungsverzeichnis aus dem System | Verwaltung → Sicherheit und Nachweise → Datenschutz → Verarbeitungsverzeichnis (JSON/Markdown), erzeugt aus Inventar und Betriebslage (effektive Modellanbieter, Recherche, Mailversand) | `…/dateninventar.test.ts` (I4), `…/auskunft-und-loeschantrag.test.ts` (A3) | Rechtsgrundlage, Verantwortlicher/DSB, Fristen: „vom Betreiber einzutragen" |
| R-1645 Wissens-DSGVO-Funktion | Auskunft durch die Verwaltung für jedes Konto, auch nach Löschung (Beiträge mit der alten Kennung), mit Übergabe-Stand (verantwortete Objekte, Autorschaft, offene Prüfungen, zugewiesene Fragen) | `…/auskunft-und-loeschantrag.test.ts` (A2, A3, L3) | — |
| R-2063 / SOLL:NFR-PRV-04 Betroffenenrechte umsetzbar | Auskunft (Art. 15), Datenmitnahme (Art. 20), Löschantrag (Art. 17/12) und Verzeichnis (Art. 30) im Produkt | alle oben | Löschung im Audit (bewusst nicht), Verweisumschreibung (R-0642), rechtliche Bewertung |

## Grenzen der Lieferung (ehrlich)

- **Erledigen löscht Konto und Anmeldesitzungen — sonst nichts.** Beiträge, Kommentare, Bewertungen,
  Fragen und Protokollzeilen tragen die Kennung weiter. Das Umschreiben auf „ehemalige Person" ist
  R-0642 und hängt an Ownerfrage 2 (`loeschung-aufbewahrung.md`); dieser Auftrag nimmt es nicht vorweg.
  Die Oberfläche sagt das dem Antragsteller und der Verwaltung wörtlich.
- **Erledigen übernimmt zuerst** (Nacharbeit 4): der Antrag geht unteilbar von `offen` nach
  `in_bearbeitung` (mit Übernahmemarke), erst dann wird das Konto gelöscht, dann mit derselben Marke
  `erledigt`. Zurückziehen, Ablehnen und eine zweite Erledigung scheitern in dieser Zeit mit 409.
  Scheitert das Löschen, wird die Übernahme freigegeben (wieder `offen`); bricht der Vorgang ganz ab,
  ist sie nach 5 Minuten (`UEBERNAHME_GUELTIG_MS`, technischer Wert) wieder übernehmbar — die
  nächste Erledigung findet das Konto dann ggf. bereits gelöscht und vermerkt das. Die Liste der
  Verwaltung liefert dafür `wiederaufnehmbar`; die Datenschutzkarte zeigt an einem solchen Antrag
  „Erledigung wieder aufnehmen" (Nacharbeit 5). Ablehnen bietet sie dort nicht an, weil der Server
  es nur an offenen Anträgen zulässt.
- **Protokollzeilen über den eigenen Antrag:** Entscheidungen der Verwaltung (`loeschantrag.erledigt`,
  `loeschantrag.abgelehnt`) erscheinen in der Auskunft des Antragstellers über `payload.nutzerId`.
- **Frist:** ein Kalendermonat ab Antrag (Art. 12 Abs. 3 Satz 1). Die Quellen nennen keine Frist;
  die Verlängerung nach Satz 2 ist nicht abgebildet.
- **Letzter Admin:** sein Antrag lässt sich nicht durch Löschen erledigen (vorhandener Schutz,
  409 `LETZTER_ADMIN`); er bleibt offen, bis ein weiteres Verwalterkonto besteht oder abgelehnt wird.
- **Desktop-Journal-Betrieb:** ohne Datenbank nimmt die Instanz keine Anträge an (503), statt sie beim
  Neustart zu verlieren — dieselbe Regel wie die Kenntnisnahme.
- **Prüfprotokoll ohne Freitext:** belegt werden `loeschantrag.gestellt|zurueckgezogen|erledigt|abgelehnt`
  und `datenschutz.auskunft` mit Kennungen und Frist; Begründung und Ablehnungsgrund stehen nur am Antrag.
- **Uploads:** die Auskunft nennt Metadaten eigener Dateien, nicht die Bytes (am Objekt abrufbar).
- **Hilfetext der Datenschutzkarte** (`seitenhilfe.admin.datenschutz.text`) beschreibt weiter nur die
  Sicherheitsaussagen; er wurde nicht geändert, um den festgehaltenen Textbestand nicht zu brechen.

## Abgrenzung zu gesonderten Aufträgen und abgeschlossenen Teilumfängen

- **Löschung, Aufbewahrung, Löschsperren** (`docs/entscheidungen/loeschung-aufbewahrung.md`,
  R-0634/0637/0638/0642/0646/0654/0657/0662): gesondert, nicht Teil dieser Lieferung. Wiederverwendet
  wird nur der vorhandene Löschweg `AuthService.deleteUser`.
- **Kundenbetrieb-Sicherung und Restore-Drill** (JOB 4010/4057/4097/4227): abgeschlossen; hier nur um
  die neue Tabelle `loeschantraege` in `PFLICHTTABELLEN` ergänzt.
- **Fachlicher Bibliotheks-Export** (`GET /api/library/export`): vorhanden, unverändert; er ersetzt
  den personenbezogenen Export nicht und wird von ihm nicht ersetzt.
- **Kenntnisnahme** und **Firmenwörterbuch**: unverändert; ihre Daten erscheinen im Inventar bzw. in
  der Auskunft.

## Quellenwidersprüche

1. **R-0583 „Juli-Quelle führt es als erledigt".** Das Klassifikationsdokument
   (`docs/compliance/data-protection-requirements.md` §1) führte acht Datenflächen, während `migrate()`
   über fünfzig Tabellen anlegt; Abnahmebeleg fehlte. Jetzt ist das Inventar im Code an die Migration
   gebunden; das Dokument verweist darauf.
2. **„Prompts/Antworten werden nicht gespeichert"** (`data-protection-requirements.md` §3) war zu grob:
   Texte werden nicht gespeichert, wohl aber Antwortbelege (Kennung, Zeit, Eigentümer, Quellen) und
   der Fragetext unbeantworteter Fragen (`gaps`). Die Zeile ist korrigiert.
3. **R-0663: Runbook (25.07.) „blosse Idee" gegen Landkarte v3 „Stufe 2".** Die Quelle sagt „v3
   entscheidet"; gebaut wurde nach v3.
4. **R-0661 „Heute kann nur ein Verwalter löschen".** Bleibt richtig für das Löschen selbst — der
   Antrag ist bewusst kein zweiter Löschweg.
5. **`loeschung-aufbewahrung.md` (Lauf 1, Commit `3a859e7b`) nennt das Aufräumen abgelaufener
   Klara-Sitzungen „nicht verdrahtet".** Am heutigen Stand startet `server.ts` den Lauf
   (`klara-aufraeumen.ts`, R-0609). Das Inventar gibt den heutigen Stand an; das Dokument des
   gesonderten Auftrags ist nicht geändert.
6. **Frist des Löschantrags:** keine Quelle nennt sie; gewählt ist die gesetzliche Regelfrist (s. o.).
7. **„KI-Läufe ohne Personenbezug"** (alte Klassifikation §1 und die erste Fassung dieses Inventars)
   ist widerlegt (Prüflauf Nacharbeit 1): `ModelRunRecord` trägt seit dem Laufkontext die Kennung
   der anfragenden Person (`actor`). Richtig bleibt nur der Befund aus R-0583 — **keine Inhalte**.
   Inventar und §1 sind korrigiert. Seit Nacharbeit 4 stehen die KI-Läufe der Person auch in der
   Auskunft (neuer Leseweg `vonAkteur`), ebenso Klara-Sitzungen und Zustimmungen.

## Fehlende Belege (benannt, nicht ersetzt)

- Keine fachliche oder rechtliche Abnahme durch Betreiber/Datenschutzbeauftragten; keine DSFA.
- Keine Bedienung durch echte Mitarbeitende und Verwalter; Nachweis nur über Tests (jsdom-Flächen,
  HTTP gegen die echte App, PostgreSQL-Ablage).
- Der Lieferbeleg mit Fassung (Deploy, Livefassung) entsteht erst mit der Veröffentlichung.

## Befund am Basisstand (fremd, unverändert)

- `tests/backup-drill/tabellensatz.test.ts` verlangt jede migrierte Tabelle in `PFLICHTTABELLEN`
  (`scripts/backup/restore-drill.sh`). `management_category_profiles` und
  `management_retirement_horizons` (R-0751/R-1639/R-2183) werden migriert, stehen dort aber nicht;
  seit der Integration mit main ebenso `verantwortung_nachfolge` (produkt:20261007:ownership-uebergabe,
  main brachte die Stufe ohne Drill-Eintrag). Rot belegt in Nacharbeit 11 (Kandidat `cc653af7`).
  Das liegt ausserhalb dieses Auftrags und ist hier nur benannt; die Löschanträge selbst stehen im
  Drill (`dateninventar.test.ts`, Löschantrags-Stufe).
- Prüflauf Nacharbeit 1 (Kandidat `e70c4636`), rot nur an fremden Routen — `datenschutzRoutes`
  selbst ist in allen drei Wächtern abgenommen (`rollen-am-draht.test.ts` 144/144 grün):
  - `tests/beta-rollenabnahme/jede-gruppe-steht-in-der-tabelle.test.ts` W2/W8: `begriffeRoutes`
    (Firmenwörterbuch) ohne Tabellenzeile; Schreibzeile `PUT /api/drafts/:id/pool` ohne Zeilennummer.
  - `…/jede-registrierte-route-ist-abgenommen.test.ts` E2/E8: sieben Türen ohne Platz
    (`GET /api/admin/import/knowledge/:koId` und sechs `/api/begriffe…`), daher 227 statt 234.
  - `tests/security/g10-herkunft-zentrum-vertraulich.test.ts`: drei `/api/library/import…`-Routen
    fahren `darfSehen` ohne Zeilenrechtseintrag.
  Diese Dateien sind deshalb nicht mehr in der Prüfauswahl dieses Auftrags; die Befunde bleiben im
  Archiv (`HISTORIE/nacharbeit-1/PRUEFUNG`).
