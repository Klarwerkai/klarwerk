# Probe-Importe für den Admin-Upload-/Lösch-Test (SCRUM-487 / SCRUM-494)

Fertige `ImportItem[]`-JSON-Dateien für Pedis manuellen Test: hochladen → Erkennung beobachten →
löschen. **Garantiert schemakonform** — abgeleitet aus `services/app/src/demo-corpus.ts`
(`corpusImportItems()`) und gegen den echten Upload-Parser `apps/web/src/lib/importReview.ts`
(`parseImportItems`) geprüft. Der Parser übernimmt bewusst nur `title, statement, type, category,
tags` — genau diese Felder tragen die Smoke-Dateien.

## Dateien

| Datei | Inhalt | Zweck |
|---|---|---|
| `kw-probe-smoke.<locale>.json` | 5 Seiten: Warnschild-Konfliktpaar (blau↔Rot) · reifen-Duplikatpaar · 1 saubere Kontrollseite | EIN Upload löst BEIDE Erkennungen (Konflikt + Duplikat) aus |
| `kw-probe-korpus.<locale>.json` | voller 8-Seiten-Korpus aus `corpusImportItems(locale)` | realistischer Durchlauf |

`<locale>` ∈ `de` · `en` · `nl`. Streitwerte stehen je Sprache wörtlich in der Aussage
(blau/blue/blauw ↔ Rot/red/rood).

## 1. App lokal mit Online-Reasoner starten

Der Konflikt-/Duplikat-Erkennung braucht den **Reasoner online** (Cloud-Key) **und** das
Import-Flag. Ohne Key läuft der Reasoner deterministisch (offline) → keine KI-Befunde.

Frontend einmal bauen, dann Server starten (Key durch den echten ersetzen):

```
cd /Users/peterkohnert/Documents/dev_Klarwerk/apps/web && npm run build
cd /Users/peterkohnert/Documents/dev_Klarwerk
ANTHROPIC_API_KEY=sk-ant-DEIN-KEY REASONER_MODEL=claude-sonnet-4-6 KLARWERK_CONFLUENCE_IMPORT=1 npm run start
```

Dann im Browser: **http://localhost:3001** — beim ersten Start die Ersteinrichtung durchlaufen
(erster angelegter Anwender = Admin).

## 2. Upload

1. Menü **Import** (`/import`, nur für Admin sichtbar).
2. Karte **„JSON hochladen"** → Button **Hochladen** → eine der Dateien wählen
   (z. B. `kw-probe-smoke.de.json`).
3. Die Seiten erscheinen in der **Prüf-Queue** darunter.
4. Bei **jedem** Kandidaten **Übernehmen** klicken. Erst beim Übernehmen entsteht ein echtes
   Wissensobjekt und läuft die Erkennung (der zweite Partner eines Paares triggert den Befund).

## 3. Erwartung

- **Konflikte** (`/konflikte`): die Warnschild-Kollision **blau ↔ Rot** taucht auf.
- **Duplikate** (`/duplikate`): das **reifen-Paar** wird als Duplikat geflaggt
  („jedes auto wird mit 4 reifen ausgeliefert" ↔ „Alle autos werden mit vier reifen ausgeliefert").
- Die **Kontrollseite** (Kaffeeküche) bleibt ohne Befund.

## 4. Löschen / rückstandsfrei zurücksetzen (lokal)

Der Start oben läuft **rein im Speicher** (kein `DATABASE_URL`, kein `KLARWERK_DEV_PERSIST`) —
darum sind beide Wege rückstandsfrei:

- **Trivialster Weg:** Server im Terminal mit **Ctrl-C** stoppen und mit demselben Befehl neu
  starten. Alles ist weg; die Ersteinrichtung beginnt frisch.
- **In-App:** **`/admin` → Werksreset** (Passwort bestätigen). Löscht alle lokalen Daten und beendet
  den Prozess; der nächste Start beginnt mit der Ersteinrichtung.

> Wird die App mit `KLARWERK_DEV_PERSIST=1` gestartet (Journal), überlebt der Bestand einen Neustart —
> dann den Werksreset nutzen oder die Journaldatei `.localdb/state.jsonl` entfernen.
