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
| Bedeutung | Die Microsoft-365-Mandanten dieser Installation, aus deren SharePoint Word im Browser Klara einbetten darf. Nur der Betreiber setzt den Wert; nichts wird aus Anfragedaten (Origin, Referer, Host, Browsermeldungen) freigegeben. Die Liste ersetzt keine Anmeldung, keine Berechtigung und keine Datentrennung. |
| Form | Kommagetrennte **SharePoint-Domänenstämme** — der tatsächliche Teil vor `.sharepoint.com`, z. B. `klarwerktest4711` oder `kunde-a,kunde-b`. Kein Anzeigename, keine Entra-Mandanten-ID (GUID). |
| Wirkung | Je Stamm kommen genau `https://<stamm>.sharepoint.com` und danach `https://<stamm>-my.sharepoint.com` als **exakte** Quellen zusätzlich in `frame-ancestors` der Taskpane-Antwort (`/word-addin/taskpane.html`). Normalisierung: am Komma teilen, äußeren Leerraum je Eintrag entfernen, ASCII kleinschreiben, prüfen, Doppelte entfernen, lexikografisch sortieren (`" B,a , a"` → `a`, `b`). |
| Ohne Eintrag | Variable fehlt, ist leer oder nur Leerraum: die Direktive ist zeichengleich wie bisher, `frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com`, ohne Warnung. Keine SharePoint-Herkunft darf einbetten. |
| Aktivierung | Einmal beim Start gelesen — wirksam erst mit einem neuen App-Prozess bzw. Container (Coolify: neu bereitstellen; Compose: Container neu erzeugen, siehe `docs/operations/kundeninstanz-neuinstallation.md` §2.6). |
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

Nach Kleinschreibung gilt ein Stamm nur, wenn er aus `a–z`, `0–9` und `-` besteht, 1 bis 60
Zeichen lang ist (damit `<stamm>-my` höchstens 63 Zeichen hat, RFC 1035 §2.3.4) und weder mit einem
Bindestrich beginnt noch endet. Leerraum **um** einen Eintrag (`a, b`) wird entfernt. Verworfen
werden u. a.: Punkt (`kunde.sharepoint.com`), Platzhalter (`*`), Leerzeichen im Stamm, Schrägstrich,
Doppelpunkt bzw. Port, `@`, Schema (`https://…`), `-a`, `a-`, `-`, mehr als 60 Zeichen, ein leerer
Eintrag in einer befüllten Liste (`a,,b`).

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

Dieser Schritt ist **nicht** Teil der Bau- oder Prüfabnahme (dort gibt es keinen Microsoft-Zugang);
er beschreibt, wie die gelieferte Fassung danach live abgenommen wird. Er ist an **genau diese
Bereitstellung** gebunden.

### Wo er geführt wird und wer was tut

- Geführt im M365-Vorgang `aufnahme:20260922:m365-anmeldung` (Entscheidung `entscheidung:ca86022d`)
  als dessen Folgeauftrag **Realabnahme**.
- **Koordinator:** verfolgt den Schritt im Vorgang und hält fest, welche Liefer-Fassung abgenommen
  wird (Version **und** vollständiger Liefercommit).
- **Pedi:** setzt in Coolify für `app.klarwerk.ai` die Laufzeitvariable
  `KLARWERK_M365_MANDANTEN=klarwerktest4711` und stellt neu bereit.
- **MS365-Prüfer:** testet und legt den Nachweis unten ab.

### Startbedingung — beides muss gelten

1. Die Fassung ist **veröffentlicht** (ausgeliefert und unter `https://app.klarwerk.ai` erreichbar).
2. Die Konfiguration ist **aktiv**: `KLARWERK_M365_MANDANTEN` ist gesetzt **und** der laufende
   Container wurde danach neu bereitgestellt (der Wert wirkt erst mit neuem App-Prozess). Belegt
   durch die Taskpane-Kopfzeile unten — trägt sie die zwei Herkünfte nicht, ist die Konfiguration
   nicht aktiv und der Test beginnt nicht.

### Herkunftsnachweis: welche Fassung läuft

`/health` liefert **zwei** Angaben, und beide werden erfasst:

```
curl -s https://app.klarwerk.ai/health
```

- `version` — die Liefer**version** (z. B. `1.0.0-beta.1.6xx`). Eine Version ist **kein** Commit:
  sie allein belegt nicht, welcher Stand läuft.
- `commit` — der Commit der laufenden Fassung. Er wird mit dem **vollständigen Liefercommit**
  (40 Zeichen) verglichen, den der Koordinator für diese Lieferung festhält.

Belegt ist die Herkunft nur, wenn `commit` mit dem vollständigen Liefercommit übereinstimmt (meldet
`/health` eine Kurzform, muss sie der Anfang genau dieses Commits sein). Meldet `/health`
`"commit": "unbekannt"`, fehlt die Angabe oder weicht sie ab, ist der **Herkunftsnachweis
offen (K4)**. Dann gibt es **keine belegte Abnahme dieser Fassung** — auch wenn Word Web Klara
anzeigt. Das Ergebnis wird dann als „Herkunft offen“ festgehalten, nicht als Abnahme.

### Der Nachweis — an dieselbe Bereitstellung gebunden

Alle Angaben stammen aus **derselben Bereitstellung** (kein Neustart, keine Neubereitstellung
dazwischen; sonst von vorn):

| Angabe | Wie |
|---|---|
| `/health.version` und `/health.commit` | wie oben, samt Vergleich mit dem Liefercommit |
| Taskpane-Header | `curl -sI https://app.klarwerk.ai/word-addin/taskpane.html` — `content-security-policy` enthält `https://klarwerktest4711.sharepoint.com https://klarwerktest4711-my.sharepoint.com`, kein `x-frame-options` |
| Dialog-Header | `curl -sI https://app.klarwerk.ai/word-addin/anmeldung.html` — Ausnahme-CSP **ohne** SharePoint-Herkunft, `frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com` |
| Gegenprobe | eine andere Antwort (z. B. `/`) trägt `frame-ancestors 'none'` und `X-Frame-Options: SAMEORIGIN` |
| Testzeit | Datum und Uhrzeit (mit Zeitzone) des Tests in Word Web |
| URL | die Adresse des geöffneten Dokuments (`https://klarwerktest4711-my.sharepoint.com/…`) |
| Hostversion | die Word-Web-Version bzw. der Browser samt Version |
| Ergebnis | Klara lädt im Seitenbereich statt „refused to connect“; Bildschirmfoto und Konsole ohne CSP-Fehler |

Liegen `/health`-Angaben und Test nicht in derselben Bereitstellung, ist der Nachweis nicht an die
gelieferte Fassung gebunden und zählt nicht.

**Word für Mac** ist ein getrennter Nachweis und nicht Teil dieses Auftrags und dieser Abnahme.
