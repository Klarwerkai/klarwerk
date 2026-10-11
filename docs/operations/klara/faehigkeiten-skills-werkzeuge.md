# Assistenzfähigkeiten: Skills und Werkzeuge (BPA-11)

Auftrag `produkt:20261011:assistenz-skills-werkzeuge`

| Teil | Datei |
|---|---|
| Vertrag, Registry, Auswahl, Bindung, Ausführung, Ablage | `services/app/src/assistenz-faehigkeiten.ts` |
| Anbindung an die vorhandenen Dienste | `services/app/src/assistenz-faehigkeiten-anbindung.ts` |
| HTTP-Wege | `services/app/src/routes/assistenz-faehigkeiten-routes.ts` |
| Oberfläche | `apps/web/src/components/assistenz/FaehigkeitenBereich.tsx` (unter „Meine Assistenz“) |
| Wiederaufnahme nach Start | `services/app/src/server.ts` |

## Was es gibt

- **Registry:** Es gibt nur geprüfte, versionierte Verträge. Aktionen außerhalb von
  `netz_anfrage_anbieter`, `wissen_lesen` und `entwurf_anlegen` werden abgewiesen.
  Die Adapterinstallation ist ein eigener administrativer Schritt. Sie gilt nur für genau
  dieselbe Vertragsfassung.
- **SKILL.md** wird nur als Ablage gelesen und wird nie ausgeführt.
- **Lage bei jedem Schritt:** Sie wird bei jedem Schritt neu gelesen, auch im Hintergrund und in
  Unterschritten.
  - „Keine KI“ kommt aus `reasoner.kiAbschaltung()`.
  - Die Vertraulich-Freigabe kommt aus `reasoner.vertraulicheAusleitungFreigegeben()`.
  - Die externe Wissensabfrage kommt aus `external_knowledge_policy`.
  - Anbieterfreigabe: Nur `wikimedia` ist durch diese Stufe freigegeben. Perplexity hat keine
    Freigabe.
- **Rechte (G04/G05):** Sie werden vor jeder Ausführung und vor jeder Rückgabe eines gespeicherten
  Ergebnisses geprüft.
  - Das Konto muss freigegeben sein und `ko.read` haben.
  - Jedes gebundene Kontextobjekt wird über `darfSehen` geprüft.
  - Vor der Ausführung muss außerdem die gebundene Kontextfassung noch gelten.
  - Ein entzogenes Recht sperrt den Ergebnisinhalt, ohne die Wirkung zu wiederholen.
- **Dauerhafte Aufträge:** Sie liegen im vorhandenen Assistenzprofil
  (`assistenz_profile.data.faehigkeitsAuftraege`). Das ist kein zweiter Auftragsspeicher (G03).
  - Schreiben läuft nur als Vergleich-und-Tausch auf die Liste.
  - Die Profilfassung bleibt unverändert, Name und Motiv bleiben also ohne 409 änderbar.
  - Höchstens 30 abgeschlossene Aufträge je Konto werden aufbewahrt.
- **Wiederanlauf:** Der Server nimmt wartende Aufträge und Läufe eines anderen Prozesses, die
  älter als 15 Minuten sind, beim Start und im Sweep-Takt wieder auf.
  - Die Auftragskennung ist zugleich die Wirkungsidentität: Ein schreibender Adapter erhält sie
    als Idempotenzschlüssel.
  - Im Wiederanlauf-Modus nach einem Restore läuft nichts.

## Produktverträge in dieser Instanz

| Fähigkeit | Empfänger | Adapter |
|---|---|---|
| `wikipedia-suche` 1.0.0 | Wikimedia | Vorhandener `external-search`-Weg, wenn er nicht mit `EXTERNAL_SEARCH=off` abgeschaltet ist |
| `perplexity-suche` 1.0.0 | Perplexity Search API | Nicht installiert |

## Offene Voraussetzungen (nicht durch Code ersetzbar)

- **O09:** Für Perplexity fehlen Anbieterfreigabe, belegte Kosten je Aufruf und Budgetzuordnung.
  Außerdem fehlt ein sicherer Betreiberweg für den Zugang. Bis dahin liefert
  `KEINE_ZUGAENGE` keinen Wert.
- **Realer Aufruf:** Ein Aufruf mit Transport `echt` an Kandidat und Host ist nicht belegt.
  Ersatztransport, Registrierung und Installation zählen nicht als Funktionsnachweis.
- **Postgres-Pfad:** Der Pfad der Profilablage (`PgAssistenzProfilRepo.schreibeFaehigkeitsauftraege`)
  ist nicht integrationsgeprüft.
