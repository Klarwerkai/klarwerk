# Abgleich mit dem bestehenden OCR-Auftrag `aufnahme:20260922:gesamt-ocr`

Stand 12.10.2026 (Nacharbeit 1). Grundlage: [`BESTAND.md`](./BESTAND.md) und
[`fundstellen.json`](./fundstellen.json).

## 1. Quellen dieses Abgleichs

| Gegenstand | Befund |
| --- | --- |
| Originalauftrag | `aufnahme:20260922:gesamt-ocr`, **Revision 2**, sieben Originalkriterien (K1–K7, Wortlaut in Abschnitt 2). Sie bleiben unverändert und werden hier weder ersetzt noch abgeschwächt |
| Aktueller Kandidat | C01 · Zweig `codex/auftrag-77a81a7a269ac1a4770d`, Commit `64e1768c1aa48ffb70f509dc0f0181de97db95bc` („Text aus Fotos und Scans auf Wunsch erkennen“, 1.0.0-beta.1.946, Kandidatenmeldung vom 12.10.2026, 18:14 UTC). Er löst den früher genannten Stand `842d2f63` ab |
| Abnahme | Ben, Urteil **„erfuellt“** für den Originalauftrag an `64e1768c`: nativer Prüfbericht mit 51 bestandenen Tests ohne Fehler oder Skips (darunter H2627, I17–I19, K14), Build und Format bestanden. Weiterverwendet: PDF-Korrekturbelege, echte Chromium-OCR-Probe mit fiktivem Bild, Medien- und Wissensgewinnungsbelege, lokale whisper.cpp-Realprobe mit 9/9 bestandenen Fällen |
| Integrationsstand | `64e1768c` ist der Stand von `github/main`. In der Arbeitsbasis dieses Auftrags (`0b8ad62c`) ist er **nicht** enthalten; die Fundstellen in `fundstellen.json` beziehen sich auf diese Basis |
| Getrennte Menschenproben (sperren weder gesamt-ocr noch OCR-01) | echte OCR-Kundenabnahme später im Pilot; Browserprobe mit Pedis ursprünglicher eingescannter PDF über 50 MB unbelegt |
| Herkunft | Auftragsdatei, Kandidatenmeldung, Prüfbericht und Urteil von gesamt-ocr liegen außerhalb des Lesebereichs dieses Auftrags. Wortlaut und Ergebnisse stammen aus Bens Prüflesung dieser Dateien in `HISTORIE/nacharbeit-1/BEN/STREAM.jsonl` und sind dort unverändert nachlesbar |

## 2. Die sieben Kriterien, ihr Lieferstand und ihr Bezug zu OCR-01 bis OCR-04

| K | Originalkriterium (Revision 2, wörtlich) | Lieferstand an `64e1768c` mit Beleg | Bezug zur neuen Anforderung |
| --- | --- | --- | --- |
| K1 | „Aufgenommener Zielzustand (R-0121): Eine Sprach- oder Videoaufnahme wird automatisch in Text umgewandelt und daraus wird Wissen gemacht. Das Modul ist gebaut, der Verschriftlichungsdienst aber nicht eingerichtet - die Funktion laeuft heute nicht. Ohne Schluessel sagt die Anwendung ehrlich, dass sie inaktiv ist.“ | Die Transkript-Kachel folgt dem gemeldeten Dienststand. `tests/app/avtranscript-mediendienst-mounted.test.tsx`, im Prüfbericht grün | Ton und Video, keine Bilder. **Abgegrenzt**, keine Auswirkung auf OCR-01 bis OCR-04 |
| K2 | „Aufgenommener Zielzustand (R-0138): Bei einer eingescannten PDF ueber 50 MB blieb die Meldung wird gelesen stehen und der Browser-Tab fror ein - aus Pedis eigenen Dateien.“ | Größenkante und Frist mit ehrlicher Meldung, auch im Panel „Aus Dokument ergänzen“. `tests/capture/gesamt-ocr-dokument-ergaenzen-mounted.test.tsx` und PDF-Korrekturbelege. Der echte 50-MB-Browserlauf ist eine getrennte Menschenprobe | **Wiederverwenden**: Kante und Frist gelten für jede automatische Analyse großer PDFs („große Quellen nachvollziehbar“). Gescannte Seiten liefern weiterhin keinen Text (L06) |
| K3 | „Aufgenommener Zielzustand (R-0151): Fotos von Anleitungen, Aushaengen oder Notizen werden gelesen und ihr Text wird zu Wissen. Die Erkennung startet nur auf ausdruecklichen Klick, nie von selbst. Tabellen auf Bildern werden nicht erkannt.“ | Erkennung auf Klick mit gleichherkünftiger Engine und Sprachdaten `deu`/`eng` (behebt L02). `tests/capture/ocr-engine-gleiche-herkunft.test.ts`, `tests-smoke/ocr-technische-probe-browser.spec.ts` (echte Chromium-Probe, fiktives Bild). Tabellenerkennung nicht geliefert | **Engine wiederverwenden, keine zweite.** **Quellenwiderspruch**: „nur auf ausdrücklichen Klick, nie von selbst“ und „Tabellen … nicht erkannt“ stehen gegen den neueren Auftrag vom 12.10.2026 („sofort automatisch mitlesen.“, bildhafte Tabellen gehören zum Kontext). Der neue Auftrag regelt das selbst für Inhalte, die Klara bereitgestellt werden. K3 bleibt für den manuellen Erfassungsweg unverändert gültig |
| K4 | „Aufgenommener Zielzustand (R-0181): Aufnahmen sollen auf dem eigenen Rechner ohne Cloud in Text umgewandelt werden; der heute gelesene Medienweg verwendet einen Cloud-Client.“ | Lokaler Transkriber über den vorhandenen Vertrag. `tests/media-lokal/r0181-lokale-transkription.test.ts` (Schnittstelle), lokale whisper.cpp-Realprobe 9/9 laut Bens Urteil | Ton, keine Bilder. **Abgegrenzt** |
| K5 | „Aufgenommener Zielzustand (R-2098): Dokumentanhang + OCR (SOLL)“ | Wie K6: Dokumentanhang mit Texterkennung auf Klick, Text geht in Entwurf und Interview | **Teilweise Grundlage**: Dokumentanhang und Erkennung vorhanden. Automatik (L01) und eingebettete Bilder (L03) fehlen |
| K6 | „Aufgenommener Zielzustand (SOLL:FR-CAP-05): Dokumentanhang (txt/md/pdf/docx/Bilder) mit Auto-OCR als Kontext. Historisches Abnahmekriterium: OCR-Text fließt in Strukturierung/Interview ein.“ | Erkannter Text fließt in Interview und Entwurf, mit maßgeblicher Fassung über den Moduswechsel in beiden Richtungen. `tests/capture/gesamt-ocr-interview-kontext.test.ts`, `…-mounted.test.tsx`, `tests/transkript-uebernahme/ocr-im-sichtbaren-feld-mounted.test.tsx`. „Auto“ ist laut Urteil durch die jüngere Entscheidung „auf Klick“ begrenzt | **Das historische „Auto-OCR als Kontext“ kehrt mit der neuen Anforderung für Klara zurück.** Geliefert ist der Kontext für Strukturierung und Interview, nicht Klaras Antwortkontext (L08) |
| K7 | „Zu den zugeordneten Anliegen das tatsächlich gelieferte Ergebnis mit Fassung und passendem Beleg festhalten; vorhandene abgeschlossene Teilumfänge und gesonderte bestehende Aufträge ausdrücklich abgrenzen. Konkrete Quellenwidersprüche und fehlende Belege benennen. Die bloße Nennung einer nicht wiederholten Prüfung bestellt keinen zusätzlichen Prüflauf.“ | Lieferstand je Anliegen im Prüfplan von gesamt-ocr (R-0121 → K1, R-0138 → K2, R-0151/R-2098/FR-CAP-05 → K3, K5, K6, R-0181 → K4). Durch Bens späteren grünen Prüfbericht überholt: die dort noch offenen Angaben zu I17–I19/K14 und zur Engine im Prüfadapter | **Nachweisregel, die dieser Abgleich übernimmt**: Fassung `64e1768c`, Belege oben, Widerspruch in K3/K6 benannt, offene Menschenproben getrennt |

## 3. Was daraus für die neue Anforderung folgt

**Erfüllt durch Bestand oder C01. Wiederverwenden, nicht neu bauen:**

- Erkennungsengine, Sprachdaten und CSP-Weg (C01, K3). Das ist die Basis jeder automatischen
  Erkennung im Browser. Es entsteht **keine zweite Engine**.
- Größenkante und Frist für große PDFs (C01, K2).
- Erkannter Text als Kontext für Entwurf und Interview mit maßgeblicher Fassung (C01, K6).
- Ehrliche Zustände `running`, `success`, `failed`, `unavailable` (W01, `ocr.ts`).
- Vertraulichkeitsregel für Bild und Kontext (W02, C01).
- Bilder aus PPTX, DOCX, Word und Browser als `<figure>` mit `data-image-id` (W03, W05, W08,
  W09), dazu die Inhaltskennung je Vorkommen (W16).
- Bildbilanz je Verlustgrund (W03, W05). Sie umfasst aber nur das Folien-XML (L05, L16).

**Fehlt im Bestand und in C01:**

- automatische Auslösung (L01); C01 hält gemäß K3 ausdrücklich „nur auf Klick“ fest,
- Erkennung eingebetteter Bilder (L03) samt Foliennummer bzw. Seite (L04, L06, L07),
- Bilder aus Layout, Master, Diagrammen und SmartArt (L16),
- Analyse von Bildern in Office-Anhängen im Artikel (L17),
- Bildtext und Bildbefund in Klaras Antwortkontext mit Fundstelle und Status (L08),
- Schalter unter Setup › Klara (L14).

**Neu gegenüber dem bestehenden Auftrag, also kein Kriterium von gesamt-ocr:**

- Analyse des Bildinhalts (Diagramme, bildhafte Tabellen) neben dem Text; K3 schließt Tabellen
  für gesamt-ocr ausdrücklich aus,
- Wiederverwendung bei unverändertem und Neuauswertung bei geändertem Bild,
- Kennzeichnung unleserlicher und unsicherer Stellen,
- Klara-Antworten und Zusammenfassungen mit Bild- und Folienangabe,
- Nutzerpräferenz mit Voreinstellung „an“.

**Quellenwiderspruch, festgehalten statt entschieden:** K3 (R-0151) sagt „nie von selbst“, K6
(FR-CAP-05) sagt „Auto-OCR“, und `files.ts` verlangt „Nur auf explizite Nutzeraktion aufrufen.“ Der
neue Originalauftrag vom 12.10.2026 legt für Inhalte, die Klara bereitgestellt werden, die
Automatik fest, abschaltbar unter Setup › Klara. OCR-02 löst die Klickregel deshalb nur an diesen
Eingängen ab; der manuelle Erfassungsweg aus K3 bleibt. Ältere manuelle Capture-OCR und Vorbelege
aus C01 zählen **nicht** als Lieferung der Automatik.

## 4. Verknüpfung

Die neue Anforderung ergänzt `aufnahme:20260922:gesamt-ocr` und ersetzt ihn nicht. OCR-02 setzt auf
dem Hauptstand mit `64e1768c` auf (siehe [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md),
Schritt 0). Die sieben Originalkriterien, das Urteil und die Prüfbelege von C01 bleiben bei C01.
