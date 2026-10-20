# Klara 17/18: mehrteilige Arbeit fortsetzen

Der gebundene Plan und seine tatsächlichen Ergebnisse bleiben im vorhandenen eigenen Klara-Gespräch. Es gibt keinen zusätzlichen Speicher oder Scheduler. Das Lesen nach Neuladen führt nichts aus. Erst **Fortsetzen** liest den aktuellen Auftrag und dessen Fassung; bereits fertige Schritte bleiben mit ihren ursprünglichen Kennungen erhalten. Offene Schritte laufen über die vorhandenen Produktwege mit den heutigen Rechten.

**Unterbrechen** hält weitere Änderungen an und speichert eine fortsetzbare Pause. **Abbrechen** beendet weitere Arbeit dauerhaft. Bereits ausgelöste Wirkungen können trotzdem eintreffen und bleiben sichtbar. Insbesondere begründet ein protokolliertes „begonnen“ keine Erlaubnis, nach Abbrechen noch zu schreiben. Eine laufende lokale Fachoperation, die ihren Schreibaufruf bereits erhalten hat, ist nicht nachträglich als abgebrochen oder ungeschehen garantiert.

**Rückgängig** bleibt ein getrennter Weg: nur passende gespeicherte Ergebnisse, über die vorhandenen Fachwege und deren Standvergleich. Eine Fremdänderung wird nicht überschrieben. Eine Rücknahme startet den alten Auftrag nicht neu.

Auf der Karte stehen tatsächlicher Fortschritt, Handlungsbedarf und die passenden Knöpfe. Die Auftragsgrenze ist in **Auftragsdetails** erreichbar. Eine fehlende Antwort wird zunächst durch Lesen des gespeicherten Auftrags beziehungsweise des tatsächlichen Originalobjekts geklärt. Unklare Ausgänge bleiben als solche sichtbar, auch wenn die Ergebniskennung noch nicht angekommen ist.

## Bestehende Gesprächsschnittstelle

- `GET /api/me/klara/gespraeche/:id/auftraege` liefert die eigenen Aufträge einschließlich gespeichertem `plan`, Schrittkennungen, Ergebnissen, `fassung` und optional `unterbrochenAm`.
- `POST .../auftraege/:auftragId/unterbrechen` und `/fortsetzen` nehmen `{auftragFassung}`. Eine überholte Fassung wird abgewiesen. Fortsetzen eines beendeten oder abgebrochenen Auftrags ist unzulässig.
- `POST .../fassungen` unterstützt zusätzlich den optionalen aktuellen `auftragFassung`-Vergleich. Bereits ausgeführte Schritte werden nicht geändert.
- Ausführung und Rücknahme bleiben die bestehenden schrittgebundenen Türen. Aus einer fremden Quellenanweisung entsteht keine Autorität.

Diese Schnittstelle betrifft die Auftragsausführung. Ein Tutorial behält seinen eigenen vorhandenen Schrittstand und kann auf den vorhandenen Fortsetzungsweg verweisen; daraus folgt keine zweite Tutorialablage.

## Nachweise und Grenzen

Gezielte Server-/Oberflächenprüfungen verwenden fiktive Konten. Die PostgreSQL-Prüfung beendet die App und den Pool, meldet sich in einer neuen Instanz neu an und führt echtes `pg_dump`/`pg_restore` in einer eigenen Wegwerfdatenbank aus. Die Chromium-Probe verwendet das gebaute React-Produkt und die echte Fastify-App über die vorhandene lokale Prüfvorrichtung. Dies ist kein Nachweis eines echten Mikrofons, Office-Hosts oder einer Liveveröffentlichung.

Dieser Kern liefert keine Beschaffungssuite, keinen Lieferantenkontakt und keine Kaufbefugnis. Die ursprünglichen Klara-17-Kriterien zum vollständigen Notiz-/Aufgaben-/Erinnerungsweg, zur bewussten Wissensübernahme (F08) und zum Beschaffungsfall bleiben einzeln zu prüfen. Vorhandene positive Nachweise unveränderter Funktionen bleiben erhalten; Gesamtabschluss, unabhängige Prüfung, Integration und Veröffentlichung sind getrennte Schritte.
