# OCR-03 · Erkenntnisse in Klara nutzen und Automatik im Setup steuern

Auftrag `produkt:20261012:klara-bildanalyse-ocr-kontext-setup`, Revision 1, Paket OCR-03. Baut auf
OCR-01 ([`BESTAND.md`](./BESTAND.md), [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md) §2) und OCR-02
([`OCR-02-AUTOMATIK.md`](./OCR-02-AUTOMATIK.md)) auf. Keine zweite Erkennung, kein neuer Host, kein
neuer Datenweg, keine neue Route.

## Was geliefert ist

| Teil | Wo | Weg |
| --- | --- | --- |
| Kontext für Klara: Text der Quelle plus Bildbefunde mit Fundstelle (Quelle · Folie/Bild), Status je Bild, Hinweise | `apps/web/src/lib/klaraBildKontext.ts` | DOM-frei; liest nur |
| „Klara zu diesem Inhalt fragen“: Frage und Zusammenfassung | `apps/web/src/components/KlaraBildKontextFrage.tsx` unter jedem Befund (Editor `BildBefundeImRumpf`, Dateiimport im Erfassen, Office im Artikel) | vorhandener assist-Weg (`/api/reasoner`, task `assist`) über `ImageDescribeContext` — dieselbe Provenienz und Vertraulichkeitsregel wie die Bildbeschreibung der Fläche |
| Fundstellen einer Frage | `belegstellen` in `klaraBildKontext.ts` | deterministisch, ohne Modell; nennt Bild bzw. Folie |
| Setup › Klara „Bilder automatisch analysieren und Text erkennen“ | `KlaraBildAutomatikGruppe` in `components/klara-setup/KlaraSetup.tsx`, eingebunden in `pages/Profile.tsx` | Feld `bildAutomatik` im vorhandenen Assistenzprofil (W17, `PUT /api/me/assistenz`, Fassungsprüfung) |
| Wirkung der Einstellung | `lib/bildAutomatikEinstellung.ts`; Editor, Dateiimport, Bildanhänge im Erfassen, Office im Artikel | Lage `an` / `aus` / `laedt` / `unbekannt` |
| Analyse je Konto | `useBildAnalyse` in `lib/bildAutomatikLauf.ts` | Kontowechsel → neue, leere Analyse |

### Regeln

- **Voreinstellung an.** Ohne gespeicherte Wahl gilt „an“; gespeichert wird nur eine bewusste Wahl.
- **Aus** heißt: keine neue automatische Auswertung. Vorhandene Ergebnisse derselben Fläche für
  dieselben Bildbytes bleiben nutzbar und sind als „unverändert — vorhandenes Ergebnis“ gekennzeichnet;
  alle übrigen Bilder stehen als „nicht gelesen · automatisches Lesen ist ausgeschaltet“ da. Eine
  gerade laufende Erkennung eines Bildes wird beendet, weitere Bilder werden nicht mehr gestartet
  (`abbrechen`). Die Erkennung per Klick bleibt.
- **Profil lädt:** die Flächen warten (der Dateiimport bis zu 15 s), sie starten nichts vorab.
  **Profil nicht lesbar:** nicht automatisch gelesen, mit sichtbarem Hinweis.
- **Status vor der Antwort:** Läuft das Lesen noch oder ist eine Quelle nur teilweise gelesen, steht
  das am Fragefeld und an der Antwort; die Anweisung an Klara verbietet, Vollständigkeit zu
  behaupten. Eine PowerPoint-Quelle ist nie vollständig (L16).
- **Nur die aktuelle Quelle:** in den Kontext kommen nur Befunde, deren Fundstelle (Quelle, Position,
  Anker) zum aktuellen Eingang gehört. Die Analyse gehört zum angemeldeten Konto.
- **Original unverändert:** Klaras Antwort ist eine Anzeige; sie schreibt nichts in Text, Datei,
  Anhang oder Bild. Die Textübernahme bleibt ein ausdrücklicher Schritt (wie in OCR-02).

## Grenzen (offen, konkret)

| Punkt | Stand |
| --- | --- |
| Formulierte Antwort und Zusammenfassung | brauchen ein für die Einstufung zulässiges Modell auf dem assist-Weg. Ohne Modell zeigt Klara bei einer Frage nur die deterministischen Fundstellen und sagt das; eine Zusammenfassung gibt es dann nicht. Die inhaltliche Qualität einer Modellantwort ist nicht automatisiert geprüft |
| Der assist-Weg | ist der vorhandene Bearbeitungsweg (System-Anweisung „keine neuen Fakten“); Frage und Fundstellenpflicht reisen als Anweisung. Ein eigener Frage-Task am Server wurde nicht gebaut |
| Wissensfragen über `/api/ask` (Bibliothek) | erkannter Bildtext wird NICHT am Wissensobjekt gespeichert und fließt dort nicht ein. Das wäre ein neuer Speicher- und Antwortweg (validierte Wissensobjekte) und ist nicht Teil dieser Lieferung |
| Klara-Figur, Klara in Word (L09, L10), PowerPoint-Add-in (H03), Mac (H05) | unverändert offen, wie im Integrationsplan |
| PDF-Bilder, Excel | unverändert nicht gelesen (OCR-02) |
| Echter Nutzerweg mit Kundendokumenten, echtes Modell | OCR-04 bzw. Pilot |

## Prüfstände

| Datei | Art | Kriterien |
| --- | --- | --- |
| `tests/klara-bildanalyse-ocr/kontext-klara.test.ts` | Unit, echte PPTX-Importkette, Engine gestellt | K1, K2, K4, K5, K6 |
| `tests/klara-bildanalyse-ocr/kontext-rumpf-mounted.test.tsx` | gemountete Editor-Automatik mit Klara-Frage, Profilstand echt, Draht ersetzt | K1–K6 |
| `tests/klara-bildanalyse-ocr/setup-schalter-mounted.test.tsx` | Setup-Schalter und Editor-Automatik gegen den echten Server | K4 |
| `tests/klara-bildanalyse-ocr/setup-automatik-am-server.test.ts` | echter Server, Speichern je Konto | K4, K6 |
| `tests/klara-bildanalyse-ocr/setup-automatik-pg.integration.test.ts` | echtes PostgreSQL, Neustart, andere Profilschreiber | K4 |
| `tests-smoke/klara-bild-kontext-browser.spec.ts` | Browser, echte Erkennung, fiktive PowerPoint: Frage mit Fundstelle, Zusammenfassung mit Bildern, unvollständiger Stand; speichert nichts | K1, K2, K3 |
| `tests-smoke/klara-bildautomatik-setup-browser.spec.ts` | Browser, echtes Konto (fiktiv), Setup-Schalter, Neuladen, Wirkung am Dateiimport; isolierter Kontext `chromium-zustand` | K4 |
| `tests-smoke/klara-bildautomatik-browser.spec.ts` (OCR-02, unverändert) | Browser, echte Erkennung: automatischer Start beim Dateiimport mit der neuen Einstellungsabfrage | K3 |

Im Smoke-Tor läuft kein Modell: dort belegen die Browserproben die Fundstellen, den Stand und die
berücksichtigten Bilder — nicht die Formulierung einer Modellantwort. Sie wird protokolliert, wenn
ein Modell da ist.
