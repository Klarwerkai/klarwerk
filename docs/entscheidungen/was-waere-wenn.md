# Geltung vorhandenen Wissens bei geänderten Bedingungen — Bestand und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-was-waere-wenn` (Revision 1). Basisstand `fadddf37`
(`1.0.0-beta.1.770`). Das Verhalten prüfen die Tests unter `tests/was-waere-wenn/`; dieses Dokument
selbst liest kein Test. „Belegt durch“ nennt Verhaltenstests — ob sie auf diesem Stand grün sind,
sagt erst ihr Lauf.*

Originalpunkt R-1628 („Was-wäre-wenn-Fragen“, Altquelle `KLARWERK-Funktions-Roadmap.md:51`):
„Der Nutzer kann mit der KI durchspielen: ‚Wenn ich statt 5083-H111 jetzt 6082-T6 verwende —
welche bestehenden Erfahrungswerte gelten dann noch, welche nicht?‘ KLARWERK markiert, welche
Wissensobjekte materialspezifisch sind und welche übertragbar sind.“

Die Auftragsquelle führt den Punkt mit Registerzustand `angedacht`, Prüfstatus `geprueft`, Beleg nur
als Altquelle („Historische Aussage, heutige Erfüllung nicht erneut geprüft“), keiner
Nutzerentscheidung (`entscheidung: null`) und zwei **gegenläufigen** Empfehlungen (siehe unten). Der
Punkt steht im Auftrag mit `state: arbeitsauftrag`; der Auftrag schließt Ideen und späteren Ausbau
ein.

## Abgleich mit dem Bestand vor diesem Auftrag

- **Vorhanden:** `KnowledgeObject.conditions` (Bedingungen je Wissensobjekt, beim Erfassen
  gesetzt), Titel, Aussage, Schlagwörter; die Geltung nach Ort (`aufnahme:20260922:gesamt-
  standortwissen`, `docs/entscheidungen/standortwissen.md`: Konzern/Werk/Schicht/Rolle).
- **Nicht vorhanden:** jede Gegenüberstellung „statt Bedingung A jetzt Bedingung B“ und jede
  Markierung, welches Wissen an eine Bedingung gebunden ist. Gesucht im Bestand nach
  „was wäre wenn“, „materialspezifisch“, „übertragbar“, „5083“ — kein Treffer mit diesem Sinn.

## Zuordnung zum Originalpunkt

| Teil von R-1628 | Geliefert | Belegt durch |
| --- | --- | --- |
| „Wenn ich statt 5083-H111 jetzt 6082-T6 verwende“ | Fragen-Seite, zugeklappt unter „Ich frage für“: **„Was wäre, wenn sich eine Bedingung ändert?“** mit „Statt (bisher)“, „jetzt (neu)“ und optional „Nur zum Thema“. Vorschläge aus den Bedingungen, die der Bestand schon führt. | `bedingungswechsel-flaeche.test.tsx` (B1–B3), `bedingungswechsel-regel.test.ts` (W6) |
| „welche bestehenden Erfahrungswerte gelten dann noch, welche nicht?“ | Je sichtbares Wissensobjekt eine von vier Lagen nach der Regel `apps/web/src/lib/bedingungswechsel.ts`: **an die bisherige gebunden — für die neue nicht belegt**; **für beide festgehalten**; **schon für die neue festgehalten**; **nennt keine von beiden** (ohne Thema nur gezählt, mit Thema einzeln). Jeder Eintrag verweist auf das Objekt und zeigt die Fundstelle (Bedingung, Titel, Aussage oder Schlagwort samt Wortlaut). | `bedingungswechsel-regel.test.ts` (W1–W5), `bedingungswechsel-flaeche.test.tsx` (B2–B3) |
| „KLARWERK markiert, welche Wissensobjekte materialspezifisch sind und welche übertragbar sind“ | „Materialspezifisch“ = nennt nur die bisherige Bedingung. „Übertragbar“ wird **nur** markiert, wo das Objekt beide Bedingungen selbst nennt. Ein Objekt ohne Nennung heißt ausdrücklich „ob es unter … gilt, hält der Bestand nicht fest“ — nicht „übertragbar“. | `bedingungswechsel-regel.test.ts` (W1–W2) |
| „mit der KI durchspielen“ | **Bewusst ohne KI** (siehe Quellenwiderspruch). Es geht keine Anfrage hinaus; die Gegenüberstellung rechnet über den bereits geladenen, serverseitig nach Sichtbarkeit gefilterten Bestand (`GET /api/kos`) und steht deshalb auch bei gesperrter KI-Antwort zur Verfügung. | `bedingungswechsel-flaeche.test.tsx` (B2, B3: kein Aufruf von `ask`) |

## Quellenwidersprüche und Entscheidung im Bau

- **ES-092 (Steuerung, 2026-09-05): „verwerfen“** — „spekulative KI-Antworten widersprechen dem
  Kernversprechen ‚belegte Antwort mit Quelle‘“. **EC-20260905-R-1628 (Codex, 2026-09-05):
  „später“** — „belegte Was-wäre-wenn-Szenarien mit sichtbaren Annahmen sind nicht automatisch
  erfundene Tatsachen“. Eine Nutzerentscheidung gibt es nicht. Der Originalwortlaut verlangt „mit der
  KI“. Gebaut ist der Teil, dem beide Empfehlungen nicht widersprechen: die Annahme ist der sichtbar
  eingegebene Wechsel, der Beleg die Fundstelle im Objekt; keine vom Modell erzeugte Aussage. Ein
  KI-gestütztes „Durchspielen“ ist **nicht** geliefert und bliebe eine eigene Entscheidung von Pedi.
- Der Registerhinweis „vorhandene Grundfunktionen belegen diese Erweiterung nicht“ bleibt richtig:
  belegt ist die Erweiterung erst durch die Tests oben, nicht durch die Bedingungsfelder allein.

## Abgrenzung

- **Standortwissen** (`aufnahme:20260922:gesamt-standortwissen`, im Basisstand `fadddf37`
  enthalten; Basisstand jenes Auftrags laut `docs/entscheidungen/standortwissen.md`:
  `1.0.0-beta.1.765`): *wo* ein Punkt gilt (Werk/Schicht/Rolle) und die Gewichtung beim Fragen. Unverändert; dieser Auftrag vergleicht Bedingungen im Inhalt, nicht den Ort.
- **Konfliktklassifikation / R-0263 Geltungsbereich** (`docs/entscheidungen/konfliktklassifikation.md`):
  Vorrang zwischen genau zwei widersprechenden Punkten nach menschlicher Entscheidung. Unberührt.
- Sichtbarkeit, Freigabe, Vertraulichkeit und gespeicherte Daten ändern sich nicht; es gibt keinen
  neuen Server-Endpunkt und keinen neuen Protokollvorgang.

## Grenzen und fehlende Belege

- Die Zuordnung ist eine **Textstelle**, keine fachliche Bewertung: steht „nicht für 5083-H111“ im
  Objekt, erscheint es als gebunden; die Fundstelle zeigt das. Schreibweisen werden nicht gleichgesetzt
  („5083 H111“ ≠ „5083-H111“), Gross-/Kleinschreibung und Leerraum schon; ein Wort muss als eigenes
  Wort stehen („5083“ trifft nicht „50830“).
- Durchsucht werden Bedingungen, Titel, Aussage und Schlagwörter — **nicht** der formatierte
  Fließtext (`bodyHtml`), Anhänge oder Quellen. Werkstoff ist kein eigenes strukturiertes Feld.
- Die Fläche gibt es nur auf der Desktop-Fragen-Seite, nicht im Mobil-, Word- oder Add-on-Weg; die
  Eingaben werden nicht gespeichert.
- Keine echte menschliche Bedienung und kein Produktivlauf sind Teil dieses Belegs; der Lieferbeleg
  mit Fassung entsteht erst mit der Veröffentlichung.
