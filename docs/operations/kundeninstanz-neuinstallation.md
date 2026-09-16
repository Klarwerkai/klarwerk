# Eine neue Kundeninstanz aufsetzen (Linux + Docker Compose)

**Zweck:** Von einer leeren Linux-Maschine zu einer benutzbaren, isolierten KLARWERK-Instanz —
eigene Datenbank, eigene Domain, eigener erster Administrator. Stand: 16.09.2026 (JOB 4201).

**Was Sie am Ende haben:** eine laufende Instanz, in der Sie sich anmelden, ein Wissensobjekt mit
Quelle und Anhang erfassen und nach einem Neustart von Anwendung **und** Datenbank alles unverändert
wiederfinden. Und: wenn Sie eine Pflichtangabe vergessen, **bricht der Start ab und nennt den Namen
des fehlenden Wertes** — statt zu gelingen und auf eine fremde Adresse zu zeigen.

---

## 0. Welcher Weg ist das hier — und welcher nicht?

Es gibt drei Betriebswege, und sie werden leicht verwechselt:

| Weg | Wofür | Wo beschrieben |
|---|---|---|
| **Kundeninstanz (dieser Text)** | Eigenständige Instanz auf einer Linux-Maschine, Docker Compose, eigene PostgreSQL, eigene Domain | **hier** |
| Coolify-Betrieb (Hetzner) | Die von Pedi betriebene Instanz; Coolify baut über das `Dockerfile` | `docs/operations/deploy-hetzner.md` |
| „Insel" (Mac Studio) | Nativ und lokal, **kein Docker**, kein Cloud-Schlüssel, nur `127.0.0.1` | `scripts/insel/README.md` |

Dieser Text beschreibt **ausschließlich** den ersten Weg. Er richtet **nichts** an einer bestehenden
Instanz ein und ändert nichts an DNS, Servern oder der Live-Umgebung.

**Nicht Gegenstand dieses Textes, weil an anderer Stelle bereits belegt** (bitte dort nachlesen,
nicht hier improvisieren):

- **Sicherung und Wiederherstellung:** `scripts/backup/backup.sh`, `scripts/backup/RESTORE.md`,
  `docs/operations/restore-drill.md` (Jobs 4010/4097/4107).
- **Update und Rückfall:** `docs/operations/maintenance-update-process.md` §6.1 (Jobs 4012/4057/4127).
- **Absicherung des Servers** (Firewall, Proxy, Ports nach außen): `docs/operations/server-hardening-readiness.md`.

---

## 1. Voraussetzungen

Nur das, was wirklich gebraucht wird:

1. Eine Linux-Maschine mit **Docker** und **Docker Compose** (`docker compose version` antwortet).
2. Eine **Domain**, die auf diese Maschine zeigt, und ein **TLS-Proxy davor** (siehe §5 —
   das ist keine Empfehlung, sondern Bedingung).
3. Dieses Repository auf der Maschine (die Compose-Datei baut das Abbild selbst).

**Keine Angabe zu CPU, RAM oder Plattenplatz.** Eine solche Zahl ist im Repo nirgends gemessen;
sie hier zu erfinden, wäre eine Zusage ohne Grundlage. Der Container bringt LibreOffice Impress und
poppler mit (für die Folienausgabe) — das ist der größte Einzelposten des Abbilds.

---

## 2. Die Werte, die Sie setzen müssen

Legen Sie neben der Compose-Datei eine Datei `.env` an. Die eine Wahrheit darüber, welche Werte es
gibt, wofür sie gelten und was ohne sie nicht geht, ist der **Startvertrag**
(`services/app/src/start-vertrag.ts`); die vollständige, kommentierte Liste steht in
`env.demo.beispiel`.

### 2.0 Die Datei `.env`, vollständig

Das hier ist alles, was auf diesem Weg über `.env` wirkt. **Jeder Name in diesem Block wird von
`docker-compose.prod.yml` wirklich durchgereicht** — was hier nicht steht, hat in der `.env` keine
Wirkung (siehe §2.4).

<!-- env-beispiel -->
```dotenv
# Pflicht — ohne diese beiden bricht `docker compose` ab und nennt den fehlenden Namen.
POSTGRES_PASSWORD=
APP_BASE_URL=

# Optional. Auskommentiert lassen heißt: es gilt die Vorgabe.
# CANONICAL_HOST=
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
# SMTP_SECURE=
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# OPENAI_BASE_URL=
# REASONER_MODEL=
# OIDC_ISSUER=
# OIDC_AUDIENCE=
# OIDC_JWKS_URI=
# OIDC_AUTOPROVISION=
```

### 2.1 Pflicht — ohne diese Werte startet nichts

| Wert | Was er ist | Was ohne ihn passiert |
|---|---|---|
| `POSTGRES_PASSWORD` | Das Kennwort der mitgelieferten Datenbank. Frei wählbar, aber **nicht leer**. | `docker compose` bricht ab und nennt den Namen. Die Anwendung selbst liest diesen Wert nie — er wird nur benutzt, um die Verbindungszeichenkette zusammenzusetzen. |
| `APP_BASE_URL` | Die **öffentliche Adresse dieser Instanz**, z. B. `https://wissen.kunde.de`. | `docker compose` bricht ab und nennt den Namen. Ohne ihn verschickte der Kennwort-Zurücksetzen-Weg später eine Mail **ohne Link** — ein Fehler, den man erst beim Klicken merkt. |

> **Die Falle, die dieser Durchgang geschlossen hat.** Bis zum 16.09.2026 trug die Compose-Datei
> für `APP_BASE_URL` einen Vorgabewert auf die öffentliche Vorführ-Domain. Der Start **gelang**
> dann — und die neue Kundeninstanz zeigte still auf eine fremde Adresse. Der Vorgabewert ist
> entfernt; `APP_BASE_URL` ist jetzt eine echte Pflichtangabe des Ein-Befehl-Weges.
>
> **Ein Rest bleibt, und er steht hier offen:** `.env.example` enthält die Vorführ-Adresse als
> Beispielwert. Wer `.env` daraus ableitet und die Zeile **nicht ersetzt**, hat einen gesetzten
> Wert — und kommt an der Pflichtprüfung vorbei. Prüfen Sie diese Zeile.

### 2.2 `CANONICAL_HOST` — im Zweifel: **nicht anfassen**

Die Anwendung leitet **genau einen** Wirtsnamen um: `app.<CANONICAL_HOST>` geht dauerhaft (301) auf
`https://<CANONICAL_HOST>`, pfaderhaltend. Alle anderen Wirtsnamen werden **nicht** angefasst.

Daraus folgt das Wichtigste zuerst: **Wenn Sie den Wert nicht setzen, passiert Ihrer Instanz
nichts.** Die Vorgabe ist `klarwerk.ai`, und Ihr Wirtsname heißt nicht `app.klarwerk.ai`.

Umgekehrt ist es das **Setzen**, das die Umleitung erzeugt. Setzen Sie `CANONICAL_HOST` auf die
übergeordnete Domain, obwohl dort gar keine KLARWERK-Instanz steht, schicken Sie jeden Besucher auf
eine Adresse, die Sie nicht bedienen.

Diese Tabelle ist **gemessen**, nicht beschrieben: `tests/neuinstallation/pflichtkonfiguration.test.ts`
(H2) führt jede Zeile gegen den echten Umleitungscode aus `services/app/src/server.ts` aus.

<!-- kanonik-messung -->

| Ihr Wirtsname | `CANONICAL_HOST` | Gemessene Wirkung |
|---|---|---|
| `wissen.kunde.test` | nicht gesetzt | keine Umleitung |
| `app.kunde.test` | nicht gesetzt | keine Umleitung |
| `app.kunde.test` | `app.kunde.test` | keine Umleitung |
| `app.kunde.test` | `kunde.test` | 301 → https://kunde.test |
| `app.klarwerk.ai` | nicht gesetzt | 301 → https://klarwerk.ai |

Praktisch:

- Instanz unter `wissen.kunde.de` → **nichts setzen**.
- Instanz unter `app.kunde.de`, und `kunde.de` ist Ihre Firmenwebsite → **nichts setzen**. Würden
  Sie `CANONICAL_HOST=kunde.de` setzen, landete jeder Besucher auf der Firmenwebsite (Zeile 4).
- Instanz unter `app.kunde.de`, und `kunde.de` liefert dieselbe Instanz aus → `CANONICAL_HOST=kunde.de`
  setzen, damit es bei **einer** Adresse bleibt.
- **Niemals leer setzen:** ein leerer Wert ist nicht dasselbe wie ein nicht gesetzter — er schaltet
  die Umleitung still ganz ab (gemessen in H4).

### 2.3 `SMTP_HOST` und `SMTP_FROM`

Ohne Postausgangsserver gibt es **keinen Mailversand**: Kennwort-Zurücksetzen und Benachrichtigungen
erreichen niemanden; die Mail landet nur im Protokoll. Die Instanz läuft trotzdem, Kennwörter setzt
dann ein Administrator. Die Vorgabe-Absenderadresse `noreply@klarwerk.ai` ist für eine eigene Domain
meist falsch — `SMTP_FROM` mitsetzen.

### 2.4 Was Sie auf diesem Weg **nicht** über `.env` steuern

Diese drei Werte stehen in `docker-compose.prod.yml` **fest**. Ein Eintrag in der `.env` bleibt
wirkungslos — er ändert nichts und erzeugt trotzdem den Eindruck, etwas eingestellt zu haben.
Geprüft wird das in `tests/neuinstallation/pflichtkonfiguration.test.ts` (D6/D6b).

| Wert | Fest auf | Wenn Sie es wirklich anders brauchen |
|---|---|---|
| `DATABASE_URL` | aus `POSTGRES_PASSWORD` und dem Dienst `db` zusammengesetzt | Eine **externe** Datenbank verlässt den Ein-Befehl-Weg: dafür ändern Sie diese Zeile in der Compose-Datei (und entfernen den Dienst `db`). Das ist nicht Gegenstand dieser Anleitung. Eine Instanz teilt ihre Datenbank mit niemandem — es muss eine eigene, leere sein. |
| `COOKIE_SECURE` | `true` | Nicht abschaltbar, siehe §5. Der Abbruch `COOKIE_SECURE=false ist in Produktion nicht erlaubt` kann Sie auf diesem Weg gar nicht treffen; er trifft Betriebswege, bei denen die Umgebung von außen gesetzt wird (z. B. Coolify). |
| `PORT` | `3001` | Der Port **im** Container. Was Sie außen erreichen wollen, stellen Sie in der Portabbildung der Compose-Datei ein. |

### 2.5 Optional: KI

`ANTHROPIC_API_KEY` und `OPENAI_API_KEY` sind **beide optional**. Ohne jeden Schlüssel arbeitet der
deterministische Ersatzmodus — die Instanz ist vollständig benutzbar, die KI-Antworten sind
regelbasiert und werden auf der Oberfläche ehrlich als solche ausgewiesen. Wer `OPENAI_API_KEY`
setzt, setzt **immer auch** `REASONER_MODEL` (sonst bleibt der OpenAI-Weg stumm). Schlüssel gehören
in die `.env` auf der Maschine, **niemals ins Repository**.

---

## 3. Der Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Der erste Lauf baut das Abbild und lädt Pakete; das dauert einige Minuten. Danach:

```bash
curl -fsS http://127.0.0.1:3001/health
```

Erwartet: `{"status":"ok"}`. Der Container horcht auf Port **3001** (so setzt es der `Dockerfile`,
so liest es `services/app/src/server.ts`), die Compose-Datei veröffentlicht ihn unverändert.

**Was in den Protokollen stehen muss** (`docker compose -f docker-compose.prod.yml logs app`):

- `KLARWERK läuft auf :3001 — Datenhaltung: Postgres`
  Steht dort etwas anderes als `Postgres`, läuft Ihre Instanz auf nicht-dauerhaftem Speicher und
  verliert bei jedem Neustart alles. Dann stimmt `DATABASE_URL` nicht.

---

## 4. Der erste Administrator — kontrolliert, und zwar sofort

Eine leere Instanz meldet über `GET /api/auth/status` `needsSetup: true` und zeigt in der
Oberfläche die **Ersteinrichtung**. Das dort angelegte erste Konto wird **Administrator**. Danach
antwortet derselbe Weg (`POST /api/auth/setup`) mit **409 `ALREADY_SETUP`** — das Fenster schließt
sich von selbst, ein zweiter Administrator kann so nicht entstehen.

**Was daran wirklich zählt, und es ist unangenehm:** Zwischen dem Moment, in dem Ihre Instanz
erreichbar ist, und dem Moment, in dem Sie die Ersteinrichtung abschließen, kann **jeder**, der die
Adresse kennt, dieses Konto beanspruchen. Daraus folgt die Reihenfolge:

1. Instanz starten, **noch nicht** öffentlich erreichbar machen (Proxy/Firewall zu, oder nur über
   einen SSH-Tunnel erreichbar).
2. Ersteinrichtung **selbst** durchführen.
3. Erst danach die Domain freischalten.

**Der öffentliche Registrierweg ist per Vorgabe zu.** `POST /api/auth/register` antwortet mit
403 `REGISTRATION_DISABLED`, solange `KLARWERK_SELF_REGISTRATION` nicht ausdrücklich gesetzt ist.
Weitere Konten legt danach der Administrator an (Rolle `viewer`, `experte` oder `controller`) —
für Gäste bitte **befristet**.

> Diese Aussagen sind am Code gemessen, nicht fortgeschrieben:
> `tests/neuinstallation/pflichtkonfiguration.test.ts` (E1/E2) und der echte Lauf
> `tests/neuinstallation/erstinstallation.integration.test.ts` (N1) führen sie aus.
> Der ältere Satz „der erste *registrierte* Anwender wird Admin" in `docs/operations/deploy-hetzner.md`
> (Stand 05.07.2026) ist dort am 16.09.2026 berichtigt worden.

---

## 5. TLS ist keine Option

Die Compose-Datei setzt `COOKIE_SECURE` auf `true`, und der `Dockerfile` setzt `NODE_ENV` auf
`production`. In Produktion wird das Secure-Flag am Sitzungsplätzchen **erzwungen**; abschalten
lässt es sich nicht — ein ausdrückliches `COOKIE_SECURE=false` **bricht den Start ab**
(`services/auth/src/routes.ts`, `assertCookieSecurityConfig`).

**Was das praktisch bedeutet:** Erreichen Sie die Instanz zunächst über `http://` (zum Beispiel
direkt über die IP), sieht die Anmeldung aus, als würde sie funktionieren — der Browser verwirft
das Plätzchen aber stillschweigend, und Sie landen sofort wieder auf der Anmeldemaske. Das ist
**kein** Kennwortfehler. Setzen Sie einen TLS-Proxy davor und rufen Sie die Instanz über `https://`
auf.

---

## 6. Neustart

```bash
docker compose -f docker-compose.prod.yml restart
```

Erwartet: Konten, Wissensobjekte, Quellen, Anhänge und Rechte sind unverändert da; bestehende
Anmeldungen gelten weiter (die Sitzungen liegen in der Datenbank, nicht im Prozess).

**Was davon belegt ist — und womit.** „Neustart" ist dreierlei, und die Belege sind unterschiedlich
stark. `tests/neuinstallation/erstinstallation.integration.test.ts` trennt das ausdrücklich:

| Ebene | Belegt durch | Was dabei gemessen wird |
|---|---|---|
| Anwendung neu **aufgebaut** (gleicher Prozess) | N1 | Bestand, Quelle, Anhangszuordnung, Rechte und Sitzungen kommen aus der Datenhaltung, nicht aus dem Arbeitsspeicher. |
| Anwendungs**prozess** neu gestartet | N3 | Der Produktionseinstieg (`server.ts`, `NODE_ENV=production`) fährt über einen echten Socket gegen den vorhandenen Bestand wieder hoch; die Datei kommt über `/api/objects/:id/raw` **Byte für Byte** zurück. |
| **Datenbankdienst** neu gestartet | N1, aber nur wo der Testlauf die Datenbank selbst betreibt | Läuft der Test gegen eine vorgegebene PostgreSQL, wird deren Dienst **nicht** angefasst; der Lauf meldet das sichtbar. |

Was **nicht** gemessen ist und deshalb hier nicht zugesagt wird: der Aufbau über `docker compose`
selbst, das gebaute Abbild, Browser und TLS. Der Befehl oben ist der richtige Weg — sein Ergebnis
auf Ihrer Maschine ist Ihre Messung, nicht unsere.

Die Daten liegen im Docker-Volume `pgdata`. **Löschen Sie es nie** ohne Sicherung —
`docker compose down -v` entfernt es mit.

---

## 7. Was tun, wenn …

| Was Sie sehen | Was los ist | Was zu tun ist |
|---|---|---|
| `docker compose` bricht sofort ab und nennt einen Namen, z. B. `APP_BASE_URL setzen — …` | Genau dieser Pflichtwert fehlt in Ihrer `.env`. So soll es sein: der Abbruch kommt **vor** dem Start. | Wert in `.env` eintragen, Befehl wiederholen. |
| Start gelingt, aber Kennwort-Mails enthalten Links auf eine **fremde** Adresse | `APP_BASE_URL` ist gesetzt, zeigt aber auf die Vorführ-Domain — vermutlich ungeändert aus `.env.example` übernommen (§2.1). | Zeile in `.env` auf Ihre Adresse ändern, Instanz neu starten. |
| Die Anmeldung „klappt", landet aber sofort wieder auf der Maske | Sie erreichen die Instanz über `http://`; das Sitzungsplätzchen wird verworfen (§5). | Über `https://` aufrufen, TLS-Proxy davorsetzen. |
| Jeder Besucher landet auf einer fremden Website | Ihre Instanz läuft unter `app.<etwas>` und `CANONICAL_HOST` **ist auf `<etwas>` gesetzt** — die Umleitung entsteht durch das Setzen, nicht durch die Vorgabe (§2.2, Zeile 4 der Messtabelle). | Die Zeile `CANONICAL_HOST=` aus der `.env` **entfernen** (nicht leeren) und die Instanz neu starten. |
| Im Protokoll steht `Datenhaltung: In-Memory` statt `Postgres` | Die Anwendung hat keine gültige `DATABASE_URL` bekommen. Alles, was Sie eingeben, ist beim nächsten Neustart weg. | Sofort stoppen, `POSTGRES_PASSWORD`/`DATABASE_URL` prüfen, neu starten. |
| Der Start bricht mit `COOKIE_SECURE=false ist in Produktion nicht erlaubt` ab | Das Secure-Flag wurde abzuschalten versucht (§5). Auf **diesem** Weg kann das nicht aus der `.env` kommen — die Compose-Datei schreibt `true` fest (§2.4); es kommt dann aus einer geänderten Compose-Datei oder einem anderen Betriebsweg. | Den Wert wieder auf `true` stellen und TLS davorsetzen. |
| Der Start bricht mit `KLARWERK-Start abgebrochen: … Pflichtwert(e)` ab | Der Startvertrag der Anwendung — er nennt **alle** fehlenden Namen auf einmal. | Alle genannten Werte nachtragen. |
| Nach dem Start ist der Port nicht erreichbar | Die Instanz horcht auf 3001; ein Proxy oder eine Firewall trifft einen anderen Port. | Proxy auf 3001 richten; siehe `docs/operations/server-hardening-readiness.md`. |
| Die Ersteinrichtung ist schon weg (409) | Jemand war schneller — oder Sie haben sie bereits durchgeführt. | Wenn Sie es nicht waren: Instanz sofort vom Netz nehmen, Datenbank verwerfen, neu aufsetzen und §4 einhalten. |

---

## 8. Ehrliche Grenzen dieses Textes

- **Nicht gemessen und deshalb nicht zugesagt:** wie lange der erste Build auf Ihrer Maschine
  dauert, welche Hardware reicht, und ob Ihr Proxy TLS korrekt terminiert. Das ist
  Laufzeitkonfiguration außerhalb dieses Repositorys.
- Der Abbruch des Ein-Befehl-Weges bei fehlender Pflichtangabe ist als Fall **N2** in
  `tests/neuinstallation/erstinstallation.integration.test.ts` hinterlegt. Auf einer Maschine
  **ohne** `docker compose` meldet dieser Lauf den Grund sichtbar und überspringt — ein
  übersprungener Lauf ist kein bestandener.
- SSO/OIDC, eine echte Microsoft-365-Anbindung, SMTP im Echtbetrieb, Skalierung und Monitoring sind
  eigene Themen und hier bewusst nicht beschrieben.
