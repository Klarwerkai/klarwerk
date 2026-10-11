# Rollenbezogene Lernwege klären und Verständnisfragen ergänzen

Auftrag `aufnahme:20260922:gesamt-lernwege`, Revision 2. Ausgangsstand des Repositorys:
`2ed7226b` (`1.0.0-beta.1.906`), Branch `codex/auftrag-49e99920ecf31ce28149`.

Diese Datei hat zwei Teile: **A** klärt die aufgenommenen Lernweg-Anliegen (Kriterien K1–K14)
gegen den heutigen Code, ohne eine Entscheidung zu ersetzen. **B** beschreibt die eindeutig
bestellte Lieferung — fassungsbezogene Verständnisfragen aus dem Nutzerauftrag vom 03.10.2026
(K15–K21).

Unterschieden wird durchgehend zwischen **Quelleninspektion** (Code gelesen), **neuen Tests** (in
diesem Auftrag geschrieben, Ausführung durch den Adapter/Ben) und **offenen externen
Voraussetzungen**. In diesem Arbeitsschritt wurde kein Test, kein Dienst und kein Modell gestartet.

---

## A. Klärung der Lernweg-Anliegen

### A1. Heutiger Stand der Lernpfade (Quelleninspektion am Ausgangsstand)

| Baustein | Fundstelle | Befund |
| --- | --- | --- |
| Dienst | `services/lifecycle/src/service.ts:520-547` | `createPath(role, steps)`, `getPath(role)`, `completeStep`, `progress`. Die in R-0771/R-2181 genannte Zeile `service.ts:114` zeigt heute auf den Konstruktor — die Zeilenangabe der Quelle ist veraltet, der Code ist derselbe. |
| Datentyp | `services/lifecycle/src/types.ts:1-10` | Ein Schritt ist `{ id, title }` — **kein Verweis auf ein Wissensobjekt**, keine Lesereihenfolge durch Wissensobjekte. |
| Schnittstelle | `services/app/src/routes/lifecycle-routes.ts:425-479` | Anlegen `ko.create`, Lesen/Abhaken/Fortschritt `ko.read`, Fortschritt je Person. |
| Ablage | `services/lifecycle/src/repo-pg.ts` | `lifecycle_paths`, `lifecycle_progress` (Postgres); Speicherfassung ohne DB. |
| Oberfläche | `apps/web/src/pages/Lifecycle.tsx` (Lernpfad im „?“-Menü des Reiters „Erneut“) | Die Fläche `/lebenszyklus` trägt `minRole: "controller"` (`apps/web/src/lib/workCenter.ts:71-75`). **Viewer und Experten erreichen den Lernpfad in der Oberfläche nicht**; die Startseite zählt nur offene Schritte. |
| Anlegen in der Oberfläche | — | Es gibt **keine** Bedienung zum Anlegen eines Lernpfads (R-1059 trifft nach Quelleninspektion weiter zu). |
| Beispieldaten | `services/app/src/seed-demo.ts:841-853` | Für experte/controller/admin dieselben vier allgemeinen Schritte, **kein Viewer-Pfad** (deckt sich mit der Abnahme vom 05.09.). |
| Mehrere Pfade je Rolle | `services/lifecycle/src/repo.ts:179-186` | `getPathByRole` liefert den ersten Pfad einer Rolle; ein zweiter `createPath` derselben Rolle wird angelegt, aber nie gelesen. Befund, in diesem Auftrag nicht geändert. |
| Vorhandene Tests | `services/app/src/learning-path-progress.test.ts`, `services/lifecycle/src/service.test.ts`, `services/app/src/build-app.integration.test.ts:210-237` | HTTP-Fortschritt je Person; Pfad überlebt einen App-Neustart auf derselben Datenbank (PG-Fall). Ein Neustart-Fall für den **Fortschritt** existiert nicht. Ausführungsbelege dieser Tests liegen in diesem Auftrag nicht vor. |

### A2. Die offene Geltungs-/Umfangsfrage (K1)

**Widerspruch der Quellen:** R-0771 (Funktionslandkarte v3, 29.08.2026) führt „Lernpfade je
Rolle“ als **unbefristet gestrichen** (Codex-Streichliste J6/J8). Gleichzeitig existiert einfacher
Lernpfad-Code (R-0958/R-2201, teilweise abgenommen am 05.09.2026, Live 1.90), FR-LIF-03 steht als
SOLL im historischen Sollvertrag, und der Nutzerauftrag vom 03.10.2026 sagt: „Rollenbezogene
Lernpfade, passende Quellenreihenfolge und Lesefortschritt sind bereits F42.“ Was „F42“ genau
umfasst und ob es die Streichung ersetzt, steht in den Auftragsunterlagen nicht — **Beleg fehlt**.

**Alternativen:**

| | Inhalt | Folge |
| --- | --- | --- |
| A | Streichung R-0771 gilt weiter. | Vorhandene einfache Lernpfade bleiben als Bestand nutzbar; kein Ausbau (keine Lesereihenfolge durch Wissensobjekte, kein Viewer-Pfad, keine Anlage in der Oberfläche, keine automatische Bildung, kein Zertifizierungsmodus). |
| B | Streichung ist durch „F42“ ersetzt. | Ausbau als eigener, abgegrenzter Auftrag F42: Schritte mit Verweis auf Wissensobjekte, Zugang für alle Rollen, Anlage in der Oberfläche (R-1059), Viewer-Pfad. |
| C | Teilweise Aufhebung. | Nur Anlage in der Oberfläche und Zugang für alle Rollen; keine automatische Bildung (R-1640/R-2181) und kein Zertifizierungsmodus (R-1641). |

**Jüngste Belege:** Abnahme R-0958 (05.09.2026 12:22, teilweise), Abnahme R-2201 (05.09.2026
13:45, teilweise), Empfehlungen ES-052/ES-053/ES-085 und EC-20260905 (alle „später“),
Basisabgleich 16.09. (`.542`), Nutzerauftrag 03.10.2026.

**Noch erforderlich:** eine Entscheidung (Pedi), welche Alternative gilt. **Ohne sie wird kein
Lernpfad-Ausbau gebaut.** Eindeutig bestellt ist nur der Zusatz „Verständnisfragen“ (Teil B) — er
ist umgesetzt und hängt an keiner der drei Alternativen: er nutzt den vorhandenen Lernpfad nur zur
Anzeige der Zuordnung und lässt ihn unverändert.

### A3. Einordnung der einzelnen Anliegen (K2–K13)

| Anliegen | Stand nach Quelleninspektion | Einordnung |
| --- | --- | --- |
| R-0771 Lernpfade je Rolle (gestrichen) | Einfacher Code vorhanden (A1). | Geltung der Streichung offen → A2. |
| R-0958 rollenspezifische Lese-Reihenfolge, Abhaken, Fortschritt | Abhaken und Fortschritt je Person vorhanden; Schritte sind freie Titel ohne Wissensobjekt; Viewer-Pfad fehlt im Beispielbestand; Oberfläche nur ab Controller. | Teilweise erfüllt (Abnahme 05.09. bleibt gültig); Rest hängt an A2. |
| R-1059 Lernpfad in der Oberfläche anlegen | Keine Bedienung, nur `POST /api/learning-paths`. | Offen; Bau nur nach A2 (B oder C). |
| R-1640 Onboarding-Pfade automatisch aus der Wissensbasis | Nicht vorhanden. | Nicht gebaut (Empfehlung „später“). Verständnisfragen können jetzt einer Rolle zugeordnet werden — das ist **keine** automatische Pfadbildung. |
| R-1641 Zertifizierungs-Modus | Nicht vorhanden. | Nicht gebaut. Der Zusatz vom 03.10. setzt die jüngere Grenze: Ergebnisse „ersetzen keinen praktischen Befähigungsnachweis“ und werden „nicht als zertifizierte Kompetenz“ ausgegeben. Ein ISO-/TISAX-Nachweis wird nicht behauptet. |
| R-1750 Lernpfade je Rolle (datenbasiert), FE-LCY-06 | Schritte sind nicht datenbasiert. | Offen; die Septemberabnahme hat Vorrang vor der alten OFFEN-Zeile. |
| R-2129 FR-LIF-03 (SOLL) „Pfad darstellbar; Fortschritt speicherbar“ | Darstellbar (ab Controller), Fortschritt speicherbar (alle Rollen per Schnittstelle). | Historisches Abnahmekriterium im Code erfüllt; „rollenspezifische Einarbeitung“ nur eingeschränkt (Oberfläche ab Controller, kein Viewer-Pfad). SOLL bleibt im Wortlaut. |
| R-2181 Lernpfade automatisch bilden und Verständnis prüfen | Automatische Bildung nicht vorhanden. | „Verständnis prüfen“ jetzt durch Teil B (manuell erstellte, belegte Fragen); automatische Bildung und KI-Fragenvorschläge nicht geliefert. |
| R-2201 einfache Lernpfade mit Fortschritt | Vorhanden. | Abnahme 05.09. teilweise; unverändert. |
| package:lernwege | wie R-0958. | Teilweise; Rest an A2. |
| question:K20 „Lernpfad-Neustart fehlen“ | PG-Neustartfall für den **Pfad** vorhanden (`build-app.integration.test.ts:210-237`), für den **Fortschritt** nicht. | Teilweise überholt (Code und Testfall vorhanden; ein Ausführungsbeleg liegt hier nicht vor). Zustellung/SSO gehören zu `gesamt-mailbetrieb`/`gesamt-sso`, nicht zu diesem Auftrag. |
| SOLL:FR-LIF-03 | wie R-2129. | wie R-2129. |

### A4. Abgrenzung (K14)

* **Gesonderte Aufträge:** Mailzustellung und Unternehmens-SSO (question:K20) gehören zu
  `aufnahme:20260922:gesamt-mailbetrieb` bzw. `…:gesamt-sso`. Die SCORM-Übergabe
  (`docs/lernplattform-scorm.md`) liefert ausdrücklich **keine** Verständnisprüfung; sie bleibt
  unverändert und überträgt keine Fragen.
* **Kenntnisnahme** (`services/app/src/kenntnisnahme.ts`) bestätigt das **Lesen** einer Fassung,
  kein Verständnis. Verständnisfragen ersetzen sie nicht und werden von ihr nicht ersetzt.
* **Lieferbeleg mit Fassung** entsteht erst nach Veröffentlichung (Deployment/Livefassung) und ist
  hier nicht behauptet.

---

## B. Verständnisfragen zu einer gültigen Wissensfassung (Lieferung)

### B1. Was geliefert ist

| Teil | Datei |
| --- | --- |
| Regeln, Ablagen (Speicher/Postgres), Dienst | `services/app/src/verstaendnisfragen.ts` |
| Neun Türen | `services/app/src/routes/verstaendnisfragen-routes.ts` |
| Verdrahtung, Migration, Inventar | `services/app/src/build-app.ts`, `db.ts`, `dateninventar.ts`, `selbstauskunft.ts`, `scripts/backup/restore-drill.sh` |
| Wissensansicht | `apps/web/src/components/verstaendnisfragen/VerstaendnisfragenBereich.tsx` (in `BibliothekLesen.tsx` nach Kenntnisnahme/Veröffentlichung) |
| Lernpfad | `apps/web/src/components/verstaendnisfragen/LernpfadVerstaendnis.tsx` (im Lernpfad-Block von `Lifecycle.tsx`, unter den unveränderten Schritten) |
| Texte DE/EN/NL | `apps/web/src/texte/verstaendnis.ts` (Dateiname = Präfix `verstaendnis.`) |

### B2. Kurzer Bedienweg

1. **Verantwortliche Person** (Verantwortung am Eintrag, oder wer freigeben darf) öffnet einen
   gültigen Eintrag (z. B. Fassung V2) → „Verständnisfragen“ → **Fragensatz anlegen**: Titel,
   Zuordnung zu Rollen, Bestehensregel („bestanden ab … richtigen Antworten“), Versuche je Person
   (Zahl oder „unbegrenzt“), je Frage Text, Antwortmöglichkeiten, richtige Antwort(en),
   Erläuterung und **wörtliche Belegstelle** aus der Fassung → „Als Entwurf speichern“.
2. Befunde stehen sofort da (fehlende Belegstelle, fehlende richtige Antwort, Regel nicht
   festgelegt …). Ohne Befund: **Annehmen** (wer freigeben darf, direkte Annahme) oder **Zur
   Zweitprüfung vorlegen** (freiwillig; ohne Freigaberecht der einzige Weg). Zurückweisen verlangt
   eine Begründung. Jede Änderung ist eine neue Fragensatzversion im Entwurf; Lernende arbeiten an
   der angenommenen Version weiter.
3. **Lernende** sehen am Eintrag den angenommenen Fragensatz mit Regel und Abgrenzungssatz →
   „Fragen beantworten“ → „Antworten abgeben“. Die Rückmeldung nennt je Frage das Urteil, die
   richtige Antwort, die Erläuterung und springt mit „Zur Stelle in Fassung N“ an die markierte
   Belegstelle (`?stelle=…&fassung=N`, vorhandener Mechanismus `lib/belegstelle.ts`). Eigene
   Ergebnisse bleiben am Eintrag abrufbar („Rückmeldung anzeigen“).
4. **Zuständige** (Verantwortung oder Freigaberecht) öffnen „Ergebnisse anzeigen“: Liste nach
   Namen, ohne Rangliste.
5. Ändert sich die Quelle **fachlich** (lesbarer Inhalt), steht der Fragensatz als „zur erneuten
   Prüfung“ da und wird nicht bewertet; die verantwortliche Person wählt „Auf Fassung N prüfen und
   neu fassen“ und nimmt die neue Version wieder nach Kontoregel an.

Schnittstellen: `docs/architektur/http-api-referenz.md` (Abschnitt Lernpfade).

### B3. Festlegungen

* **Kontoregel, keine neue Rolle:** Anlegen/Ändern/Vorlegen `ko.create` **und** Verantwortung am
  Eintrag (`responsibleOf`) oder `ko.validate`; Annehmen/Zurückweisen `ko.validate` — ohne
  Space-Freigaberegel als direkte Annahme, mit Regel nach Prüferkreis, Mehr-Augen-Prinzip und
  Mindestzahl der Zustimmungen (Beleg: `tests/verstaendnisfragen/kontoregel.test.ts`); Vorlegen =
  freiwillige Zweitprüfung; Beantworten `ko.read`; Sichtbarkeit jeder Tür über
  `darfSehen` (unsichtbar → 404). Entscheidungen stehen im Prüfprotokoll
  (`verstaendnisfragen.angenommen`/`.zurueckgewiesen`); **Versuche nicht** (das Protokoll dient
  nicht der Leistungs- oder Verhaltenskontrolle).
* **Beleg statt Behauptung:** Annahme nur, wenn jede Belegstelle wörtlich (Leerraum
  zusammengefasst, mindestens 8 Zeichen) im Text der gebundenen Fassung steht und jede Frage
  richtige Antwort und Erläuterung hat. Ohne Beleg keine Musterantwort.
* **Bewertung:** richtig = genau die richtigen Möglichkeiten gewählt; ohne Wahl = unbeantwortet =
  nicht richtig (so steht es sichtbar in der Regel). Bestanden ab der festgelegten Zahl. Keine
  vorbelegte Kennzahl: Regel und Wiederholung müssen ausdrücklich gesetzt sein.
* **Ergebnis:** Person, Eintrag, Wissensfassung, Fragensatzversion, Versuchsnummer, Zeitpunkt,
  Antworten, Bewertung samt angewandter Mindestzahl. Fragensatzversionen sind unveränderlich (nur
  ihr Status wechselt) — ein Ergebnis wird nie umgeschrieben.
* **Doppelte Abgabe:** jede geöffnete Antwortfläche trägt eine Versuchskennung; dieselbe Kennung
  ergibt denselben Versuch (auch gleichzeitig, Postgres-Primärschlüssel). Eine zweite Abgabe über
  die Grenze wird über einen eindeutigen Schlüssel (Person, Version, Nummer) abgewiesen.
* **Fachliche Änderung:** Vergleich des lesbaren Inhalts (Titel, Aussage, Text, Bedingungen,
  Maßnahmen) der gebundenen mit der heutigen Fassung. Eine reine Bestätigung ohne Inhaltsänderung
  markiert nichts. Ist die gebundene Fassung nicht mehr lesbar, gilt die Quelle als „fehlt“ — nie
  still als aktuell.
* **Kein KI-Dienst, kein externer Datenfluss, kein Microsoft 365.** Bewertung und Belegprüfung
  sind deterministisch und lokal.

### B4. Zuordnung der Abnahmekriterien zu Belegen

| Kriterium | Beleg (neue Tests, Ausführung durch Adapter/Ben) |
| --- | --- |
| K15 erstellen, nach Kontoregel annehmen, zuordnen, bearbeiten; Lernpfade nutzbar | `tests/verstaendnisfragen/am-server.test.ts` S1; `…/flaeche.test.tsx` U2, U3; PG: `…/ablage-pg.integration.test.ts` P1, P3 |
| K16 richtige Antwort und Quellen-/Fassungsbezug | `am-server.test.ts` S2; `regeln.test.ts` R2; `flaeche.test.tsx` U2 |
| K17 falsch/richtig/unvollständig nach sichtbarer Regel; ohne Quelle keine Bewertung | `am-server.test.ts` S3; `regeln.test.ts` R1, R2; `flaeche.test.tsx` U1 |
| K18 nach Neuladen erhalten; Doppelabgabe kein zweiter Versuch | `am-server.test.ts` S4; `flaeche.test.tsx` U1; `ablage-pg.integration.test.ts` P2, P3 |
| K19 historische Ergebnisse unverändert; veraltete Fragensätze erkennbar und erst nach Prüfung verwendbar | `am-server.test.ts` S5; `regeln.test.ts` R3; `flaeche.test.tsx` U4 |
| K20 eigene Ergebnisse; andere nur für Zuständige | `am-server.test.ts` S6 (inkl. Selbstauskunft und unsichtbarem Eintrag) |
| K21 Lesen / Verständnisfragen / praktische Befähigung getrennt; kein Zertifikat | `flaeche.test.tsx` U1 (Abgrenzungssatz), U3 (Lernpfad) |

### B5. Fehlerfälle

| Antwort | Ursache |
| --- | --- |
| 400 `VALIDATION` (`eingabe`) | Rumpf formal ungültig (Längen, Grenzen, unbekannte Rolle/Antwortmöglichkeit, fehlende Version) |
| 403 `FORBIDDEN` | Routenrecht fehlt (z. B. Viewer legt an, Experte entscheidet) |
| 403 `NICHT_ZUSTAENDIG` | Anlegen ohne Verantwortung; Ergebnisse anderer ohne Zuständigkeit; nach Space-Freigaberegel `selbstpruefung`, `nicht_berechtigt`, `vertretung_ruht` |
| 409 `bereits_zugestimmt` | Dieselbe Person stimmt derselben Version ein zweites Mal zu |
| 404 | Eintrag unsichtbar, gelöscht oder unbekannt; fremder Versuch |
| 409 `befunde` | Vorlegen/Annehmen mit fehlender oder nicht gefundener Belegstelle, fehlender Antwort/Regel |
| 409 `quelle_geaendert` / `quelle_nicht_gueltig` / `quelle_fehlt` | Bindung an eine Fassung, deren Inhalt nicht mehr gilt; Abgabe wird nicht bewertet |
| 409 `stand_veraltet` | Inzwischen andere Fragensatzversion (Ändern oder Abgeben) |
| 409 `versuche_erschoepft` / `gleichzeitig` / `versuch_fremd` | Wiederholungsgrenze; gleichzeitige zweite Abgabe; fremde Versuchskennung |
| 503 `NICHT_HALTBAR` | Desktop-Journal-Betrieb ohne haltbare Ablage (wie Kenntnisnahme) |

### B6. Offene Grenzen

* **Keine KI-Fragenvorschläge.** Der optionale Teil („KI-erzeugte Vorschläge bleiben Entwürfe“)
  ist nicht gebaut; es gibt keinen Weg, der Fragen automatisch erzeugt.
* **Lernpfad-Oberfläche nur ab Controller.** Die Zuordnung erscheint im bestehenden Lernpfad-Block
  (`/lebenszyklus`, `minRole: controller`). Viewer und Experten sehen ihre Fragensätze und
  Ergebnisse am Eintrag (`/wissen/:id`) und über `GET /api/verstaendnisfragen/meine`; eine
  Lernpfad-Seite für alle Rollen gehört zur offenen Entscheidung A2.
* **Vorgeschriebene Prüfung (Nacharbeit 3):** Trägt der führende Space des Eintrags eine
  Freigaberegel (ADMIN-09), gilt sie für die Annahme: nur Personen ihres Prüferkreises entscheiden
  (`entscheidungsurteil`), niemand über die selbst verfasste oder vorgelegte Version
  (Mehr-Augen-Prinzip), und angenommen ist erst mit der verlangten Zahl verschiedener Zustimmungen
  zu genau dieser Version; davor bleibt sie „vorgelegt“ und unsichtbar für Lernende. Ohne Regel
  bleibt die direkte Annahme durch `ko.validate`. Nicht übernommen sind Fristlauf und
  Vertretungsaufgaben der Regel (es gibt für Fragensätze keine Prüfaufgaben); eine Vertretung
  entscheidet deshalb nur, wenn die vertretene Person nicht aktiv ist.
* **Inhalt einsprachig:** Fragen stehen in der Sprache, in der die verantwortliche Person sie
  schreibt; die Oberfläche ist DE/EN/NL.
* **Kein Löschweg** für Ergebnisse (wie Kenntnisnahme und Lernfortschritt; Frist vom Betreiber
  festzulegen, s. Dateninventar). Nicht im Bestandsreset-Löschgraphen.
* **Anlaufzeitpunkt der Belegprüfung:** geprüft wird gegen den gespeicherten Text der Fassung;
  Text in Anhängen oder Bildern zählt nicht als Belegstelle.
* **Echte Bedienung** durch Fachpersonen an einer veröffentlichten Fassung ist nicht erfolgt;
  die Belege sind automatisierte Tests mit Beispieldaten.
