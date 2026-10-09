# Geltung vorhandenen Wissens bei geänderten Bedingungen — Bestand und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-was-waere-wenn` (Revision 1). Basisstand `fadddf37`
(`1.0.0-beta.1.770`); erster Kandidat `16211282`, danach Nacharbeit 1 (Kandidat `9682296a`),
Nacharbeit 2 (Kandidat `d7e4f5be`), Nacharbeit 3 (Kandidat `2f33dafb`) und Nacharbeit 4 nach
Bens Befunden. Das
Verhalten prüfen die Tests unter `tests/was-waere-wenn/`; dieses Dokument selbst liest kein Test.
„Belegt durch“ nennt Verhaltenstests — ob sie auf diesem Stand grün sind, sagt erst ihr Lauf.*

Originalpunkt R-1628 („Was-wäre-wenn-Fragen“, Altquelle `KLARWERK-Funktions-Roadmap.md:51`):
„Der Nutzer kann mit der KI durchspielen: ‚Wenn ich statt 5083-H111 jetzt 6082-T6 verwende —
welche bestehenden Erfahrungswerte gelten dann noch, welche nicht?‘ KLARWERK markiert, welche
Wissensobjekte materialspezifisch sind und welche übertragbar sind.“

Die Auftragsquelle führt den Punkt mit Registerzustand `angedacht`, Prüfstatus `geprueft`, Beleg nur
als Altquelle („Historische Aussage, heutige Erfüllung nicht erneut geprüft“), ohne
Nutzerentscheidung (`entscheidung: null`, `entscheidungen: []`) und mit zwei gegenläufigen
**Empfehlungen** (siehe unten). Der Punkt steht im Auftrag mit `state: arbeitsauftrag`; der Auftrag
schließt Ideen und späteren Ausbau ein. Gebaut ist deshalb der ganze Wortlaut, einschließlich des
Durchspielens mit der KI.

## Abgleich mit dem Bestand vor diesem Auftrag

- **Vorhanden:** `KnowledgeObject.conditions` (Bedingungen je Wissensobjekt), Titel, Aussage,
  Schlagwörter; der quellengebundene Frageweg `POST /api/ask` (Antwort nur aus dem sichtbaren
  Bestand; ein „Treffer“ ohne Quelle wird zur Leer-Antwort, die Lücke wird geschrieben —
  `services/ask/src/service.ts`, SCRUM-490 R2); die Geltung nach Ort (Standortwissen).
- **Nicht vorhanden:** jede Gegenüberstellung „statt Bedingung A jetzt Bedingung B“ und jede
  Markierung, welches Wissen an eine Bedingung gebunden oder für beide belegt ist. Gesucht im
  Bestand nach „was wäre wenn“, „materialspezifisch“, „übertragbar“, „5083“, „6082“ — kein Treffer
  mit diesem Sinn.

## Zuordnung zum Originalpunkt

| Teil von R-1628 | Geliefert | Belegt durch |
| --- | --- | --- |
| „Wenn ich statt 5083-H111 jetzt 6082-T6 verwende“ | Fragen-Seite, zugeklappt unter „Ich frage für“: **„Was wäre, wenn sich eine Bedingung ändert?“** mit „Statt (bisher)“, „jetzt (neu)“, optional „Nur zum Thema“; Vorschläge aus den Bedingungen des Bestands. | `bedingungswechsel-flaeche.test.tsx` (B1–B3), `bedingungswechsel-regel.test.ts` (W6) |
| „mit der KI durchspielen“ | Knopf **„Mit Klara durchspielen“**: stellt die Frage der Quelle mit den eingegebenen Bedingungen (und dem Thema) über **denselben** Submit wie Fragefeld und Beispielchips (`askExample` → `submitAsk`). Es gelten Quellenpflicht, Lückenweg, Fragekontext, Gesprächsfaden und KI-Sperre wie bei jeder Frage; bei gesperrter KI ist der Knopf aus und nennt den Grund. Die Einordnung darüber bleibt stehen. | `bedingungswechsel-flaeche.test.tsx` (B4, B5), `bedingungswechsel-regel.test.ts` (W11) |
| „welche bestehenden Erfahrungswerte gelten dann noch, welche nicht?“ | Je sichtbares Wissensobjekt eine Lage nach `apps/web/src/lib/bedingungswechsel.ts`: **an die bisherige gebunden**, **für die neue ausdrücklich ausgeschlossen**, **genannt, aber nicht eindeutig**, **für beide ausdrücklich festgehalten**, **schon für die neue festgehalten**, **nennt keine** (ohne Thema nur gezählt). Jeder Eintrag verweist auf das Objekt und zeigt die maßgebliche Fundstelle mit Bewertung („ausgeschlossen“, „nur erwähnt, nicht ausdrücklich“). | `bedingungswechsel-regel.test.ts` (W1–W5, W7–W10), `bedingungswechsel-flaeche.test.tsx` (B2–B3) |
| „markiert, welche … materialspezifisch sind und welche übertragbar sind“ | Geltung nur aus **positivem Beleg**: (a) reine Bedingungsangabe („Werkstoff 5083-H111“), (b) vollständig gedeutete Geltungsaussage mit Ergebnis („gilt/geeignet/bewährt für X und Y“, „X und Y sind geeignet“, „für X geeignet“, „erfolgreich getestet“ — eine bloße oder laufende Prüfung wie „werden getestet“ zählt nicht), (c) **erkannte** Anweisung, die die Bedingung einleitet („bei X die Kanten entgraten“ — Satzteil endet mit kleingeschriebenem Infinitiv, kein Zustands-/Existenzverb). „Für/bei X …“ allein ist kein Beleg; fehlendes Wissen („liegen keine Erfahrungswerte vor“, „unbekannt“, „fehlen“) ist ein Vorbehalt. „Materialspezifisch“ = die bisherige gilt, die neue ist nicht genannt. „Übertragbar belegt“ **nur** mit (a) oder (b) für beide gemeinsam. Ein Ausschluss („nicht für Y“, „außer bei Y“, „Y ist ungeeignet“, „für Y nicht“) führt zu „ausgeschlossen“. Alles ohne positiven Beleg oder mit Vorbehalt — auch bei nur einer genannten Bedingung (Unsicherheit, Abwertung, Gegensatz, „nur“, „statt“, nur Titel/Schlagwort, unbekannte Formulierung) — zu „nicht eindeutig“. | `bedingungswechsel-regel.test.ts` (W7–W10, W12–W15), `bedingungswechsel-flaeche.test.tsx` (B2) |

## Nacharbeit 1 (Ben, Kandidat `16211282`)

1. *„Bloße Begriffsnennungen werden als belegte Übertragbarkeit ausgegeben“* — „Gilt für 5083-H111,
   nicht für 6082-T6“ stand unter „übertragbar belegt“. Behoben: jede Fundstelle wird in ihrem
   Satzteil bewertet (`gilt` / `ausgeschlossen` / `vorbehalt`); `beide` verlangt einen gemeinsamen
   Beleg ohne Vorbehalt; zwei neue Lagen `neu_ausgeschlossen` und `ungeklaert`. Gegenfälle W7–W10,
   auf der Fläche B2.
2. *„Das ausdrücklich geforderte Durchspielen mit KI fehlt“* — Behoben: „Mit Klara durchspielen“
   über den bestehenden, quellengebundenen Frageweg. B4 belegt den Aufruf mit der Frage und die
   Antwortanzeige, B5 die Sperre. Die frühere Aussage, ein KI-Durchspielen sei „nicht geliefert“ und
   bleibe Pedis Entscheidung, ist damit überholt.

## Nacharbeit 2 (Ben, Kandidat `9682296a`)

1. *„Nicht erkannte Aussagen gelten standardmäßig als positiver Geltungsbeleg“* — „5083-H111 und
   6082-T6 sind untauglich“ stand unter „übertragbar belegt“. Die Behauptung aus Nacharbeit 1, eine
   unerkannte Formulierung falle „höchstens in eine vorsichtigere Lage“, war damit falsch. Behoben:
   `gilt` entsteht nur noch aus den positiven Formen (a)–(c); ohne sie ist eine Nennung `vorbehalt`.
   `beide` verlangt (a) oder (b) für beide gemeinsam — eine Anweisung (c) genügt nicht. Gegenfälle
   W12, auf der Fläche B2.
2. *„Die Einordnung ignoriert einen erkannten Vorbehalt, wenn nur eine Bedingung genannt ist“* —
   „Vielleicht für 6082-T6 geeignet“ stand unter „Schon für 6082-T6 festgehalten“. Behoben: die
   positiven Gruppen `nur_bisher`/`nur_neu` verlangen `gilt`; jeder Vorbehalt ist `ungeklaert`.
   Gegenfälle W13 (Unsicherheit, Abwertung, nur Titel, nur Schlagwort, kein positiver Beleg), auf
   der Fläche B2.

W8 bewertet „Bei 5083-H111 nicht überhitzen“ jetzt mit `gilt` statt `vorbehalt`: die Bedingung
ist eingeleitet (c), „nicht“ verneint die Handlung. Die Lage „an 5083-H111 gebunden“ bleibt.

## Nacharbeit 3 (Ben, Kandidat `d7e4f5be`)

*„Eine vorangestellte Präposition genügt weiterhin als positiver Geltungsbeleg“* — „Für 6082-T6
liegen keine Erfahrungswerte vor“ stand unter „Schon für 6082-T6 festgehalten“, weil „für X“ allein
als Form (c) zählte und jede Verneinung danach als verneinte Handlung galt. Behoben: (c) verlangt
eine **erkannte Anweisung** — der Satzteil nach der Bedingung endet mit einem kleingeschriebenen
Infinitiv, der kein Zustands-, Existenz- oder Hilfsverb ist („vorliegen“, „fehlen“, „gelten“,
„geben“ …); großgeschriebene Wörter auf -en sind Substantive. Nur dann bleibt eine Verneinung nach
der Bedingung Teil der Handlung („bei X nicht überhitzen“, „für X keine Druckluft verwenden“);
sonst ist sie ein Vorbehalt. „Für X geeignet“ ist jetzt eine vollständig gedeutete Geltungsaussage
(b). Wörter für fehlendes Wissen („unbekannt“, „fehlen“, „fehlt“, „ungeklärt“ und Entsprechungen in
EN/NL) zählen als Vorbehalt. Gegenfälle W14, auf der Fläche B2.

## Nacharbeit 4 (Ben, Kandidat `2f33dafb`)

*„Eine laufende Prüfung wird als belegte Übertragbarkeit gewertet“* — „5083-H111 und 6082-T6
werden getestet“ und „Getestet für 5083-H111 und 6082-T6“ standen unter „übertragbar belegt“, weil
„getestet/tested/getest“ als positive Prädikate zählten und „wird/werden“ als Kopula erlaubt war.
Behoben: die positiven Prädikate halten nur noch ein Ergebnis fest (geeignet, bewährt, freigegeben,
zugelassen, anwendbar, empfohlen und Entsprechungen); Prüfwörter („getestet“, „erprobt“, „tested“,
„getest“, „beproefd“) zählen nur mit ausdrücklichem Erfolg („erfolgreich getestet“, „successfully
tested“, „met succes getest“). Das laufende Passiv „wird/werden“ ist keine Kopula mehr, die
abgeschlossene Form „wurde/wurden/was/were“ schon. Gegenfälle W15 (auch einseitig), auf der Fläche
B2.

## Empfehlungen (keine Entscheidungen)

- **ES-092 (Steuerung, 2026-09-05): „verwerfen“** — spekulative KI-Antworten widersprächen dem
  Kernversprechen „belegte Antwort mit Quelle“. **EC-20260905-R-1628 (Codex, 2026-09-05):
  „später“** — belegte Szenarien mit sichtbaren Annahmen seien nicht automatisch erfundene
  Tatsachen. Beides sind Empfehlungen, keine Nutzersperre. Die Umsetzung trägt dem Anliegen beider
  Rechnung, ohne den Umfang zu kürzen: das Durchspielen läuft über den Frageweg mit Quellenpflicht
  (keine Antwort ohne tragende Quelle), und die Annahme — der Wechsel — steht wörtlich in der
  gestellten Frage.

## Abgrenzung

- **Standortwissen** (`aufnahme:20260922:gesamt-standortwissen`, im Basisstand `fadddf37`
  enthalten; Basisstand jenes Auftrags laut `docs/entscheidungen/standortwissen.md`:
  `1.0.0-beta.1.765`): *wo* ein Punkt gilt (Werk/Schicht/Rolle) und die Gewichtung beim Fragen.
  Unverändert; dieser Auftrag vergleicht Bedingungen im Inhalt, nicht den Ort.
- **Konfliktklassifikation / R-0263 Geltungsbereich** (`docs/entscheidungen/konfliktklassifikation.md`):
  Vorrang zwischen genau zwei widersprechenden Punkten nach menschlicher Entscheidung. Unberührt.
- Der Fragedienst (`services/ask`) ist unverändert; es gibt keinen neuen Server-Endpunkt, keinen
  neuen Protokollvorgang und keine neue Sichtbarkeits- oder Freigaberegel.

## Grenzen und fehlende Belege

- Die Bewertung arbeitet mit Wortlisten und Satzformen in Deutsch, Englisch und Niederländisch.
  Ein unbekanntes Wort macht eine Nennung nie zu „gilt“ und nie zu „übertragbar belegt“: beides
  entsteht nur aus den positiven Formen (a)–(c), und „für/bei X …“ ohne erkannte Anweisung ist
  keine davon. Verbleibende Grenze: eine erkannte Anweisung (c), die inhaltlich von X abrät, ohne
  ein Listenwort zu benutzen („bei X lieber auf das Schweißen verzichten“), erscheint als an X
  gebunden bzw. schon für X festgehalten — nie als „übertragbar belegt“. Die Fundstelle steht
  deshalb immer dabei.
- Die Anweisungserkennung beruht auf der deutschen/niederländischen Infinitivstellung am
  Satzteilende. Englische Imperative („For X, deburr the edges“) werden nicht als Anweisung
  erkannt und erscheinen als „nicht eindeutig“.
- Die Satzformen sind bewusst eng: übertragbare Aussagen in anderer Formulierung („bei X und Y die
  Kanten entgraten“) erscheinen als „nicht eindeutig“, nicht als „übertragbar belegt“.
- Schreibweisen werden nicht gleichgesetzt („5083 H111“ ≠ „5083-H111“); Groß-/Kleinschreibung und
  Leerraum schon; ein Begriff muss als eigenes Wort stehen („5083“ trifft nicht „50830“).
- Durchsucht werden Bedingungen, Titel, Aussage und Schlagwörter — nicht der formatierte Fließtext
  (`bodyHtml`), Anhänge oder Quellen. Werkstoff ist kein eigenes strukturiertes Feld.
- Die KI-Antwort selbst wird nicht nach Lagen gegliedert; sie ist eine gewöhnliche belegte Antwort
  auf die Szenariofrage. Wie gut ein echtes Modell die Frage beantwortet, belegt kein Test (die
  Tests setzen die Antwort ein).
- Nur Desktop-Fragen-Seite; nicht Mobil-, Word- oder Add-on-Weg; Eingaben werden nicht gespeichert.
- Keine echte menschliche Bedienung und kein Produktivlauf sind Teil dieses Belegs; der Lieferbeleg
  mit Fassung entsteht erst mit der Veröffentlichung.
