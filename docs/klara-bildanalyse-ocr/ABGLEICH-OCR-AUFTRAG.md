# Abgleich mit dem bestehenden OCR-Auftrag `aufnahme:20260922:gesamt-ocr`

Stand 12.10.2026, Basis `0b8ad62c`. Grundlage: [`BESTAND.md`](./BESTAND.md) und
[`fundstellen.json`](./fundstellen.json).

## 1. Was frisch geprüft wurde

| Gegenstand | Befund |
| --- | --- |
| Originalauftrag | `aufnahme:20260922:gesamt-ocr`, **Revision 2**, sieben Originalkriterien (laut Auftrag OCR-01). Die Kriterien bleiben unverändert und werden hier weder ersetzt noch abgeschwächt |
| Laufender Kandidat | C01 · Zweig `codex/auftrag-77a81a7a269ac1a4770d`, Commit `842d2f636bdffdd18aad616135dd67e3f0d4c33c` („Text aus Fotos und Scans auf Wunsch erkennen“, 1.0.0-beta.1.945). Er ist **nicht** im Hauptstand: Seine Basis ist `25f2ea02`, der Hauptstand steht bei `0b8ad62c` |
| Anforderungs-IDs im Kandidaten | FR-CAP-05, R-0121, R-0138, R-0151, R-0181. Eingebunden sind außerdem die fremden Integrationsstellen R-1624, R-0088, R-1688 und R-1733 (Interview und sichtbares Feld) |
| Wortlaut der sieben Kriterien | lag diesem Lauf **nicht** vor. Die Auftragsunterlagen von C01 liegen außerhalb des freigegebenen Bereichs. Die Zuordnung unten stützt sich auf die IDs in Code, Tests und Commits von C01 und muss von Führung bzw. Ben gegen den Originalwortlaut bestätigt werden |
| Pflichtenheft | `specs/reference/Pflichtenheft.md` FR-CAP-05: „Dokumentanhang (txt/md/pdf/docx/Bilder) mit **Auto-OCR** als Kontext … OCR-Text fließt in Strukturierung/Interview ein.“ `specs/ERFUELLUNGSSTAND.md` führt FR-CAP-05 als „teilweise“ |

## 2. Was C01 liefert (laut Zweig, Abnahme offen)

| Anforderung | Inhalt auf C01 | Belegt auf C01 durch |
| --- | --- | --- |
| R-0151 / FR-CAP-05 | Arbeiter, Kern und Sprachdaten `deu`/`eng` der Erkennung kommen von derselben Herkunft (`apps/web/src/lib/ocrEngineDateien.ts`, `apps/web/public/ocr/lang/`). Die CSP erlaubt WebAssembly, aber weder `blob:` noch fremde Herkunft. Behebt L02 | `tests/capture/ocr-engine-gleiche-herkunft.test.ts`, `tests-smoke/ocr-technische-probe-browser.spec.ts` (technische Probe mit fiktivem Bild, ausdrücklich keine Kundenabnahme) |
| R-0151 / FR-CAP-05 | Auf Klick erkannter Bildtext reist als Kontext ins geführte Interview und in die Extraktion. Die Vertraulichkeitsregel gilt dabei auch für den Kontext | `tests/capture/gesamt-ocr-interview-kontext.test.ts`, `…-mounted.test.tsx`, `tests/capture/gesamt-ocr-dokument-ergaenzen-mounted.test.tsx` |
| R-0138 | Größenkante vor dem PDF-Parser auch im Panel „Aus Dokument ergänzen“ | `tests/capture/gesamt-ocr-dokument-ergaenzen-mounted.test.tsx` |
| R-0121 | Die Kachel des Transkriptionsdienstes zeigt den gemeldeten Stand des Mediendienstes | `tests/app/avtranscript-mediendienst-mounted.test.tsx` |
| R-0181 | Lokale Verschriftlichung über den vorhandenen Transcriber-Vertrag | `tests/media-lokal/r0181-lokale-transkription.test.ts`, `r0181-realprobe-lokale-engine.test.ts` |

Die Spalte „Belegt“ nennt die Tests auf C01. Ob sie dort grün sind, ist hier nicht geprüft. Das
entscheidet die reguläre Prüfung von C01.

## 3. Abgleich mit der neuen Anforderung (OCR-01 bis OCR-04)

**Erfüllt durch Bestand oder C01. Wiederverwenden, nicht neu bauen:**

- Erkennungsengine, Sprachdaten und CSP-Weg (C01): Basis jeder automatischen Erkennung im Browser.
  Es entsteht **keine zweite Engine**.
- Ehrliche Zustände `running`, `success`, `failed`, `unavailable` (W01, `ocr.ts`): Grundlage für
  „läuft, teilweise, fehlgeschlagen“.
- Vertraulichkeitsregel für Bild und Kontext (W02, C01): bleibt wirksam.
- Bilder aus PPTX, DOCX, Word und Browser als `<figure>` mit `data-image-id` (W03, W05, W08, W09),
  dazu Inhaltskennung je Vorkommen (W16): Anker für Fundstelle und Wiederverwendung.
- Bildbilanz je Verlustgrund (W03, W05): Grundlage für „nicht als vollständig gelesen darstellen“.

**Fehlt im Bestand und in C01:**

- automatische Auslösung (L01). C01 hält ausdrücklich „auf Wunsch / nur auf Klick“ fest,
- Erkennung eingebetteter Bilder (L03) samt Foliennummer bzw. Seite (L04, L06, L07),
- Bildtext und Bildbefund in Klaras Antwortkontext mit Fundstelle und Status (L08),
- Schalter unter Setup › Klara (L14).

**Neu gegenüber dem bestehenden Auftrag, also kein Kriterium von gesamt-ocr:**

- Analyse des Bildinhalts (Diagramme, bildhafte Tabellen) neben dem Text,
- Wiederverwendung bei unverändertem und Neuauswertung bei geändertem Bild,
- Kennzeichnung unleserlicher und unsicherer Stellen,
- Klara-Antworten und Zusammenfassungen mit Bild- und Folienangabe,
- Nutzerpräferenz mit Voreinstellung „an“.

**Spannung, die Führung entscheidet:** FR-CAP-05 im Pflichtenheft spricht von „Auto-OCR“. C01 und
der Hauptstand sagen bewusst „nur auf Klick“, und `files.ts` verlangt „Nur auf explizite
Nutzeraktion aufrufen.“ Peters Entscheidung vom 12.10.2026 („sofort automatisch mitlesen.“) gilt für
Inhalte, die Klara bereitgestellt werden. OCR-02 muss diese Regel deshalb an genau den angebundenen
Eingängen ablösen, sobald der Schalter (L14) an ist. Ältere manuelle Capture-OCR und Vorbelege aus
C01 zählen **nicht** als Lieferung der Automatik.

## 4. Verknüpfung

Die neue Anforderung ergänzt `aufnahme:20260922:gesamt-ocr` und ersetzt ihn nicht. OCR-02 setzt auf
C01 auf (siehe [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md), Schritt 0). Die sieben
Originalkriterien und die Prüfbelege von C01 bleiben bei C01.
