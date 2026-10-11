# Abnahme R-0713 — Klara als MCP-Werkzeug in einem tatsächlichen Fremdclient

> Aufnahme `gesamt-mcp` (R-0713), Nacharbeit 1. Server: `services/app/src/routes/mcp-routes.ts`,
> Vertrag: `docs/architektur/integrations-schnittstelle.md` §6.

## Stand der Belege

| Beleg | Art | Stand |
| --- | --- | --- |
| Protokoll, Rechte, nur Validiertes, Beleg (`tests/integrations-api/mcp-zugang-am-draht.test.ts`) | Test, `app.inject` | ausgeführt, grün (Prüflauf Nacharbeit 1: 18 Fälle) |
| Verbindungsaufbau über echtes HTTP in der Abfolge des MCP-SDK-Clients (`tests/integrations-api/mcp-transport-am-socket.test.ts`) | Test, echter Socket, nachgebaute Abfolge | neu, Ausführung durch den Prüfadapter |
| Anmeldung, Werkzeugerkennung und Antwort in einem **tatsächlichen Fremdclient** | Abnahme nach diesem Protokoll | **offen** — Mittel fehlen (unten) |

## Was für die Abnahme fehlt (keine Produktfehler)

1. **Erreichbare Instanz** mit diesem Stand (ab Vertrag 1.2.0) unter einer HTTPS-Adresse, die vom
   Rechner der prüfenden Person aus erreichbar ist.
2. **Ausgestellter Dienst-Schlüssel**: der Betrieb ergänzt `KLARWERK_SERVICE_KEYS` um
   `{ "id": "mcp-abnahme", "sha256": ["<Prüfsumme>"], "rechte": ["mcp.werkzeug", "ask.validated"] }`,
   startet die Instanz neu und übergibt den Schlüssel selbst auf sicherem Weg an die prüfende Person.
3. **Mindestens ein validiertes, nicht vertrauliches Wissensobjekt** auf der Instanz, dessen Inhalt
   die Prüffrage trifft, und eines, das nicht validiert ist (für die Gegenprobe).
4. **Eine bedienende Person** mit einem installierten Fremdclient. Vorgesehen ist **Claude Code**
   (Kommandozeile, unterstützt entfernte MCP-Server mit eigenem Kopf). Gleichwertig: Cursor oder
   VS Code mit GitHub Copilot (Konfiguration in §6 der Schnittstellenbeschreibung).

ChatGPT und die Connectoren der Claude-Web-/Desktop-Oberfläche verlangen für entfernte Server
OAuth; das ist nicht gebaut und für diese Abnahme nicht nötig (ein unterstützter Fremdclient genügt).

## Ablauf mit Claude Code

1. Anmelden:
   `claude mcp add --transport http klarwerk https://<instanz>/mcp --header "x-klarwerk-service-key: <schlüssel>"`
2. Anmeldung prüfen: `claude mcp list` — erwartet: `klarwerk` mit Zustand „connected"/„✓ Connected".
3. Werkzeugerkennung: in einer Claude-Code-Sitzung `/mcp` aufrufen, Server `klarwerk` wählen —
   erwartet: Werkzeug `klara_fragen` („KLARWERK fragen (nur validiertes Wissen)").
4. Nutzung: eine Frage stellen, die nur KLARWERK beantworten kann, z. B. „Frage KLARWERK: <Prüffrage>"
   — erwartet: Aufruf von `klara_fragen`, Antwort mit dem Wortlaut des validierten Objekts, Zeile
   „Belege (validiertes Wissen in KLARWERK):" mit `[<Wissensobjekt-Kennung>]` und Fundstelle,
   Zeile „Einstufung: …".
5. Gegenprobe: eine Frage, die nur das nicht validierte Objekt trifft — erwartet: „Zu dieser Frage
   gibt es in KLARWERK kein validiertes Wissen …", kein Inhalt des Objekts.
6. Rechte-Gegenprobe: denselben Server mit einem falschen Schlüssel anlegen — erwartet: keine
   Verbindung (HTTP 401).
7. Abbau: `claude mcp remove klarwerk`; den Abnahme-Schlüssel im Betrieb wieder entfernen.

## Festzuhalten (Nachweis)

- Datum, Instanzadresse (ohne Schlüssel), Fassung aus `GET /health`.
- Fremdclient und seine Fassung (`claude --version`).
- Bildschirmfoto oder Textauszug von Schritt 2, 3, 4 und 5 — **ohne den Schlüssel**.
- Kennung des Wissensobjekts aus Schritt 4 und sein Prüfstand in KLARWERK.

## Zuordnung zur Quellenauflage „kein externer Kanal vor Berechtigungsvertrag"

Die Quelle (Landkarte v3 G2, PPLX2) nennt den Vertrag nicht näher. Ein Dokument dieses Namens gibt es
im Repository nicht. Der MCP-Zugang ist deshalb an den bestehenden, getesteten Rechtevertrag der
Integrationsschnittstelle gebunden. Jede Zusage ist an Code und Gegenprobe nachvollziehbar:

| Zusage | Code | Gegenprobe |
| --- | --- | --- |
| Kein Zugang ohne ausgestellten Schlüssel, kein Rückfall auf eine Sitzung | `addon-principal.ts` `resolveAddonAuth`; `mcp-routes.ts` `zugang` | `mcp-zugang-am-draht` R3, R4; `mcp-transport-am-socket` S2 |
| Ausdrückliche Freigabe des Kanals je Schlüssel (`mcp.werkzeug`) | `dienst-schluessel.ts` `DIENST_RECHTE`, `DIENST_ROUTEN` | `mcp-zugang-am-draht` R1 |
| Werkzeug nur mit dem Recht seiner Route (`ask.validated`) | `mcp-routes.ts` `werkzeugeFuer` | `mcp-zugang-am-draht` R2 |
| Nur validiertes Wissen | `ask-routes.ts` Schlüsselzweig `validatedOnly` | `mcp-zugang-am-draht` V1, V3 |
| Nichts Vertrauliches | `services/ask/src/service.ts` `dropConfidential` | `mcp-zugang-am-draht` V4 (ohne Auffindbarkeits-Gegenprobe) |
| Nur Inhalt ohne Space oder aus offenen Spaces | `ask-routes.ts` `grundlage` ohne Sitzungsnutzer | Bestand der Spaces-Aufnahme |
| Kein Modellaufruf, kein Abfluss an Dritte | `ask-routes.ts` `retrievalOnly` | `tests/security/f0688-schluessel-api-nur-validiert.test.ts` |
| Kein Browserkanal | `mcp-routes.ts` `Origin` → 403 | `mcp-zugang-am-draht` R4 |
| Grenze je Schlüssel, Protokoll `dienst:<id>` | `build-app.ts` Anmeldehook, `anfragebremse.ts` | `dienst-schluessel-am-draht` B1, D1 |

Ob dieser Rechtevertrag der in der Quelle gemeinte „Berechtigungsvertrag" ist, ist eine
**Produktentscheidung**, die hier nicht getroffen wird. Sie bleibt zur Bestätigung offen.
