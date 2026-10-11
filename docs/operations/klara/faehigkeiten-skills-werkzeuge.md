# Assistenzfähigkeiten: Skills und Werkzeuge (BPA-11)

Auftrag `produkt:20261011:assistenz-skills-werkzeuge` · Code `services/app/src/assistenz-faehigkeiten.ts`
· Agentenprüfung `tests/assistenz-faehigkeiten/faehigkeiten.test.ts`

## Was es gibt

- **Registry** (`Faehigkeitsregistry`): nur geprüfte, versionierte Verträge (Zweck, Datenempfänger,
  Wirkung, erlaubte Aktionen, Eingaben, Ergebnisform, Schutzstufengrenze, Treffer-/Zeit-/Kostengrenze,
  Budgetzuordnung, Zugangsname, Rücknahme, Unterschritte). Aktionen außerhalb von
  `netz_anfrage_anbieter`, `wissen_lesen`, `entwurf_anlegen` werden abgewiesen.
- **Adapterinstallation** ist ein eigener administrativer Schritt (`installiereAdapter`) und gilt nur
  für die exakt gleiche Vertragsfassung. Ein geänderter Vertrag verliert seinen Adapter.
- **SKILL.md** wird nur als Ablage gelesen (`nimmSkillDateiAuf`): Name/Beschreibung/Fassung und eine
  Liste erkannter, ignorierter Anweisungen. Daraus entsteht keine Fähigkeit.
- **Auswahl** nach Zweck; eine ausdrücklich gewählte Fähigkeit läuft oder wird mit konkreten
  Voraussetzungen als unverfügbar erklärt. Ein stiller Wechsel findet nicht statt.
- **Bindung vor Ausführung** (`bereiteVor`) und erneute Prüfung beim Lauf (`fuehreAus`), auch für
  Hintergrundjobs und jeden deklarierten Unterschritt: „Keine KI“, Freigabe der externen
  Wissensabfrage, Anbieterfreigabe, geschützter Arbeitsbereichsinhalt in der Eingabe, Zugang, Budget.
- **Idempotenz** über die Auftragskennung; Fehler/Teilresultat werden nie als Erfolg gemeldet.
- **Favoriten/Routinen** im vorhandenen Assistenzprofil (`assistenz_profile.data.faehigkeiten`).

## Produktverträge

| Fähigkeit | Empfänger | Adapter | Stand |
|---|---|---|---|
| `wikipedia-suche` 1.0.0 | Wikimedia (vorhandener external-search-Weg) | `suchAdapter(WIKIPEDIA_SUCHE, createWikipediaProvider(), "echt")` | im Code nutzbar, nicht im Server verdrahtet |
| `perplexity-suche` 1.0.0 | Perplexity Search API | `perplexitySuchAdapter()` | Kosten je Aufruf und Budget sind nicht belegt; deshalb startet kein Aufruf |

## Offene Voraussetzungen (nicht durch Code ersetzbar)

- O09: Freigabe von Perplexity als Anbieter, belegte Kosten je Aufruf und Budgetzuordnung. Ein
  Zugang `PERPLEXITY_API_KEY` darf nur über die sichere Betreiber-Einspeisung kommen.
- Anbindung von Registry und Ausführung an Server, Oberfläche und vorhandenen Job-/Aktionsweg.
  Dazu gehören die `LageQuelle` aus KI-Abschaltung, externer Wissensabfrage und P04-Freigaben sowie
  eine dauerhafte Ablage statt `InMemoryFaehigkeitsAblage`.
- Ein realer Aufruf mit Transport `echt` ist als Probe noch nicht belegt. Ersatztransport, Stub,
  Registrierung und Installation zählen nicht als Funktionsnachweis.
