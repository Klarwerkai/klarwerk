# Klarwerk — Secrets-Management (Betreiber-Runbook)

> Praktisches Ops-Runbook für API-Keys, Zugangsdaten, Zertifikate und sonstige Secrets.
> **Keine echten Secrets** in diesem Dokument. Konfig-Vorlage: `.env.example` (nur Platzhalter).
> Verwandte Doku: `docs/operations/deploy-hetzner.md`, `docs/operations/pre-launch-protection.md`,
> `docs/compliance/gdpr-compliance-runbook.md`. Grundregel G-7: **keine Geheimnisse im Client-Bundle.**
>
> Fassung 2026-10-08 (Auftrag `aufnahme:20260922:gesamt-geheimnisse-betrieb`, Basis `a42c2881`):
> Grundentscheidung (§0), vollständiges Inventar mit Ordnung und Wechsel (§1), Erhebungsprotokoll (§1a),
> eigene Kundenschlüssel (§7a). Die Inventarliste wird gegen den Startvertrag geprüft:
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

**Ordnung (Ebenen).** Eine höhere Ebene schützt alle darunter: Wer sie hat, kann die Werte der
tieferen Ebenen lesen oder ersetzen. Daraus folgt die Wechselregel im Notfall (§7): **Ist eine Ebene
kompromittiert, werden ihre Werte UND alle Werte der tieferen Ebenen gewechselt.**

| Ebene | Art | Was dazu gehört |
| --- | --- | --- |
| **0** | Wurzelzugang zur Betriebsplattform | Coolify-/Hetzner-Konto, Server-SSH — liest und setzt jede Service-Env |
| **1** | Datenhaltung | Datenbank-Zugang |
| **2** | Ausgehende Anbieter-Zugänge | KI-Modelle, Transkription, Postausgang, Single Sign-on |
| **3** | Quellsystem-Zugänge (Import, lesend) | Confluence, SharePoint/OneDrive |
| **4** | Produkteigene Geheimnisse | Add-in-Schlüssel, Signatur der Antwortbelege |

**Inventar der Umgebungsvariablen.** Jede Variable, die der Startvertrag
(`services/app/src/start-vertrag.ts`) als `geheim: true` führt, steht hier — der Test oben bricht,
sobald eine fehlt. Ablageort für alle: **Service-Env in Coolify** (Produktion) bzw. `.env.local` (lokal).

| Ebene | Geheimnis | Variable | Ohne Wert | Regulärer Wechsel | Folge des Wechsels |
| --- | --- | --- | --- | --- | --- |
| 1 | Datenbank-Zugang | `DATABASE_URL` | Produktion startet nicht (In-Memory nur mit ausdrücklicher Ausnahme) | jährlich und bei Personal-/Infrastrukturwechsel | Neustart; Kennwort zuerst in Postgres ändern, dann Env setzen |
| 2 | KI-Schlüssel Anthropic | `ANTHROPIC_API_KEY` | deterministischer Ersatzmodus | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; alten Schlüssel beim Anbieter widerrufen |
| 2 | KI-Schlüssel OpenAI | `OPENAI_API_KEY` | OpenAI-Weg inaktiv | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; alten Schlüssel beim Anbieter widerrufen |
| 2 | Schlüssel des lokalen Modells | `KLARWERK_LOCAL_LLM_KEY` | lokaler Weg ohne Schlüssel | mit dem Schlüssel des lokalen Modellservers | Neustart; Wert am Modellserver und hier gleichzeitig ändern |
| 2 | Transkriptionsdienst | `MEDIA_TRANSCRIBE_API_KEY` | keine Transkription | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; alten Schlüssel beim Anbieter widerrufen |
| 2 | Postausgang | `SMTP_PASS` (+ `SMTP_USER`) | kein authentifizierter Versand | ≤ 12 Monate bzw. Anbieter-Policy | Neustart; Testmail über den Kennwort-zurücksetzen-Weg |
| 2 | Single Sign-on | `OIDC_CLIENT_SECRET` | Client gilt als öffentlich (nur PKCE) | ≤ 12 Monate bzw. Ablauf beim IdP | Neustart; neues Secret beim IdP vor dem Widerruf des alten anlegen |
| 3 | Confluence-Token | `KLARWERK_CONFLUENCE_TOKEN` | kein Confluence-Client, Zustand „nicht gesetzt“ | ≤ 12 Monate bzw. Ablauf bei Atlassian | Neustart; Zustandsanzeige muss „gesetzt“ zeigen |
| 3 | SharePoint-/OneDrive-Token | `KLARWERK_SHAREPOINT_TOKEN` | kein SharePoint-Client, Zustand „nicht gesetzt“ | mit Ablauf bei Microsoft, spätestens 12 Monate | Neustart; Zustandsanzeige muss „gesetzt“ zeigen |
| 4 | Add-in-Schlüssel | `KLARWERK_ADDON_API_KEY` | Add-in-Pfad ist zu | ≤ 12 Monate und bei jedem Wechsel des Add-in-Verteilwegs | Neustart; das Add-in braucht denselben neuen Schlüssel |
| 4 | Signatur der Antwortbelege | `KLARWERK_ASK_RECEIPT_SECRET` | signiert mit einem prozesslokalen Zufallswert (`services/ask/src/service.ts`); nach einem Neustart nicht mehr bestätigbar | nur bei Verdacht oder Personenwechsel | Ein Beleg trägt kein Schlüsselkennzeichen: vorher ausgestellte Belege lassen sich mit dem neuen Wert nicht mehr bestätigen |

**Schlüsselmaterial außerhalb der Umgebungsvariablen:**

| Ebene | Geheimnis | Wo es liegt | Wechsel |
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
1. Neuen Wert beim Anbieter erzeugen (bzw. bei Ebene 4 selbst: `openssl rand -hex 32`); den alten
   noch **nicht** widerrufen.
2. Neuen Wert in Coolify als Service-Env setzen, Service **neu starten** — ein laufender Prozess
   behält sonst den alten Wert.
3. Wirkung prüfen, ohne den Wert anzuzeigen: Startbericht bzw. Zustandsanzeige im Admin („gesetzt“),
   ein echter Aufruf des betroffenen Wegs.
4. Erst dann den alten Wert beim Anbieter **widerrufen**.
5. Datum des Wechsels im Betriebsprotokoll festhalten (nur Name und Datum, nie Wert oder Präfix).

**Notfallwechsel** (bei Leak/Verdacht/Offboarding mit Zugriff) — sofort, Reihenfolge umgekehrt:
1. Betroffenes Secret beim Anbieter **widerrufen** und **neu** erzeugen. Ist eine Ebene 0 oder 1
   betroffen, gilt das auch für alle tieferen Ebenen (§1, Ordnung).
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
- **Periodischer Review:** Secret-/Zugriffs-Check und fällige Wechsel (§1) im **Quartals-Compliance-Review** (`gdpr-compliance-runbook.md` §6) mitführen.

---

## 11. Offene Betreiberpflichten / Nicht-Ziele

- **Wechsel tatsächlich terminieren** und Verantwortlichen benennen — organisatorisch.
- Offene Handgriffe aus OFFEN.md I56 (Schlüssel in Coolify wechseln, Protokolldatei löschen) — nur der Betreiber.
- Auswahl/Einrichtung eines **externen Secret-Stores** (Vault/Doppler/Cloud SM) — Option, nicht eingerichtet.
- **Secret-Scanning der Git-Historie** in CI aktivieren — Ops-Aufgabe.
- **Eigene Schlüssel je Kunde in einer gemeinsamen Instanz** — nicht gebaut, braucht Entscheidung (§7a).

---

*Ops-Runbook. Keine echten Secrets erzeugt; kein externer Secret-Store installiert.*
