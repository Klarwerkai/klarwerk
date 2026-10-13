# Aufnahme 20260922 · Unbekannte UX-Kennungen — W8 zu JOB 2600 (R-0971)

Auftrag `aufnahme:20260922:gesamt-unbekannte-ux-kennungen` („Den noch unbeschriebenen W8-Umfang zu
JOB2600 konkretisieren“), Revision 1, Lauf 1, 13.10.2026. Basis `06468f05` (`1.0.0-beta.1.953`). Die
Fassung, in der dieser Lauf ausgeliefert wird, steht erst nach der Veröffentlichung fest; bis dahin
ist „dieser Lauf“ der Kandidat auf dieser Basis.

Quelle: `QUELLEN.json` des Auftrags, ein Originalpunkt **R-0971** (Alias F-0971, Titel „Offene
Kennung W8“, Zustand `klaerung`, Prüfstatus `nur_altquelle`, verwandt mit R-1865).

**Art der Belege.** Alles unten beruht auf einer **Quelleninspektion** des Arbeitsbaums (Code,
Testdateien, Dokumente). In diesem Arbeitsgang wurde kein Test ausgeführt. Der gezielte Prüflauf
steht im Prüfplan des Auftrags und läuft in der Cloud; sein Bericht ist der Beleg. Die Altquelle
selbst (`00_CONTROL/ERKENNTNISSE.md`, `00_CONTROL/FUNKTIONSREGISTER.json:22578` außerhalb des
Repositorys) wurde **nicht** gelesen; zitiert wird nur der Wortlaut, den `QUELLEN.json` davon trägt.

## Was die Quelle sagt

- Registersatz (R-0971): „Eine Ausbaustufe der Bedienoberfläche, zu der am 27.08. ein
  Korrekturdurchgang geschnitten wurde. Was sie inhaltlich leisten soll, ist in den ausgewerteten
  Quellen nirgends beschrieben — nur der Auftragsname ist belegt.“
- Einziger Herkunftsbeleg, Erkenntnisbuch 28.08. 02:12, Eintrag „Eine Durchgangsnummer zweimal
  vergeben“: „der Korrekturauftrag zu JOB 2600 D8 / W8 liegt schreibgeschützt im Bereit-Ordner.“
- Altbestand F-0971: Kategorie „Bedienung/Oberfläche“, Status `IN_ARBEIT`, Begründung „nicht
  dokumentiert“, `quell_ids` „JOB 2600“ und „W8“, Notiz „Gegenstand unbekannt — vor jeder Verwendung
  im Register nachrecherchieren.“ `pedi_override` ist leer; eine alte Pedi-Auswahl zu diesem Punkt
  ist in `QUELLEN.json` nicht enthalten (`entscheidung: null`, `entscheidungen: []`). Der Hinweis
  „bleibt unten als historische Entscheidung erhalten“ verweist damit auf nichts, was hier vorliegt.

Die Deutung „Ausbaustufe der Bedienoberfläche“ ist eine Auslegung des Registers. Der Wortlaut des
Erkenntnisbuchs nennt nur einen **Korrekturauftrag** mit zwei Kennungen.

## Nachrecherche im Arbeitsbaum (Kriterium 2)

**JOB 2600 ist eindeutig belegt: die Themenkarte des Wissensnetzes.**

- Abnahme wörtlich in `apps/web/src/pages/Wissensnetz.tsx:8-12`: „Auf der bestehenden
  Klara-Oberflaeche erscheint eine Themenkarte mit hoechstens 40 Themen …“ Route `/wissensnetz`.
- Durchgänge im Code: D1 (Karte, Server und Seite: `services/wissensnetz/src/themenkarte.ts`,
  `lesemodell.ts`, `luecken-einstieg.ts`, `apps/web/src/api/*`, `routes.tsx`, `app/navigation.ts`),
  D4 (Mischbestand, `tests/app/themenkarte-mischbestand-mounted.test.tsx`), D5/D7 (Ergebnistypen und
  Null-Kanten-Satz, `services/wissensnetz/src/themenkarte-typen.ts`,
  `tests/app/themenkarte-nullkanten-mounted.test.tsx`) und **D8**.
- **JOB 2600 D8 ist ein Korrekturdurchgang** und passt zum Datum der Quelle:
  `tests/app/themenkarte-kette-mounted.test.tsx` („JOB 2600 · D8 — DIE KETTE BIS ZUM CLIENTABRUF“)
  setzt BENs Auflage zu D7 um. Die Korrektur des Null-Kanten-Satzes war einzeln grün, aber über
  Handler, Wire und echten Clientabruf nicht belegt. Die Datei belegt sie durch die ganze Kette
  (K1 unterdrückter Zusammenhang, K2 Gegenprobe, K3 kein Direktimport der Rechnung).
- Das Datum passt: `tests/app/mega47-modale-flaechen-sammler.test.tsx:4489` vermerkt „JOB 2600:
  Wissensnetz.tsx trägt die Themenkarte vom 27.08.“

**„W8“ ist im Arbeitsbaum nicht eindeutig.** Gefunden sind drei verschiedene Bedeutungen:

| Fundstelle | Bedeutung von W8 | Bezug zu JOB 2600 |
|---|---|---|
| `docs/knowledge-os/wissensnetz-themenkarte-bestandsaufnahme-2026-10-03.md:159` | Titel von R-0454: „Themenlandkarte als Bildform des Wissensnetzes (W8)“, dort geliefert als Themenkarte `/wissensnetz` (JOB 2600) | **gleicher Gegenstand** |
| `OFFEN.md:178` (Registerzeile W8, Stand 31.07.) | „Die Prüflogik wird gebaut, sobald die drei offenen Punkte aus S5 beantwortet sind“ (`check-text-detection.ts`, Fundort je Fund) | kein Bezug; anderes Datum, anderer Gegenstand |
| Testfallnamen „W8 · …“ (u. a. `tests/verwaltung-schreibwege/karten-am-echten-server.test.tsx:519`, `tests/design/h3-wirkung.test.ts:840`, `tests/app/werksreset-bestaetigung-mounted.test.tsx:343`) | laufende Fallnummer innerhalb einer Testdatei | kein Bezug |

Die Form „JOB nnnn Dn (Wx)“ kommt im Code sonst als Verweis auf eine Registerzeile in `OFFEN.md` vor
(`services/ask/src/service.ts:703` „JOB 1591 D1 (W5)“, `tests/design/k2-buehne.ts:187` „JOB 3092 S6
(W6)“). Nach dieser Lesart hieße „JOB 2600 D8 / W8“ „antwortet auf OFFEN W8 (Prüflogik)“. Inhaltlich
passt das nicht: D8 berührt nur die Themenkarte, keine Prüflogik.

### Ergebnis der Klärung

- Eine **eigene Ausbaustufe „W8“ der Bedienoberfläche** mit eigenem Inhalt ist im Arbeitsbaum
  **nicht belegt**. Es gibt keinen Code, keinen Test und kein Dokument, das unter W8 einen
  Oberflächenumfang neben der Themenkarte beschreibt.
- Der einzige belegte Gegenstand hinter der Quelle ist der **Korrekturdurchgang JOB 2600 D8 an der
  Themenkarte** (Kette bis zum Clientabruf). Die wahrscheinlichste Lesart von „W8“ ist die Kennung
  der Themenlandkarte aus R-0454 („W8“), also derselbe Gegenstand wie JOB 2600. Der Titel des
  Erkenntnisbucheintrags („Eine Durchgangsnummer zweimal vergeben“) spricht dafür, dass derselbe
  Durchgang unter zwei Kennungen geführt wurde. Das ist **Auslegung**; der Eintrag selbst liegt hier
  nicht vor.
- Daraus folgt **kein eindeutig bestellter Bauanteil**. In diesem Lauf wurde deshalb nichts am
  Produkt gebaut.

## Offene Geltungs-/Umfangsfrage (Kriterium 1)

**Frage:** Ist R-0971 („Offene Kennung W8“) ein eigener Umfang, oder nur eine zweite Kennung eines
bereits gelieferten Durchgangs?

| Alternative | Was daraus folgt | Jüngster Beleg |
|---|---|---|
| **A** — W8 ist eine zweite Kennung für JOB 2600 D8 bzw. die Themenlandkarte (R-0454) | R-0971 wird als Dublette von R-0454 / JOB 2600 geschlossen; kein eigener Bau. Die Kategorie „Bedienung/Oberfläche“ und die Auslegung „Ausbaustufe“ fallen weg. | `tests/app/themenkarte-kette-mounted.test.tsx` (D8); R-0454 in `docs/knowledge-os/wissensnetz-themenkarte-bestandsaufnahme-2026-10-03.md:159` (03.10.) |
| **B** — W8 meint die Registerzeile OFFEN W8 (Prüflogik nach S5) | R-0971 gehört zur Prüflogik und zu den Aufträgen, die `check-text`/S5 bearbeiten, nicht zur Themenkarte; der Bezug zu JOB 2600 wäre ein Schreibfehler in der Quelle. | `OFFEN.md:178` (31.07.); Stand der Prüflogik heute: `docs/klara/bestandsblick-zwei-pruefwege.md:64` (W8 steht in `OFFEN.md` noch als `OFFEN`, obwohl Code und Tests sie belegen) |
| **C** — W8 ist eine eigene, noch unbeschriebene Ausbaustufe der Oberfläche | Gegenstand bleibt unbekannt; ohne Beschreibung ist nichts baubar. Der Punkt bleibt in `klaerung`, bis jemand den Inhalt benennt. | nur die Altquelle (28.08.) |

**Noch erforderliche Entscheidung (Owner/Pedi):** welche Alternative gilt. Hilfreich wäre der volle
Erkenntnisbucheintrag vom 28.08. 02:12 und der schreibgeschützte Korrekturauftrag im Bereit-Ordner;
beide liegen außerhalb des Repositorys und wurden hier nicht gelesen. Diese Entscheidung ist in diesem
Lauf **nicht** getroffen.

## Geliefertes Ergebnis und Abgrenzung (Kriterium 3)

| Anliegen | Stand | Fassung | Beleg |
|---|---|---|---|
| R-0971 Gegenstand von W8 | **geklärt, soweit der Arbeitsbaum es trägt** (s. oben); Entscheidung A/B/C offen | dieser Lauf (nur Dokument) | diese Datei |
| JOB 2600 D8 Korrekturdurchgang (Kette bis zum Clientabruf) | geliefert (vorher) | JOB 2600 D8; im Basisstand `06468f05` enthalten | `tests/app/themenkarte-kette-mounted.test.tsx` K1–K3, im Prüfplan dieses Laufs ausgewählt |
| JOB 2600 Themenkarte insgesamt (D1–D7) | geliefert (vorher), **nicht Teil dieses Auftrags** | JOB 2600 | `tests/wissensnetz/themenkarte.test.ts`, `tests/wissensnetz/themenkarte-route.test.ts`, `tests/app/themenkarte-*-mounted.test.tsx`; in diesem Lauf nicht ausgewählt |

- **Abgeschlossene Teilumfänge, nicht neu gebaut:** JOB 2600 (Themenkarte, D1–D8), JOB 3052 (Zielbild
  des Netzes), JOB 3067/3070/3073 (Sichtmetrik, Leseweg).
- **Gesonderte bestehende Aufträge:** `aufnahme:20260922:gesamt-wissensnetz` (R-0454 und das übrige
  Wissensnetz, Bestandsaufnahme vom 03.10.); die Prüflogik zu OFFEN W8/S5 (Prüfwege, s.
  `docs/klara/bestandsblick-zwei-pruefwege.md`). R-1865 (verwandte Kennung) ist dort unter
  „Entwurfsreichweite beider Prüfwege“ genannt und ausdrücklich nicht Teil der dortigen Nacharbeit;
  hier ebenfalls nicht bearbeitet. Ergebnisse dieser Aufträge werden hier nicht behauptet.

## Quellenwidersprüche und fehlende Belege

- R-0971 nennt eine „Ausbaustufe der Bedienoberfläche“; der Herkunftsbeleg nennt nur einen
  „Korrekturauftrag“. Die Kategorie stammt aus der Registerauslegung, nicht aus dem Wortlaut.
- R-0971 nennt den 27.08. als Schnitt des Korrekturdurchgangs, der Herkunftsbeleg ist vom 28.08.
  02:12. Beides ist vereinbar (Schnitt am Abend, Eintrag nachts), aber nicht belegt.
- Der Hinweis auf eine „alte Pedi-Auswahl … unten als historische Entscheidung“ hat in `QUELLEN.json`
  kein Gegenstück (`entscheidung`, `entscheidungen`, `pedi_override` leer).
- `docs/knowledge-os/wissensnetz-themenkarte-bestandsaufnahme-2026-10-03.md:159` nennt „JOB 2600
  D7/D9“. Ein Durchgang **D9** von JOB 2600 ist im Arbeitsbaum nicht auffindbar; belegt sind D1, D4,
  D5, D7 und D8 (D9 gibt es zu JOB 3052).
- Die Registerzeile W8 in `OFFEN.md` steht weiter auf `OFFEN`; laut
  `docs/klara/bestandsblick-zwei-pruefwege.md:64` ist das überholt. Diese Statuspflege gehört nicht
  zu diesem Auftrag und ist hier nicht geändert.
- Fehlende Belege: der Erkenntnisbucheintrag im Volltext und der Korrekturauftrag im Bereit-Ordner
  (beide außerhalb des Repositorys); ein Lieferbeleg mit Fassung für diesen Lauf entsteht erst nach
  der Veröffentlichung.
