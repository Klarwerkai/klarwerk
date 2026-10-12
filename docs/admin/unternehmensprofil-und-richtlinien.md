# Unternehmensprofil und interne Richtlinien (ADMIN-15)

Auftrag `produkt:20261009:admin-unternehmensprofil`. Bedienorte: `/unternehmen` (Verwaltung, erreichbar
unter Verwaltung → System) und `/richtlinien` (alle Konten, erreichbar über das Konto-Menü).

## Unternehmensprofil

- Name (2–80 Zeichen), optionales Logo, eine Akzentfarbe aus einer festen Liste.
- Logo: nur PNG oder JPEG, höchstens 200 KB, 32–4000 Pixel je Kante, Seitenverhältnis höchstens 8:1.
  Der Server prüft den Inhalt (Dateikopf), nicht den Dateinamen. SVG wird abgewiesen.
- Akzentfarben: neutral, nachtblau, tannengrün, aubergine, anthrazit — jede mit mindestens 7:1
  Kontrast zwischen Fläche und Schrift (`services/app/src/unternehmensprofil.ts`, `AKZENTE`).
  Es gibt keinen freien Farbwähler.
- Vor dem Speichern zeigt die Verwaltung den Kopf der Seite „Interne Richtlinien“ in breiter Ansicht
  und in 390 Pixel Breite. Jede Speicherung ist eine neue Fassung; eine frühere Fassung kann als
  Vorlage übernommen und mit Grund neu gespeichert werden.
- Das Kopfband der App und die feste Markenwahl (`/api/branding`) bleiben unverändert.

## Interne Richtlinien

- Jede Fassung trägt Titel, Text, Verantwortlich, „Gültig ab“, Geltung (Rollen; leer = alle Konten)
  und die verlangte Handlung: nur anzeigen, Kenntnisnahme oder Zustimmung.
- Vor dem Veröffentlichen zeigt die Wirkungsvorschau, wie viele Konten betroffen sind und ob sie
  erneut zur Kenntnis nehmen oder zustimmen müssen. Der Server veröffentlicht nur, wenn die
  mitgeschickte Wirkung der aktuell berechneten entspricht (sonst 409 `WIRKUNG_NICHT_BESTAETIGT`).
- Ab Fassung 2 ist ein Änderungsgrund Pflicht. Frühere Fassungen bleiben vollständig erhalten.
- Eine Handlung gilt genau der Fassung, auf die sie sich bezieht. Anzeigen erzeugt keinen Eintrag.
  Es gibt keinen Lösch- oder Überschreibweg für Handlungen.

## Rechte und Organisation

Lesen und eigene Handlung: jedes angemeldete Konto (`requireUser`). Verwaltung: `users.manage`.
Eine Kundeninstanz ist ein Datenraum; keine Route nimmt eine Organisationskennung entgegen.

## Grenzen

- Die Richtlinien ersetzen weder Impressum noch Datenschutzerklärung; diese bleiben feste Texte.
- Es gibt keine Benachrichtigung über neue Fassungen; Beschäftigte sehen offene Handlungen auf
  `/richtlinien`.
- Mehrere Organisationen in einer Instanz sind nicht vorgesehen.
