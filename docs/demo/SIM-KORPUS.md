# SCRUM-501 — Demo-/Simulationskorpus DE/EN/NL (Begutachter-Vorführung)

Ein kuratierter Bestand realistischer Industrie-Wissensobjekte (Pumpen · Ventile · Wartung ·
Normen) in drei Sprachen, damit die Vorführung Substanz hat: Facetten, Untergruppen, Sprache,
Duplikat- und Konflikt-Erkennung arbeiten auf echtem Material.

## Inhalt (Datenquelle: `services/app/src/sim-corpus.ts`)

- **81 Wissensobjekte**: 28 DE · 27 EN · 26 NL (Ziel „~30 je Sprache" — ehrlich: knapp darunter,
  Erweiterung ist reine Datenpflege im selben Modul).
- Titel tragen das Sprach-Präfix `[DE]`/`[EN]`/`[NL]` — dieselbe Kennung, die die
  Bibliotheks-/Import-Facetten erkennen (Sprach-Filter funktioniert sofort).
- Ein deterministischer Teil ist **validiert mit Trust-Werten** (Substanz für Wissenskapital-
  Kachel, Reife-Filter, Status-Badges) — keine Zufallszahlen.
- **Gewollte Befunde** (Futter für Duplikat-/Konflikt-Erkennung, je Eintrag im Code kommentiert):
  - Cross-Sprach-DUPLIKATE: alle „Drillinge" (gleiche Aussage in DE/EN/NL), z. B. `p-entlueften-*`.
  - Sprachinterne nahe Dubletten: `p-entlueften-dublette-de`, `v-schieber-dublette-en`.
  - KONFLIKTE quer durch die Sprachen:
    - `p-nachlauf-de` (30 Min Nachlauf) ↔ `p-nachlauf-en` (10 Min) — Magnetkupplungspumpe MK-5.
    - `v-rueckschlag-de` (12 Monate) ↔ `v-rueckschlag-nl` (6 Monate) — Rückschlagventil RK-8.
    - `w-kette-de` (vor jeder Schicht) ↔ `w-kette-en` (alle 200 h) — Förderkette KF-2.

## Laden (NICHT automatisch)

Voraussetzung: laufendes Backend (`tools/localhost start`) und ein Admin-Konto.

```bash
KLARWERK_ADMIN_EMAIL=admin@example.com \
KLARWERK_ADMIN_PASSWORD=geheim \
tools/seed-sim-corpus
```

Alternativ direkt: `POST /api/admin/sim-corpus` (Recht `users.manage`). Antwort:
`{ seeded, created, validated, byLanguage }` — `seeded:false` heißt: Korpus war schon da,
NICHTS wurde dupliziert (Idempotenz über das Tag `sim-korpus`).

## Kennzeichnung + Entfernen

- Jedes Objekt trägt `demoSeed: true` (DEMO-Badge in der Oberfläche) und das Tag `sim-korpus`.
- KOMPLETT entfernen über den bestehenden Demo-Purge: `DELETE /api/admin/demo-seed`
  (Admin-Bereich „Demodaten entfernen") — er räumt alle demoSeed-Objekte ab, auch dieses Korpus.

## Ehrliche Grenzen

- Duplikat-/Konflikt-BEFUNDE entstehen nicht beim Seed, sondern über die normalen Erkennungswege
  (Validierung/Hintergrund) — das Korpus liefert das Material, keine vorgefertigten Urteile.
- Cross-Sprach-Duplikate erkennt die deterministische Textdeckung nur begrenzt (andere Sprache =
  wenig Wortdeckung); mit aktiver KI-Prüfung werden sie gefunden. Ohne KI bleiben vor allem die
  sprachinternen Dubletten sichtbar — ehrlich so vorgeführt.
