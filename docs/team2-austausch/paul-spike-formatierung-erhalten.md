# Technische Machbarkeit: „Formatierung nicht verlieren" (Word/PowerPoint-Übernahme)

**Von:** Paul (Cloud-Worker) · **Datum:** 06.07.2026 · **Zweck:** Pedis K.-o.-Kriterium technisch de-risken, bevor der Word-Weg gebaut wird. Richtungsunabhängig — gilt für jede Vordertür-Variante.

## Ist-Stand im Code (ehrlich)

Der Body läuft durch einen **server-autoritativen Allowlist-Sanitizer** (`services/structure/src/sanitize.ts`). Erlaubt sind heute nur: `p, br, h2, h3, strong, em, u, ul, ol, li, a, img, blockquote, div` (mit festen sicheren Klassen). Alles andere — inkl. `style`, `on*`-Handler, fremde Tags — wird entfernt. Eine **Paste-Normalisierung existiert nicht**: Aus Word/PowerPoint eingefügtes HTML landet roh im Editor und wird dann vom Sanitizer beschnitten.

## Was heute beim Einfügen aus Office VERLOREN geht

- **Tabellen** (Word/Excel) → komplett weg (keine `table`-Tags erlaubt). **Größte Lücke.**
- **Fett/Kursiv aus Word** → oft als `<b>`/`<i>` oder `<span style="font-weight:bold">`; wir erlauben nur `strong`/`em` und kein `style` → **wird stumm entfernt**.
- **Überschriften** außer H2/H3 (Word nutzt H1/H4–H6) → verloren bzw. zu Absatz degradiert.
- **Eingefügte Bilder** aus Rich-HTML (externe URL oder Office-Blob) → weg; nur interner Object-Store-Pfad oder sicheres `data:image`-Raster wird gehalten (der Bild-Button/Drop wandelt bereits um, der HTML-Paste nicht).
- Farben, Schriftart, Ausrichtung → entfernt (für Konsistenz meist gewollt, kein Verlust im Sinn des Kriteriums).

## Machbarkeit: JA — mit zwei Bausteinen

1. **Paste-Normalisierer** (Client, beim Einfügen von `text/html`): Office-HTML auf unser sauberes Modell abbilden statt es wegzuwerfen — `b→strong`, `i→em`, `span[style: bold/italic]→strong/em`, `h1→h2`, `h4–h6→h3`, eingefügte Bilder zu sicheren `data:image` konvertieren, `mso-`/Office-Müll entfernen.
2. **Allowlist um Tabellen erweitern** (`table/thead/tbody/tr/td/th`, streng sanitisiert — nur Struktur, kein `style`/kein Merge-Zauber in v1). Das schließt die größte reale Lücke für Word/Excel.

## Sicherheit — warum das vertretbar ist

Paste-HTML ist der klassische XSS-Vektor, ABER unsere Architektur sanitisiert **server-autoritativ**: Der Normalisierer läuft nur clientseitig für die UX; das letzte Wort hat weiter der Server-Sanitizer. Erweitern heißt also: neue Tags **mit engen Attributregeln** in die Allowlist, niemals `style`/`on*`/`script`. Das ist eine kontrollierte, gut testbare Erweiterung — kein Aufweichen des Prinzips.

## Empfehlung

Das Kriterium ist **erreichbar**, Aufwand grob 1–2 Slices. Aufgabenteilung: der **Berater** entwirft UX/Flow der Vordertür; die **Formatierungs-Pipeline** (Normalisierer + Tabellen-Allowlist) ist richtungsunabhängige Klempnerei, die jede Variante braucht — sie kann parallel spezifiziert werden. **Eine Design-Entscheidung braucht es:** wie reich Tabellen sein sollen (einfache Gitter reichen für v1? verbundene Zellen später?). Das an den Berater weiterreichen (ergänzt EF-3/EF-4).

**Kurz:** Pedis „darf nicht verloren gehen" ist kein Show-Stopper — es ist ein lösbares, sicherheitsverträgliches Klempner-Thema. Kein Grund zur Sorge; wir wissen jetzt genau, was zu tun ist.
