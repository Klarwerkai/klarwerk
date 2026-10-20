# Sprachbedienbarer Lesekiosk (R-1648)

Original: `aufnahme:20260922:gesamt-kiosk`, Revision 2, beide Originalkriterien bleiben offen bis zur vollständigen Lieferung. Quellenpunkt R-1648 / ROADMAP:7.2 beschreibt ein Tablet an der Maschine, Sprache ohne Tastatur und ein anonymes Leseprofil. Die historischen Empfehlungen „später“ vom 05.09.2026 sowie der Aufnahmevermerk vom 16.10.2026 sind erhalten; der konkrete Auftrag vom 20.10.2026 trägt diese Umsetzung.

## Technischer Teil

Direkter Einstieg `/kiosk`, ohne Arbeitsnavigation, Schreib-, Freigabe-, Helpful-, Import- oder Kalenderaktionen. Ein bewusster Start aktiviert die Browser-Sprachbedienung. Eine endgültig erkannte Frage startet die Abfrage automatisch; die Antwort einschließlich des kanonischen Prüfvorbehalts wird automatisch vorgelesen. Danach wird die nächste Frage angenommen. „Noch einmal“/„again“/„opnieuw“ wiederholt die letzte Antwort, „stopp“/„stop“ beendet die Bedienung. Während Abruf und Sprachausgabe bleibt das Mikrofon ausgeschaltet. Stop und Abbau verwerfen verspätete Antworten und lösen die Aufnahme. Ein verspätetes Ende einer alten Sprachausgabe kann keine neue Aufnahme starten.

Der vorhandene Rekorder (`makeRec`), Sprachwahl, Vorlesehaken und Quellen-/Rechteweg werden wiederverwendet. Die neue HTTP-Route ist ein enger Adapter am vorhandenen `antwortLauf`/`AskService`, keine weitere Antwortengine. Sie verwendet ausschließlich validierte, nicht vertrauliche Quellen, deterministisches Retrieval und `gapPolicy: count_only`. Keine Lücke, Fachänderung oder neue Aufgabe entsteht aus einer gesprochenen Anweisung. Die regulären Antwortbelege und das vorhandene Metadaten-Audit bleiben Bestandteil des Fragewegs; „Lesekonsole“ behauptet keine vollkommen schreibfreie Infrastruktur.

## Geschlossene Installationsbindung

`buildApp` kann optional `kioskProfil` als serverseitige Quelle erhalten. Ohne Quelle, bei Fehler, fehlendem Freigabebeleg, leerem/fehlerhaftem Umfang, Ablauf, falschem Konto oder ungültiger Revision bleibt der Kiosk geschlossen. Die Installation benennt ausschließlich bestehendes Lesekonto, Quellenkennungen mit exakten Fassungen, Profilkennung/-revision, Freigabebeleg und Ablauf. Der Callback ist kein HTTP-Administrationsweg und provisioniert weder Konto noch Rechte. Die bestehenden Sitzungs-, Rollen-, Space-, Quellrechte- und Vertraulichkeitsregeln gelten zusätzlich. Nach der Verarbeitung werden Anmeldung, Profilbindung und aktuelle Quellrechte nochmals geprüft.

`GET /api/kiosk/profil` liefert nur die Profilkennung und Revision für die berechtigte bestehende Sitzung. `POST /api/kiosk/fragen` akzeptiert ausschließlich `question`, `locale` (`de/en/nl`), `profilId`, `revision`; unbekannte Felder werden vor der Schema-Normalisierung abgewiesen. Datenantworten tragen `Cache-Control: no-store`. Auf der Oberfläche gibt es keinen lokalen Verlauf oder dauerhaften Inhaltsspeicher. Der bestehende Rechtekontextwechsel löscht den sichtbaren Inhalt.

Der reguläre Server bindet derzeit **kein** Betriebsprofil ein. Auch ein als „anonym“ bezeichnetes Callback-Profil wird abgewiesen. Die anonyme Oberfläche ist erreichbar, der Inhaltszugang bleibt geschlossen. Die Fiktion in den Prüfungen erteilt keine Installationsfreigabe. Ein anonymes Profil darf erst mit belegtem erlaubtem Umfang und legitimem bestehenden Zugang eingebunden werden; es ersetzt keine Anmeldung und keine Quellrechte. Es wurden keine Konten, Rollen, Zugangsdaten oder Provider dafür beschafft.

## Beleggrenzen und nächste Schritte

Die HTTP-Prüfungen verwenden die echte App und normale Anmeldung/Anlage/Bewertung auf fiktivem InMemory-Bestand. Die gemounteten Sprachtests verwenden kontrollierte Browseradapter. Die gezielte Chromium-Probe prüft echte Browserbedienung und Layout gegen synthetische API-/Sprachdaten. Diese Nachweise belegen keine echte Mikrofonerkennung, hörbare Ausgabe, Tablet-/iPad-Bedienung, native App, Office, PostgreSQL-Persistenz oder Liveinstallation.

Die vorhandene Spracherkennung sperrt iOS bewusst als nicht unterstützt (`speechSupport.ts`). Damit ist ein iPad-Ziel heute nicht belegt. Fehlende Browser-Sprachfähigkeit und Mikrofonablehnung werden angezeigt; es wird kein zusätzlicher Audio-/Providerweg eingebaut. Browserabhängige Erstaktivierung und Berechtigungen können nicht durch eine Weboberfläche beseitigt werden. Dark-Systempräferenz allein belegt keinen vollständigen dunklen Plattformmodus; die Oberfläche erbt die vorhandenen Anwendungstokens.

Offen bleiben: zulässiger anonymer Profilumfang und legitime Installationsbindung, echte geeignete Tablet-/Mikrofon-/Lautsprecherprobe einschließlich Erkennungsqualität, Host-/Screenreader-/vollständige Hell-Dunkel-Abnahme (UI-06/UI-08), unabhängige Prüfung sowie Integration/Version/Veröffentlichung durch die Führung. Bestehende A–I-, D/G-, Aufgaben-/Beschaffungs- und Office-Aufträge bleiben gesondert. Die vorhandenen Einzelbelege werden nicht durch eine neue Gesamtabnahme ersetzt.
