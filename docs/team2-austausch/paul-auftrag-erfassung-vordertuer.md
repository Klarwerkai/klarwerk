# Berater-Auftrag: Die Erfassung als „vertraute Vordertür" — so einfach wie Word, aber nicht Word

**Von:** Paul (Cloud-Worker) im Auftrag von Pedi (PO) · **Datum:** 06.07.2026
**Status:** Richtungs-Auftrag. Boss-Abgleich folgt; dein Konzept ist die Vorlage dafür.

---

## Auslöser (echtes Feedback, nicht Theorie)

Ein wohlgesonnener VIP-Tester hat KLARWERK im Vorab-Test benutzt. Kernaussagen (Pedi, sinngemäß):

- „Als Anwender ist mir die Wissenserfassung zu kompliziert mit all ihren Möglichkeiten. Ich verzettel mich."
- „Ich komme aus dem Studio nicht mehr raus."
- „Bild einfügen ging nicht."
- „Komplette Dokumente (z. B. ein Design Guide) sollten als verlässliche Aussagen importierbar sein — **inkl. der Grafiken**, die oft mehr sagen als viele Worte."
- „Ich lade ein Dokument hoch und will Fragen darauf stellen, deren Antwort die Inhalte logisch verknüpft."
- „Suche soll nicht nur den ‚dummen' Artikel finden, sondern auch zusammenfassen oder Fragen beantworten — mit Quellenlink."

Pedis Schluss (und wir teilen ihn): **Menschen bringen ihre Werkzeuge mit, nicht ihre Bereitschaft, neue zu lernen.** Wer seit Jahren in Word/Excel/PowerPoint denkt, will in diesen Gesten arbeiten — tippen, einfügen, Bild reinziehen, aus Office kopieren. Jede Hürde davor kostet uns genau die wertvollsten Nutzer: die mit dem Erfahrungswissen, die keine Software-Enthusiasten sind.

## Das Leitprinzip, das wir geprüft haben wollen

> **So einfach wie Word — aber nicht Word.**

Word gibt es schon, gratis; für ein zweites zahlt niemand. Unser Wert ist genau das, was Word **nicht** kann: aus dem, was jemand hinschreibt, **strukturiertes, geprüftes, abfragbares Wissen mit Herkunft und Vertrauen** zu machen. Die These: Die **Eingabe** muss sich so vertraut wie ein leeres Dokument anfühlen; Struktur, Prüfung und Schlussfolgern passieren **darunter** — mühelos, unsichtbar, hinterher. Vertraute Oberfläche, klügeres Fundament.

## Was schon existiert (ehrlicher Bestand — es ist kein Neubau)

Die Bausteine sind da, aber unter zu viel Prozess begraben:
- Rich-Text-Editor mit Blöcken (Info/Hinweis/Warnung/Erfolg), Listen, Überschriften.
- Bilder per **Einfügen/Drag&Drop** (sichere Einbettung existiert bereits im Code).
- **Datei-Import** mit KI-Extraktion einzelner Wissenspunkte (mit wörtlicher Belegstelle).
- KI, die **Freitext in Struktur** überführt (Reasoner).
- Quellengebundene **Frage-Antwort** über den Bestand („Fragen", mit Quellen-Links, ehrliche Wissenslücke statt Erfindung).
- Validierung / Vertrauen / Herkunft als geprüftes Fundament.

Das aktuelle Problem ist **Verpackung**, nicht Substanz: vier Erzähl-Modi + Experten-Formular + „Studio im Studio" + Schritt-Leisten. Der Nutzer sieht eine Maschine, wo er ein Blatt Papier erwartet.

## Deine Aufgabe — Fragen, die wir beantwortet haben wollen

- **EF-1 (Vordertür):** Wie sieht die EINE, vertraute Eingabe-Oberfläche aus, die sich wie ein leeres Dokument anfühlt (tippen, Bild reinziehen, aus Word/PowerPoint einfügen, Datei fallen lassen) — und trotzdem sauber in unser Wissensobjekt-Modell mündet? Skizziere das Sollbild.
- **EF-2 (Struktur ohne Zwang):** Wann und wie passiert die Strukturierung, ohne den Nutzer zu einem Formular zu zwingen? Inline, auf Knopfdruck („soll ich das ordnen?"), im Hintergrund, am Ende? Was ist die ehrlichste Reihenfolge?
- **EF-3 (Office-Paste):** Wie gehen wir mit Einfügen aus Word/Excel/PowerPoint um — Formatierung, Bilder, Tabellen — sodass etwas Sauberes entsteht und nicht Müll? Was übernehmen, was verwerfen?
- **EF-4 (Ganz-Dokument als verlässliche Quelle):** Design-Guide-Szenario — ein ganzes, extern bereits freigegebenes Dokument inkl. Grafiken als verlässliches Wissen importieren. Wie halten wir das Vertrauensversprechen ehrlich (Schnellprüfung mit 1 Freigabe ist die aktuelle Idee)? Wo ist die Grenze zwischen „verlässlich, weil extern freigegeben" und „ungeprüft"?
- **EF-5 (Grafiken):** Grafiken als Erklärung zu Punkten — an Ort und Stelle aus dem Dokument übernehmen, plus jederzeit ergänzen. Was ist das richtige Verhalten (Position erhalten, Galerie, im Zweifel alle)?
- **EF-6 (Dokumentgestützte Fragen):** Dokument hochladen → Fragen darauf, Antwort verknüpft die Inhalte logisch, mit Quellenverweis. Wie präsentieren wir das ehrlich (KI-generiert, Belegstellen, keine Erfindung)?
- **EF-7 (Suche → Antwort/Zusammenfassung):** Aus der Suche heraus optional KI-Antwort ODER Zusammenfassung über die Treffer, mit Quellenlinks. Wie unterscheiden wir sichtbar „gefunden" von „von der KI verdichtet"?
- **EF-8 (Onboarding/Progressive Disclosure):** Wie führen wir Erstnutzer, ohne zu erschlagen? Wann darf welche Möglichkeit erscheinen?
- **EF-9 (Migration):** Realistischer Umbaupfad vom heutigen Multi-Modus-Wizard zur Vordertür, ohne Funktionsverlust — die Modi/das Formular bleiben als „andere Wege" für die, die sie wollen.

## Harte Leitplanken (nicht verhandelbar — bitte darin arbeiten)

- **Der Burggraben bleibt:** Validierung, Vertrauen, Herkunft (Provenienz) werden NICHT für Vertrautheit geopfert. Sie sollen sich nur mühelos anfühlen, nicht verschwinden.
- **Ehrlichkeit:** Nichts wird still auto-validiert; KI-Generiertes wird als solches gekennzeichnet („KI-generiert, nicht 100 % geprüft"); Belegstellen statt Behauptungen; bei fehlender Grundlage ehrliche Wissenslücke statt Erfindung.
- **Sicherheit:** Kein Einbetten unsicherer Inhalte (SVG bleibt Anhang, kein Fremd-Hotlinking); Upload-Grenzen gelten.
- **Kein Funktionsverlust:** Bestehende Wege bleiben erreichbar, nur nachrangig.

## Erbetene Lieferung

1. **Sollbild-Konzept** der Erfassungs-Vordertür (Fließtext + grobe Skizze/Wireframe-Beschreibung genügt).
2. **Antworten EF-1 bis EF-9**, kurz und konkret.
3. **Migrationspfad** in 2–3 Stufen (was zuerst, was kann warten).
4. **Ausdrücklicher Widerspruch**, wo du unsere These für falsch hältst — wir wollen die ehrliche Gegenprobe, nicht Zustimmung.

Zeit: kein harter Termin, aber vor dem großen Umbau. Format: eine Datei, wie gewohnt über die Austausch-Ablage.
