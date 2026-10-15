# Wissensprüfung — Referenzbestand mit vorab benannten Sollurteilen

*Aufnahme 20260922 · referenzbestand-sollurteile (G3), Revision 1, Arbeitsart Fachklärung. Stand
13.10.2026 auf Basis `550807b9` (`1.0.0-beta.1.954`). Fassung **RB-01-ENTWURF-v1** — ein
Vorschlag zur Bestätigung durch Pedi, **noch nicht bestätigt**.*

Daten: `tests/wissenspruefung-referenzbestand/referenzbestand.ts`. Wächter:
`tests/wissenspruefung-referenzbestand/referenzbestand.test.ts`.

## 1. Zweck und Abgrenzung

Die Wissensprüfung (Konflikt- und Dublettenweg, Paarpflichten) soll an **unabhängigen
Sollurteilen** gemessen werden können. Dieser Bestand legt die Urteile fest, **bevor** ein Modell
die Paare sieht. Er ist klein, stützt sich ausschließlich auf vorhandene Quellen des Arbeitsbaums
und benennt, wo diese Quellen nicht reichen.

| Gehört dazu | Gehört nicht dazu |
|---|---|
| Quellen, Paar- und Mehrfachurteile mit Begründung und Herkunft | Ein Modelllauf gegen den Bestand und seine Auswertung — das ist `aufnahme:20260922:paarurteile-qualitaet` |
| Abdeckung von Zahlen, Einheiten, Varianten, Ausnahmen und Unklarem | Eine Änderung an Reasoner, Konflikt- oder Dublettenerkennung |
| Fragen an Pedi und der Ort ihrer Bestätigung | Die Bestätigung selbst: sie gibt Pedi oder eine von Pedi benannte Fachperson |

Herkunft des Auftrags: Meilenstein G3 („Jedes verpflichtete Paar mit Kontext und tatsächlichem
Ergebnis nachweisen · Zahlen, Einheiten, Varianten und Ausnahmen unterscheiden · Mehr-Aussagen-
Konflikte gesondert prüfen; unklar bleibt offen"), Notizquelle
`gespraech/wiki-start-20260915/VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md` (liegt außerhalb des
Produktbaums). Der historische Vorschlag „10–20 Paare" ist eine Startgröße, keine Zusage; dieser
Entwurf hat 15 Einzelpaare und zwei Mehrfachfälle mit zusammen neun Paarurteilen.

**Originalkriterien (wörtlich):**

1. Quellen und erwartete Paar-/Mehrfachurteile sind mit fachlicher Begründung und Herkunft dokumentiert.
2. Zahlen, Einheiten, Varianten, Ausnahmen und bewusst unklare Fälle sind vertreten.
3. Sollurteile werden unabhängig vom zu testenden Modellergebnis bestätigt.

## 2. Quellen

Alle Inhalte sind vorhandene, fiktive Demo- und Testdaten; keine Kunden- oder Personendaten.

| Bestand | Datei | Kennung im Bestand | Was er beiträgt |
|---|---|---|---|
| Simulationskorpus (SCRUM-501) | `services/app/src/sim-corpus.ts` | `SIM_CORPUS[].key` | DE/EN/NL-Drillinge, nahe Dubletten, drei kommentierte „GEWOLLTE KONFLIKTE" mit Zahlen und Einheiten |
| Demo-Korpus (SCRUM-487) | `tests/demo-korpus/demo-corpus.ts` | `DEMO_CORPUS[].pageId`, Sprache de | zwei eingebaute Konfliktpaare (`conflictKey`) |
| Probe-Import | `demo/testimports/kw-probe-smoke.de.json` | Eintrag nach `title` | Reifen-Dublette (Ziffer ↔ Wort) und Kontrollseite; Erwartung in `demo/testimports/README.md` |
| PX-17-Sollbestand (BES-01) | `tests/beschaffung-px17/sollbestand.ts` | `QUELLEN[].quellId` | Fassungen mit Freigabestand (freigegeben, Entwurf, künftig, abgelöst) und ein Maßwiderspruch |

Der Text eines Elements steht **nur** in seiner Quelle; der Wächter liest ihn dort (Q1) und prüft
jede zitierte Wertstelle wörtlich gegen ihn (Q2).

## 3. Sollurteile

Urteile: **duplikat** (dieselbe Aussage, auch in anderer Sprache oder Notation) · **widerspruch**
(heute für denselben Gegenstand unvereinbar) · **variante** (verwandt, aber heute vereinbar:
andere Geltung, anderer Freigabestand) · **kein_befund** · **offen** (bewusst unklar: ohne
Fachentscheidung weder Widerspruch noch Vereinbarkeit belegt).

### Paare

| Fall | Paar | Soll | Merkmale | Begründung (Kurzform) | Herkunft |
|---|---|---|---|---|---|
| RB-01 | Reifen (A) „4 reifen" ↔ Reifen (B) „vier reifen" | duplikat | Zahl, Variante | Ziffer und Zahlwort, gleicher Wert | Probe-README, Abschnitt 3 |
| RB-02 | Warnschilder Halle 7 „blau" ↔ „ausschließlich in Rot" | widerspruch | — | gleiche Regel, unvereinbare Farben | Demo-Korpus `warnfarbe` |
| RB-03 | Backup „täglich" ↔ „nur wöchentlich" | widerspruch | — | „nur" schließt täglich aus | Demo-Korpus `backup` |
| RB-04 | MK-5 Kühlung „30 Minuten" (DE) ↔ „10 minutes" (EN) | widerspruch | Zahl, Einheit, Sprache | gleiche Pumpe und Maßnahme; EN lehnt längeren Nachlauf ab | Sim-Korpus, „GEWOLLTER KONFLIKT" |
| RB-05 | RK-8 „alle 12 Monate" (DE, Hersteller) ↔ „elke 6 maanden" (NL, Praxis) | **offen** | Zahl, Einheit, Unklar, Sprache | 6 Monate halten 12 ein; Widerspruch nur, wenn 12 ein festes Intervall ist — Fachentscheidung (F1) | **weicht ab** vom Korpuskommentar „GEWOLLTER KONFLIKT" |
| RB-06 | KF-2 „vor jeder Schicht" (DE) ↔ „only every 200 operating hours" (EN) | widerspruch | Zahl, Einheit, Sprache | Bezugsgrößen nicht umrechenbar; Widerspruch folgt aus „only" und der Begründung | Sim-Korpus, „GEWOLLTER KONFLIKT" |
| RB-07 | SV-200 „11,5 bar" (DE) ↔ „11.5 bar" (EN) | duplikat | Zahl, Einheit, Variante, Sprache | Dezimalkomma ↔ Dezimalpunkt, gleicher Wert | Sim-Korpus, Drilling |
| RB-08 | DP-3 „8.000 Betriebsstunden" (DE) ↔ „8,000 operating" (EN) | duplikat | Zahl, Einheit, Variante, Sprache | Tausenderpunkt ↔ Tausenderkomma; falsch gelesen 8 ↔ 8000 | Sim-Korpus, Drilling |
| RB-09 | HP-1 Filter „2,5 bar Differenzdruck" ↔ SV-200 „11,5 bar" | kein_befund | Zahl, Einheit | gleiche Einheit, verschiedene Gegenstände und Größen | fachliche Lesart (Gegenprobe) |
| RB-10 | Kaffeeküche ↔ Reifen (A) | kein_befund | — | keine gemeinsame Sache | Probe-README, Kontrollseite |
| RB-11 | KP-110 „vor jedem Anfahren" entlüften ↔ „darf nie ohne Entlüftung anlaufen" | duplikat | Variante | Gebot ↔ Verbot derselben Regel | Sim-Korpus, „NAHE DUBLETTE" |
| RB-12 | PX-17 V2 „mindestens 80 % Altpapier" ↔ V3 „gültig erst ab 01.03.2027" (90 %) | variante | Zahl, Einheit, Ausnahme | Zahlunterschied, aber zeitliche Geltungsausnahme: heute gilt V2 | PX-17 V2/V3 |
| RB-13 | PX-17 PB-1 „120 × 80 × 40 mm" ↔ Beta-Maßblatt „125 × 80 × 40 mm" | widerspruch | Zahl, Einheit | gleiche Schachtel, keine Toleranzangabe | PX-17 `klaeren`, BES-F-WIDERSPRUCH |
| RB-14 | PX-17 Design D3 (freigegeben) ↔ D4 (Entwurf) | variante | Variante, Ausnahme | Entwurf ist heute kein Gegenstück zur gültigen Fassung | PX-17 D3/D4 |
| RB-15 | Druckluft „3-mm-Leckage … 2.000 Euro" (DE) ↔ „3 mm leak … 2,000 euros" (EN) | duplikat | Zahl, Einheit, Variante, Sprache | gleiche Werte, andere Schreibweise | Sim-Korpus, Drilling |

### Mehrfachfälle

| Fall | Aussagen | Paarurteile | Warum als Gruppe |
|---|---|---|---|
| RB-M1 | Absperrschieber AS-40: DE, EN, NL und die EN-Dublette | alle sechs Paare **duplikat** | eine Dublettengruppe aus vier Aussagen, nicht vier Einzelbefunde |
| RB-M2 | PX-17 V2 (heute), V3 (ab 2027), Design D2 (abgelöst, „mit Kunststofffenster") | V2↔V3 **variante**; V2↔D2 **kein_befund**; V3↔D2 **kein_befund** | ein reiner Textvergleich sähe V2↔D2 („ohne Kunststofffenster") als Widerspruch; der Altstand gilt nicht mehr (F2) |

Die ausführliche Begründung jedes Paarurteils steht im Datenmodul.

### Abdeckung (Kriterium 2)

| Merkmal | Fälle |
|---|---|
| Zahl | RB-01, RB-04 bis RB-09, RB-12, RB-13, RB-15, RB-M2 |
| Einheit | RB-04 bis RB-09, RB-12, RB-13, RB-15, RB-M2 |
| Variante (Schreibweise, Formulierung, Fassung) | RB-01, RB-07, RB-08, RB-11, RB-14, RB-15, RB-M1 |
| Ausnahme (Geltung, Freigabestand) | RB-12, RB-14, RB-M2 |
| Bewusst unklar | RB-05 |
| Sprachübergreifend | RB-04 bis RB-08, RB-15, RB-M1 |

Gezielte Zahlenfallen: andere Schreibweise desselben Werts (RB-01, RB-07, RB-08, RB-15), gleiche
Einheit ohne gemeinsamen Gegenstand (RB-09), echter Zahlenwiderspruch (RB-04, RB-13),
Zahlunterschied mit Geltungsausnahme (RB-12).

## 4. Fragen an Pedi

- **F1** (RB-05): Ist „alle 12 Monate" beim RK-8 ein festes oder ein Höchstintervall, und ersetzt
  die Praxisbeobachtung (6 Monate) die Herstellerfreigabe? Bis dahin bleibt das Paar „offen".
- **F2** (RB-M2): Soll ein Widerspruch zu einem abgelösten Stand als „kein Befund" gelten oder als
  eigener historischer Hinweis gemeldet werden?
- **F3**: Die vorhandenen Quellen enthalten **keinen echten Widerspruch zwischen drei Aussagen**
  und **kein Paar mit gleichem Wert in verschiedenen Einheiten** (z. B. bar ↔ kPa). Sollen solche
  Fälle mit Pedi neu formuliert werden? Dieser Entwurf erfindet sie nicht.
- **F4**: Wer bestätigt die Urteile (Pedi selbst oder eine benannte Fachperson), und in welchem
  Beleg (Gesprächsnotiz unter `gespraech/wissenspruefung-referenzbestand`)?

## 5. Unabhängigkeit vom Modellergebnis (Kriterium 3)

- Das Datenmodul importiert nichts; es kennt weder Reasoner noch Konflikt- oder Dublettenerkennung
  und trägt keine Felder eines Modellurteils (Wächter U1).
- Jedes Urteil hat einen Bestätigungsstand. In dieser Fassung ist jeder Stand `vorgeschlagen`
  (U3). Bestätigt oder abgelehnt wird ein Urteil nur mit Person, Datum und Beleg; ein Beleg, der
  auf einen Modelllauf zeigt, ist unzulässig (U2, mit Kalibrierfällen).
- Reihenfolge: Pedi bestätigt die Urteile (oder ändert sie) **ohne** Ergebnisse eines Modelllaufs
  gegen diesen Bestand. Erst danach misst `aufnahme:20260922:paarurteile-qualitaet`. Mit der
  Bestätigung wird die Fassung umbenannt (ohne „ENTWURF") und der Stand je Fall eingetragen.

## 6. Belege und Grenzen

- **Art der Belege:** Quelleninspektion der vier Bestandsdateien; der Wächter
  `referenzbestand.test.ts` ist neu und in dieser Lieferung **nicht selbst ausgeführt** — sein
  Lauf ist der Prüflauf dieser Lieferung.
- **Offen, extern:** die fachliche Bestätigung durch Pedi (Kriterium 3 ist erst damit erfüllt);
  die Notizquelle `VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md` liegt außerhalb des Produktbaums.
- **Abweichung von einer Quelle:** RB-05 schlägt „offen" vor, wo der Simulationskorpus einen
  gewollten Konflikt kommentiert. Der Korpus bleibt unverändert.
- **Lücken der vorhandenen Quellen:** siehe F3. Alle Inhalte sind fiktive Demodaten; ein
  Kundenbestand ist nicht beteiligt.
