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
  - Ergebnisinhalte werden für höchstens 30 abgeschlossene Aufträge je Konto aufbewahrt. Ältere
    Einträge behalten Kennung, Fingerabdruck, Stand und Wirkungskennung (`gekuerzt`). Eine
    Wiederholung löst deshalb keine zweite Wirkung aus.
- **Ausführung nur der angezeigten Vorschau:** `POST /api/me/faehigkeiten/auftraege` verlangt
  `auftragId` und `vorschauFingerabdruck` aus der Vorschau. Weicht die neu gebildete Bindung ab
  (Vertrag, Adapterfassung, Eingabe, Datenweg, Kontextfassung), kommt 409 zurück und es entsteht
  keine Wirkung.
- **Unterschritte:** Vor jedem Unterschritt werden geprüft:
  - ein dauerhafter Abbruch,
  - die aktuelle Lage,
  - aktuelle Konto- und Kontextrechte samt gebundener Kontextfassung,
  - die tatsächlich weitergegebenen Daten gegen die Grenzen des Empfängers.
- **Abbruch:** Er wird dauerhaft im Auftrag vermerkt. Ein wartender Auftrag startet danach auch nach
  Neustart oder in einem anderen Prozess nicht mehr. Für diese Kennung ist der Abbruch endgültig.
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

## Reale Probe (AC10)

`tests/assistenz-faehigkeiten/echtprobe-wikipedia.ts` führt einen tatsächlichen Aufruf über den
integrierten Produktweg aus. Der Weg führt über die echte App, Anmeldung, Vorschau und die
bestätigte Ausführung von `wikipedia-suche` zum Adapter `external-search` mit Transport `echt` und
weiter zu de.wikipedia.org. Danach prüft die Probe:

- die Wirkung: Die zurückgegebene Originalquelle ist abrufbar und trägt ihren Titel,
- die Wiederholung: Derselbe Auftrag wird nicht doppelt ausgeführt,
- den Negativfall: Ist die externe Abfrage gesperrt, findet kein Aufruf statt.

Die Probe gibt einen JSON-Beleg aus. Sie sendet nur, wenn `KLARWERK_FAEHIGKEIT_ECHTPROBE=freigegeben`
gesetzt ist und `EXTERNAL_SEARCH` nicht `off` ist. Vitest und das Smoke-Tor sind bewusst hermetisch
(`EXTERNAL_SEARCH=off`); dort meldet sie die fehlende Voraussetzung ohne Netzanfrage.

```
KLARWERK_FAEHIGKEIT_ECHTPROBE=freigegeben KLARWERK_KANDIDAT=<commit> KLARWERK_SKIP_KEYCHAIN=1 \
  npx tsx tests/assistenz-faehigkeiten/echtprobe-wikipedia.ts
```

Exitcodes: 0 heißt durchgeführt, 2 heißt Voraussetzung fehlt, 1 heißt fehlgeschlagen.

## Offene Voraussetzungen (nicht durch Code ersetzbar)

- **O09:** Für Perplexity fehlen Anbieterfreigabe, belegte Kosten je Aufruf und Budgetzuordnung.
  Außerdem fehlt ein sicherer Betreiberweg für den Zugang. Bis dahin liefert
  `KEINE_ZUGAENGE` keinen Wert.
- **Realer Aufruf:** Ein Aufruf mit Transport `echt` an Kandidat und Host ist nicht belegt.
  Ersatztransport, Registrierung und Installation zählen nicht als Funktionsnachweis.
- **Postgres-Pfad:** Der Pfad der Profilablage (`PgAssistenzProfilRepo.schreibeFaehigkeitsauftraege`)
  ist nicht integrationsgeprüft.
