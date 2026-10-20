# Klara 17/18: mehrteilige Arbeit fortsetzen

Der gebundene Plan und seine tatsächlichen Ergebnisse bleiben im vorhandenen eigenen Klara-Gespräch. Es gibt keinen zusätzlichen Speicher oder Scheduler. Das Lesen nach Neuladen führt nichts aus. Erst **Fortsetzen** liest den aktuellen Auftrag und dessen Fassung; bereits fertige Schritte bleiben mit ihren ursprünglichen Kennungen erhalten. Offene Schritte laufen über die vorhandenen Produktwege mit den heutigen Rechten.

**Unterbrechen** hält weitere Änderungen an und speichert eine fortsetzbare Pause. **Abbrechen** beendet weitere Arbeit dauerhaft. Bereits ausgelöste Wirkungen können trotzdem eintreffen und bleiben sichtbar. Insbesondere begründet ein protokolliertes „begonnen“ keine Erlaubnis, nach Abbrechen noch zu schreiben. Eine laufende lokale Fachoperation, die ihren Schreibaufruf bereits erhalten hat, ist nicht nachträglich als abgebrochen oder ungeschehen garantiert.

**Rückgängig** bleibt ein getrennter Weg: nur passende gespeicherte Ergebnisse, über die vorhandenen Fachwege und deren Standvergleich. Eine Fremdänderung wird nicht überschrieben. Eine Rücknahme startet den alten Auftrag nicht neu.

Auf der Karte stehen tatsächlicher Fortschritt, Handlungsbedarf und die passenden Knöpfe. Die Auftragsgrenze ist in **Auftragsdetails** erreichbar. Eine fehlende Antwort wird zunächst durch Lesen des gespeicherten Auftrags beziehungsweise des tatsächlichen Originalobjekts geklärt. Unklare Ausgänge bleiben als solche sichtbar, auch wenn die Ergebniskennung noch nicht angekommen ist. Auch ein nur als begonnen erhaltener, noch ungeprüfter Versuch ohne nachträglichen Ergebnismarker bleibt nach Stopp nachlesbar. Fehlt das Original beim Lesen, erzeugt Stopp niemals eine Ersatzanlage.

## Bestehende Gesprächsschnittstelle

- `GET /api/me/klara/gespraeche/:id/auftraege` liefert die eigenen Aufträge einschließlich gespeichertem `plan`, Schrittkennungen, Ergebnissen, `fassung` und optional `unterbrochenAm`.
- `POST .../auftraege/:auftragId/unterbrechen` und `/fortsetzen` nehmen `{auftragFassung}`. Eine überholte Fassung wird abgewiesen. Fortsetzen eines beendeten oder abgebrochenen Auftrags ist unzulässig.
- `POST .../fassungen` unterstützt zusätzlich den optionalen aktuellen `auftragFassung`-Vergleich. Ein optionaler `plan` kann nur künftige Inhalte oder Zeiten desselben begrenzten Plans korrigieren. Bereits begonnene Schritte bleiben unverändert; die alte Planfassung bleibt in `fassungen` erreichbar.
- Ausführung und Rücknahme bleiben die bestehenden schrittgebundenen Türen. Aus einer fremden Quellenanweisung entsteht keine Autorität.

Diese Schnittstelle betrifft die Auftragsausführung. Ein Tutorial behält seinen eigenen vorhandenen Schrittstand und kann auf den vorhandenen Fortsetzungsweg verweisen; daraus folgt keine zweite Tutorialablage.

## Persönliche Aufgabe mit Erinnerung

„Lege mir die Aufgabe „Filter prüfen“ an und erinnere mich am 2035-10-22 um 09:00 in Europe/Berlin“ bindet zwei Schritte. Die Erkennung gilt für den getippten und den bewusst gesprochenen Auftrag. Fehlen Datum, Uhrzeit oder Zone, fragt die Karte gezielt danach und erzeugt bis zur Klärung keine Objekte. Bereits genannte Angaben bleiben im Formular erhalten. Die Zeitprüfung verwendet die vorhandene D-Vorschau.

Die persönliche Aufgabe entsteht über `/api/me/klara/aufgaben`. Der nächste Planschritt `erinnerung_anlegen` verwendet ausschließlich das tatsächliche Ergebnis dieser Aufgabe und `/api/me/klara/erinnerungen`, mit derselben stabilen Aktionskennung. Die Erinnerung verlinkt auf die Aufgabe und ist unter `/aufgaben?erinnerung=<id>` erreichbar. Nach verlorener Antwort wird zunächst das tatsächliche Original über den vorhandenen Vorgang gelesen. Die Erinnerungssteuerung und ihre Zustellung bleiben unverändert bei D; der Mehrschrittplan baut keinen Scheduler.

Eine offene Erinnerungszeit darf vor Ausführung unter einer neuen Auftragsfassung berichtigt werden. Die bereits gespeicherte Aufgabe bleibt unverändert. Das Anlegen von Aufgabe und Erinnerung wird hier ausdrücklich nicht als rücknehmbar ausgewiesen; beide bleiben an ihren vorhandenen Arbeitsorten veränderbar beziehungsweise löschbar.

## Nachweise und Grenzen

Gezielte Server-/Oberflächenprüfungen verwenden fiktive Konten. Die PostgreSQL-Prüfung beendet die App und den Pool, meldet sich in einer neuen Instanz neu an und führt echtes `pg_dump`/`pg_restore` in einer eigenen Wegwerfdatenbank aus. Die Chromium-Probe verwendet das gebaute React-Produkt und die echte Fastify-App über die vorhandene lokale Prüfvorrichtung. Dies ist kein Nachweis eines echten Mikrofons, Office-Hosts oder einer Liveveröffentlichung.

Dieser Kern liefert keine Beschaffungssuite, keinen Lieferantenkontakt und keine Kaufbefugnis. Die ursprünglichen Klara-17-Kriterien zum vollständigen Weg mit einer tatsächlichen gespeicherten Gesprächsnotiz, zur bewussten Wissensübernahme (F08) und zum Beschaffungsfall bleiben einzeln zu prüfen. Vorhandene positive Nachweise unveränderter Funktionen bleiben erhalten; Gesamtabschluss, unabhängige Prüfung, Integration und Veröffentlichung sind getrennte Schritte.
