# Situationsabhängige Avatarzustände

Auftrag `produkt:20261010:assistenz-avatarzustaende` (PoC). Ergänzt die persönliche Assistenz
(`docs/klara/assistenz-name-avatar.md`) um den noch fehlenden Umfang. Keine neue App, keine neue
Steuerung; Name, Profil und Motivauswahl bleiben wie geliefert.

## Was dazukam

| Thema | Umsetzung |
| --- | --- |
| Neue Aktion vor altem Ergebnis | `beginneAktion()` (`components/assistenz/ausdruck.ts`) vergibt je Aktion eine Kennung und beendet Fehler, Pause oder Freude sofort. Ein Ergebnis zählt nur mit der Kennung der jüngsten Aktion — eine langsame Antwort oder ein verspätetes Speichern überschreibt keine neuere Aktion. |
| Keine Freude ohne bestätigtes Ergebnis | `ausdruckNachFrage()`: Freude nur bei gespeicherter Antwort mit Grundlage. Antwort „ohne KI“ (keine geprüfte Quelle) = Fehler „quelle“; nicht gespeicherte Antwort = kein Ergebnis (Bereit). |
| Fehlerarten | `technisch` (Server, Netz, Speichern), `quelle` (keine geprüfte Quelle), `eingabe` (Angabe fehlt: Feldprüfung, fehlende Einwilligung). Je eigener Text an der Figur und in der vorgelesenen Beschreibung (`assistenz.zustand.fehler_*`); `data-fehlerart` an Figur und Textpille. Nur „technisch“ ist rot markiert und sinkt kurz ab; „quelle“/„eingabe“ sind kaum gedimmt und neigen sich einmal fragend. |
| Ruhiger Ausdruck ohne Bewegung | Sachliche Objekte zeigen jeden Zustand auch statisch (Helligkeit, Lichtsaum, leichte Neigung) — bei reduzierter Bewegung durch System oder eigene Wahl. Die Wahl „Bewegung der Figur reduzieren“ schaltet alle Animationen der Figur ab; Text bleibt. |
| Vorschau in der Auswahl | Unter jedem der 13 Motive „Zustände ansehen“ (`AvatarZustandsVorschau.tsx`): neun Zustände je 1,2 s, gestrichelt umrandet, „Vorschau: …“, „Nur eine Vorschau …“, Schritt „Vorschau n von 9: …“. Fokus auf „Vorschau beenden“; Enter/Escape beenden, der Fokus kehrt zum Startknopf zurück. Endet auch, wenn die Seite verborgen wird. Sie meldet kein Ergebnis, wählt kein Motiv und speichert nichts. |

## Getrennte Ausweisung (K8)

| Stufe | Stand |
| --- | --- |
| Basisbilder | 13 PNGs (12 neue, Original unverändert, Prüfsumme in `tests/assistenz-profil/bildpaket.test.ts`). |
| Bewegungsprototypen | CSS-Gesten (expressiv) und Lichtmodulation (zurückhaltend) in `index.css`, Mimik-Ebene über den 8 Motiven mit Gesicht (`AvatarMimik.tsx`). |
| Fertige Ausdrucksanimationen | Keine eigenen Animationsdateien oder Bildfolgen je Motiv geliefert. Die Darstellung entsteht aus Standbild + CSS + Mimik-Ebene; ob das als fertige Ausdrucksanimation abgenommen wird, entscheidet ein Mensch an den Bildbelegen. |
| Produktiv angebundene Zustände | Alle neun: bereit, warten (Frage wird am Server abgelegt bzw. Antwort wird abgelegt), nachdenken (die abgelegte Frage wird am Frageweg `POST /api/ask` bearbeitet — `verarbeitetSeit` in `echt.ts`, endet mit Antwort, Fehler oder Abbruch), zuhören (`audiostart`), sprechen (`start`), ratlos (Entscheidung nötig), freude, fehler (drei Arten), pause (verkleinert, gestoppt). |

Nacharbeit 1 (Ben): Abbrechen im Formular beendet auch den Eingabefehler an der Figur. Endet eine
ältere Frage erst, nachdem eine neue begonnen hat (z. B. verspäteter Abschluss nach einem Stopp),
ändert ihr Ende weder Status noch Ausdruck der neuen Frage (`istAktuelleAktion`).

## Prüfungen

- `tests/assistenz-profil/avatarzustaende.test.tsx` — Aktionskennung, Ergebnis einer Frage,
  Texte je Zustand und Fehlerart, statische CSS-Ausdrücke, Vorschau aller 13 Motive × 9 Zustände in
  der echten Auswahlkomponente, Tastatur, verborgene Seite, reduzierte Bewegung.
- `tests/assistenz-profil/nachdenken-am-server.test.tsx` — echte Hülle gegen die echte App: Warten →
  Nachdenken → Stopp/Ergebnis/Fehler; verspätetes Ende einer gestoppten Frage bei laufender Folgefrage.
- `tests-smoke/assistenz-avatarzustaende-browser.spec.ts` — Chromium: Vorschau aller 13 Motive mit
  gemessener Animation und Bild je Zustand, Profil unverändert; 390 × 844 mit reduzierter Bewegung
  und Tastatur; echte Ereignisse (schneller Wechsel, Fehlerarten, Abbrechen, Minimieren,
  Seitenansicht, Andocken, Verschieben); Frageweg auf Desktop und 390 × 844 mit Tastatur (Warten,
  Nachdenken, Stopp, verspätetes Ende, schnelle Folgefrage).

## Grenzen

- Echte Sprachein- und -ausgabe hat der kopflose Browser nicht; Zuhören/Sprechen sind über die
  Browserereignisse angebunden und in `tests/assistenz-profil/sprachaktivitaet.test.tsx` geprüft.
- Bildwirkung, Freundlichkeit des Ausdrucks und Bedienung an echten Geräten beurteilt ein Mensch.
