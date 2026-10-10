# Vorlagen, persönlicher Standard und Space-Vorgaben

Auftrag `produkt:20261007:templates-default` (Revision 2, ADMIN-08).

## Was es gibt

- **Standardvorlagen** (eingebaut, unveränderlich): Regel, Arbeitsanleitung, Übergabe,
  Projektentscheidung, Besprechungsnotiz, FAQ sowie die übernommenen Startstrukturen des Editors
  (Störung beheben, Sicherheitsrelevantes Wissen, Checkliste, Entscheidungshilfe). Feldtitel in
  DE/EN/NL (`services/app/src/vorlagen.ts`, `STANDARD_VORLAGEN`).
- **Eigene Vorlagen** mit Geltung `persoenlich`, `space` (geteilt in einem Space) oder `unternehmen`.
  Jede Änderung ist eine neue, unveränderliche Fassung; Ausmustern statt Löschen.
- **Persönlicher Standard** je Konto.
- **Space-Vorgaben** je Space: verbindliche Vorlage, erlaubte Kategorien, Pflichtkategorie,
  Mindestzahl an Tags, vorgeschlagene Tags, Erklärung.
- **Nutzung**: Jeder mit Vorlage eingereichte Beitrag merkt sich Vorlage und Fassung.
- **Begriffspflege** (Kontoverwaltung): Tag/Kategorie umbenennen, zusammenführen, ausmustern —
  wahlweise nur in einem Space; Vorschau des betroffenen Bestands je Space vor der Ausführung.
  Gespeicherte Space-Ansichten mit dem Tag ziehen beim Umbenennen/Zusammenführen als neue
  Spacefassung mit; ein archivierter Space bleibt unverändert und wird so benannt. Ebenso ziehen
  Space-Vorgaben im Geltungsbereich mit (erlaubte Kategorien bzw. vorgeschlagene Tags, neue
  Vorgabenfassung, ohne Doppel); Vorgaben anderer Spaces bleiben unverändert. Archivierte Spaces
  sind schon in der Vorschau als unverändert gekennzeichnet; das Ergebnis nennt geänderte und
  übersprungene Vorgaben mit Grund. Hat sich der Bestand seit der Vorschau geändert, zeigt die
  Oberfläche die neue Vorschau statt still auszuführen.

## Rechte

| Geltung | sehen / anwenden | anlegen, teilen | ändern, ausmustern |
| --- | --- | --- | --- |
| standard | alle mit `ko.read` | — | niemand |
| persönlich | Eigentümerin | `ko.create` | Eigentümerin |
| space | Leser des Space | Schreibrecht im Space | Eigentümerin mit Schreibrecht oder Spaceverwaltung |
| unternehmen | alle mit `ko.read` | `users.manage` | `users.manage` |

Space-Vorgaben pflegen die Spacezuständigen oder die Kontoverwaltung. Verwaltungssicht und
Begriffspflege verlangen `users.manage`; Begriffsnamen und Titel nur aus einsehbaren Beiträgen.

## Vorrangregel bei neuer Eingabe

1. Im gewählten Space verbindliche, anwendbare Vorlage (der persönliche Standard wird als
   „tritt zurück“ benannt).
2. Sonst der persönliche Standard.
3. Sonst freie Eingabe — war ein Standard gesetzt, der nicht mehr verfügbar ist (ausgemustert, kein
   Zugriff), steht der Grund dabei. Inhalte werden nie entfernt.

## Einreichen

Speichern eines Entwurfs bleibt frei. Beim Einreichen (`POST /api/kos`,
`POST /api/kos/from-document`, `POST /api/drafts/:id/promote`) prüft der Server dieselben Regeln:
Pflichtfelder der verwendeten Fassung, Pflichtfelder einer im Space verbindlichen Vorlage,
Space-Vorgaben zu Kategorie und Tags sowie umbenannte/ausgemusterte Begriffe. Fehlt etwas, antwortet
er `400 PFLICHTANGABEN_FEHLEN` mit `befunde` je Feld; es entsteht nichts. Danach vermerkt er Vorlage
und Fassung und legt den Beitrag in den gewählten Space (`setLeadingSpace`).

Die Feldstruktur (Abschnitte, Platzhalter, Pflichtfelder, Wechsel) steht einmal in
`apps/web/src/lib/vorlagenStruktur.ts`; Editor, Klara-Kontext und Server lesen dieselbe Datei.

## Ablage

Eine Tabelle `vorlagen_fassungen (art, schluessel, version, data)` — rein additiv (`VORLAGEN_SCHEMA`).

## Grenzen

- Die Ablage im Space nach dem Einreichen ist eine Nacharbeit; scheitert sie, meldet die Antwort
  `vorlagenVermerk: "fehlgeschlagen"` bzw. `followUpsFailed: ["vorlage"]`. Die Prüfzuständigkeit aus
  dem Unternehmensverzeichnis (R-0571) wird dabei nicht neu abgeglichen.
- Ein späteres Verschieben in einen Space über den Spacewechsel prüft die Space-Vorgaben nicht.
- Umbenannte Begriffe: Suche und Filter finden die Beiträge unter dem neuen Begriff; der alte Begriff
  ist kein Suchalias, er führt nur bei neuen Eingaben zum Hinweis.
- Das Blatt hat kein Tag-Feld; verlangt ein Space Tags, geht das über das Formular.
- Serverseitige Meldungstexte (`message`) sind deutsch; die Oberfläche zeigt die Befunde übersetzt.
