# Klarwerk — Secrets-Management (Betreiber-Runbook)

> Praktisches Ops-Runbook für API-Keys, Zugangsdaten, Zertifikate und sonstige Secrets.
> **Keine echten Secrets** in diesem Dokument. Konfig-Vorlage: `.env.example` (nur Platzhalter).
> Verwandte Doku: `docs/operations/deploy-hetzner.md`, `docs/operations/pre-launch-protection.md`,
> `docs/compliance/gdpr-compliance-runbook.md`. Grundregel G-7: **keine Geheimnisse im Client-Bundle.**
>
> Fassung 2026-10-08 (Auftrag `aufnahme:20260922:gesamt-geheimnisse-betrieb`, Basis `a42c2881`):
> Grundentscheidung (§0), vollständiges Inventar mit Ordnung und Wechsel (§1), Erhebungsprotokoll (§1a),
> eigene Kundenschlüssel (§7a). Ergänzt 2026-10-12: Rotationsplan mit Zuständigkeit (§1b). Die Inventarliste wird gegen den Startvertrag geprüft:
> `tests/geheimnisse-betrieb/geheimnisse-nur-in-der-betriebsumgebung.test.ts`.

---

## 0. Grundentscheidung: Geheimnisse leben nur in der Betriebsumgebung

**Entschieden von Pedi am 30.07. (OFFEN.md C2, wiederholt in E10): Zugangsdaten bleiben in der
Umgebungsvariable** — in Produktion also als Service-Env in Coolify.

- **Kein Feld der Oberfläche nimmt je ein Geheimnis entgegen**, und keine Fläche zeigt einen Wert an —
  auch keine Maske mit Länge. Die Verwaltung zeigt nur den **Zustand** (gesetzt ja/nein), nennt den
  **Variablennamen** und sagt, dass er **auf dem Server** gesetzt wird.
  Umsetzung: `apps/web/src/components/ImportAccessPanel.tsx` (Confluence),
  `apps/web/src/components/sharepoint-import/SharePointZugangKarte.tsx` (SharePoint/OneDrive).
- **Keine Verwaltungsfläche für Zugangsdaten** im Admin-Bereich: Es gibt nichts zu verwalten, der
  frühere Entwurf C3 hat sich damit aufgelöst.
- **Verworfen:** der Schlüsselbund (trägt nur dort, wo die Desktop-App läuft, nicht bei einer
  Server-Installation) und die verschlüsselte Ablage in der Datenbank (Schlüsselverwaltung und Wechsel
  wären echter Bauaufwand, und das Merkmal läge danach in jeder `pg_dump`-Datei).
- **Härtung der Quellsystem-Zugänge bleibt:** eigener Namensraum (`KLARWERK_CONFLUENCE_*`,
  `KLARWERK_SHAREPOINT_*`), Origin-Bindung samt https-Pflicht, `redirect: "error"` auf jedem Sprung,
  Schwärzung des Tokens in jeder Fehlermeldung (`services/confluence/src/rest-client.ts`,
  `services/sharepoint/src/graph-client.ts`).

**Ausnahme Desktop-App (lokal, ein Rechner):** Der macOS-Starter
(`desktop-app/KLARWERK App.app/Contents/MacOS/KLARWERK_App`) fragt den KI-Schlüssel beim Erststart in
einem Systemdialog ab, legt ihn im macOS-Schlüsselbund ab und reicht ihn dem lokalen Server als
Umgebungsvariable weiter. Das ist kein Feld der Web-Oberfläche und keine Server-Installation; die
Grundentscheidung oben gilt für jede Server-Installation unverändert.

---

## 1. Secret-Inventar, Ordnung und Wechsel

**Ordnung nach Arten.** Die Arten gliedern das Material nach Herkunft und Zuständigkeit. Sie sind
**keine** Rangfolge: Ein Schlüssel einer Art gewährt für sich keinen Zugriff auf Schlüssel einer
anderen Art (ein KI-Anbieterschlüssel öffnet weder ein Confluence-Token noch die Belegsignatur).

| Art | Bezeichnung | Was dazu gehört |
| --- | --- | --- |
| **0** | Betriebszugang | Coolify-/Hetzner-Konto, Server-SSH, Shell im laufenden Container |
| **1** | Datenhaltung | Datenbank-Zugang |
| **2** | Ausgehende Anbieter-Zugänge | KI-Modelle, Transkription, Postausgang, Single Sign-on |
| **3** | Quellsystem-Zugänge (Import, lesend) | Confluence, SharePoint/OneDrive |
| **4** | Produkteigene Geheimnisse | Add-in-Schlüssel, Signatur der Antwortbelege |

**Tatsächliche Zugriffswege.** Was ein kompromittierter Zugang wirklich erreicht — daraus bestimmt
sich der Pflichtumfang eines Notfallwechsels (§7):

| Kompromittiert | Erreicht tatsächlich | Pflichtumfang des Notfallwechsels |
| --- | --- | --- |
| Betriebszugang (Coolify-/Hetzner-Konto, SSH, Container-Shell) | **jede** Service-Env dieser Instanz im Klartext, damit auch die Datenbank | den Betriebszugang selbst und **alle** Variablen der Inventartabelle dieser Instanz; Sitzungen invalidieren |
| `DATABASE_URL` | Inhalt der Datenbank: Konten (Kennwort-Hashes), serverseitige Sitzungen, Bestand, Audit. **Keine** anderen Zugangsdaten — nach §0 liegt kein Token in der Datenbank | Datenbank-Kennwort; Sitzungen invalidieren; Konten prüfen |
| ein Anbieterschlüssel (KI, Transkription, SMTP, OIDC-Client) | nur das eigene Anbieterkonto (Kosten, Versand bzw. Anmeldung als dieser Client) | nur dieser Schlüssel; beim OIDC-Client zusätzlich Sitzungen invalidieren |
| ein Quellsystem-Token | lesend den freigegebenen Space bzw. die Bibliothek im Quellsystem | nur dieses Token; Zugriffe im Quellsystem prüfen |
| `KLARWERK_ADDON_API_KEY` | die Add-in-Schnittstelle von Klarwerk mit den Rechten des Add-ins — keine anderen Geheimnisse | nur dieser Schlüssel, im Add-in nachziehen |
| `KLARWERK_ASK_RECEIPT_SECRET` | Fälschen von Antwortbelegen dieser Instanz | nur dieses Geheimnis |
| Repository, Build, Client-Bundle | **kein** Geheimnis (§1a, Test G3–G6) | — (Fund prüfen; enthält er doch einen Wert, gilt die Zeile dieses Werts) |

**Vorsorgliche Betriebsregel (über den Pflichtumfang hinaus).** Ist unklar, welche Werte ein Leck
enthält — etwa ein Protokoll, ein Chat oder ein Bildschirmfoto, das während einer Sitzung mit
Betriebszugang entstand —, oder verlässt eine Person mit Betriebszugang das Team, werden **alle**
Variablen der Inventartabelle gewechselt. Das ist eine bewusste Betriebsregel, keine technische
Abhängigkeit zwischen den Schlüsseln.

**Inventar der Umgebungsvariablen.** Jede Variable, die der Startvertrag
(`services/app/src/start-vertrag.ts`) als `geheim: true` führt, steht hier — der Test oben bricht,
sobald eine fehlt. Ablageort für alle: **Service-Env in Coolify** (Produktion) bzw. `.env.local` (lokal).

| Art | Geheimnis | Variable | Ohne Wert | Regulärer Wechsel | Folge des Wechsels |
| --- | --- | --- | --- | --- | --- |
| 1 | Datenbank-Zugang | `DATABASE_URL` | Produktion startet nicht (In-Memory nur mit ausdrücklicher Ausnahme) | jährlich und bei Personal-/Infrastrukturwechsel | Neustart; Kennwort zuerst in Postgres ändern, dann Env setzen |
| 2 | KI-Schlüssel Anthropic | `ANTHROPIC_API_KEY` | deterministischer Ersatzmodus | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; alten Schlüssel beim Anbieter widerrufen |
| 2 | KI-Schlüssel OpenAI | `OPENAI_API_KEY` | OpenAI-Weg inaktiv | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; alten Schlüssel beim Anbieter widerrufen |
| 2 | Schlüssel des lokalen Modells | `KLARWERK_LOCAL_LLM_KEY` | lokaler Weg ohne Schlüssel | ≤ 12 Monate, gemeinsam mit dem lokalen Modellserver | Neustart; Wert am Modellserver und hier gleichzeitig ändern |
| 2 | Transkriptionsdienst | `MEDIA_TRANSCRIBE_API_KEY` | keine Transkription | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; alten Schlüssel beim Anbieter widerrufen |
| 2 | Postausgang | `SMTP_PASS` (+ `SMTP_USER`) | kein authentifizierter Versand | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; Testmail über den Kennwort-zurücksetzen-Weg |
| 2 | Single Sign-on | `OIDC_CLIENT_SECRET` | Client gilt als öffentlich (nur PKCE) | ≤ 12 Monate bzw. Ablauf beim IdP | Neustart; neues Secret beim IdP vor dem Widerruf des alten anlegen |
| 3 | Confluence-Token | `KLARWERK_CONFLUENCE_TOKEN` | kein Confluence-Client, Zustand „nicht gesetzt“ | ≤ 12 Monate bzw. Ablauf bei Atlassian | Neustart; Zustandsanzeige muss „gesetzt“ zeigen |
| 3 | SharePoint-/OneDrive-Token | `KLARWERK_SHAREPOINT_TOKEN` | kein SharePoint-Client, Zustand „nicht gesetzt“ | mit Ablauf bei Microsoft, spätestens 12 Monate | Neustart; Zustandsanzeige muss „gesetzt“ zeigen |
| 4 | Add-in-Schlüssel | `KLARWERK_ADDON_API_KEY` | Add-in-Pfad ist zu | ≤ 12 Monate und bei jedem Wechsel des Add-in-Verteilwegs | Neustart; das Add-in braucht denselben neuen Schlüssel |
| 4 | Signatur der Antwortbelege | `KLARWERK_ASK_RECEIPT_SECRET` | signiert mit einem prozesslokalen Zufallswert (`services/ask/src/service.ts`); nach einem Neustart nicht mehr bestätigbar | ≤ 12 Monate, zusätzlich Notfallwechsel (§7) | Neustart. Ein Beleg trägt kein Schlüsselkennzeichen und ist nur 30 Minuten gültig (`ANSWER_RECEIPT_TTL_MS`, `services/ask/src/receipt.ts`): Belege aus den letzten 30 Minuten vor dem Wechsel werden nicht mehr bestätigt, ältere waren ohnehin abgelaufen. Den regulären Wechsel deshalb in eine nutzungsarme Zeit legen; ein Parallelbetrieb mit altem Wert ist nicht nötig |

**Schlüsselmaterial außerhalb der Umgebungsvariablen:**

| Art | Geheimnis | Wo es liegt | Wechsel |
| --- | --- | --- | --- |
| 0 | Plattform-Zugang (Coolify, Hetzner, SSH) | beim Betreiber, mit Zwei-Faktor | bei Personenwechsel sofort |
| Proxy | Pre-Launch-Gate | Basic-Auth-Hash am Reverse-Proxy (Traefik/Coolify) | bei Personen- oder Phasenwechsel |
| Proxy | TLS-Zertifikate | Reverse-Proxy (automatisch) | automatisch durch den Proxy |
| 4 | Demo-Seed-Admin-Kennwort | erster Start einer Instanz | **vor jeder echten Nutzung** ändern |

**Kein App-Signing-Secret nötig:** Session-Tokens sind **opake Zufallswerte** (`randomBytes(32)`, serverseitig gespeichert) — es gibt **kein** symmetrisches JWT-Signaturgeheimnis zu verwalten. OIDC-Tokens werden über **JWKS** (öffentliche Schlüssel) verifiziert. Nutzerkennwörter liegen nur als Hash in der Datenbank und werden von den Nutzern selbst gewechselt.

**Nicht-geheime Konfiguration** (kein Secret, dürfen klar gesetzt werden): `PORT`, `APP_BASE_URL`, `CANONICAL_HOST`, `COOKIE_SECURE`, `REASONER_MODEL`, `OIDC_ISSUER/AUDIENCE/JWKS_URI/AUTHORIZE_URL/TOKEN_URL/CLIENT_ID/REDIRECT_URI/ROLE_CLAIM/GROUP_*`, `EXTERNAL_SEARCH*`, `SEED_ALLOW_PROD`, `KLARWERK_CONFLUENCE_BASE_URL/USER/SPACE`, `KLARWERK_SHAREPOINT_BASE_URL/DRIVE`.

## 1a. Erhebungsprotokoll: Wo steht echtes Schlüsselmaterial?

**Erhebung vom 2026-10-08, Stand `a42c2881`, Produktbaum ohne `node_modules` und `.git`.** Gesucht wurde
nach den Formen echter Schlüssel (Anthropic- und OpenAI-Schlüssel mit voller Länge, GitHub-Tokens,
AWS-Zugangskennungen, Slack-Tokens, Google-API-Schlüssel, PEM-Privatschlüssel) sowie nach
Schlüsseldateien (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`) und eingecheckten `.env`-Dateien.
Ausgegeben wurden nur Dateinamen und Trefferzahlen, nie ein Wert.

- **Echtes Schlüsselmaterial: kein Treffer.** Keine Schlüsseldatei, einzige `.env*`-Datei ist
  `.env.example` (Platzhalter).
- **Nur das Präfix, kein Schlüssel** (Beispiel, Erklärtext, Testattrappe): `OFFEN.md` (Bericht I56),
  `demo/testimports/README.md` (Platzhalter `…-DEIN-KEY`), `docs/qm/claude-after-report.md`
  (Erklärtext), `desktop-app/KLARWERK App.app/Contents/MacOS/KLARWERK_App` (Dialogtext),
  `tests/app/g27-ask-rot-diagnose.test.ts` (Attrappe).
- **Außerhalb des Produktbaums, nicht erhoben:** das in OFFEN.md I56 gemeldete Protokoll unter
  `_relay/hand/logs/` (durch `.gitignore` ausgeschlossen). Die dort genannten Handgriffe —
  Schlüssel in Coolify **wechseln**, Protokolldatei **löschen** — kann nur der Betreiber ausführen.

Die Erhebung läuft seither bei jedem Testlauf mit (Test oben, Fall „kein echtes Schlüsselmaterial“) und
deckt dabei auch das gebaute Client-Bundle `apps/web/dist`, wenn es vorliegt.

## 1b. Rotationsplan und Zuständigkeit

**Festgelegt durch Peters Entscheidung vom 12.10. (Nr. 6, „Verantwortung für Geheimnisse“):**
Peter ist zunächst der **fachliche Betreiberverantwortliche** für alle Geheimnisse. Die **technische
Durchführung** liegt beim zugeordneten Betriebsweg — für jede Umgebungsvariable die Service-Env der
Instanz in Coolify (Hetzner, `deploy-hetzner.md`), für Anbieterwerte zusätzlich das jeweilige
Anbieterkonto. Handgriffe, die historisch Peter vorbehalten sind (OFFEN.md I56), bleiben bei ihm.

**Regeln dieser Tabelle.** Sie enthält nie einen Wert und kein Präfix.
„Letzte nachgewiesene Rotation“ nennt nur einen Wechsel **mit Beleg**; fehlt der Beleg, steht dort
**„nicht nachgewiesen“** — kein geschätztes Datum. Der **nächste Termin** folgt der Anbieterregel
(ein vom Anbieter gesetztes Ablaufdatum gilt, wenn es früher liegt) und dem Risiko: Ohne Nachweis ist
das Alter eines Werts unbekannt, deshalb liegt der erste Termin vor der Regelfrist aus §1 — je
kürzer, je größer die Reichweite laut „Tatsächliche Zugriffswege“. Nach dem ersten nachgewiesenen
Wechsel gilt die Regelfrist aus §1, gerechnet ab diesem Wechsel. Ein Wert, der in einer Instanz nicht
gesetzt ist, hat dort keinen Termin. Nach jedem Wechsel trägt der Betreiber hier Datum und Beleg ein
(z. B. Coolify-Änderungsprotokoll oder Widerrufsbestätigung des Anbieters).

Stand: 2026-10-12.

| Art | Geheimnis | Variable / Ort | Zuständig | Letzte nachgewiesene Rotation | Nächster Termin | Grundlage des Termins |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Betriebszugang | Coolify-/Hetzner-Konto, Server-SSH | Peter (fachlich und Durchführung, Kontoinhaber) | nicht nachgewiesen | 2026-11-12 | größte Reichweite (jede Service-Env); danach jährlich und bei jedem Personenwechsel |
| 1 | Datenbank-Zugang | `DATABASE_URL` | Peter (fachlich); Durchführung: Betriebsweg Coolify + Postgres | nicht nachgewiesen | 2026-11-12 | Reichweite: gesamter Bestand und Sitzungen; danach jährlich |
| 2 | KI-Schlüssel Anthropic | `ANTHROPIC_API_KEY` | Peter selbst (OFFEN.md I56, ihm vorbehalten); Durchführung: Anbieterkonto + Coolify | nicht nachgewiesen | 2026-10-19 | offener Leckbericht OFFEN.md I56 (Schlüssel im Klartext in einem Protokoll) — Notfallwechsel, sofort |
| 2 | KI-Schlüssel OpenAI | `OPENAI_API_KEY` | Peter (fachlich); Durchführung: Anbieterkonto + Coolify | nicht nachgewiesen | 2027-01-12 | Alter unbekannt, Reichweite nur Anbieterkonto (Kosten); danach ≤ 12 Monate |
| 2 | Schlüssel des lokalen Modells | `KLARWERK_LOCAL_LLM_KEY` | Peter (fachlich); Durchführung: lokaler Modellserver + Coolify | nicht nachgewiesen | 2027-01-12 | Alter unbekannt, Reichweite nur Modellserver; danach ≤ 12 Monate |
| 2 | Transkriptionsdienst | `MEDIA_TRANSCRIBE_API_KEY` | Peter (fachlich); Durchführung: Anbieterkonto + Coolify | nicht nachgewiesen | 2027-01-12 | Alter unbekannt, Reichweite nur Anbieterkonto; danach ≤ 12 Monate |
| 2 | Postausgang | `SMTP_PASS` | Peter (fachlich); Durchführung: Mail-Anbieter + Coolify | nicht nachgewiesen | 2027-01-12 | Alter unbekannt, Reichweite Versand im Namen der Instanz; danach ≤ 12 Monate |
| 2 | Single Sign-on | `OIDC_CLIENT_SECRET` | Peter (fachlich); Durchführung: IdP-Verwaltung + Coolify | nicht nachgewiesen | 2027-01-12 | früheres Ablaufdatum beim IdP geht vor; danach ≤ 12 Monate |
| 3 | Confluence-Token | `KLARWERK_CONFLUENCE_TOKEN` | Peter (fachlich); Durchführung: Atlassian-Konto + Coolify | nicht nachgewiesen | 2027-01-12 | früheres Ablaufdatum des Tokens bei Atlassian geht vor; danach ≤ 12 Monate |
| 3 | SharePoint-/OneDrive-Token | `KLARWERK_SHAREPOINT_TOKEN` | Peter (fachlich); Durchführung: Microsoft-Mandant + Coolify | nicht nachgewiesen | 2027-01-12 | früheres Ablaufdatum bei Microsoft geht vor; danach ≤ 12 Monate |
| 4 | Add-in-Schlüssel | `KLARWERK_ADDON_API_KEY` | Peter (fachlich); Durchführung: Coolify + Add-in-Verteilung | nicht nachgewiesen | 2027-01-12 | Alter unbekannt, Reichweite Add-in-Schnittstelle; danach ≤ 12 Monate |
| 4 | Signatur der Antwortbelege | `KLARWERK_ASK_RECEIPT_SECRET` | Peter (fachlich); Durchführung: Betriebsweg Coolify | nicht nachgewiesen | 2027-04-12 | geringe Reichweite (nur Belegfälschung, Belege gelten 30 Minuten); danach ≤ 12 Monate |
| Proxy | Pre-Launch-Gate | Basic-Auth-Hash am Reverse-Proxy | Peter (fachlich); Durchführung: Betriebsweg Coolify/Traefik | nicht nachgewiesen | 2026-11-12 | Zugangsschutz vor der ganzen App; danach bei Personen- oder Phasenwechsel |
| 4 | Demo-Konten-Kennwörter | erster Start einer Instanz | Peter (fachlich und Durchführung) | 30.07. (Beleg: OFFEN.md, Eintrag zu den Demo-Konten, „die Kennwörter der Demo-Konten sind zurückgesetzt“; Jahr dort nicht genannt) | 2027-07-30 | vor jeder echten Nutzung; sonst ≤ 12 Monate ab dem belegten Wechsel |
| Proxy | TLS-Zertifikate | Reverse-Proxy | Betriebsweg Coolify/Traefik (automatisch) | nicht nachgewiesen | automatisch | Erneuerung durch den Proxy; Peter prüft nur das Ablaufdatum |

**Offener Beleg:** Für keinen der Werte außer den Demo-Kennwörtern liegt ein Nachweis eines
erfolgten Wechsels vor. Die Tabelle legt Zuständigkeit und Termine fest — sie bestätigt keine
Durchführung.

---

## 2. Erlaubte Speicherorte

- **Runtime-Env-Variablen**, vom Hosting/Secret-Manager injiziert (Produktion).
- **`.env.local`** für lokale Entwicklung (per `.gitignore` ausgeschlossen).
- **Hosting Secret Manager** (Coolify-Env/Secrets je Service; optional externer Store).
- **macOS-Schlüsselbund** ausschließlich für die lokale Desktop-App (§0, Ausnahme).

## 3. Verbotene Speicherorte (hart)

- **Im Code / im Repo** (auch nicht „temporär").
- **Committetes `.env`** (nur `.env.example` mit Platzhaltern ist erlaubt).
- **Im Client-Bundle** (`apps/web`) — siehe §9 (G-7).
- **In der Datenbank** — auch nicht verschlüsselt (§0, `pg_dump`).
- **In einem Feld der Oberfläche** — weder Eingabe noch Anzeige (§0).
- **In Logs / Audit-Payloads / Fehlermeldungen** im Klartext. Eine Prüfzeile, die einen Schlüssel
  anfasst, gibt nie den Wert aus, sondern höchstens Länge und Präfix.
- **In Tickets / Chat / Wiki / Screenshots** im Klartext.

---

## 4. Secret-Store pro Umgebung

| Umgebung | Quelle | Hinweis |
| --- | --- | --- |
| **Lokal/Dev** | `.env.local` (aus `.env.example` kopiert) | niemals committen; ohne `DATABASE_URL` läuft In-Memory |
| **Staging/Prod** | **Coolify-Env/Secrets** je Service (Hetzner via Coolify, `deploy-hetzner.md`) | Secrets pro Service, nicht global; TLS/Reverse-Proxy über Coolify |
| **Optional/später** | externer Secret-Store (Vault/Doppler/Cloud SM) | **nicht eingerichtet**; die Grundentscheidung §0 nennt Coolify-Env als geltenden Ort |

---

## 5. Lokale Entwicklung

1. `.env.example` → `.env` bzw. `.env.local` kopieren.
2. Nur die benötigten Werte setzen (ohne `DATABASE_URL` = In-Memory-Schnellstart; ohne `ANTHROPIC_API_KEY` = deterministischer Reasoner).
3. **Niemals committen** (`.gitignore` deckt `.env` und `.env.local` ab — vor jedem Push prüfen).

## 6. Produktion / Hosting

- Secrets als **Service-Env in Coolify** hinterlegen (nicht im Image, nicht im Repo).
- HTTPS/TLS-Zertifikate verwaltet der Reverse-Proxy (Traefik/Coolify) — keine Zertifikats-Keys ins Repo.
- `COOKIE_SECURE=true`, `APP_BASE_URL`/`CANONICAL_HOST` korrekt setzen.
- **Default-Credentials sofort ändern:** Pre-Launch-Gate-Passwort (`pre-launch-protection.md`) und das Demo-Seed-Admin-Passwort vor jeder echten Nutzung rotieren.

---

## 7. Rotation & Notfallrotation

**Regulärer Wechsel** — Fristen je Geheimnis in der Inventartabelle (§1). Ablauf für jede
Umgebungsvariable:
1. Neuen Wert beim Anbieter erzeugen (bzw. bei Art 4 selbst: `openssl rand -hex 32`); den alten
   noch **nicht** widerrufen.
2. Neuen Wert in Coolify als Service-Env setzen, Service **neu starten** — ein laufender Prozess
   behält sonst den alten Wert.
3. Wirkung prüfen, ohne den Wert anzuzeigen: Startbericht bzw. Zustandsanzeige im Admin („gesetzt“),
   ein echter Aufruf des betroffenen Wegs.
4. Erst dann den alten Wert beim Anbieter **widerrufen**.
5. Datum des Wechsels im Betriebsprotokoll festhalten (nur Name und Datum, nie Wert oder Präfix).

**Notfallwechsel** (bei Leak/Verdacht/Offboarding mit Zugriff) — sofort, Reihenfolge umgekehrt:
1. Umfang bestimmen: der kompromittierte Zugang plus alles, was er laut **„Tatsächliche
   Zugriffswege“** (§1) erreicht — bei Betriebszugang also alle Variablen der Instanz, bei einem
   einzelnen Anbieterschlüssel nur dieser. Ist der Inhalt des Lecks unklar, gilt die vorsorgliche
   Betriebsregel (§1). Jedes Secret im Umfang beim Anbieter **widerrufen** und **neu** erzeugen.
2. Neuen Wert im Secret-Store/Coolify setzen, Service neu starten.
3. Bei kompromittiertem Auth: **Sessions invalidieren** (Tokens sind serverseitig → Session-Store leeren/Nutzer neu anmelden), betroffene Konten prüfen/sperren.
4. **Audit-Log prüfen** (Analytics-Audit / `GET /api/audit`, append-only Hash-Kette) auf auffällige Aktionen.
5. Fundstelle des Lecks bereinigen (Protokolldatei, Chat, Ticket) — **Wechseln schlägt Löschen**: gelöscht ist der Wert nur an dieser einen Stelle.
6. Vorfall dokumentieren; ggf. DSGVO-Meldepflichten prüfen (`gdpr-compliance-runbook.md`).

## 7a. Eigene Schlüssel der Kunden

**Heute:** Jede Kundeninstallation setzt ihre Werte in **ihrer eigenen** Betriebsumgebung. Ein Kunde
mit eigener Installation bringt damit seinen eigenen KI-Schlüssel mit (`ANTHROPIC_API_KEY` bzw.
`OPENAI_API_KEY`) oder betreibt ein eigenes Modell (`KLARWERK_LOCAL_LLM_URL`/`KLARWERK_LOCAL_LLM_KEY`);
Klarwerk sieht diesen Wert nie.

**Nicht gebaut:** getrennte Schlüssel je Kunde innerhalb **einer gemeinsamen** Instanz. Das verlangte
eine Ablage je Mandant — also genau die verschlüsselte Ablage, die §0 verworfen hat. Ein solcher Ausbau
braucht zuerst eine neue Entscheidung (Plan: Stufe 2).

---

## 8. Least Privilege

- **DB-User** nur mit nötigen Rechten (kein Superuser für die App).
- **API-Key** mit minimalem Scope/Budget; getrennte Keys je Umgebung (Dev/Prod nicht teilen).
- **OIDC-Client** minimal konfiguriert; Admin-Rolle nur bei exakt gesetzter Gruppe (`OIDC_GROUP_ADMIN`).
- **Quellsystem-Tokens** nur lesend und auf den einen Space bzw. die eine Bibliothek beschränkt.
- **Service-/Personenkonten** trennen; keine geteilten „Sammel"-Secrets.

## 9. Client-Bundle-Regel (G-7) — KEINE Secrets in `apps/web`

- Das Frontend darf **keine** Secrets enthalten. `apps/web/src` nutzt nur Build-Flags `import.meta.env.DEV/PROD` — **keine** `VITE_*`-Secrets, keine API-Keys, kein `process.env`.
- **Alle** Modell-/E-Mail-/OIDC-/DB-Secrets leben **ausschließlich serverseitig**; der Browser spricht nur mit `/api` des eigenen Servers. Ein im JS-Bundle hinterlegtes Geheimnis ist für jeden lesbar — daher verboten.
- Externer Modell-Egress und Zugriff auf die Modellschlüssel stehen nur in den Chokepoint-Dateien (`tests/security/egress-chokepoint.test.ts`).
- Pre-Launch-Zugangsschutz sitzt **vor** der App (Reverse-Proxy), nicht im Bundle.

## 10. Secret Scanning / Review

- **Im Testlauf:** `tests/geheimnisse-betrieb/geheimnisse-nur-in-der-betriebsumgebung.test.ts` sucht im Produktbaum (und im gebauten Bundle, falls vorhanden) nach echtem Schlüsselmaterial. Er prüft den aktuellen Stand, **nicht** die Git-Historie.
- **Pre-Commit/CI-Scan der Historie** (z. B. `gitleaks`/`trufflehog`) bleibt empfohlen — Einrichtung ist Betreiber-/Ops-Aufgabe.
- **PR-Review:** `.env.example` enthält nur Platzhalter; keine echten Werte in Diffs/Logs.
- **Periodischer Review:** Secret-/Zugriffs-Check und fällige Wechsel (§1b) im **Quartals-Compliance-Review** (`gdpr-compliance-runbook.md` §6) mitführen.

---

## 11. Offene Betreiberpflichten / Nicht-Ziele

- **Zuständigkeit und Termine sind festgelegt** (§1b, Peters Entscheidung vom 12.10.). Offen bleibt
  die **Durchführung** der Wechsel zu diesen Terminen und das Eintragen von Datum und Beleg in §1b.
- Offene Handgriffe aus OFFEN.md I56 (Schlüssel in Coolify wechseln, Protokolldatei löschen) — Peter vorbehalten, Termin §1b.
- Auswahl/Einrichtung eines **externen Secret-Stores** (Vault/Doppler/Cloud SM) — Option, nicht eingerichtet.
- **Secret-Scanning der Git-Historie** in CI aktivieren — Ops-Aufgabe.
- **Eigene Schlüssel je Kunde in einer gemeinsamen Instanz** — nicht gebaut, braucht Entscheidung (§7a).

---

*Ops-Runbook. Keine echten Secrets erzeugt; kein externer Secret-Store installiert.*
