# Geführter Weg vom Problem zur Lösung (R-1662) — Bestandsaufnahme 08.10.2026

Auftrag `aufnahme:20260922:gesamt-problemloesungsweg` (Revision 1), Quelle
`gesamtaufnahme-20260922-v1-2b77e2c5d6b47400`, Originalpunkt R-1662 (Addendum
`KLARWERK_Codex_Next_Prompt_Knowledge_OS_Addendum.md:162`, „A. Problem Resolution Flow“).
Basisstand des Arbeitsbaums: `6ebcf0be` (1.0.0-beta.1.759).

**Art der Belege.** Die Zuordnung beruht auf einer **Quelleninspektion** des Arbeitsbaums. In diesem
Arbeitsgang wurde **kein Test ausgeführt**. Die gezielten Prüfläufe stehen im Prüfplan des Auftrags
und laufen in der Cloud. Die Fassungsnummer der Lieferung vergibt erst die Veröffentlichung. Der
Lieferbeleg mit Fassung (Deployment, Livefassung) fehlt deshalb hier noch.

## Lieferung dieses Auftrags

An einer beantworteten Frage auf `/fragen`:

- **„Bekannte Fehler – was vermeiden“.** Ist unter den herangezogenen Quellen ein Wissensobjekt vom
  Typ `negativwissen`, steht ein Warnkasten mit Link auf dieses Objekt im Warnblock `ask-warnungen`
  direkt hinter der Antwort (`VermeidenWarnung`, R-0286-Reihenfolge).
- **Knopf „Lösungsweg“** in der Knopfzeile. Er öffnet ein Seitenblatt mit
  - der Rahmung des Addendums: bei belegter Einstufung (`verified`) „Auf Basis des vorhandenen
    validierten Wissens sind dies die belastbarsten Hinweise – keine endgültige Lösung“, sonst ein
    Satz über die noch ungeprüfte Grundlage. Das Blatt sagt nirgends „das ist die Lösung“.
  - den nächsten Schritten: belastbarste Quelle öffnen (die erste tragende, die kein Negativwissen
    ist), bekannte Fehler beachten, Personen mit Wissensspuren (Autor und Originalautor der
    tragenden Quellen, Namen aus dem Verzeichnis) und „Neuen Fall dokumentieren“ (`/erfassen` über
    `RoleLink`).
- Bei einer Wissenslücke gibt es keinen Lösungsweg-Knopf. Die bestehende Lückenkarte bleibt der Weg.

Dateien: `apps/web/src/lib/problemloesungsweg.ts` (Ableitung, DOM-frei),
`apps/web/src/components/fragen/Loesungsweg.tsx`, `apps/web/src/texte/loesungsweg.ts` (de/en/nl),
Einbindung in `apps/web/src/pages/Ask.tsx`. Tests: `tests/loesungsweg/problemloesungsweg.test.ts`,
`tests/loesungsweg/loesungsweg-mounted.test.tsx`.

**Nacharbeit 2 (Befund Ben: Prüfpunkte 5 und 6 fehlten).** Das Blatt prüft jetzt auch gelöste
Konflikte und offene Revalidierungsfälle der Quellen. Beide Abrufe laufen erst mit offenem Blatt.
Scheitert einer, steht „nicht abrufbar“ und nie „keine“. Für gelöste Konflikte gab es keinen
Leseweg (`GET /api/conflicts` führt nur offene). Neu ist deshalb `GET /api/conflicts/geloest?ko=…`:
- `ConflictService.geloesteFuer` liefert nur von einem Menschen abgeschlossene Konflikte
  (`decided`, `dismissed`). Systemische Abschlüsse wie `superseded` bleiben draußen.
- Routenrecht `ko.read` und Paar-Tor `sichtbarePaare` wie bei der Liste. Bei Feldredaktion wird
  zusätzlich die Entscheidung geleert.
- Eingetragen in `tests/security/routeGuardAudit.ts`, `tests/security/mega74-lesewege-sammler.test.ts`,
  `tests/beta-rollenabnahme/tabelle.ts` und `docs/architektur/http-api-referenz.md`.
- Test: `tests/loesungsweg/geloeste-konflikte-route.test.ts`.

## Abgleich mit dem Originalwortlaut

| Prüfpunkt des Addendums | Stand |
| --- | --- |
| 1 validierte Wissensobjekte | vorhanden vor diesem Auftrag: quellengebundene Antwort, eine Einstufung (`lib/effectiveAnswer.ts`), Quellenchips mit Prüfstand |
| 2 ähnliche Fälle | nur als ähnliche Wissensobjekte über die Suche; eine eigene Einheit „Fall“ gibt es im Produkt nicht – **offen** |
| 3 Negativwissen | **neu** (Warnung und Schritt) |
| 4 bekannte Fehlerauslöser | kein eigenes Feld; nur, soweit sie im Negativwissen stehen – **offen** |
| 5 offene oder gelöste Konflikte | offene Konflikte vorhanden (`conflict.impact`, `ask-conflict-caveat`). **Neu seit Nacharbeit 2:** gelöste Konflikte (von einem Menschen entschieden oder als Fehlalarm geschlossen) zu den Quellen der Antwort stehen im Blatt, mit beiden Objekten und der Entscheidung. Leseweg `GET /api/conflicts/geloest` (Paar-Tor, Feldredaktion inkl. Entscheidung) |
| 6 alte Revalidierungsfälle | **Neu seit Nacharbeit 2:** Quellen der Antwort mit offenem Revalidierungsfall (`GET /api/lifecycle/pending`) stehen im Blatt mit Link zur Quelle und zum Fall (`/lebenszyklus?fall=…`, über `RoleLink`). **Neu seit Nacharbeit 5:** Frühere, schon bestätigte Revalidierungen stehen getrennt darunter („Früher bestätigt“: jüngste Bestätigung mit Datum und Fassung, Anzahl). Sie kommen aus dem Beleg `ko.revalidated` im Prüfprotokoll über `GET /api/lifecycle/revalidiert` (`ko.read`, Zeilenrecht `sichtbareEintraege`). Hinaus gehen nur Kennung, Zeitpunkt und Fassung; Akteur und Nutzlast bleiben hinter dem Audit-Recht |
| 7 Quellen / Artikel / SOPs | vorhanden (Quellenchips, Quellenliste im Blatt „Mehr“) |
| 8 passende Experten | **neu**: Autor und Originalautor. Prüfer ähnlicher Objekte fehlen, die Fläche erhält keine Prüferdaten – **offen** |
| 9 Wissenslücke | vorhanden: automatisch angelegte Lücke (`services/ask/src/service.ts`, `createGap`), Lückenkarte „Keine belastbare Grundlage“, Weg zur Erfassung |
| Schritt „Quelle öffnen“ | **neu** |
| Schritt „Experte anfragen“ | keine Anfragefunktion im Produkt. Das Blatt nennt die Personen und sagt das ausdrücklich – **offen** |
| Schritt „Wissenslücke anlegen“ | im Lückenfall automatisch; an einer beantworteten Frage nicht – **offen** |
| Schritt „neuen Fall dokumentieren“ | **neu** (`/erfassen`) |
| Rahmung „belastbarste Hinweise“ | **neu** |

## Abgrenzung

- Nicht Teil dieser Lieferung: mobile Fragenseite (`/mobile`), Markdown-Export und Kopieren der
  Antwort, Klara im Word-Add-in. Dort steht der Lösungsweg nicht.
- Laut Registerhinweis zu R-1662 sind Teilbausteine im Produkt gesondert erfasst. Die übrigen
  Aufträge im Quellenpaket `auftraege-003.json` (zum Beispiel `ki-wahl-betriebsabnahme`) gehören
  nicht hierher.

## Quellenwidersprüche und fehlende Belege

- Im Register steht `pruefstatus: geprueft`, im Beleg derselben Zeile aber „heutige Erfüllung nicht
  erneut geprüft“.
- Die Register-Empfehlungen ES-073 und EC-20260905-R-1662 lauten „später“ (Zustand „angedacht“). Die
  Auftragsaufnahme vom 22.09. führt den Punkt dagegen als Arbeitsauftrag. Maßgeblich ist die jüngere
  Aufnahme.
- ES-073 schätzt den Aufwand als „klein“, gemessen an einer groben Titelregel. Für die neun
  Prüfpunkte gilt das nicht: Mehrere davon (Fall, Fehlerauslöser, Revalidierung, Expertenanfrage)
  setzen Produktteile voraus, die es nicht gibt.
- Es fehlen: der Lieferbeleg mit Fassung (nach Veröffentlichung), eine Bedienung des neuen Blatts im
  echten Browser (die Tests laufen unter jsdom) und eine fachliche Rückmeldung echter Anwender.
