# KI-Berechnung im Browser des Nutzers — Klärung des Nicht-Ziels

*Aufnahme 20260922 · gesamt-browser-inferenz (`aufnahme:20260922:gesamt-browser-inferenz`, Revision 1)
· R-0719 (Alias F-0719). Basis `81f9152d` (`1.0.0-beta.1.952`). Die festgehaltene Fassung dieser
Lieferung erzeugt der Starter nach dem Lauf; bis dahin ist sie hier ausdrücklich offen und wird nicht
behauptet.*

Diese Notiz ist eine **Klärung, keine Umsetzung**. Gebaut wird nichts: Die Quelle nennt die
KI-Berechnung im Browser ausdrücklich ein Nicht-Ziel, und eine Entscheidung, das zu ändern, liegt
nicht vor. **Entscheidung offen:** ob das Nicht-Ziel so stehen bleibt und wie weit es reicht, legt
Pedi fest (s. „Noch erforderliche Entscheidung").

## Der Originalpunkt

| Feld (Register-Schnappschuss `$.eintraege[718]`) | Wortlaut |
| --- | --- |
| Satz | „Die KI-Berechnung würde nicht auf dem Server, sondern direkt im Browser des Nutzers laufen. Das ist als Nicht-Ziel festgelegt." |
| Herkunft (2026-06-25) | „specs/stories/reasoner.md, Nicht-Ziele (v1): 'Client-seitige Inferenz'." |
| Notiz | „Stand in derselben Nicht-Ziel-Liste wie das Nachtrainieren eigener Modelle; hier als eigene Funktion geführt, damit sie nicht verlorengeht." |
| Zustand / Prüfstatus | `angedacht` / `nur_altquelle` |
| Altbestand F-0719 | Status `VERWORFEN`, Begründung „Begruendung nicht dokumentiert", `pedi_override: null` |

## Heutiger Stand (Quelleninspektion an der Basis, 2026-10-13)

| Frage | Befund | Stelle |
| --- | --- | --- |
| Steht das Nicht-Ziel noch? | Ja, unverändert, in derselben Zeile wie das Nachtrainieren: „Fine-Tuning eigener Modelle; Client-seitige Inferenz." | `specs/stories/reasoner.md`, Abschnitt „Nicht-Ziele (v1)" |
| Läuft eine Reasoner-Aufgabe im Browser? | Nein. Alle sechs Aufgaben (Strukturieren, Antworten, Interview, Auswahl, Zweitmeinung, Schreibhilfe) laufen im Server-Modul `services/reasoner`; das Frontend ruft sie über `/api/reasoner` und `/api/ask`. Die Anbieteradressen stehen nur serverseitig (`services/reasoner/src/model-client.ts`). | `specs/stories/reasoner.md` „Aufgabenvertrag im Code" |
| Bringt das Frontend eine Sprachmodell-Laufzeit mit? | Nein. `apps/web/package.json` enthält keine LLM-/ML-Laufzeit für den Browser (kein WebLLM, Transformers.js, ONNX Runtime Web, TensorFlow.js, wllama). | `apps/web/package.json` |
| Ist „lokaler LLM" Browser-Inferenz? | Nein. Der lokale LLM ist ein OpenAI-kompatibler Endpunkt, den der **Server** anspricht (`openAiCompatibleClient`, Präfix `local:`); er läuft auf eigener Hardware, nicht im Browser. | `services/reasoner/src/model-client.ts` |
| Rechnet überhaupt ein lernendes Modell im Browser? | **Ja, eine Stelle:** die Bild-Texterkennung. `tesseract.js` 5 lädt einen LSTM-Kern als WebAssembly (`tesseract-core-simd-lstm.wasm.js`) und erkennt Text direkt im Browser; „Das Bild selbst verlässt den Browser dabei nicht." Seit OCR-02 (12.10.2026) liest sie bereitgestellte Bilder automatisch mit, solange die Automatik eingeschaltet ist. Geliefert im gesonderten Auftrag `gesamt-ocr` (R-0151). | `apps/web/src/lib/files.ts` (`runImageOcr`, `ocrEngineOptionen`), `apps/web/src/lib/ocrEngineDateien.ts`, CSP `'wasm-unsafe-eval'` in `services/app/src/security-headers.ts` |
| Lokale Verschriftlichung von Aufnahmen (R-0181) | Läuft nicht im Browser: der Server reicht die Aufnahme an einen lokalen Sprach-zu-Text-Dienst (`KLARWERK_LOCAL_TRANSCRIBE_URL`). | `tests/media-lokal/r0181-lokale-transkription.test.ts` |

## Die offene Geltungs-/Umfangsfrage

Das Nicht-Ziel steht in der Spezifikation des **Reasoners**. Der Registersatz spricht allgemein von
„der KI-Berechnung". Ob damit nur die Reasoner-Aufgaben (Sprachmodell) gemeint sind oder jede
Berechnung mit einem gelernten Modell, ist nirgends festgelegt. Davon hängt ab, ob die Browser-OCR
mit dem Nicht-Ziel vereinbar ist.

| Alternative | Inhalt | Folge für den Bestand |
| --- | --- | --- |
| **A** — Nicht-Ziel gilt für den Reasoner | Sprachmodell-Aufgaben laufen nur serverseitig; Hilfsverfahren wie die Bild-Texterkennung im Browser sind nicht gemeint. | Keine Änderung. Entspricht dem heutigen Code und der Lage des Satzes in `reasoner.md`. |
| **B** — Nicht-Ziel gilt für jede Berechnung mit gelerntem Modell | Auch die OCR gehört auf den Server. | Widerspricht der gelieferten Browser-OCR (`gesamt-ocr`, R-0151; OCR-02 „sofort automatisch mitlesen") und ihrem Datenschutzvorteil (Bild bleibt im Browser). Wäre ein Umbau im Auftrag `gesamt-ocr`, nicht hier. |
| **C** — Nicht-Ziel für einen späteren Ausbau aufheben | Reasoner-Aufgaben dürften künftig auch im Browser laufen (z. B. über WebGPU). | Neue Anforderung jenseits der Quelle; berührt die Schlüssel- und Statusregeln (FR-RSN-05, FR-RSN-06), die Modellwahl per Einstellung (FR-RSN-02) und die offene Frage zu On-Premises-Modell und Hardware. Bräuchte eine ausdrückliche Bestellung. |

**Was eindeutig bestellt ist und umgesetzt wurde:** nur die Klärung selbst. Das Nicht-Ziel bleibt
wörtlich stehen; `reasoner.md` verweist jetzt auf diese Notiz, damit der Punkt nicht verlorengeht.
Ein Test hält fest, dass das Nicht-Ziel weiter gilt und das Frontend keine Sprachmodell-Laufzeit
mitbringt (`tests/browser-inferenz/nicht-ziel-stand.test.ts`). Der Test ersetzt keine Entscheidung
zwischen A, B und C: Er misst den heutigen Stand, der Alternative A entspricht.

## Noch erforderliche Entscheidung

Pedi legt fest:

1. Geltung des Nicht-Ziels: **A**, **B** oder **C** (s. oben).
2. Ob die fehlende Begründung des Altbestands (F-0719, „Begruendung nicht dokumentiert")
   nachgetragen werden soll, etwa analog zur Fine-Tuning-Notiz (`docs/operations/fine-tuning-decision.md`).

Bis dahin gilt das Nicht-Ziel unverändert, und die Browser-OCR bleibt so, wie sie im Auftrag
`gesamt-ocr` geliefert wurde.

## Abgrenzung

- **Nachtrainieren eigener Modelle** (gleiche Nicht-Ziel-Zeile): bereits gesondert entschieden in
  `docs/operations/fine-tuning-decision.md` („jetzt NICHT durchgeführt"). Nicht Teil dieses Auftrags.
- **Browser-OCR und lokale Verschriftlichung**: Auftrag `gesamt-ocr` (R-0151, R-0181) samt
  `docs/klara-bildanalyse-ocr/`. Hier nur als Befund für die Umfangsfrage benannt, nicht geändert
  und nicht neu geprüft.
- **Aufgabenvertrag und Modellwahl des Reasoners**: Auftrag `gesamt-reasoner-vertrag`
  (`specs/stories/reasoner.md`, „Aufgabenvertrag im Code").

## Quellenwidersprüche und fehlende Belege

1. **Zustand gegen Altstatus:** Der Registereintrag führt R-0719 als `angedacht`, der Altbestand
   F-0719 als `VERWORFEN`. Der Satz selbst („als Nicht-Ziel festgelegt") stützt `VERWORFEN`. Welcher
   Zustand gilt, ist Teil der offenen Entscheidung.
2. **Einordnung:** `bereich: Betrieb` gegen `kategorie: Schnittstellen/API` im Altbestand; die
   Herkunft ist die KI-Schicht (`reasoner.md`). Die Einordnung bleibt offen, wie der Hinweis
   „Altbestand: Einordnung offen" sagt.
3. **Pedi-Auswahl:** Der Hinweis nennt „eine alte Pedi-Auswahl", die erhalten bleibe. In der Quelle
   ist keine enthalten: `entscheidung: null`, `entscheidungen: []`, `pedi_override: null`. Es fehlt
   also ein Beleg für eine Pedi-Entscheidung zu diesem Punkt.
4. **Begründung fehlt:** Für das Verwerfen ist keine Begründung dokumentiert (F-0719).
5. **Pfad:** Die Herkunft nennt `dev_Klarwerk/specs/stories/reasoner.md`; im Produktbaum liegt die
   Datei unter `specs/stories/reasoner.md`, mit unverändertem Wortlaut des Nicht-Ziels.
6. **Allgemeiner Satz gegen Code:** „die KI-Berechnung" läuft heute nicht vollständig auf dem
   Server. Die Bild-Texterkennung rechnet im Browser (s. Alternative B). Das ist nur dann ein
   Widerspruch, wenn das Nicht-Ziel über den Reasoner hinaus gelten soll.

## Belege und Grenzen

- **Quelleninspektion** (diese Notiz): `specs/stories/reasoner.md`, `apps/web/package.json`,
  `apps/web/src/lib/files.ts`, `apps/web/src/lib/ocrEngineDateien.ts`,
  `services/reasoner/src/model-client.ts`, `services/app/src/security-headers.ts`.
- **Test für den heutigen Stand**: `tests/browser-inferenz/nicht-ziel-stand.test.ts` (B1–B4). Ob er
  grün ist, belegt erst der Prüflauf. Diese Notiz behauptet das nicht.
- **Nicht neu geprüft:** dass die Browser-OCR tatsächlich Text erkennt. Das belegen die Prüfungen
  des Auftrags `gesamt-ocr` (`tests-smoke/ocr-technische-probe-browser.spec.ts`).
- **Lieferbeleg mit Fassung:** entsteht erst mit Veröffentlichung und Deployment, nicht mit dieser
  Notiz.
