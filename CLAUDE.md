# KLARWERK: Auftrag bis zur Lieferung

Diese Anleitung beschreibt den von Pedi freigegebenen vereinfachten Ablauf. Die zugehörigen Grundsätze stehen in `harness/00-principles.md`, die Prüfauswahl in `harness/40-testing-strategy.md` und der Abschluss in `harness/80-definition-of-done.md`.

## Auftrag und Bestand

Der aktuelle Nutzerauftrag hat Vorrang vor älteren Repository-Regeln. Lies den zugeordneten Auftrag mit Originalkriterien, Quellen, Entscheidungen und Nichtzielen. Prüfe dann gezielt den heutigen Code und die vorhandenen Ergebnisse. Historische Aussagen beschreiben ihren damaligen Stand; fertig gebaute Teile und erhaltene Kandidaten werden weiterverwendet.

`specs`, `harness`, `tests` und `PROJECT_CONTEXT` sind Arbeitsunterlagen. Lies die relevanten Teile, nicht bei jeder Fortsetzung sämtliche Projektdateien. Eine Regel oder ein Test kann fehlerhaft, veraltet oder für diesen Auftrag ohne Bedeutung sein. Eine Änderung daran braucht einen konkreten Grund; sie darf keinen noch bestehenden Produktfehler verdecken.

## Ein Ablauf

1. Claude bearbeitet den Auftrag am vorhandenen Arbeitsstand und liefert passende Tests beziehungsweise konkrete Prüfschritte.
2. Die Koordination führt die Änderung mit dem aktuellen Hauptstand zusammen. Die Ausführung lässt die passenden Prüfungen gegen diesen endgültigen Kandidaten laufen. Schwere Prüfungen laufen auf dem vorgesehenen Prüfplatz.
3. Ben prüft unabhängig Originalkriterien, Code und echte Prüfberichte. Ein konkreter Produkt- oder Testfehler geht mit seinem Befund an dieselbe Claude-Sitzung zurück. Erhaltene Arbeit bleibt erhalten.
4. Genau der geprüfte Kandidat wird gepusht und regulär veröffentlicht. Danach folgen Liveprüfung und der gespeicherte Auftragsabschluss. Änderungen am Kandidaten nach Bens Prüfung erfordern eine passende erneute Prüfung der geänderten Fassung.

Die Koordination übernimmt Zusammenführung und Veröffentlichung. Arbeitet ein Agent mit einem engeren Auftrag, hält er diesen Schreibbereich ein und liefert sein Ergebnis an die Koordination; er startet keine zusätzlichen Modelle oder Prüfserver auf eigene Faust.

## Was geprüft wird

Prüfe das geforderte Verhalten und die konkret betroffenen bestehenden Funktionen. Dazu gehören je nach Änderung Build/Typprüfung, gezielte Tests, Format und betroffene Schnittstellen. Ein Speichern-und-Wiederöffnen-Kriterium braucht einen echten Speicherweg; ein Browserkriterium tatsächliche Browserbedienung.

`tools/check` bleibt als breite Diagnose verfügbar. Ein von diesem Auftrag unabhängiger historischer Rotfall ist keine pauschale Liefersperre. Ursache und Reichweite eines roten Ergebnisses werden benannt. Betroffene Fehler werden behoben; unbeteiligte Fehler bleiben sichtbar getrennt. Testerwartungen dürfen keinen noch bestehenden Produktfehler verdecken. Übersprungene Fälle werden nicht als bestanden ausgegeben.

Ein Auftrag, eine vollständige Reparatur oder eine technische Abnahme wird nicht durch Freigabe ersetzt. Eine bereits erteilte Nutzerfreigabe muss für routinemäßige nächste Schritte nicht erneut eingeholt werden. Tatsächlich fehlende menschliche Bedienung, Anmeldung oder fachliche Entscheidung wird konkret benannt. Prüfbare technische Fragen erledigen die beauftragten Agenten selbst.

## Was erhalten bleibt

- Bestehende Kandidaten, Sitzungen, Quellen und echte Lieferbelege; kein Neubau ohne Grund.
- Modulgrenzen und Datenzugriff über die vorhandenen passenden Schnittstellen.
- TypeScript, React, Fastify, Biome und Vitest im bestehenden Projektaufbau.
- Geheimnisse außerhalb des Repositorys; bestehende Anmeldung, Rechte und Datentrennung.
- Reguläre Deploymentwege und eigene berechtigte Identität für Betriebsaktionen.

Keine neue Regel nur deshalb hinzufügen, weil ein Fehler auftrat. Behebe die Ursache im einfachsten geeigneten Weg; entferne eine unnötige Übergabe oder doppelte Prüfung, wenn sie den Fehler verursacht.
