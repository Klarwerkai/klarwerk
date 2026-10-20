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

## Gespeicherte eigene Gesprächsnotiz als Quelle

„Aus der Gesprächsnotiz „Wartung“: Lege mir die Aufgabe „Filter prüfen“ an und erinnere mich am 2035-10-22 um 09:00 in Europe/Berlin“ löst nur eine tatsächlich gespeicherte eigene Gesprächsnotiz auf. Mehrere passende Notizen brauchen eine bewusste Auswahl. Bis zur Klärung wird nichts angelegt. Der Quellinhalt wird nicht als zusätzlicher Auftrag erkannt.

Der Plan bindet Notizkennung, Fassung und die vom Server gelesene Gesprächs-/Nachrichtenherkunft. Titel oder Herkunft aus dem Client ersetzen diesen Beleg nicht. Vor jeder abhängigen Produktänderung liest der vorhandene authentifizierte Notizweg die heutige Quelle. Nach diesem Readback wird der aktuelle Auftrag nochmals auf Stopp und Auftragsgrenze geprüft. Die Aufgabe verwendet den vorhandenen `weg: notiz`, übernimmt den tatsächlichen gespeicherten Notizinhalt und erhält dessen Rücklink. Der optionale Vergleich `notizFassung` am Aufgabenport weist eine dort inzwischen geänderte Quelle vor der Anlage ab. Alte Aufgabenaufrufe bleiben gültig.

Die Karte zeigt die gebundene Fassung und kann das aktuelle Original mit Rücklink zum ursprünglichen Gesprächskontext lesen. Änderungen, Löschung oder fehlendes aktuelles Leserecht stoppen künftige abhängige Schritte. Bereits fertige Ergebnisse bleiben erreichbar; ein verlorener tatsächlicher Erfolg kann auch nach Stopp oder Quellenwechsel noch über seine ursprüngliche Vorgangskennung nachgelesen werden. Eine geänderte Quelle wird nur mit einem neuen ausdrücklichen Auftrag verwendet, nicht still in den alten Plan eingesetzt.

## Private Notiz bewusst als fachlich offenen Artikel übernehmen

Die vorhandene F08-Zielwahl mit Sichtbarkeit, Kategorie, Bedingungen, Space und gegebenenfalls Vorlage bleibt der einzige Übernahmeweg. Ihr Endknopf „Bewusst als Wissen übernehmen“ übergibt die tatsächlich gesehene Vorschau an denselben persistenten G-Auftragskern. Die Auftragskarte zeigt Fortschritt, Stop und tatsächliches Ergebnis; sie steht im Gespräch beziehungsweise am geöffneten Original in „Meine Funktionen“. Es gibt keinen zusätzlichen Bestätigungsdialog und keine automatische Übernahme aus Quelltext.

Der gebundene Schritt `wissen_uebernehmen` enthält nur eigene private `notizId`, `fassung`, tatsächlich gewähltes F08-`ziel`, den gesehenen `stempel` und `bewusst: true`. Die Auftragsgrenze erlaubt diese eigene Quelle ausdrücklich. Vor Bindung und vor neuer Fachwirkung wird dieselbe vorhandene F08-Vorschau authentifiziert erneut geprüft; nach ihrem await gelten außerdem der heutige Routinenprüfer und der frische G-Stop-/Grenzreadback. Die eigentliche Anlage geht ausschließlich an den bestehenden F08-Übernahmeport. Dieser prüft Quelle, Fassung, Zielrechte und Stempel nochmals am tatsächlichen Fachweg.

Die normale F08-Vorgangsidentität wird gemeinsam aus derselben exportierten Funktion verwendet. Ein unbekannter Ausgang wird über den vorhandenen berechtigt sichtbaren Wissensbestand mit Vorgangskennung, eigenem Actor, gesehenem Fingerprint und gewähltem Ziel gelesen. Ein begonnenes unbestätigtes Ergebnis ohne lesbares Original bleibt unklar und erzeugt keinen zweiten Übernahmeaufruf. Das gilt auch nach einer Fehlerantwort, die nach einem tatsächlichen Insert eintreffen kann. Bereits eigenständig übernommenes Wissen bleibt nach Privatlöschung oder Stop als echtes Original nachlesbar; es wird nicht aus neuer privater Quelle neu kopiert.

Das Ergebnis ist ein tatsächlich angelegter fachlich offener Beitrag, keine behauptete fachliche Freigabe. Die private Notiz bleibt privat. Änderungen und Löschung des eigenständigen Beitrags folgen dem bestehenden Wissensweg; die Auftragskarte verspricht keine pauschale Rücknahme.

## Vorhandener Port für eigene geschriebene Originalnotizen

Der serverseitige persönliche Aufgabenschritt darf zusätzlich ausdrücklich `notizQuelle: {id, fassung, weg: "geschrieben"}` binden. `id` und `fassung` müssen die tatsächlich gespeicherte eigene Notiz bezeichnen. Das authentifizierte `GET /api/me/klara/notizen/:id` liest die heutige Quelle und bestätigt genau `weg: geschrieben`. Die Bindung enthält danach nur reale Kennung, Fassung, Titel und Weg; keine Gesprächs-/Nachrichtenkennung und keine behauptete menschliche Autorenschaft. Das vorhandene Gespräch ist hier ausschließlich der Journalcontainer des Auftrags.

Der Port bleibt `POST /api/me/klara/gespraeche/:id/auftraege` mit `erlaubteQuellen: ["notiz:<id>"]`, persönlicher Aufgabenaktion und vorhandenem begrenztem Plan. Die Ausführung bleibt `POST .../auftraege/:auftragId/schritte/:schluessel/ausfuehrung` mit `{nr, auftragFassung}`. Aufgabe und Ergebniskennung entstehen über dieselben bestehenden Wege wie beim Gesprächsnotizauftrag. Eine Normannahme, Bekanntmachungserkennung oder neue Workflowverwaltung ist damit nicht implementiert.

Für echte Gesprächsnotizen bleiben reale Gesprächs- und Nachrichtenherkunft zwingend. Alte gespeicherte795-Bindungen ohne `weg` meinen ausschließlich diesen strengen Gesprächsfall. Neue Bindungen lesen und speichern `weg: gespraech` ausdrücklich. Andere Notizherkünfte wie `diktiert` oder `ausschnitt` werden nicht pauschal freigegeben. Die Browsererkennung „Aus der Gesprächsnotiz …“ bleibt auf Gesprächsnotizen beschränkt; der geschriebene Port ist ein expliziter Serveranschluss.

Heutiges Eigentum/Leserecht, Fassung, Auftragsgrenze und Stopp werden vor weiteren Wirkungen unverändert geprüft. Ein bereits begonnener Notiz-Anlageversuch ohne lesbares Original bleibt unklar. Ein fehlender oder verweigerter Ergebnis-GET begründet keine erneute Anlage. Wird das tatsächliche Original später lesbar, darf derselbe Schritt es auch nach Stopp oder Quellenänderung nachlesen und markieren; dadurch entsteht keine neue Fachwirkung. Die bestehende Journal-Schreibmarke bleibt von einem neuen Produkt-POST getrennt.

## Nachweise und Grenzen

Gezielte Server-/Oberflächenprüfungen verwenden fiktive Konten. Die PostgreSQL-Prüfung beendet die App und den Pool, meldet sich in einer neuen Instanz neu an und führt echtes `pg_dump`/`pg_restore` in einer eigenen Wegwerfdatenbank aus. Die Chromium-Probe verwendet das gebaute React-Produkt und die echte Fastify-App über die vorhandene lokale Prüfvorrichtung. Dies ist kein Nachweis eines echten Mikrofons, Office-Hosts oder einer Liveveröffentlichung.

Dieser Kern liefert keine Beschaffungssuite, keinen Lieferantenkontakt und keine Kaufbefugnis. Der gespeicherte eigene Gesprächsnotizweg ist gezielt über API, echten App-/Poolneustart mit neuer Anmeldung in PostgreSQL und Chromium geprüft. Der kontrollierte 403-Fall prüft die G-Reaktion an der vorhandenen Notizlesetür; er ersetzt keinen zusätzlichen F08-Rechtetest. Der neue bewusste F08-Auftragsanschluss ergänzt den privaten Notizweg technisch; seine eigene unabhängige Prüfung und Bereitstellung bleiben getrennt. Der ursprüngliche vollständige Beschaffungsfall bleibt offen. Vorhandene positive Nachweise unveränderter Funktionen bleiben erhalten; Gesamtabschluss, unabhängige Prüfung, Integration und Veröffentlichung sind getrennte Schritte.
