# KLARWERK — Integrationsschnittstelle mit Dienst-Schlüsseln (Vertrag 1.2.0)

> Aufnahme `gesamt-integrations-api` (R-0677, R-0688, R-0696, R-0698, R-0704, R-0712, R-0842);
> Fassung 1.2.0: Aufnahme `gesamt-mcp` (R-0713) — MCP-Zugang `/mcp`, §6.
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
  | `mcp.werkzeug` | `POST /mcp`, `GET /mcp` | MCP-Zugang für fremde KI-Programme (§6); das Fragewerkzeug braucht zusätzlich `ask.validated` |

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
| `POST /mcp` | 200 | — | JSON-RPC-Antwort: Ergebnis oder JSON-RPC-Fehler (`-32600`, `-32601`, `-32602`). Ein Werkzeugfehler steht als `result.isError = true` im Ergebnis. |
| | 202 | — | Benachrichtigung oder Antwort des Clients angenommen; kein Antwortkörper. |
| | 400 | `Bad Request` | Rumpf ist kein JSON oder leer. |
| | 413 | `Payload Too Large` | Rumpf größer als 128 KiB. |
| | 415 | `Unsupported Media Type` | Rumpf ist nicht `application/json`. |
| `GET /mcp` | 405 | `METHOD_NOT_ALLOWED` | Kein Ereignisstrom; Nachrichten nur per `POST` (`Allow: POST`). |

Am MCP-Zugang bedeutet `401` zusätzlich: Anfrage ohne Dienst-Schlüssel (eine Sitzung genügt nicht);
`403` zusätzlich: Anfrage mit `Origin`-Kopf (Browseraufruf).

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
  Klara-Panel, das Bildbeschreibungsformular im Editor sowie Strukturierung und KI-Assistent im
  Erfassungsblatt zeigen genau diesen Satz statt des allgemeinen Fehlertexts (`apps/web/src/lib/kiBremse.ts`).
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

## 6. MCP-Zugang: Klara als Werkzeug in fremden KI-Programmen (R-0713)

Klara steht unter **`/mcp`** als MCP-Server bereit (Model Context Protocol, Transport „Streamable
HTTP", zustandslos: eine JSON-RPC-2.0-Nachricht je `POST`, Antwort als `application/json`, kein
Ereignisstrom, keine Sitzungskennung). Unterstützte Protokollfassungen: `2025-06-18`, `2025-03-26`,
`2024-11-05`. Code: `services/app/src/routes/mcp-routes.ts`.

**Auflage der Quelle: kein externer Kanal vor Berechtigungsvertrag.** Der MCP-Zugang öffnet deshalb
nichts Eigenes, sondern hängt vollständig an diesem Vertrag:

- Anmeldung nur mit Dienst-Schlüssel (`x-klarwerk-service-key`). Ohne Schlüssel `401`, auch mit
  gültiger Sitzung; Anfragen mit `Origin` (Browser) `403`.
- Eigenes Recht `mcp.werkzeug`. Ein Schlüssel, der schon fragen darf, wird nicht stillschweigend
  zum KI-Werkzeug.
- Werkzeug **`klara_fragen`** (Eingabe `question`, optional `locale` = `de`/`en`/`nl`) erscheint in
  `tools/list` nur, wenn der Schlüssel zusätzlich `ask.validated` trägt; sonst ist es ein
  unbekanntes Werkzeug (`-32602`).
- Die Frage läuft unverändert über `POST /api/ask` mit demselben Schlüssel: nur validiertes, nicht
  vertrauliches Wissen, ohne Modellaufruf, nur Inhalt ohne Space oder aus offenen Spaces; die
  Abschaltung der Fragefunktion gilt auch hier.
- Das Ergebnis nennt die Antwort, je Wissensobjekt **Kennung und Fundstelle als Beleg** und die
  Einstufung (`verified`/`unverified`, ggf. mit Vorbehalt), zusätzlich maschinenlesbar in
  `structuredContent` (`beantwortet`, `antwort`, `belege`, `einstufung`, `wissensklasse`,
  `vertrauen`). Ohne validiertes Wissen: eine Wissenslücke (`beantwortet: false`), keine erfundene
  Antwort.

Beispiel-Eintrag für einen Schlüssel, der nur als MCP-Fragewerkzeug dienen soll:

```json
{ "id": "ki-werkzeug", "sha256": ["<64 Hexzeichen>"], "rechte": ["mcp.werkzeug", "ask.validated"] }
```

Anbindung (Beispiele; Adresse und Schlüssel je Installation):

- **Cursor** (`.cursor/mcp.json`) bzw. **VS Code / GitHub Copilot** (`.vscode/mcp.json`, dort
  `"servers"` und `"type": "http"`):
  `{ "mcpServers": { "klarwerk": { "url": "https://<instanz>/mcp", "headers": { "x-klarwerk-service-key": "<schlüssel>" } } } }`
- **Claude Code**: `claude mcp add --transport http klarwerk https://<instanz>/mcp --header "x-klarwerk-service-key: <schlüssel>"`

Grenzen (ehrlich):

- Ein Werkzeugaufruf zählt **zweimal** gegen die Grenze des Schlüssels (MCP-Hülle und die
  weitergeleitete Frage); `initialize`, `tools/list` und Benachrichtigungen je einmal.
- Anmeldung nur per eigenem Kopf. KI-Programme, die für entfernte MCP-Server ausschließlich OAuth
  anbieten (z. B. die Connectoren in ChatGPT und in der Claude-Web-/Desktop-Oberfläche), können sich
  heute **nicht** anmelden; dafür fehlt ein OAuth-Autorisierungsweg.
- Angeboten wird nur das Fragewerkzeug; Textprüfung, Export und Einlieferung sind über MCP nicht
  erreichbar.
- Eine echte Anmeldung aus einem dieser Programme gegen eine laufende Instanz ist damit **nicht**
  belegt — sie braucht eine erreichbare Instanz, einen ausgestellten Schlüssel und eine Abnahme im
  Betrieb. Ablauf, fehlende Mittel und die Zuordnung jeder Rechtezusage zu Code und Gegenprobe:
  `docs/abnahme/mcp-fremdclient-abnahme.md`.

## 7. Ereignis-Meldungen an Fremdwerkzeuge (Webhooks, R-0710)

KLARWERK meldet angebundenen Werkzeugen von selbst, wenn

| Ereignis | Bedeutung |
| --- | --- |
| `wissen.validiert` | Ein Wissensobjekt ist in dieser Fassung validiert (jeder Weg: Bewertung, Admin-Freigabe, Überarbeitung mit Freigabe, Vorschlagsübernahme). |
| `wissen.revalidierung_faellig` | Für ein Wissensobjekt steht „Stimmt das noch?" an (gekoppelte Anlage geändert) — der Zustand, den Management und Arbeitsbereich als veraltet zählen. Eine Gültigkeitsfrist nach Datum hat das Produkt nicht. |
| `widerspruch.offen` | Ein Widerspruch zwischen zwei Wissensobjekten ist neu offen. |

Code: `services/app/src/wissensereignisse.ts`, gestartet in `services/app/src/server.ts`.

**Einrichten (Betrieb).** `KLARWERK_WEBHOOKS` als JSON-Liste; der ganze Wert ist geheim:

```json
[
  {
    "id": "n8n-wissen",
    "url": "https://<ziel>/webhook/<pfad>",
    "ereignisse": ["wissen.validiert", "widerspruch.offen"],
    "geheimnis": "<mindestens 32 Zeichen>"
  }
]
```

- Nur `https`; `http` allein für die eigene Maschine (`localhost`, `127.0.0.1`, `[::1]`). Keine
  Zugangsdaten in der Adresse. Ein fehlerhafter Eintrag wird beim Start verworfen und ohne Adresse
  und Geheimnis im Log genannt.
- Abgeglichen wird im Takt `KLARWERK_WEBHOOKS_TAKT_SEK` (Vorgabe 60 s, mindestens 10 s). Ein
  Ereignis kommt also spätestens einen Takt nach der Änderung an.
- Beim allerersten Lauf wird der vorhandene Bestand als **Grundstand** festgehalten und nicht
  gemeldet. Gemeldet wird, was danach geschieht. Ein später hinzugefügtes Ziel bekommt ebenfalls nur
  Ereignisse ab seinem Eintrag.

**Die Meldung.** `POST` mit `content-type: application/json`, ohne Weiterleitung, Zeitgrenze 10 s:

```json
{
  "format": "klarwerk-wissensereignis",
  "formatVersion": 1,
  "kennung": "wissen.validiert:<ko-id>:<fassung>",
  "ereignis": "wissen.validiert",
  "zeitpunkt": "2026-10-08T09:00:00.000Z",
  "wissensobjekt": { "id": "<ko-id>", "version": 3 }
}
```

Bei `widerspruch.offen` steht statt `wissensobjekt` das Feld
`"widerspruch": { "id": "<id>", "art": "truth", "wissensobjekte": ["<ko-a>", "<ko-b>"] }`.

- Köpfe: `x-klarwerk-ereignis`, `x-klarwerk-kennung` und `x-klarwerk-signatur: t=<Unix-Sekunden>,v1=<hex>`.
  `v1` ist HMAC-SHA-256 mit dem `geheimnis` des Ziels über `"<t>.<Rumpf>"`. Der Empfänger rechnet
  sie nach und verwirft alte Zeitstempel.
- Die Meldung trägt **nur Kennungen und Fassung**, keinen Titel und keinen Inhalt. Gemeldet werden
  nur Objekte, die auch der Export eines Dienst-Schlüssels zeigen darf: nicht vertraulich, ohne
  führenden Space. Bei einem Widerspruch müssen beide Seiten diese Regel erfüllen. Inhalte holt das
  Werkzeug über §1–§3 mit eigenem Schlüssel und dessen Rechten.
- Erfolg ist jede `2xx`-Antwort. Sonst wird die Meldung in den nächsten Takten erneut versucht
  (höchstens 5 Versuche, dieselbe `kennung`). Der Empfänger muss doppelte Zustellungen anhand der
  `kennung` erkennen.
- Unmittelbar vor jedem einzelnen Versuch, auch innerhalb eines Takts, werden die betroffenen
  Objekte frisch gelesen und ihre Sichtbarkeit geprüft. Ist ein betroffenes Objekt inzwischen
  vertraulich, einem Space zugeordnet oder gelöscht, wird die Meldung nicht mehr gesendet. Bei einem
  Widerspruch gilt das für beide Seiten. Der Abbruch wird protokolliert.

**Prüfprotokoll.**

- `wissensereignis.grundstand`: einmal.
- `wissensereignis.erkannt`: je Ereignis, mit der `kennung` als eindeutiger Ereigniskennung der
  Kette und den bei der Erkennung abonnierten Zielen.
- `wissensereignis.zustellversuch`: je erfolglosem Versuch.
- Je Ziel genau ein Abschluss mit Versuchen und letztem Status: `wissensereignis.zugestellt`,
  `wissensereignis.zustellung-gescheitert` oder `wissensereignis.zustellung-abgebrochen`.

**Dauerhaft.** Zustellvorgänge ohne Abschluss nimmt der Melder nach einem Neustart aus dem
Prüfprotokoll wieder auf und zählt dabei die Versuche weiter. Ein erst nach der Erkennung
eingetragenes Ziel bekommt keine alten Vorgänge.

**Grenzen.**

- Zugestellt wird mindestens einmal. Doppelt gesendet werden kann eine Meldung in zwei Fällen:
  bei einem Neustart zwischen erfolgreicher Antwort und Abschlusseintrag, oder wenn mehrere
  Instanzen gleichzeitig neu starten und denselben offenen Vorgang aufnehmen. Wiederaufgenommen
  wird nur beim Start eines Prozesses; eine weiterlaufende Instanz übernimmt die offenen Vorgänge
  einer abgestürzten nicht.
- Jeder Takt liest den Bestand der Wissensobjekte, die Revalidierungsmerker und die offenen
  Widersprüche einmal vollständig.
- Ziele werden über die Umgebung verwaltet; eine Änderung braucht einen Neustart. Eine
  Verwaltungsoberfläche gibt es nicht.
- Eine echte Zustellung an ein Fremdwerkzeug im Betrieb ist damit **nicht** belegt. Dafür braucht es
  ein konkretes Zielsystem, einen eingetragenen Eintrag samt Geheimnis und eine Abnahme.
