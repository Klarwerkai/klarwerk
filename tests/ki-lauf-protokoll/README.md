# KI-Laufprotokoll — Abgleich der Aufnahme `gesamt-ki-laufprotokoll`

Auftrag `aufnahme:20260922:gesamt-ki-laufprotokoll`, Lauf 1 Runde 1, Basis `e6e4bf16`
(1.0.0-beta.1.638), Stand 01.10.2026. Abgleich am Code dieser Basis; Fassungen sind die
Ship-Commits, in denen die Lieferung zuerst stand.

## Gelieferter Stand (wiederverwendet, nicht neu gebaut)

| Teil | Lieferung | Fassung | Beleg |
|---|---|---|---|
| Protokoll v1, nur Metadaten (Aufgabe, Anbieter, Erfolg/Fehler, Ersatzmodus `fallback`, `demo`, Start/Ende) | SCRUM-164/167 | `7feb10ae`, `bbdb74e7` (26.06.) | `services/model-runs/src/types.ts`, `services/model-runs/src/*.test.ts` |
| Laufkontext nur als Kennungen (`actor`, `subject` = KO) | mega26 Block A | `5150cd5a` | `sanitizeModelRunContext` in `types.ts` |
| Echter Modellname statt zweimal Anbieter | JOB 3036 | 1.0.0-beta.1.50 | `tests/ki-lauf-modell/` |
| Modell und Dauer je Lauf in der KI-Übersicht | JOB 3044 | 1.0.0-beta.1.68 | `tests/ki-lauf-dauer/` |
| Acht Aufgabenarten in der Karte, unbekannte Art als Satz (DE/EN/NL) | JOB 3069 | 1.0.0-beta.1.81 | `tests/ki-aufgabenarten/` |
| Tokenverbrauch je Lauf, auch bei Fehlversuchen, ohne Preis (V9 Scheibe 3) | JOB 3074 | 1.0.0-beta.1.88 | `tests/ki-lauf-verbrauch/` |
| MR-SELECT-1: Import-Auswahl (`POST /api/admin/import/confluence/select`) schreibt je echter Anfrage genau einen `select`-Lauf | JOB 3127 | 1.0.0-beta.1.140 | `tests/select-lauf-protokoll/` |
| Gescheiterte Ausweichversuche stehen im Datensatz des Laufs (Anbieter, Modell, Grund) | JOB 3276 | 1.0.0-beta.1.202 | `Reasoner.versuchsfehlerZeile`, `tests/ki-assist-leer/` |

## In diesem Lauf geschlossen

- **`ModelCapacityError` (R-1572, R-1621):** Ein Lauf in `runTask`, der an der Modell-Auslastung
  endet, schrieb keinen Datensatz, auch wenn ein früheres Glied bereits bezahlten Verbrauch
  gemeldet hatte. Jetzt entsteht genau ein `error`-Datensatz: Glied, an dem er stand, bisher
  gesammelter Verbrauch, zuletzt wirklich gerufenes Modell, Versuchsfehler samt
  Auslastungsmeldung. Die 503 bleibt unverändert, auch wenn das Protokoll nicht schreiben kann.
  Beleg: `kapazitaet-hinterlaesst-spur.test.ts` K1–K3 (Gegenprobe ohne die Änderung: K1/K2 rot).
  Ausgenommen bleiben die Kapazitätsfälle der Wege ohne Protokoll (siehe unten).

## Offen, mit Grund

- **Preis/Kosten je Lauf und Summe je Zeitraum (V9, R-0705, R-0759, R-0833):** nicht gebaut.
  Es gibt keine Preisliste je Modell. MR-SELECT-1 schließt eine Preisentscheidung aus.
  **Entscheidung Pedi nötig** (Preisquelle, Stand, Währung). Danach ist das eine
  Anzeigeberechnung auf `verbrauch` + `model`.
- **Nicht protokollierte KI-Wege (R-0612 „jeder Aufruf"):** `judgeConflictOutcome` /
  `judgeDuplicateOutcome` (Konflikt- und Dublettenprüfung, KI-Prüflauf, Textprüfung),
  `enrichPublic` (öffentliche Anreicherung) und die Admin-Proben `probe`/`probeLocal` schreiben
  keinen `ModelRunRecord`. Dafür wären neue Aufgabenarten nötig, samt Karte, Sprachmatrix und
  KI-Kennzeichnung (`KI_ERZEUGENDE_AUFGABEN`). Das ist eine eigene Lieferung und hier nicht gebaut.
- **Erzeugte Gegenstände (R-0759, R-1984):** `subject` kennt nur `kind: "ko"`. Was ein Lauf
  erzeugt hat (Entwurf, Vorschlag, Gruppe), steht nicht im Datensatz.
- **Dashboards/Metriken/Tracing (R-2071):** Es gibt die Liste `GET /api/model-runs?limit=` und die
  KI-Übersicht (`Stufe2.tsx`, ModelRunsCard). Zeitraumfilter, Metrik-Export und Dashboards gibt es nicht.
- **Anzeige des Fehlergrunds:** `error` (auch die Versuchsfehlerzeile) steht im Datensatz und in
  der API, die Laufkarte zeigt ihn nicht.
- **Nicht geprüft (R-1536, R-1544, R-1567):** echte Anbieter-API, Schlüsselbund,
  PostgreSQL-Persistenz (`repo-pg.ts`), Browserlayout der Karte, Tastaturzugang zur Laufkarte im
  Browser, „unbekannte Live-Art“, vollständige Karten-Zustandsmatrix, Klärung
  OpenAI-400/`model-error` (N12d). In diesem Lauf wurde nichts davon ausgeführt.

## Quellenwidersprüche

- „Modellläufe werden nicht protokolliert“ (Register, zeitweise): durch SCRUM-164 (26.06.)
  überholt. Unvollständig ist das Protokoll trotzdem (siehe nicht protokollierte Wege).
- „select rechnet grundsätzlich ohne Modell“ (`types.ts` am Feld `model`, `Reasoner.select`):
  gilt nur für das synchrone Keyword-Ranking `Reasoner.select`. Dafür gibt es keinen produktiven
  Aufrufer. Der produktive `select`-Weg ist `deriveImportCriteria` (JOB 3127) und befragt ein
  echtes Modell.
- R-1567 nennt sechs Fallback-Läufe. Sie sind keine KI-Abnahme. Eine Abnahme mit echtem Modell
  fehlt weiterhin.
