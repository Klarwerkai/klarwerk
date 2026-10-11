# Word-Host-Gesamtweg · Realabnahme und Beleg

Vorgang `aufnahme:20260922:word-echter-arbeitsweg` (mit dem übernommenen Hostteil von
`aufnahme:20260922:m365-anmeldung`, Entscheidung `entscheidung:ca86022d`, Option C).

Diese Seite beschreibt, wie ein **Mensch im echten Word-Host** abnimmt und wie der Beleg dazu
aussieht. Bau- und Prüfabnahme haben keinen Microsoft-Zugang; sie ersetzen diese Bedienung nicht,
und aus automatischen Belegen wird keine erfolgreiche reale Anmeldung oder Abnahme abgeleitet.

## 1 · Ergänzung 4 — Anleitung in Word ändern und als neue Fassung zurückgeben

**Geltung (Entscheidung `entscheidung:756b7d22`, Pedi 29.09.2026) — ausschließlich:**

- Word Web unter **Chrome**,
- ein Dokument aus SharePoint/OneDrive des Testmandanten **`klarwerktest4711`**
  (`https://klarwerktest4711-my.sharepoint.com/…` oder `https://klarwerktest4711.sharepoint.com/…`),
- ein Klarwerk-Konto der Rolle **`admin`**, also Direktfreigabe der neuen Fassung.

**Nicht erfüllt durch diese Abnahme:** Word für Mac und der Vorschlagsweg ohne Admin-Recht.

### Startbedingung

Die Fassung ist ausgeliefert, `KLARWERK_M365_MANDANTEN=klarwerktest4711` ist aktiv, und die
Herkunft ist belegt — genau wie in `docs/operations/word-web-hostabnahme.md` („Live-Folgeschritt“)
beschrieben. Meldet `/health` `"commit": "unbekannt"` oder einen anderen Commit als den
Liefercommit, ist die Herkunft offen und es gibt **keine** belegte Abnahme dieser Fassung.

### Ablauf (der Fall „20 Schritte auf 10 verkürzen“)

0. **Vor dem Lauf** den Solltext der verkürzten Anleitung als `soll-anleitung.txt` schreiben —
   eine Zeile je Schritt, so wie er nach der Rückgabe in KLARWERK stehen soll. Diese Datei ist der
   unabhängige Sollinhalt; sie entsteht nicht aus dem Panel und nicht aus KLARWERK.
1. Frisches Chrome-Profil, Chrome-Version notieren (`chrome://version`).
2. In Klarwerk als `admin` anmelden. Eine bestehende Anleitung wählen; Objektkennung, Fassung und
   Status notieren (`GET /api/kos/<id>` im selben Profil: `id`, `version`, `status`).
3. Die Anleitung als DOCX in OneDrive/SharePoint des Testmandanten öffnen (Word Web), Klara im
   Seitenbereich öffnen und anmelden.
4. Den Text in Word überarbeiten (20 Schritte auf 10) und den geänderten Teil markieren.
5. Im Klara-Panel unter „Erfassen“ die Anleitung als Ziel wählen. Die Zeile zeigt
   „<Titel> · Version <n>“ — `n` ist die **Ausgangsfassung**. Vorschau lesen.
6. „Aktualisieren und freigeben“ klicken. Erwartet: „Aktualisiert und freigegeben: Version <m>.“
   — `m` ist die **neue Fassung**. Bildschirmfoto.
7. In Klarwerk `GET /api/kos/<id>` erneut lesen: dieselbe `id`, `version` = `m`,
   `status` = `validiert`. `GET /api/kos/<id>/versions` enthält weiter die Ausgangsfassung.
8. In der Bibliothek nach dem Titel suchen: es ist **kein** zweites Objekt dazugekommen.
9. Word-Dokument speichern, schließen und wieder öffnen; die Anleitung in Klarwerk neu öffnen,
   `GET /api/kos/<id>` als `ko-nach-wiederoeffnen.json` speichern und vergleichen:

   ```
   node tools/word-host-wiederoeffnen.ts vergleiche-anleitung soll-anleitung.txt ko-nach-wiederoeffnen.json <id> <m>
   ```

   Erwartet: „✓ gleich dem Soll“ — dieselbe `id`, Fassung `m`, Status `validiert`, jede Zeile des
   Solltexts in Reihenfolge. Jeder Befund ist ein Verlust und wird so festgehalten. Ausgabe und
   Bildschirmfotos gehören zum Beleg; `neueFassungWiederGeoeffnet` ist nur bei „gleich“ `true`.

Gibt Word Bilder nicht mit oder kürzt das Panel die Ladung, nennt der Erfolgssatz das; das gehört
mit ins Bildschirmfoto. Steht statt des Erfolgs „Der Eintrag steht inzwischen auf Version …“, hat
jemand anderes geschrieben: nichts wurde überschrieben, der Lauf beginnt mit „Stand neu laden“.

### Der Beleg

Eine JSON-Datei neben den Aufnahmen. **Keine** Passwörter, Cookies, Token, Sitzungskennungen oder
Freigabelinks mit Schlüssel (`?e=…`, `tempauth`, `access_token` …) — der Prüfer weist sie ab.

```json
{
  "host": { "anwendung": "Word Web", "browser": "Chrome", "browserVersion": "141.0.7390.66" },
  "testzeit": "2026-10-06T10:15:00+02:00",
  "dokumentUrl": "https://klarwerktest4711-my.sharepoint.com/personal/…/Doc.aspx?sourcedoc=…",
  "bereitstellung": {
    "healthVersion": "1.0.0-beta.1.6xx",
    "healthCommit": "<aus /health>",
    "liefercommit": "<vollständiger Liefercommit, 40 Zeichen>"
  },
  "konto": { "rolle": "admin" },
  "rueckgabe": {
    "objektId": "<id>",
    "ausgangsfassung": 3,
    "neueFassung": 4,
    "objektIdNachRueckgabe": "<id>",
    "statusNachRueckgabe": "validiert",
    "bisherigeFassungAbrufbar": true,
    "neueFassungWiederGeoeffnet": true,
    "neueObjekteDurchRueckgabe": 0
  },
  "nachweise": ["01-ziel-version-3.png", "02-freigegeben-version-4.png", "03-wiedergeoeffnet.png"]
}
```

Pflichtfelder: `host.anwendung`, `host.browser`, `host.browserVersion`, `testzeit`,
`dokumentUrl`, `bereitstellung.healthVersion`, `bereitstellung.healthCommit`,
`bereitstellung.liefercommit`, `konto.rolle`, `rueckgabe.objektId`, `rueckgabe.ausgangsfassung`,
`rueckgabe.neueFassung`, `rueckgabe.objektIdNachRueckgabe`, `rueckgabe.statusNachRueckgabe`,
`rueckgabe.bisherigeFassungAbrufbar`, `rueckgabe.neueFassungWiederGeoeffnet`,
`rueckgabe.neueObjekteDurchRueckgabe`, `nachweise`.

Prüfen: `node tools/word-host-beleg.ts beleg.json`. Er sagt, ob der Beleg vollständig, eindeutig
und geheimnisfrei ist; Code 1 mit Befundliste sonst. Er nimmt **nicht** ab — ob die Aufnahmen
zeigen, was der Beleg sagt, beurteilt die Prüfung. Testzeit und `/health` müssen aus derselben
Bereitstellung stammen (kein Neustart dazwischen); das zeigt die Aufnahme, nicht die Datei.

**Adressleiste und Schwärzung.** `docs/operations/word-web-hostabnahme/README.md` verlangt, in den
Bildbelegen Adressleiste, Konto- und Mandantennamen zu schwärzen; Ergänzung 4 verlangt die
Dokumentadresse des Testmandanten im Beleg. Beides gilt: die Adresse steht als Text in
`dokumentUrl` (Mandantenhost und Pfad, ohne Freigabe- oder Anmeldeschlüssel), die Bilder bleiben
geschwärzt.

## 2 · Speichern, Schließen, Wiederöffnen gegen feste Sollwerte (Kriterium 3) — je Host getrennt

Ein Bildschirmfoto zeigt nicht, ob ein Bild still ausgetauscht, eine Tabellenzelle verloren oder
eine Bildunterschrift dem falschen Bild zugeordnet wurde. Deshalb läuft je Host ein eigener
Vergleich gegen ein Sollpaket, das **vor** dem Lauf feststeht: Überschrift, Absätze, fetter Text,
Tabelle, zwei Rasterbilder mit Byte- und Bildpunkt-Prüfsumme (die Prüfbilder aus
`tests/rueckweg-bilder-nutzerweg/pruefbilder.ts`), die Unterschrift je Bild und ein Änderungssatz,
der den Host nennt. Ein Ergebnis aus Word für Mac besteht deshalb den Web-Vergleich nicht.

1. Prüfdokument und Sollpaket erzeugen — je Host einmal:

   ```
   node tools/word-host-wiederoeffnen.ts sollpaket web abnahme/
   node tools/word-host-wiederoeffnen.ts sollpaket mac abnahme/
   ```

   Das ergibt `pruefdokument-web.docx`/`soll-web.json` und `pruefdokument-mac.docx`/`soll-mac.json`.
2. Das Prüfdokument im jeweiligen Host öffnen (Web: in OneDrive/SharePoint des Testmandanten
   hochladen; Mac: in Word für Mac öffnen). Am Ende genau den Änderungssatz aus dem Sollpaket
   (`aenderung`) als letzten Absatz eintippen.
3. In Klara unter „Erfassen“ „Ganzes Dokument übernehmen“ → Entwurf. **Sofort, noch vor dem
   Speichern und Schließen**, `GET /api/drafts/<id>` lesen und zwei Werte notieren: die
   Entwurfskennung `<id>` und die Dokumentkennung `<dok>` (`dokumentHerkunft.dokumentId`). Beide
   sind Pflicht für Schritt 6; ohne `<dok>` gibt der Vergleich kein Urteil.
4. Speichern, Word bzw. das Browserfenster **schließen**, das Dokument **wieder öffnen**, dann eine
   Kopie als DOCX herunterladen bzw. sichern (`wiedergeoeffnet-web.docx` / `-mac.docx`).
5. Den Entwurf in KLARWERK als JSON sichern (`GET /api/drafts/<id>` → `entwurf-web.json` /
   `-mac.json`).
6. Vergleichen:

   ```
   node tools/word-host-wiederoeffnen.ts vergleiche-docx soll-web.json wiedergeoeffnet-web.docx
   node tools/word-host-wiederoeffnen.ts vergleiche-objekt soll-web.json entwurf-web.json <id> <dok>
   ```

   Trägt der Entwurf eine andere Dokumentkennung als die in Schritt 3 notierte — auch eine nicht
   leere —, ist das ein Quellenbefund (`quelle.dokumentHerkunft`), kein Bestehen. Verglichen werden
   außerdem Absatzreihenfolge und -häufigkeit, die Tabelle mit ihren Zellpositionen und der
   Fettdruck als Auszeichnung; ohne `figcaption` gilt der Textblock nach einem Bild als dessen
   Unterschrift.

   (Mac entsprechend mit `soll-mac.json`.) Liegt ein Bild im Entwurf nur als Adresse vor, meldet
   der Vergleich das als **offen**; dann das Bild herunterladen und mit
   `vergleiche-bild soll-web.json <nr> <bild.png>` prüfen.

Was verglichen wird:

| Teil | DOCX nach Wiederöffnen | KLARWERK-Eintrag |
|---|---|---|
| Inhalt | alle Absätze in Reihenfolge, jeder genau einmal, Tabelle zellgenau, Fettdruck | dasselbe: Absatzreihenfolge und -häufigkeit, Tabelle mit Zellpositionen, Fettdruck als Auszeichnung |
| Rasterbilder | Anzahl; je Bild Byte- **oder** Bildpunkt-Prüfsumme gleich | Anzahl; je Bild Prüfsumme (oder `vergleiche-bild`) |
| Zuordnung | auf Bild k folgt dessen Unterschrift | Unterschriften in Bildreihenfolge |
| Quelle | — | Herkunft `word_addin`; Entwurfs- und Dokumentkennung gleich den in Schritt 3 notierten (Pflicht) |

Ein neu verpacktes PNG mit denselben Bildpunkten gilt als erhalten; ein anderes Format (etwa JPEG)
oder ein einziger anderer Bildpunkt nicht. EMF/WMF sind kein unterstütztes Rasterformat und nicht
Teil des Sollpakets. Die Vergleiche bedienen Word nicht; sie ersetzen die Bedienung im Host nicht,
sie machen ihr Ergebnis prüfbar.

## 3 · Der übrige Hostteil — getrennte Protokolle

Anmeldung, Sitzung, Lesen, Fragen, Quellen, Einfügen, Speichern/Wiederöffnen und Rückweg im echten
Host stehen in den vorhandenen Protokollen, je Host getrennt:

- Word für das Web (Chrome): `docs/operations/word-web-hostabnahme/README.md`, Schritte W1–W19.
- Word für Mac: `docs/operations/word-mac-hostabnahme/README.md`, Schritte M1–M10.
- Gemeinsamer Teil (Stammdaten, Zustimmung, Zustände): `docs/word-addin/ABNAHME-M365.md`.

Abschnitt 1 ist die belegpflichtige Fassung von W13 für genau den Fall aus Ergänzung 4 (Web,
admin). Er ersetzt weder W1–W19 noch M1–M10. Jeder Nachweis wird an Version **und** vollständigen
Liefercommit derselben Bereitstellung gebunden; ein Ergebnis in Word Web gilt nicht für Word für
Mac und umgekehrt.
