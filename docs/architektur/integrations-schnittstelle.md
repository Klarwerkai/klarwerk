# KLARWERK — Integrationsschnittstelle mit Dienst-Schlüsseln (Vertrag 1.1.0)

> Aufnahme `gesamt-integrations-api` (R-0677, R-0688, R-0696, R-0698, R-0704, R-0712, R-0842).
> Quelle der Wahrheit ist der Code: `services/app/src/integrations-vertrag.ts` (Tabelle),
> `services/app/src/dienst-schluessel.ts` (Schlüssel, Rechte, Routen). Die maschinenlesbare
> Beschreibung `docs/generated/integrations-openapi.json` (OpenAPI 3.1) wird aus derselben Tabelle
> erzeugt; `tests/integrations-api/` hält Datei, Tabelle und Verhalten am Draht gleich.
>
> Nicht-Ziel (R-0721): KLARWERK bietet **keine** OpenAI-kompatible Modell-API an.

## 1. Anmeldung

Ein angebundenes System schickt seinen Schlüssel im Kopf **`x-klarwerk-service-key`** — nicht als
`Authorization`, nicht als Cookie, nie in der URL. Es gibt kein Menschenkonto und keine Sitzung.

Ein falscher Schlüssel bekommt `401` (kein Rückfall auf eine Sitzung). Das gilt auch, wenn gar
kein Dienst-Schlüssel (mehr) konfiguriert ist: wer den Kopf weiter mitsendet, wird abgewiesen, selbst
mit gültiger Sitzung im selben Aufruf. Fehlversuche werden je Adresse gedrosselt (`429`, wie beim
Klara-Schlüssel).

## 2. Schlüssel einrichten, wechseln, sperren (Betrieb)

Die Konfiguration steht in der Umgebungsvariable `KLARWERK_SERVICE_KEYS` als JSON-Liste. Sie enthält
**nie den Schlüssel selbst**, nur seine SHA-256-Prüfsumme:

```json
[
  {
    "id": "wiki-sync",
    "sha256": ["<64 Hexzeichen>"],
    "rechte": ["export.validated", "status.read"],
    "max": 60,
    "fensterSek": 60
  }
]
```

- Schlüssel erzeugen: eine lange Zufallsfolge (z. B. 32 Byte, hex). Die Prüfsumme ist SHA-256 über
  genau diese Zeichenfolge (UTF-8). Der Schlüssel geht nur an das angebundene System.
- **Rechte** (jedes öffnet genau seine Route, alles andere ist `403`):

  | Recht | Route | Wirkung |
  | --- | --- | --- |
  | `ask.validated` | `POST /api/ask` | Fragen; Antwort nur aus validiertem, nicht vertraulichem Wissen, ohne Modell |
  | `checktext.validated` | `POST /api/check-text` | Texte prüfen gegen validiertes Wissen, ohne Modell, nichts gespeichert |
  | `export.validated` | `GET /api/library/export` | Wissen ausleiten (nur validiert, nicht vertraulich) |
  | `import.kandidaten` | `POST /api/library/import/candidates` | Wissen einliefern — nur als Kandidat in die Prüfwarteschlange |
  | `status.read` | `GET /health`, `GET /api/reasoner/status` | Betriebszustand abfragen |

- **Grenze je Schlüssel**: `max` Aufrufe je `fensterSek` (Standard 60 je 60 s). Darüber `429`.
- **Wechseln ohne Ausfall**: die Prüfsumme des neuen Schlüssels neben die alte in die Liste
  `sha256` stellen, Instanz neu starten, das System umstellen, die alte Prüfsumme entfernen, neu
  starten. Kennung, Rechte, Grenze und Protokollspur (`dienst:<id>`) bleiben dieselben.
- **Sperren**: Prüfsumme oder ganzen Eintrag entfernen und neu starten.
- Ein fehlerhafter Eintrag wird beim Start verworfen und im Log genannt (ohne Prüfsumme) — der
  Zugang bleibt dann zu (fail-closed).

Jeder Export und jede Einlieferung trägt im Protokoll den Akteur `dienst:<id>`.

## 3. Verbindliche Zustandstabelle (R-0696)

Diese Paare aus HTTP-Status und `error`-Feld darf die Schnittstelle liefern — keine anderen. Jeder
Fehlerzustand nennt genau seine Kennung; Erfolgsantworten tragen kein `error`. Die Felder der
Anfragen und Antworten (Pflichtfelder, Wertemengen wie Wissensart und Vertraulichkeit,
Antwortvarianten „beantwortet"/„Wissenslücke") stehen in `docs/generated/integrations-openapi.json`. Fehler
haben immer die Form `{ "error": "<Kennung>", "message": "<Satz>" }`; bei `429` des Schlüssels
zusätzlich `wartenSek`. Für die Standardfehler des HTTP-Rahmens steht in `error` die HTTP-
Kurzbezeichnung und in `code` die Rahmenkennung.

**Für jede Route:**

| Status | `error` | Bedeutung |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Kein gültiger Dienst-Schlüssel: falsch, gesperrt oder nicht (mehr) konfiguriert. Kein Rückfall auf eine Sitzung. |
| 403 | `FORBIDDEN` | Schlüssel gültig, aber ohne das Recht dieser Route (auch: jede nicht gelistete Route). |
| 429 | `RATE_LIMITED` | Grenze des Schlüssels erreicht oder zu viele Fehlversuche von dieser Adresse. `Retry-After` nennt die Sekunden. |
| 500 | `INTERNAL` | Interner Fehler; Einzelheiten nur im Serverprotokoll. Wiederholen erlaubt. |

**Je Route zusätzlich:**

| Route | Status | `error` | Bedeutung |
| --- | --- | --- | --- |
| `POST /api/ask` | 200 | — | Beantwortet (`result.answered = true`, mit Quellen) **oder** Wissenslücke (`result.answered = false`). Beides ist Erfolg. |
| | 400 | `Bad Request` | Rumpf verletzt das Schema oder ist kein JSON. |
| | 413 | `Payload Too Large` | Rumpf größer als 128 KiB. |
| | 415 | `Unsupported Media Type` | Rumpf ist nicht `application/json`. |
| | 503 | `KI_ABGESCHALTET` | Fragefunktion der Instanz vom Administrator abgeschaltet. |
| `POST /api/check-text` | 200 | — | Prüfergebnis (auch: keine Funde). |
| | 400 | `Bad Request` | `text` fehlt oder liegt außerhalb von 40–8.000 Zeichen. |
| | 413 | `Payload Too Large` | Rumpf größer als 128 KiB. |
| | 415 | `Unsupported Media Type` | Rumpf ist nicht `application/json`. |
| `GET /api/library/export` | 200 | — | Export im Format `format` = `json` (Standard), `markdown`, `mediawiki`, `html`. |
| `POST /api/library/import/candidates` | 201 | — | Eingereiht; Antwort nennt die Kandidaten samt Dublettenbefund. |
| | 400 | `BAD_REQUEST` | Ein Eintrag ist unbrauchbar: unbekannte Wissensart (`type`) oder ungültige `sourceVersion`. Nichts wird eingereiht. |
| | 400 | `DOKUMENT_UNBEKANNT` | Ein Eintrag nennt eine Dokumentkennung, die diese Instanz nicht vergeben hat. Nichts wird eingereiht. |
| | 400 | `Bad Request` | Rumpf ist kein JSON. |
| | 413 | `Payload Too Large` | Rumpf größer als 1 MiB. |
| | 415 | `Unsupported Media Type` | Rumpf ist nicht `application/json`. |
| `GET /health` | 200 | — | Instanz antwortet (`status = "ok"`, Version, Deploy-Stand). |
| `GET /api/reasoner/status` | 200 | — | Abstrakter KI-Zustand, ohne Anbieter- oder Modellnamen. |

## 4. Zugriffsbremse für angemeldete Nutzer (R-0842)

Auch über die Web-Anwendung angemeldete Personen können modellgestützte Anfragen nicht mehr
beliebig oft hintereinander auslösen. Gezählt wird je Konto über diese Routen:
`POST /api/ask`, `/api/reasoner`, `/api/reasoner/describe`, `/api/reasoner/enrich`,
`/api/check-text`, `/api/kos/:id/ai-check`, `/api/help/explain`, `/api/media/analyze`.

- Standard: 30 Anfragen je 60 Sekunden (`KLARWERK_KI_ANFRAGEN_MAX`,
  `KLARWERK_KI_ANFRAGEN_FENSTER_SEK`; `KLARWERK_KI_ANFRAGEN_MAX=aus` schaltet die Bremse ab).
- Darüber: `429`, `error = "KI_ANFRAGEN_GEBREMST"`, `Retry-After` und ein Satz in der Sprache der
  Anfrage mit der Wartezeit, z. B. „Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte
  warten Sie 42 Sekunden und versuchen Sie es dann erneut." Die Fragen-Seite, die KI-Hilfesuche im
  Klara-Panel und das Bildbeschreibungsformular im Editor zeigen genau diesen Satz statt des allgemeinen Fehlertexts (`apps/web/src/lib/kiBremse.ts`).
- Schlüsselzugänge zählen hier nicht — sie haben ihre eigene Grenze.

## 5. Grenzen (ehrlich)

- Die Zähler liegen im Speicher **einer** Instanz. Laufen mehrere Instanzen nebeneinander, gilt die
  Grenze je Instanz; ein gemeinsamer Zähler wäre ein eigener Ausbau.
- Schlüssel werden über die Umgebung verwaltet; ein Wechsel braucht einen Neustart. Eine
  Verwaltungsoberfläche für Schlüssel gibt es nicht.
- Die Beschreibung liegt als Datei bei (`docs/generated/integrations-openapi.json`); sie wird nicht
  über eine eigene HTTP-Route ausgeliefert.
- Eine produktive Drittanbindung ist damit **nicht** belegt — sie braucht ein konkretes Zielsystem,
  einen ausgestellten Schlüssel und eine Abnahme im Betrieb.
