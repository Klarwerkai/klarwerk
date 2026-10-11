# KI-Governance — Zweck, Rollen, Fassungen, Risiken, Aufsicht, Vorfälle, Kennzeichnung

*Aufnahme 20260922 · gesamt-ki-governance, Revision 1 · Basis `2ed7226b` (`1.0.0-beta.1.906`).
Dokumentfassung `2026-10-11.1`. Die Produktfassung, unter der dieses Paket live geht, entsteht erst bei der
Veröffentlichung; bis dahin ist hier nichts als „ausgeliefert" belegt (K3).*

Grundlage sind R-0659 (K1: „Ein Satz Unterlagen fuer den Umgang mit KI im Unternehmen: Zweck, Rollen,
Fassungen, Risikoeinstufung, Aufsicht, ein Vorfallregister und die Pruefung der Kennzeichnungspflicht.
Teile davon existieren als Dokumente; ein Vorfallregister und die Risikoeinstufung fehlen.") und
NFR-TAI-03 (K2). Dieses Dokument ist der Einstieg in den Satz: es nennt für jeden der sieben Teile das
tragende Dokument und den Code, an dem die Aussage hängt. Neu sind hier die **Risikoeinstufung** (Abschnitt
4) und das **Vorfallregister** (Abschnitt 6); die übrigen Teile bestanden und werden verwiesen, nicht
neu geschrieben. Jede genannte Datei liegt im Repository, die Kennzeichnungstabelle deckt genau die
Aufgaben des Laufprotokolls ab — das prüft `tests/ki-governance/governance-paket.test.ts`.

**Grenze:** technische und organisatorische Lesart am Code, keine Rechtsberatung, keine
Konformitätsbewertung nach der KI-Verordnung (Verordnung (EU) 2024/1689) und keine Abnahme durch einen
Menschen. Die Kanzleifragen stehen weiter in Register T4 (siehe `docs/compliance/unterrichtung-artikel-4.md`).
Durch dieses Dokument übernimmt niemand eine Rolle; die Platzhalter füllt nur Pedi.

| Teil | Tragendes Dokument | Stand |
| --- | --- | --- |
| Zweck | dieses Dokument, Abschnitt 1; Unterrichtung Teil 2 | bestand, hier gebündelt |
| Rollen | dieses Dokument, Abschnitt 2 | bestand verstreut, hier gebündelt |
| Fassungen | dieses Dokument, Abschnitt 3 | bestand im Code, hier gebündelt |
| Risikoeinstufung | dieses Dokument, Abschnitt 4 | **neu** |
| Aufsicht | `docs/compliance/vertrauenswuerdige-ki.md` | bestand (gesonderter Auftrag, s. Abschnitt 8) |
| Vorfallregister | dieses Dokument, Abschnitt 6 | **neu**, ohne Einträge |
| Kennzeichnungspflicht | dieses Dokument, Abschnitt 7; Lesart in `services/model-runs/src/types.ts` | bestand im Code, hier geprüft |

## 1. Zweck

KLARWERK ist ein quellengebundenes Wissenswerkzeug. Die KI beantwortet Fragen **aus dem eingetragenen
Bestand** und nennt die Quellen (`services/ask/src/service.ts`), führt Interviews, beschreibt Bilder und
hilft bei kleineren Handgriffen (umformulieren, gliedern, Punkte aus einer Datei holen, ordnen,
auswählen). Sie prüft Wissensobjekte auf Widerspruch und Dublette, sucht Lücken und reichert auf
ausdrückliche Freigabe aus öffentlichem Wissen an. Die vollständige Liste der Aufgaben ist
`ModelRunTask` in `services/model-runs/src/types.ts`; Abschnitt 7 führt sie einzeln.

Die KI **entscheidet nicht**: Wahrheit und Gültigkeit bestätigen Menschen (`services/validation/src/service.ts`,
NFR-TAI-02). Sie trifft keine Entscheidungen über Personen, bewertet weder Beschäftigte noch Lernende
und ist nicht in die Lernplattform-Ausgabe eingebunden (`docs/lernplattform-scorm.md`: „Kein KI-Dienst").
Ein Einsatz außerhalb dieses Zwecks verändert die Risikoeinstufung (Abschnitt 4) und ist vor Beginn neu
einzustufen.

## 2. Rollen

| Rolle | Wer | Aufgabe in der KI-Governance | Beleg |
| --- | --- | --- | --- |
| Anbieter der Software | der Hersteller von KLARWERK | Produktpflichten: Kennzeichnung, Unterrichtungsvorlage, Protokoll, dieses Paket | dieses Dokument |
| Betreiber | jeder Kunde für die eigene Installation (Art. 3 Nr. 4) | Unterrichtung des eigenen Personals (Art. 4), Freigabeentscheidungen, eigenes Vorfallregister | `docs/compliance/unterrichtung-artikel-4.md` Teil 4 |
| Administrator | Konto mit Recht `users.manage` | entscheidet über öffentliche KI und getrennt über vertrauliche Inhalte (Vorgabe: gesperrt) | `tests/admin-ki-freigabe/freigabe-kern.test.ts`, `tests/admin-ki-freigabe/rollen-und-protokoll.test.ts` |
| Freigebende Person der Ausgangsprüfung | wer die Ausgangsprüfung bedient, wenn eingeschaltet | gibt jeden ausgehenden KI-Aufruf einzeln frei | `tests/ausgangspruefung/chokepoint.test.ts` |
| Validierende | Fachleute mit Validierungsrecht | bestätigen Wissen, lösen Konflikte | `services/validation/src/service.ts` |
| Nutzer | alle Konten | prüfen Antworten an den Quellen, melden Fehler, geben Kennzeichnung weiter | `docs/compliance/unterrichtung-artikel-4.md` Teil 2 |
| Verantwortlich für KI-Governance | [[PLATZHALTER: Name der verantwortlichen Person]] | führt dieses Paket und das Vorfallregister, stuft neu ein | — |
| Annahme von KI-Vorfällen | [[PLATZHALTER: Name oder Funktionspostfach]] | nimmt Meldungen an und trägt sie ein (Abschnitt 6) | — |

## 3. Fassungen

Was eine Aussage über die KI belegt, muss sagen, für welche Fassung es gilt.

| Gegenstand | Fassung wird geführt in | Heutiger Wert | Beleg |
| --- | --- | --- | --- |
| Hinweistext am Konto und Unterrichtung nach Artikel 4 | `HINWEIS_TEXT_VERSION` in `services/auth/src/notice.ts` | `2026-07-30.1` | `tests/legal/mega63-unterrichtung-artikel-4.test.ts` (Kopplung Dokument ↔ Code), `tests/legal/hinweis-textfassung-gebunden.test.ts` (Wortlaut ↔ Fassung, R-0593) |
| Modell je Lauf | `ModelRunRecord.model` in `services/model-runs/src/types.ts`, nur wenn wirklich gerufen | je Lauf | `tests/ki-lauf-modell/lauf-nennt-modell.test.ts` |
| Anbieter je Lauf, deterministischer Rückfall | `ModelRunRecord.provider`, `demo`, `fallback` | je Lauf | `tests/ki-lauf-protokoll/protokoll-vollstaendig.test.ts` |
| Anweisung Konflikturteil | `PROMPT_VERSION` in `services/conflicts/src/service.ts` | `kon-v1` | dort |
| Anweisung Dublettenurteil | `promptVersion` in `services/conflicts/src/overlap-service.ts` | `dup-v1` | dort |
| Dieses Paket | Kopf dieses Dokuments | `2026-10-11.1` | dieses Dokument |
| KI-Verordnung | Verordnung (EU) 2024/1689; Artikel 4 gilt seit 2. Februar 2025, Artikel 50 seit 2. August 2026 | — | — |

**Lücke, benannt:** Für die Anweisungen der Reasoner-Aufgaben (`answer`, `interview`, `describe` usw.)
gibt es keine Fassungskennung; `ModelRunRecord` führt `promptVersion` bewusst nicht, weil kein Erzeuger
existiert (Kommentar in `services/model-runs/src/types.ts`). Nachvollziehbar ist damit Modell und Anbieter
je Lauf, nicht der Anweisungstext. Das ist eine offene Ausbaufrage, kein Bau in diesem Auftrag.

## 4. Risikoeinstufung

### 4.1 Einstufung nach der KI-Verordnung

| Stufe | Prüffrage | Lesart für KLARWERK im Zweck von Abschnitt 1 |
| --- | --- | --- |
| Verbotene Praktiken (Art. 5) | Manipulation, Ausnutzung von Schwächen, Bewertung sozialen Verhaltens, Emotionserkennung am Arbeitsplatz, biometrische Kategorisierung? | **nein** — keine dieser Funktionen ist gebaut |
| Hochrisiko (Art. 6, Anhang III) | Einsatz in Beschäftigung (Auswahl, Beförderung, Leistungsbewertung), Bildung (Bewertung von Lernergebnissen), kritischer Infrastruktur als Sicherheitsbauteil, Zugang zu wesentlichen Diensten? | **nein** im bestimmungsgemäßen Zweck. Grenzfall: Antworten zu Wartungsfristen oder Grenzwerten können in sicherheitsrelevante Arbeit eingehen; KLARWERK ist dort Nachschlagewerk mit Quellenpflicht, kein Sicherheitsbauteil. Die Unterrichtung verlangt für genau diese Fälle die Nachprüfung (Teil 2 „Wann Sie nachprüfen müssen") |
| Transparenzpflichten (Art. 50) | Interagiert ein Mensch mit einer KI? Erzeugt die KI Text? | **ja** — Art. 50 Abs. 1 (Hinweisband `apps/web/src/legal/NoticeBanner.tsx`) und Abs. 2 (Kennzeichnung, Abschnitt 7) |
| KI-Modell mit allgemeinem Verwendungszweck (Kapitel V) | Stellt KLARWERK ein solches Modell bereit? | **nein** — KLARWERK nutzt Modelle eines Anbieters, es stellt keine bereit |
| KI-Kompetenz (Art. 4) | gilt für alle Stufen | **ja** — `docs/compliance/unterrichtung-artikel-4.md` |

**Ergebnis der Lesart: begrenztes Risiko mit Transparenzpflichten.** Pflichten für Hochrisiko-Systeme
(Risikomanagementsystem nach Art. 9, Meldung schwerwiegender Vorfälle nach Art. 73, Grundrechte-
Folgenabschätzung nach Art. 27) folgen daraus nicht. Diese Einstufung kippt, sobald ein Betreiber die KI
für Personalentscheidungen oder die Bewertung von Beschäftigten oder Lernenden einsetzt; dann ist vor
Beginn neu einzustufen. Ob die Lesart trägt, ist eine Kanzleifrage (Register T4).

### 4.2 Risiken im Betrieb

Unabhängig von der Rechtsstufe führt das Paket die Risiken, die im Betrieb auftreten können, mit ihrer
Gegenmaßnahme im Produkt. Eintrittswahrscheinlichkeit und Schadenshöhe sind nicht gemessen; die
Spalte „Einschätzung" ist eine Einordnung, keine Messung.

| Nr. | Risiko | Einschätzung | Gegenmaßnahme im Produkt | Beleg |
| --- | --- | --- | --- | --- |
| RK-1 | Falsche oder unbelegte Antwort wird als Auskunft genommen | hoch | Quellenpflicht, tragende gegen herangezogene Quellen, kein Wahrheitsversprechen, Unterrichtung | `services/ask/src/service.ts`, `docs/compliance/unterrichtung-artikel-4.md` |
| RK-2 | Vertrauliches verlässt die Installation | hoch | zwei getrennte Adminfreigaben (Vorgabe gesperrt), Prüfung im Augenblick der Übertragung, Egress nur über bewachte Clients | `tests/admin-ki-freigabe/vertrauliche-freigabe-bis-zum-anbieter.test.ts`, `tests/security/egress-chokepoint.test.ts` |
| RK-3 | KI-erzeugter Text wird ohne Kennzeichnung weitergegeben | mittel | Kennzeichnung an Fläche, Serverantwort und Export | `apps/web/src/components/AiGeneratedNotice.tsx`, `tests/reasoner/mega61-ki-kennzeichnung.test.ts` |
| RK-4 | Deterministischer Rückfall wird für KI-Ausgabe gehalten oder umgekehrt | mittel | Marke nur an echter Modellausgabe, `demo`/`fallback` am Lauf | `tests/legal/r0604-ki-kennzeichnung-wahrheit.test.tsx` |
| RK-5 | Inhalte geraten ins Protokoll | mittel | Laufprotokoll nur mit Kennungen, keine Prompt- oder Antworttexte; Serverlog ohne Werte | `tests/reasoner/model-run-context.test.ts`, `tests/security/log-keine-inhalte.test.ts` |
| RK-6 | Eine Freigabeänderung ist nicht nachvollziehbar | mittel | Prüfprotokoll mit Administrator, Zeit und Umfang | `tests/admin-ki-freigabe/rollen-und-protokoll.test.ts` |
| RK-7 | Unerwartete Kosten durch Modellaufrufe | niedrig | Kostenhinweis an jeder Auslösestelle, Verbrauch am Lauf | `tests/legal/mega67-kostenhinweis-bedingt.test.tsx` |

Neue Funktionen mit KI ergänzen diese Tabelle vor der Veröffentlichung; ein Vorfall aus Abschnitt 6, der
kein Risiko hier trifft, ergänzt sie ebenfalls.

## 5. Aufsicht

Wer entscheidet, wer freigibt und was nachvollziehbar bleibt, steht mit Code- und Testbelegen in
`docs/compliance/vertrauenswuerdige-ki.md` (Abschnitte „Transparenz", „Menschliche Aufsicht",
„Nachvollziehbarkeit"); die Belege hält `tests/ki-freigaberegeln/prinzipien-beleg.test.ts` aktuell. Der
Serververtrag je KI-Weg steht in `docs/entscheidungen/gesamt-ki-freigaberegeln.md`. Dieses Paket
wiederholt das nicht.

## 6. Vorfallregister

### 6.1 Was ein KI-Vorfall ist

Ein KI-Vorfall ist jedes Ereignis, bei dem eine KI-Funktion von KLARWERK

- eine falsche Antwort gab, auf die jemand gehandelt hat oder hätte handeln können (RK-1),
- Inhalte an einen Anbieter übertragen hat, die nicht freigegeben waren (RK-2),
- eine Ausgabe ohne vorgeschriebene Kennzeichnung oder eine Kennzeichnung ohne KI-Ausgabe zeigte (RK-3, RK-4),
- Inhalte in ein Protokoll schrieb (RK-5),
- oder sonst gegen Zweck (Abschnitt 1) oder Freigabe (Abschnitt 5) wirkte.

Betrifft ein Vorfall personenbezogene Daten, gilt **zusätzlich** der Ablauf für Datenschutzverletzungen
des Betreibers (`docs/compliance/gdpr-compliance-runbook.md`, Trigger „Sicherheitsvorfall"); das
Register ersetzt ihn nicht. Eine Meldepflicht nach Art. 73 folgt aus der Einstufung in Abschnitt 4
nicht; das Register ist die freiwillige, für Aufsicht und Nachbesserung nötige Führung.

### 6.2 Meldeweg

1. Wer einen Vorfall bemerkt, meldet ihn an die Annahme (Abschnitt 2) — mit Zeitpunkt, KI-Fläche und
   was geschah. Keine Inhalte vertraulicher Objekte in die Meldung kopieren; die Kennung genügt.
2. Die Annahme trägt den Vorfall binnen eines Arbeitstags ein und sichert die Belege: Kennung des
   KI-Laufs aus dem Laufprotokoll (`services/model-runs/src/types.ts`), Einträge im Prüfprotokoll
   (`services/audit/src/chain.ts`), betroffene Wissensobjekte als Kennungen.
3. Sofortmaßnahme nach Lage: öffentliche KI durch den Administrator sperren, Quelle zurückziehen oder
   korrigieren, Kennzeichnung nachholen.
4. Ursache und dauerhafte Maßnahme eintragen; trifft der Vorfall kein Risiko aus 4.2, dort ergänzen.
5. Abschluss mit Datum und Person.

### 6.3 Register

Spalten: laufende Nummer, gemeldet am, gemeldet von (Rolle), KI-Aufgabe (Abschnitt 7), Risiko (4.2),
Beschreibung ohne Inhalte, Belegkennungen, Sofortmaßnahme, Ursache, dauerhafte Maßnahme, abgeschlossen
am, abgeschlossen von.

| Nr. | Gemeldet am | Von (Rolle) | KI-Aufgabe | Risiko | Beschreibung | Belege | Sofortmaßnahme | Ursache | Dauerhafte Maßnahme | Abgeschlossen am | Abgeschlossen von |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

**Bisher ist kein Vorfall eingetragen.** Das heißt nicht, dass keiner geschah: vor diesem Dokument gab es
keinen Ort, an dem einer hätte stehen können. Einträge sind nur aus echten Meldungen zu machen; ein
erfundener oder nachträglich geglätteter Eintrag wäre schlimmer als ein leeres Register.

**Aufbewahrung:** [[PLATZHALTER: Ort und Dauer der Aufbewahrung des Registers]]. Ein Betreiber führt für
seine Installation ein eigenes Register; dieser Abschnitt ist dafür die Vorlage.

## 7. Prüfung der Kennzeichnungspflicht

Prüfmaßstab ist Art. 50 Abs. 2: Ausgaben sind maschinenlesbar als KI-erzeugt zu kennzeichnen, außer die
KI „führt eine unterstützende Funktion für die Standardbearbeitung aus oder verändert die
bereitgestellten Eingabedaten nicht wesentlich". Die Lesart steht mit Begründung im Code
(`services/model-runs/src/types.ts`, `KI_ERZEUGENDE_AUFGABEN`); die maschinenlesbare Marke ist
`aiGeneratedMark`, die Anzeige `apps/web/src/components/AiGeneratedNotice.tsx`. Art. 50 Abs. 1
(Hinweis, dass man mit einer KI arbeitet) erfüllt das Hinweisband `apps/web/src/legal/NoticeBanner.tsx`.

| Aufgabe | Ergebnis | Begründung |
| --- | --- | --- |
| `answer` | gekennzeichnet | formuliert eine neue Antwort |
| `interview` | gekennzeichnet | erzeugt Fragen |
| `describe` | gekennzeichnet | erzeugt eine Bildbeschreibung |
| `enrich` | gekennzeichnet | erzeugt Text aus öffentlichem Wissen (Entscheidung Pedi `8398db9e`) |
| `assist` | nicht gekennzeichnet | formuliert vorhandenen Text um — der Grenzfall der Lesart |
| `structure` | nicht gekennzeichnet | gliedert vorhandene Notizen |
| `extract` | nicht gekennzeichnet | holt Punkte aus einer vorhandenen Datei |
| `group` | nicht gekennzeichnet | ordnet vorhandene Dokumente |
| `select` | nicht gekennzeichnet | wählt aus, erzeugt keinen Text |
| `conflict` | kein gelesener Text | Urteil über ein Paar |
| `duplicate` | kein gelesener Text | Urteil über ein Paar |
| `probe` | kein gelesener Text | Anbieterprobe |
| `gaps` | kein gelesener Text | Lückenerkennung je Bereich |

Gemessen sind die Marke an Modellausgaben und ihr Fehlen am deterministischen Rückfall
(`tests/reasoner/mega61-ki-kennzeichnung.test.ts`, `tests/legal/r0604-ki-kennzeichnung-wahrheit.test.tsx`)
sowie der Export (`tests/legal/mega62-export-kennzeichnung.test.ts`).

**Offen an der Lesart:** `conflict` und `duplicate` speichern eine Begründung mit wörtlichen
Belegzitaten (`services/conflicts/src/types.ts`). Wird diese Begründung Menschen angezeigt, ist
„kein gelesener Text" zu prüfen. Das ist eine Frage an die Lesart, kein festgestellter Verstoß. Bis sie
geklärt ist, gilt der Satz im Code: eine Kennzeichnung zu viel ist kein Verstoß, eine zu wenig schon.

## 8. Abgrenzung zu bestehenden Lieferungen und Aufträgen

- **NFR-TAI-03 (K2)** ist inhaltsgleich auch R-2066 im gesonderten Auftrag
  `aufnahme:20260922:gesamt-ki-freigaberegeln` zugeordnet und dort geliefert:
  `docs/compliance/vertrauenswuerdige-ki.md` mit `tests/ki-freigaberegeln/prinzipien-beleg.test.ts`.
  Dieser Auftrag baut es nicht neu, sondern bindet es als Teil „Aufsicht" in das Paket ein.
- **DS18 (Unterrichtung nach Art. 4):** `docs/compliance/unterrichtung-artikel-4.md` (mega61 Block J,
  mit dem Produkt seit mega63 Block E, gemessen in `tests/legal/mega63-unterrichtung-artikel-4.test.ts`).
- **DS21 (Folgenabschätzung):** die DSFA-Entscheidungshilfe steht in
  `docs/compliance/gdpr-compliance-runbook.md` §2 und die Auslöser in
  `docs/compliance/data-protection-requirements.md` §4. Eine durchgeführte DSFA gibt es nicht; sie liegt
  beim Betreiber und seinem Datenschutzbeauftragten. Eine Grundrechte-Folgenabschätzung nach Art. 27
  folgt aus Abschnitt 4 nicht.
- **Kennzeichnung (mega61 Block E/F, mega62 Block E, R-0604, R-1349):** bestehender Code, hier nur
  geprüft.
- **Laufprotokoll (`aufnahme:20260922:gesamt-ki-laufprotokoll`, R-0612):** bestehend, hier als Beleg
  für Fassungen und Vorfälle genutzt.

## 9. Quellenwidersprüche und fehlende Belege

- **Zahl der Aufgaben:** Die Unterrichtung, Teil 5, nennt „Acht KI-Aufgaben, drei davon
  kennzeichnungspflichtig". Der Code führt heute dreizehn Laufarten, davon vier gekennzeichnet (`enrich`
  kam durch Entscheidung Pedi hinzu). Nach Teil 5 selbst gilt der Produkttext; Teil 2 (der gelesene,
  versionierte Text) nennt keine Zahl und bleibt unverändert. Teil 5 ist bei der nächsten Erhöhung der
  Textfassung nachzuführen.
- **Altquelle nicht im Repository:** Die Herkunft von R-0659 (`00_CONTROL/FUNKTIONSREGISTER.json`,
  Landkarte v3 Zeile N10, Plan P-2.6) und die Vorlage der Art.-50-Lesart (`_relay/kopf/…`) liegen nicht
  im Produktrepository. Welches Dokument die Altquelle mit „Betreiber-Runbook" meint, ist daraus nicht
  feststellbar; als Betreiberunterlage dienen hier `docs/compliance/gdpr-compliance-runbook.md` und
  `docs/compliance/unterrichtung-artikel-4.md` Teil 4.
- **Keine Rechtsprüfung:** Einstufung (Abschnitt 4) und Kennzeichnungslesart (Abschnitt 7) sind
  unbestätigt (Register T4).
- **Keine echte Führung:** Rollen und Register sind Vorlagen. Ob jemand die Rollen übernimmt und das
  Register führt, belegt erst ein echter Eintrag.
