# Bildschirmabläufe in prüfbare Schrittanleitungen übernehmen

Auftrag: `produkt:wettbewerb:20261003:bildschirmablaeufe` (Revision 1).

## Kurzer Bedienweg

1. **Meine Entwürfe → „Bildschirmablauf übernehmen“** (Adresse `/erfassen/ablauf`).
2. **Ablaufdatei wählen** (`.json`, Format siehe unten). Klarwerk liest die Datei im Browser, prüft
   sie vollständig und legt daraus einen **privaten Entwurf** an. Die Adresse wird zu
   `/erfassen/ablauf?entwurf=<id>` – ein Neuladen öffnet denselben Stand.
3. **Ansehen und korrigieren:** Handlungstext je Schritt ändern, Schritte nach oben/unten
   verschieben oder entfernen, Bild je Schritt ersetzen oder entfernen.
4. **Schwärzen:** Im Bild einen Rahmen über die Angabe ziehen → „Bereich schwärzen“. Für Texte die
   Angabe eingeben → „In Texten schwärzen“ (alle Schritte, Titel, Kernaussage).
5. Titel, Kernaussage, Wissensart, Kategorie und Vertraulichkeit setzen → **„Entwurf speichern“**.
6. **„Zur Prüfung einreichen“** – der vorhandene Einreichweg. Das Wissensobjekt steht danach auf
   „offen“ und durchläuft die Prüfung nach der Regel des Kontos (direkte Annahme durch die berechtigte
   Person, vorgeschriebene Prüfung oder freiwillige Zweitprüfung). Die Entscheidung steht wie bei
   jedem Wissensobjekt in Bewertungen, Kommentaren und Historie.

Ein Entwurf mit Ablauf öffnet aus „Meine Entwürfe“ wieder in dieser Schrittbearbeitung.

## Technische Wahl und Begründung

Der Auftrag verlangt zuerst die Prüfung, ob ein vorhandener, lokal nutzbarer Erfassungsweg oder der
Import eines strukturierten Exports den Nutzerfall erfüllt.

| Weg | Ergebnis der Prüfung |
| --- | --- |
| **Chrome-DevTools-Recorder** (in Chrome/Edge eingebaut, lokal, kostenlos) | Aufzeichnung wird bewusst gestartet und gestoppt; Export als JSON mit geordneten Schritten (Öffnen, Klicken, Eingeben, Taste). **Keine Bildschirmfotos** im Export. → unterstützt; Bilder je Schritt bewusst hinzufügen. |
| **Offenes Format `klarwerk-ablauf/1`** (dieses Dokument) | Schritte mit Handlungstext und Bild, Werkzeug, Zeitpunkt, Anwendung. Jedes Erfassungswerkzeug oder Skript kann es schreiben. → unterstützt, vollständiger Weg mit Bildern. |
| Windows-Schrittaufzeichnung (`psr.exe`) | Von Microsoft abgekündigt; Ausgabe als MHT-Archiv. → nicht unterstützt. |
| Tango, iorad u. ä. | Cloud-Dienste mit Konto beim Anbieter; Nichtziel „keine Verpflichtung zum Kauf eines Fremdprodukts“ und eigener externer Datenfluss. → nicht angebunden. Ein Export solcher Werkzeuge kann über `klarwerk-ablauf/1` übernommen werden, wenn er dorthin übertragen wird. |

**Entscheidung:** Import eines strukturierten Exports. Klarwerk enthält **keinen eigenen Rekorder**:
der vereinbarte Weg (bewusst aufzeichnen → bearbeitbare Schrittanleitung) ist mit den beiden
Eingabeformaten abbildbar. Folglich gibt es in Klarwerk keine Aufnahme, keinen Aufnahmebereich und
keine Hintergrundbeobachtung; Klarwerk liest ausschließlich eine Datei, die der Mensch bewusst wählt.
Die Fläche zeigt bei jedem Ablauf ausdrücklich „Außerhalb Klarwerks aufgezeichnet mit …“.

## Eingabeformat `klarwerk-ablauf/1`

```json
{
  "format": "klarwerk-ablauf/1",
  "titel": "Angebot anlegen, prüfen und speichern",
  "werkzeug": "Name des Aufzeichnungswerkzeugs (Pflicht)",
  "aufgezeichnetAm": "2026-10-05T09:12:00Z",
  "anwendung": "Testanwendung Angebote",
  "schritte": [
    { "text": "Menü „Angebote“ öffnen", "bild": "data:image/png;base64,…" },
    { "text": "„Neues Angebot“ wählen" }
  ]
}
```

- `format` (Pflicht) muss genau `klarwerk-ablauf/1` lauten.
- `werkzeug` (Pflicht): ohne benannte Herkunft wird nichts übernommen.
- `schritte` (Pflicht): 1–100 Einträge in der Reihenfolge der Ausführung. Jeder Schritt braucht
  `text` (höchstens 2000 Zeichen). `bild` ist optional: PNG, JPEG oder WebP als `data:`-URL
  (höchstens 1,5 Mio. Zeichen je Bild, 2 Mio. Zeichen alle Bilder zusammen). SVG und Adressen auf
  fremde Server werden abgelehnt.
- `titel`, `aufgezeichnetAm`, `anwendung` sind optional (je höchstens 200 Zeichen).
- Datei höchstens 4 MB.

Beispiel mit neutralen Daten: `docs/aufnahme/beispiele/angebot-anlegen.klarwerk-ablauf.json`
(Platzhalterbilder; echte Bildschirmfotos ersetzen sie).

## Eingabeformat Chrome-DevTools-Recorder

JSON-Export aus Chrome/Edge (DevTools → Recorder → „Export“ → JSON). Erkannt an `title` und `steps`.
Übernommen werden `navigate`, `click`, `doubleClick`, `change`, `keyDown`; übergangen werden die
technischen Typen `setViewport`, `keyUp`, `waitForElement`, `waitForExpression`, `scroll`, `hover`,
`close`. Ein **anderer** Typ bricht den Import mit einer Meldung ab – es entsteht keine lückenhafte
Anleitung. Ebenso bricht ein bekannter Schritt ohne seine Pflichtangabe ab (`navigate` ohne `url`,
`click`/`doubleClick`/`change` ohne Ziel in `selectors`, `change` ohne `value`, `keyDown` ohne `key`);
die Meldung nennt die Schrittnummer in der Datei. Ein Handlungstext über 2000 Zeichen wird
abgewiesen, nicht gekürzt. Die Handlungstexte werden in der Oberflächensprache formuliert („Klicke auf …“), das Ziel
aus dem Zugänglichkeitsnamen (`aria/…`) bzw. Text des Selektors. Der Export enthält keine Bilder.

## Datenflüsse

1. **Datei → Browser:** Die Datei wird nur im Browser gelesen und geprüft. Kein Upload, solange sie
   nicht vollständig gültig ist.
2. **Browser → Klarwerk-Server dieser Instanz:** Beim Übernehmen entsteht ein privater Entwurf
   (`POST /api/drafts`), beim Speichern wird er fortgeschrieben (`PUT /api/drafts/:id`), beim
   Einreichen wird er zum Wissensobjekt (`POST /api/drafts/:id/promote`). Datenzugriff, Rechte und
   Unternehmensinstanz sind die der Bestandswege.
3. **Kein KI-Dienst:** Import, Bearbeitung, Schwärzen und Rumpferzeugung rufen kein Modell auf. Nach
   dem Einreichen gilt für das neue Wissensobjekt die vorhandene, im Admin-Bereich konfigurierte
   KI-Prüfung des Bestands unverändert (im internen Betrieb das interne Modell oder keines); diese
   Funktion fügt keinen externen Aufruf hinzu.
4. **Keine Anbindung an Microsoft 365 oder andere Kundensysteme.** Ein Export aus einem solchen
   System gelangt nur als vom Menschen gewählte Datei hierher.

## Was am Entwurf und am Wissensobjekt steht

- Entwurf: `payload.ablauf` = Herkunft (`art: "import"`, Format, Werkzeug, Datei, Zeitpunkt,
  Anwendung, Übernahmeschlüssel) und die geordneten Schritte (Text, Bild). Der Server prüft die
  Gestalt am Rand und weist Unvollständiges mit 400 ab (`services/capture/src/ablauf.ts`).
- Wissensobjekt: der daraus erzeugte Rumpf – Herkunftssatz, Hinweis „Beobachteter Ablauf: die
  fachliche Richtigkeit bestätigt die Prüfung, nicht die Aufzeichnung“, je Schritt Überschrift,
  Handlungstext und Bild. Fassungen und Historie sind die des Wissensobjekts.

## Schwärzen

Im Bild werden die **Pixel** des gewählten Bereichs schwarz überschrieben und das Bild als neues PNG
kodiert (`apps/web/src/lib/ablaufSchwaerzen.ts`). Das alte Bild wird ersetzt; es bleibt weder im
Entwurf noch im Rumpf eine Kopie, auch keine eingebetteten Metadaten oder Vorschaubilder des
Originals. In Texten wird jede Fundstelle durch `█████` ersetzt (feste Länge) – in allen
Handlungstexten, in Titel, Kernaussage und Kategorie **und in den übernommenen Herkunftsangaben**
(Werkzeug, Dateiname, Aufzeichnungszeit, Anwendung), denn diese fließen über den Herkunftssatz in das
Wissensobjekt. Die Kennzeichnung „außerhalb Klarwerks aufgezeichnet“ und das Format bleiben stehen
(etwa „aufgezeichnet mit █████“).

## Wiederholung und neue Fassung

- Aus Dateiinhalt und Konto entsteht ein Übernahmeschlüssel. Er geht als Vorgangsschlüssel an die
  wiederholsicheren Bestandswege: dieselbe Datei erneut übernommen öffnet **denselben Entwurf**;
  nach dem Einreichen lehnt der Server ein zweites Wissensobjekt aus derselben Aufzeichnung ab
  (409 `IDEMPOTENCY_PAYLOAD_MISMATCH`), und die Fläche sagt das.
- Eine **bewusste neue Fassung** legt der Mensch am bestehenden Wissensobjekt an (Feld „Kennung oder
  Adresse des Wissensobjekts“ → „Neue Fassung anlegen“, Aktion `revise` mit Standvergleich). Die
  Fassung steht danach wieder auf „offen“ und wird geprüft. Ist das Objekt bereits freigegeben und
  das Konto darf es nicht direkt überarbeiten, antwortet der Server mit seiner Bestandsregel
  (Vorschlag statt Überarbeitung); diese Fläche reicht dann keinen Vorschlag ein, sondern nennt den
  Grund.

## Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Kein JSON, unbekanntes Format, fehlendes Werkzeug, Schritt ohne Text, zu langer Text, ungültiges/zu großes Bild, zu viele Schritte, unbekannter oder unvollständiger Recorder-Schritt | Verständliche Meldung mit Schrittnummer; **nichts** wird angelegt; ein bereits geöffneter Ablauf bleibt unverändert. |
| Speichern scheitert (Netz, veralteter Stand 409) | Meldung mit Grund; die Bearbeitung bleibt auf der Seite stehen. |
| Seitenwechsel/Neuladen mit ungespeicherten Änderungen | Vorhandene Rückfrage (Bleiben · Verwerfen · Speichern) bzw. Browserwarnung. |
| Einreichen ohne Pflichtfelder | Meldung, welche Felder fehlen; nichts wird eingereicht. |
| Dieselbe Aufzeichnung erneut einreichen | Kein zweites Objekt; Hinweis und Weg zur neuen Fassung. |

## Offene Grenzen

- Kein eigener Rekorder in Klarwerk (bewusste Wahl, siehe oben). Für Bilder braucht es ein
  Werkzeug, das `klarwerk-ablauf/1` schreibt, oder Bildschirmfotos, die je Schritt hinzugefügt
  werden. Ein Konverter für weitere Fremdformate ist nicht Teil dieser Lieferung.
- Der Übernahmeschlüssel hängt am Dateiinhalt: eine inhaltlich veränderte Datei ist eine neue
  Übernahme. Die neue Fassung wird deshalb bewusst über die Kennung des Objekts angelegt.
- Die Kennung des bereits entstandenen Objekts nennt der Server bei der Ablehnung nicht; der Mensch
  findet es über die Bibliothek bzw. seine Aufgaben.
- Schwärzen im Bild ist mausbasiert (Rahmen ziehen); ohne Zeigegerät bleibt „Bild entfernen“ oder
  „Bild ersetzen“.
- Herkunft des Wissensobjekts steht im Rumpf (Herkunftssatz), nicht als eigenes Herkunftsfeld des
  Objekts; die strukturierte Herkunft bleibt am Entwurf, der beim Einreichen verbraucht wird.
- Echte menschliche Bedienung mit einer realen Büroanwendung und einem realen Aufzeichnungswerkzeug
  ist nicht Teil der automatischen Prüfungen; diese laufen mit getrennten Beispieldaten.
