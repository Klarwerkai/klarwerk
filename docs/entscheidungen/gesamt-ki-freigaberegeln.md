# Externe KI und Recherche je Aufgabe und Datenklasse freigeben

*Aufnahme 20260922 · gesamt-ki-freigaberegeln, Revision 1 · Basis `064ded35` (`1.0.0-beta.1.746`).
Lauf vom 08.10.2026. Die Fassung, unter der diese Lieferung live geht, entsteht erst bei der
Veröffentlichung. Bis dahin ist hier nichts als „ausgeliefert" belegt (K12).*

Grundlage sind die Kriterien K1–K12 aus `AUFTRAG-B1.json` und ihre Originalpunkte in `QUELLEN.json`.
Was hier steht, ist am Code dieser Basis gelesen. Ausgeführte Tests nennt der Abschnitt „Prüfstand".

## Was dieser Lauf geändert hat

| Kriterium | Änderung | Beleg (Test) |
| --- | --- | --- |
| K1 (R-0586) | Neu: deklarierte Liste aller ausgehenden Ziele des Servers samt Word-Add-in (`services/app/src/ausgehende-ziele.json`; bewusst Daten statt Modul, weil der Egress-Wächter
die Modellhosts in keiner `.ts`-Datei ausser den Chokepoint-Clients zulässt): Datei, feste Hosts, Betreiber-Umgebungsvariablen, wirksame Freigaberegel | `tests/ki-freigaberegeln/ausgehende-ziele.test.ts` (beide Richtungen: neue Verbindungsstelle oder neuer fester Host ohne Eintrag ist rot, ebenso ein toter Eintrag) |
| K8/K9 (P-ADMIN-KI-FREIGABE, package:kiwahl) | Die Transkription (`/api/media/analyze`, Whisper bei OpenAI) fragt jetzt die zentrale Grundfreigabe. Bisher ging ein nicht vertrauliches Medium **ohne** Freigabe hinaus. Nur `true` zählt, fehlend oder ein Fehler sperren. Der Anbieter bleibt benannt; „kein Schlüssel" und „nicht freigegeben" bleiben unterscheidbar | `services/media/src/service.test.ts` (Block „gesamt-ki-freigaberegeln"), `tests/admin-ki-freigabe/transkription-grundfreigabe.test.ts` (echte Wurzel, Transport mitgeschrieben, Sperre und Gegenprobe) |
| K5 (R-0628) | Neu: Gleichlauf-Messung der Vertraulichkeitslesart über Server, Browser-Abschrift, Word-Markierung und Medienobjekt; die bewusst verschiedenen Lesarten von „keine Stufe" als Tabelle festgehalten | `tests/ki-freigaberegeln/vertraulichkeit-eine-lesart.test.ts` |
| K7 (R-2066) | Neu: Prinzipien Transparenz, Aufsicht und Nachvollziehbarkeit mit Produktstellen und Tests dokumentiert (`docs/compliance/vertrauenswuerdige-ki.md`) | `tests/ki-freigaberegeln/prinzipien-beleg.test.ts` |

Mitgezogen: in `services/media/src/service.test.ts` bekommen die vier Fälle, die die Transkription
selbst messen, die Freigabe (`zentralFreigegeben: freigegeben`). Ihre Erwartungen sind unverändert.

## Stand je Kriterium

- **K1 · R-0586 Domänenliste:** mit diesem Lauf gebaut (s. oben). Geltungsbereich: Server (`services/**`)
  und das Word-Aufgabenfenster. Nicht erfasst: `desktop-app/`, `scripts/`, `tools/` sowie
  Browserbibliotheken der Web-App.
- **K2 · R-0606 Stufen je KI, „Extern: Blockiert" in der Kopfzeile:** Die Vorgabe „alles gesperrt" ist
  erfüllt: ohne Adminfreigabe geht nichts an eine öffentliche KI (`Reasoner.oeffentlicheKiErlaubt`).
  Die Adminfläche zeigt „Öffentliche KI: gesperrt · Vertrauliches: gesperrt"
  (`AdminKiDetails.tsx`, `adm.ai.freigabe.stand`). **Offen:** Eine Anzeige in der Kopfzeile gibt es nicht.
  Das Kopfband ist seit JOB 3060/FE-002 abschliessend festgelegt und auf den Pixel vermessen. Ein
  zusätzliches Element dort braucht Pedis Entscheidung. Die Stufen sind zweistufig steuerbar
  (intern / vertraulich einschliesslich streng vertraulich), siehe K6.
- **K3 · R-0615 Regler externe Wissensabfrage:** vorhanden. Es gibt vier Stufen, Vorgabe
  `search_on_click`; `blocked` weist serverseitig ab, die Public-KI-Anreicherung nur bei `open`
  (`services/external-search/src/policy.ts`, `external-routes.ts`). Beleg ist der Bestandstest
  `tests/app/external-policy-e2e.test.ts`.
- **K4 · R-0627 Vertrauliches nicht in Antworten/Exporten/Bildbeschreibungen:** Die Codepfade sind
  vorhanden: `dropConfidential` vor Antwortkontext und Export, das Vertraulichkeitsbit bis zum
  Chokepoint. Dort wird es abgewiesen (`cappedModelClient`, `ConfidentialEgressError`). Die
  Anforderung beschreibt selbst eine globale Sperre und keine abgestufte Leseberechtigung; das ist
  unverändert so. Zum Verhältnis zur jüngeren Adminfreigabe siehe Widerspruch W1/W3.
- **K5 · R-0628 eine Stelle:** Die Stufengrenze ist `services/knowledge-object/src/confidentiality.ts`.
  Die Browser-Abschrift ist jetzt gegen sie gemessen. Die Lesart von „keine Stufe" ist weiterhin je
  Rolle verschieden: Zugriff liest intern, von aussen gemeldete Stufen und Medien lesen vertraulich.
  Das ist der Rest, den die Quelle benennt. Ihn zu vereinheitlichen ist eine Entscheidung und hier
  festgehalten, nicht verändert.
- **K6 · R-1665 KI-Nutzung nach Vertraulichkeitsklassen:** Steuerbar sind „öffentliche KI überhaupt"
  und „auch Vertrauliches". Eine eigene Stufe für `streng_vertraulich` wie im Addendum (L3 „nur lokal")
  gibt es nicht. Pedis jüngere Entscheidung vom 10.09. kennt genau zwei Schalter, deshalb wurde nichts
  dazugebaut.
- **K7 · R-2066:** dokumentiert (s. oben). Das ist eine technische Zuordnung und keine rechtliche
  Bewertung.
- **K8 · P-ADMIN-KI-FREIGABE:** Bestand laut Quelle (15.09., `archiv/3549`, `3502`, `3783`, `3767`):
  zwei getrennte Freigaben, Rollen über `users.manage`, Warn- und Bestätigungsdialog, Protokoll mit
  Administrator, Zeit und Umfang, Anbieter sichtbar. Belegt durch `tests/admin-ki-freigabe/*` und
  `tests/admin-ki-oberflaeche/*`. Dieser Lauf schliesst die Lücke bei der Transkription. **Offen:**
  W1–W3.
- **K9 · package:kiwahl:** Warnhinweis, ausdrückliche und protokollierte Freigabe und die Sperre ohne
  Freigabe sind vorhanden. „Freigegebene Funktionen bleiben tatsächlich nutzbar" ist für Vertrauliches
  **nicht erfüllt** (W1).
- **K10/K11 · K18, letzter Vertrag je Weg:** siehe die Tabelle unten. Massgeblich ist die jüngere
  Entscheidung vom 10.09. (Originalstellen 3924/3927/3934/4022, `decision-evidence:K18`): Die
  Adminfreigabe gilt für alle KI-Wege, ohne widersprüchliche Zusatzsperren. Der Beschluss vom 18.08.
  („Vertraulich Markiertes bleibt IMMER draußen") ist der ältere.
- **K12:** dieses Dokument. Der Lieferbeleg mit Fassung folgt erst mit der Veröffentlichung.

## Der heutige Serververtrag je Weg (K10/K11)

Gelesen am Code der Basis plus dieser Änderung. „Grundfreigabe" heisst `kiFreigabe.oeffentlicheKi`,
„zweite Freigabe" heisst `kiFreigabe.vertraulicheInhalte`. Beide wirken nur mit `true`.

| Weg | Ohne Grundfreigabe | Nicht vertraulich, mit Grundfreigabe | Vertraulich, mit beiden Freigaben |
| --- | --- | --- | --- |
| Erfassen/Bearbeiten (`/api/reasoner`: structure, assist, interview, extract, describe) | gesperrt (Kern) | geht hinaus; mit Klara-Bindung nur mit Dokumentzustimmung | Kern lässt zu, **Chokepoint sperrt** (`rejectsConfidential: true`) → `model-error` |
| Fragen (`/api/ask`, Konsole) | gesperrt | geht hinaus | vertrauliche Objekte werden **vorher entfernt** (`dropConfidential`) |
| Word/Klara (`/api/ask` gebunden) | gesperrt (`zentralFreigegeben`) | nur mit Dokumentzustimmung je Dokument und Anbieter; markierter Dokumenttext zusätzlich Riegel `KLARA_DOCUMENT_TEXT_EGRESS_ENABLED` (Vorgabe AUS) | als vertraulich markierter Dokumenttext **immer gesperrt** (`pruefeDokumenttextDeckung`, Grund `vertraulich`) |
| Wissenscheck (`/api/check-text`, tiefe Prüfung) | Urteile gesperrt (Kern) | tiefe Prüfung mit Modell | **immer deterministisch** (Route: `deepAllowed = wantDeep && !confidential`) |
| Transkription (`/api/media/analyze`) | **neu gesperrt** | geht hinaus | **immer gesperrt** (`mediaIsConfidential`, `cappedTranscriber`) |
| Externe Wissenssuche (Wikipedia) | nicht an die KI-Freigabe gebunden, sondern an den Regler (K3) | — | — |

UI-Einwilligung, Berechtigung und serverseitiges Ausleiten sind damit getrennt beantwortet: Die
Berechtigung zum Ändern ist `users.manage`, die Einwilligung im Word-Weg ist die Klara-Zustimmung, und
das Ausleiten entscheiden der Kern und der Chokepoint.

## Konkrete Widersprüche und fehlende Belege

- **W1 · Die zweite Freigabe wirkt in der Produktionsverdrahtung nicht bis zum Anbieter.** Die Kerntests
  (`freigabe-kern.test.ts` 2.2, `rollen-und-protokoll.test.ts` R7) belegen den vertraulichen Aufruf
  nur mit einem **ungekapselten** Testclient. Im Betrieb ist jeder Cloudclient mit
  `cappedModelClient(…, { rejectsConfidential: true })` gekapselt (`model-client.ts`), und der Wächter
  (`model-concurrency.ts`) weist jedes vertrauliche Bit ab. `tests/admin-ki-freigabe/ka4-direktwege-volle-kette.test.ts`
  schreibt das ausdrücklich fest (`SPERRURSACHE.beide = "model-error"`). Die Aussage „erledigt
  (Nutzerziel) 15.09." trifft für Vertrauliches deshalb nicht zu.
  **Warum dieser Lauf das nicht behebt:** Das Bit `confidential` trägt auf den Routen mehr als die
  Einstufung. `reasoner-routes.ts` (`resolveProvenance`) und `check-text-routes.ts` setzen es auch bei
  **fehlender Klara-Dokumentzustimmung** und bei **nicht auflösbarem Entwurfsanker**. Mit beiden
  Freigaben hält heute allein der Chokepoint diese Fälle auf. Den Wächter an die zweite Freigabe zu
  koppeln, liesse nicht zugestimmten Dokumenttext hinaus. Nötig ist zuerst, das Bit zu trennen
  („eingestuft vertraulich" gegen „nicht zur Ausleitung berechtigt") und durch Reasoner, Routen und
  Chokepoint zu führen. Das ist ein eigener Umbau an einer Sicherheitsstelle.
- **W2 · Word/Klara-Dokumenttext:** Hier gilt weiter Pedis älterer Beschluss vom 18.08. („Vertraulich
  Markiertes bleibt IMMER draußen", `klara-session-service.ts`). Die jüngere Entscheidung vom 10.09.
  schliesst Word ausdrücklich ein. Die Quelle (`P-ADMIN-KI-FREIGABE`, Rest D5 (3)) führt die Frage als
  **offene Entscheidung Pedis**. Heute kennt der Word-Weg die Einstufung (`selectionConfidentiality`);
  ihn zu öffnen hinge an W1.
- **W3 · Wissenscheck und Fragen:** Beide sperren Vertrauliches mit eigener Regel, unabhängig von der
  zweiten Freigabe. Beim Wissenscheck ist es die Routenbedingung `!confidential`, beim Fragen
  `dropConfidential` vor dem Kontext. Ob die zweite Freigabe auch vertrauliche Objekte in den
  Antwortkontext lassen soll, berührt R-0627 („in keiner Antwort, für alle Nutzer gleich") und ist eine
  Produktentscheidung.
- **W4 · Kopfzeile „Extern: Blockiert" (R-0606):** Die Quelle ist ein Konzeptpapier vom 26.07. ohne
  Wirkungsbeleg. Die jüngere Festlegung des Kopfbands (FE-002, 26.09.) sieht kein solches Element vor.
- **W5 · R-0628 „vier Stellen mit der Lesart keine Stufe":** Die Entscheidungsvorlage selbst liegt nicht
  im Repository. Gemessen sind die heutigen Stellen (Server, Browser-Abschrift, Word-Markierung,
  Medien); ob sie den vier der Vorlage entsprechen, ist nicht belegt.
- **Fehlender Beleg:** Es gibt keinen Lauf gegen eine echte Instanz mit echtem Anbieter. Die
  Bedienung der Adminfläche durch einen Menschen und das Verhalten auf Pedis Instanz sind nicht geprüft.
  An keiner Instanz wurde eine Freigabe umgeschaltet.

## Abgrenzung

- Gesonderte, abgeschlossene Bestandteile (nicht neu gebaut): JOB 3549 (Kern), 3502 (Klara/Word-Verbraucher),
  3783 (Adminoberfläche), 3767 (fail-closed), 3666 (Wurzelverdrahtung), SCRUM-414 (Regler), SCRUM-502
  (Chokepoint), R-0639/F-0295 (Dokumenttext-Riegel). Das sind Angaben aus den Quellen; heute
  nachgelesen wurde der Code, nicht die Archivakten.
- Nicht Teil dieses Laufs: das Trennen des Vertraulichkeitsbits (W1), die Öffnung des Word-Dokumenttexts
  (W2), die Antwortkontext-Frage (W3), die Kopfzeilenanzeige (W4) und eine dritte Stufe für
  `streng_vertraulich` (K6). Alle brauchen eine Entscheidung oder einen eigenen Auftrag.

## Prüfstand

Lokal ausgeführt wurde nichts. In dieser Umgebung sind keine Test- oder Buildläufe erlaubt.

Prüflauf am Kandidaten `a7de8eb9` (Nacharbeit 1, Bericht im Auftragsarchiv `HISTORIE/nacharbeit-1`):
`tools/build` grün; grün sind `ausgehende-ziele` (4), `vertraulichkeit-eine-lesart` (3),
`prinzipien-beleg` (2), `transkription-grundfreigabe` (35, inklusive Medien-E2E und G8),
`external-policy-e2e` (3), `freigabe-kern` (54), `rollen-und-protokoll` (12),
`freigabe-texte-und-einziger-weg` (12), `egress-chokepoint`, `egress-encapsulation` und Biome auf allen
geänderten Dateien.

**Rot in fremden, unveränderten Bestandsdateien.** Keine dieser Dateien und kein Produktcode auf ihrem
Weg (Reasoner, Ask-Freigabe, Klara-Sitzung, `reasoner-routes.ts`) wurde in diesem Auftrag geändert.
Der Auftragscommit ändert nur `build-app.ts` (Medienverdrahtung), den Mediendienst, die Zielliste, Dokumente
und eigene Tests.
- `tests/admin-ki-freigabe/ka4-direktwege-volle-kette.test.ts`: Zwei Sperrfälle der Stufe „beide“
  melden die Ursache `confidential` statt `model-error`. Die Null-Abruf-Sperre selbst ist nicht der
  gemeldete Fehler. Für W1 heisst das: Auch dort ging mit beiden Freigaben nichts hinaus, die
  Kette schloss die Cloud nur früher aus.
- `tests/klara-dokumenttext/riegel-haelt-den-dokumenttext.test.ts` R5d, R5e, R7b, R7f, R7g: Die
  Gegenproben erwarten einen Modellaufruf und sehen keinen, auch auf der ungebundenen Konsole (R7g).
- `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts` F1/F4: Das Register kennt zwei fremde Helfer-Benutzer
  (`tests/uebernahme-standard-intern/datei-import-bis-egress.test.ts`,
  `tests/vertraulichkeit-pflicht/word-uebernahme-bis-wissensobjekt.test.ts`) und neue Fälle in
  `services/reasoner/src/anbieterbindung.test.ts` nicht. Die Dateien dieses Auftrags sind nicht betroffen.
  F2 (keine Freigabefelder von Hand) ist grün.

Die Ursachen gehören den jeweiligen Eigentümern; dieser Auftrag ändert dort weder Produktcode noch
Sollwerte. Die roten Berichte bleiben im Archiv erhalten.
