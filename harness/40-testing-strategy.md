# 40 — Prüfungen passend zum Auftrag

Tests leiten ihr erwartetes Verhalten aus den Originalkriterien ab. Sie sollen relevante Fehler erkennen, nicht bloß den geschriebenen Code spiegeln.

Die Änderung bestimmt die Auswahl: betroffene Funktion, Schnittstellen und konkrete Regressionen prüfen. Build und Typprüfung, gezielte API-/Komponenten-/Browserfälle sowie Formatprüfung werden dort eingesetzt, wo sie die Änderung absichern. Kein pauschaler Volltest und keine feste Abdeckungsquote allein wegen eines neuen Auftrags.

Für Datenhaltung den echten benötigten Speicherweg verwenden; für Browserverhalten den tatsächlichen Browser. Vorhandene Prüfmittel wiederverwenden. Testcontainers sind eine Möglichkeit, keine Pflicht, wenn der freigegebene Prüfplatz bereits eine passende echte PostgreSQL-Instanz bereitstellt. Fremde Systeme nur dann simulieren, wenn damit nicht gerade das zu belegende Kriterium ersetzt wird.

Zu jeder Ausführung gehören Kandidatenfassung, Befehl und tatsächliches Ergebnis. Übersprungene oder nicht ausgeführte Fälle sind keine bestandenen Tests. Ein fehlendes Werkzeug oder Kontingent ist von einem Produktfehler zu unterscheiden; unveränderte Bedingungen rechtfertigen keine endlose Wiederholung.

`tools/check` dient der breiten Diagnose. Ein roter Fall wird auf Ursache und Betroffenheit geprüft. Ein Fehler der beauftragten Änderung muss behoben werden; ein unabhängiger historischer Rotfall wird gesondert ausgewiesen. Ändert man einen Test wegen einer veralteten Regel, bleiben das berechtigte Nutzerziel und sein Prüfnachweis erhalten.
