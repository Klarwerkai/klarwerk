# Spaces verwalten — Übersicht, Zugriff, Regeln, Archiv, Bestand

Auftrag `produkt:20261007:spaces:admin-20261009` (ADMIN-07). Grundlage: Spaces (`produkt:20261007:spaces`)
und Teams (`produkt:20261009:admin-teams`, [teams.md](teams.md)). Code: `services/app/src/spaces.ts`,
`services/app/src/space-verwaltung.ts`, `services/app/src/routes/spaces-routes.ts`; Oberfläche
`apps/web/src/pages/Spaces.tsx` und `apps/web/src/components/SpaceVerwaltung.tsx` (`/spaces`).

Das Modell bleibt: ein Artikel hat höchstens **einen führenden Space**; Tags und gespeicherte
Ansichten zeigen **dasselbe Objekt** (Kennung, Fassung) an weiteren Stellen. Keine Ordnerhierarchie.

## Übersicht (`/spaces`)

- Je Space: Name, Zweck, Spacezuständigkeit, Mitgliederzahl (direkt und über Teams, je Person
  einmal), Status (aktiv/archiviert), optionale Gruppe, Spaceregeln, Zugang, eigenes Recht.
- Suche über Name, Zweck, Zuständigkeit, Gruppe und Regeln; Filter nach Status (Vorgabe: aktiv),
  Zugang und Gruppe; optional nach Gruppe gegliedert. Die Filter stehen in der Adresse und
  überleben Neuladen und Rückweg.
- Die Marke „Space · Wissensbereich" und der Hinweis über der Liste unterscheiden einen Space von
  Funktionsseiten (Suche, Prüfung, Verwaltung).
- **Gruppe** ist ein flaches Etikett (ohne „/"), kein Elternordner: sie trägt keine Rechte und
  keine Inhalte.
- **Spaceregeln** sind die Arbeitsregeln in Worten (was hineingehört, wer pflegt). Rechte stehen
  nicht dort, sondern in Zugang, Mitgliedern und Teams.

## Zugriff und Herkunft (Detailseite, `GET /api/spaces/:id/zugriff`)

Je Person mit benanntem Weg: **zuständig**, **direkt** (Recht), **über Team X** (Recht) — jeder Weg
einzeln — und die Wirkung zusammen (zuständig / liest und schreibt / liest). Beim offenen Zugang
wird nur die Zahl weiterer Leser genannt, keine Kontoliste. Die globale Rolle ist kein Weg zu
Inhalten (kein Admin-Durchgriff). Sichtbar für alle, die den Space sehen; sonst 404.

## Spacewechsel

Die bestehende Rechtevorschau nennt zusätzlich die **Regeln vorher und nachher** (Zugang,
Spacezuständigkeit, Spaceregeln). Übernommen wird weiter nur mit der Grundlage dieser Vorschau;
Fassung, Historie, Autorschaft, Artikelverantwortung, Beziehungen und Kennung bleiben.

## Archivieren und Wiederaufnehmen

Recht: Spacezuständige oder Kontoverwaltung (`users.manage`).

1. `POST /api/spaces/:id/archivierung/vorschau` — Folgen ohne Schreiben:
   - **Lesen bleibt** für alle bisherigen Leser (Zahl).
   - **Schreiben entfällt** für die genannten Personen: nichts wird hinein- oder herausbewegt,
     der Space wird nicht gepflegt (Bearbeiten → 409 `SPACE_ARCHIVIERT`), er ist kein Ziel mehr.
   - **Offene Aufgaben**: Artikel mit Status „offen" (Titel nur, wo der Betrachter sie sehen darf).
   - **Offene Verantwortungsfragen** sperren das Archivieren: Spacezuständigkeit ohne aktives Konto,
     Artikelverantwortung ohne aktives Konto, Artikelverantwortung ohne Zugang zum Space.
2. `POST /api/spaces/:id/archivieren` mit `version`, `grundlage` der Vorschau und **Begründung**.
   Veraltete Vorschau → 409 `VORSCHAU_VERALTET` mit neuen Folgen; offene Verantwortung → 409
   `OFFENE_VERANTWORTUNG`.
3. Der archivierte Space verschwindet nicht: er steht in der Übersicht (Filter „Archiviert"), im
   Detail mit Hinweis und im Verlauf mit Vorgang und Begründung.
4. `POST /api/spaces/:id/wiederaufnehmen` mit `version` und Begründung — Mitglieder, Teams und
   Regeln gelten wieder wie zuvor.

Jede Änderung ist eine neue Fassung in `spaces_fassungen` (rein additiv, kein Schemawechsel: Status,
Vorgang und Begründung stehen in der Fassung). Prüfprotokoll: `space.archiviert`,
`space.wiederaufgenommen`; `space.geaendert` nennt zusätzlich `regelnGeaendert`.

## Bestandszuordnung (nur Kontoverwaltung)

Vorhandene Artikel **ohne Space** erhalten per Regel „Tag → Zielspace" einen führenden Space.

- `POST /api/spaces/bestand/vorschau` — **Bilanz**: gesamt, bereits zugeordnet, ohne Space, davon
  zuordenbar / Ausnahmen / ohne passende Regel (bleiben unverändert).
- Übernommen wird nur, was **niemandem mehr Sicht gibt als vorher** und bei dem Autor und
  Artikelverantwortung den Zugang behalten. Sonst eine benannte **Ausnahme**: `mehrdeutig`
  (mehrere Zielspaces), `erweitert`, `autor_verliert`, `verantwortung_verliert`, `verwaist`
  (Artikel nennt einen unbekannten Space). Artikel mit Space werden nie umgehängt; archivierte
  Zielspaces sind abgelehnt.
- `POST /api/spaces/bestand/zuordnung` mit derselben `grundlage` — sonst 409 mit neuer Bilanz.
  Jede Zuordnung läuft über den bestehenden Spacewechsel (`ko.space-changed` je Artikel).
- `GET /api/spaces/bestand/protokoll` — die dokumentierten Läufe (`space.bestand-zugeordnet`):
  Regeln, Bilanz, zugeordnete Kennungen, Ausnahmen, Fehlschläge. Nur Kennungen und Zahlen, keine
  Titel. Titel nicht einsehbarer Artikel erscheinen auch in der Bilanz nicht.

## Auskunftsgrenze

Unberechtigte bekommen über Suche, direkten Link (404), Anhänge, Vorschau-/Folgenauskunft,
Bestandsbilanz und **Export** (`GET /api/library/export`, alle Formate — jetzt zusätzlich über
`darfSehen` des Betrachters) weder Inhalte noch geschützte Titel.

## Grenzen

- Kein Zeitplan für Archivierung, keine Massenarchivierung, keine Ordnerhierarchie.
- Die Bestandszuordnung kennt nur Tag-Regeln; andere Kriterien (Kategorie, Quelle) sind nicht Teil
  dieses Auftrags.
- Ein archivierter Space sperrt das Verschieben; die Bearbeitung des Artikelinhalts folgt weiter
  den Artikelrechten.
