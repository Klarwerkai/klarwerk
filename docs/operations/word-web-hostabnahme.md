# Word Web · Hostabnahme — SharePoint-Herkunft des Microsoft-365-Mandanten

Wer ein Word-Dokument aus OneDrive/SharePoint seines Microsoft-365-Mandanten im Browser öffnet,
lädt Klara in dieser Rahmenkette (live belegt, 1.0.0-beta.1.609, 26.09.2026):

```
top                    https://<mandant>-my.sharepoint.com
└─ WacFrame_Word_Inline https://dec-word-edit.officeapps.live.com
   └─ Klara             https://app.klarwerk.ai/word-addin/taskpane.html
```

`frame-ancestors` prüft **jeden** Vorfahren. Fehlt der SharePoint-Top-Rahmen des Mandanten in der
Direktive, blockiert der Browser das Taskpane („app.klarwerk.ai refused to connect“; Konsole:
„Framing 'https://app.klarwerk.ai/' violates the following Content Security Policy directive …“).
`https://word.cloud.microsoft/` ist nur der Einstieg, **nicht** der Top-Rahmen.

## Die Variable `KLARWERK_M365_MANDANTEN`

| | |
|---|---|
| Bedeutung | Die Microsoft-365-Mandanten dieser Installation, aus deren SharePoint Word im Browser Klara einbetten darf. |
| Form | Kommagetrennte Mandantennamen (der Teil vor `.sharepoint.com`), z. B. `klarwerktest4711` oder `kunde-a,kunde-b`. |
| Wirkung | Je Name kommen genau `https://<name>.sharepoint.com` und `https://<name>-my.sharepoint.com` zusätzlich in `frame-ancestors` der Taskpane-Antwort (`/word-addin/taskpane.html`) — in Eingabereihenfolge, doppelte Namen einmal, Großschreibung wird kleingeschrieben. |
| Ohne Eintrag | Variable fehlt oder ist leer: die Direktive ist zeichengleich wie bisher, `frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com`. Keine SharePoint-Herkunft darf einbetten. |
| Quelle der Wahrheit | `services/app/src/office-host.ts` — Direktive (`wordAddinFrameAncestors`) und Prüfung (`istErlaubterEinbettungsHost`) kommen aus derselben Quelle. Gelesen wird die Variable einmal beim Start in `registerSecurityHeaders` (`services/app/src/security-headers.ts`). |

### Beispiel

```
KLARWERK_M365_MANDANTEN=klarwerktest4711
```

ergibt an `/word-addin/taskpane.html`:

```
frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com https://klarwerktest4711.sharepoint.com https://klarwerktest4711-my.sharepoint.com
```

### Strenge Prüfung der Namen (fail-closed)

Nach Kleinschreibung gilt ein Name nur, wenn er aus `a–z`, `0–9` und `-` besteht und 1 bis 63
Zeichen lang ist. Leerraum **um** einen Eintrag (`a, b`) wird entfernt. Verworfen werden u. a.:
Punkt (`kunde.sharepoint.com`), Platzhalter (`*`), Leerzeichen im Namen, Schrägstrich, Doppelpunkt
bzw. Port, `@`, Schema (`https://…`), über 63 Zeichen, leere Einträge (`a,,b`).

Jeder verworfene Eintrag steht beim Start mit Grund im Protokoll, z. B.:

```
KLARWERK_M365_MANDANTEN: Eintrag "kunde.sharepoint.com" verworfen — enthält einen Punkt — nur der Mandantenname, ohne .sharepoint.com. Er erscheint NICHT in frame-ancestors des Word-Taskpanes.
```

Verworfene Einträge gelangen nie in die Direktive; gültige Einträge daneben wirken weiter.

## Ausschlüsse (bleiben bestehen)

- **Keine Platzhalter-Freigabe:** weder `*.sharepoint.com` noch `*.live.com`, `*.microsoft.com`,
  `*.cloud.microsoft` oder `*`. `live.com`, `microsoft.com` und `sharepoint.com` stehen als ganze
  Plattformfamilien in `NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN` und werden beim Laden des Moduls
  gegengeprüft — `*.sharepoint.com` würde jeder Seite jedes Mandanten das Einbetten erlauben.
- **Nur der Taskpane-Pfad ändert sich.** Die Dialogseite `/word-addin/anmeldung.html` behält ihre
  Ersatz-CSP ohne Mandanten; alle anderen Antworten behalten die globale CSP mit
  `frame-ancestors 'none'` und `X-Frame-Options: SAMEORIGIN`. COOP/CORP bleiben unverändert.
- **Kein Mandant im Code.** Welcher Mandant einbetten darf, entscheidet allein die Installation.
- Anmeldung, Dialog, Sitzung und Cookies (SameSite=Lax) sind nicht berührt; Word für Mac und das
  Manifest ebenfalls nicht.

## Live-Folgeschritt nach der Auslieferung

1. **Pedi** trägt in Coolify für `app.klarwerk.ai` ein: `KLARWERK_M365_MANDANTEN=klarwerktest4711`
   und stellt neu bereit.
2. **MS365-Prüfer** weist live nach:
   - `/health` meldet die Lieferversion (ship-Commit) — sonst prüft er einen alten Stand.
   - Die Taskpane-Antwort trägt die beiden Herkünfte, gemessen am Draht:
     `curl -sI https://app.klarwerk.ai/word-addin/taskpane.html | grep -i content-security-policy`
     enthält `https://klarwerktest4711.sharepoint.com https://klarwerktest4711-my.sharepoint.com`.
   - Eine andere Antwort (z. B. `/`) trägt weiter `frame-ancestors 'none'` und `X-Frame-Options`.
   - Klara lädt in Word Web aus dem Testmandanten (Dokument aus OneDrive/SharePoint öffnen,
     Seitenbereich zeigt Klara statt „refused to connect“; Bildschirmfoto + Konsole ohne CSP-Fehler).

Word für Mac ist ein getrennter Nachweis und nicht Teil dieser Abnahme.
