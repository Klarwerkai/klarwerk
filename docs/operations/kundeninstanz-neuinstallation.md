# Eine neue Kundeninstanz aufsetzen (Linux + Docker Compose)

**Zweck:** Von einer leeren Linux-Maschine zu einer benutzbaren, isolierten KLARWERK-Instanz —
eigene Datenbank, eigene Domain, eigener erster Administrator. Stand: 16.09.2026 (JOB 4201),
fortgeschrieben am 26.09.2026: der ganze Weg — leere Compose-Installation, HTTPS im echten Browser,
Neustart von Anwendung **und** Datenbank — ist als ausführbare Prüfstrecke hinterlegt (§9) und auf
einem leeren Linux-Prüfplatz **erfolgreich gefahren** (Laufstand und Belege in §9.1). Gemessen ist
damit genau **dieser** Weg auf **einem** Platz — keine Zusage für jede Maschine.

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
   Auf Ubuntu 24.04 genügen die Pakete der Distribution: `sudo apt-get install docker.io
   docker-compose-v2 docker-buildx`. Genau so hat die Prüfstrecke (§9) den leeren Prüfplatz
   eingerichtet (gemessen: Docker 29.1.3, Compose 2.40.3, Buildx 0.30.1; §9.1).
2. Eine **Domain**, die auf diese Maschine zeigt, und ein **TLS-Proxy davor** (siehe §5 —
   das ist keine Empfehlung, sondern Bedingung; §5.2 beschreibt den Proxy der Prüfstrecke).
3. Dieses Repository auf der Maschine (die Compose-Datei baut das Abbild selbst) — sauber, in genau
   der Fassung, die Sie installieren wollen (z. B. `git clone` bzw. `git archive <commit>`).

**Keine Mindestangabe zu CPU, RAM oder Plattenplatz.** Die Prüfstrecke (§9) schreibt in ihren
Beleg, auf welchem Platz sie lief. Der erfolgreiche Lauf (§9.1) lief auf 8 Kernen, 32 GB RAM und
rund 22 GB freiem Platz unter `/var/lib/docker`; der erste Abbildbau dauerte dort rund eine Minute.
Das belegt **einen** Platz, auf dem es ging — keine Mindestanforderung.
Der Container bringt LibreOffice Impress und poppler mit (für die Folienausgabe) — das ist der
größte Einzelposten des Abbilds.

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
> **Der Rest ist seit dem 25.09.2026 geschlossen:** `.env.example` enthielt die Vorführ-Adresse als
> Beispielwert; wer `.env` daraus ableitete und die Zeile nicht ersetzte, kam an der Pflichtprüfung
> vorbei. Die Zeile steht dort jetzt **leer**. Eine unverändert übernommene `.env.example` bricht
> `docker compose` damit genauso ab wie ein fehlender Wert — gemessen am echten `up` auf dem
Prüfplatz (§9, K6a; §9.1): Abbruch mit `required variable APP_BASE_URL is missing a value`, danach
kein Container, kein Volume, kein Netz.

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
erreichen niemanden. **Die Mail steht dann auch nicht im Protokoll** — sie wird nur im Arbeitsspeicher
der Anwendung abgelegt und ist nirgends lesbar (`ConsoleMailer` in
`services/notifications/src/mailer.ts`; bis zum 25.09.2026 stand hier fälschlich, sie lande im
Protokoll). Die Instanz läuft trotzdem, Kennwörter setzt dann ein Administrator. Die
Vorgabe-Absenderadresse `noreply@klarwerk.ai` ist für eine eigene Domain meist falsch — `SMTP_FROM`
mitsetzen.

Wohin der Kennwort-Link einer Mail zeigt, misst die Prüfstrecke (§9, K6c): ein eigener
Test-Empfänger (`SMTP_HOST=mailfalle`, `SMTP_PORT=2525`) nimmt die echte Mail der Instanz an, und
der Link muss auf `<APP_BASE_URL>/reset` und auf keine andere Adresse zeigen. Echte Mails verlassen
dabei den Prüfplatz nicht. Gemessen (§9.1): der Link zeigte auf `https://kundeninstanz.pruefplatz.test/reset`,
also auf die eigene `APP_BASE_URL`.

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

Mit `-p <projektname>` (z. B. `docker compose -p klarwerk -f docker-compose.prod.yml up -d --build`)
geben Sie der Instanz einen festen Projektnamen; ohne ihn nimmt Compose den Ordnernamen. Der Name
bestimmt, wie Container, Netz (`<projektname>_default`), Datenvolume (`<projektname>_pgdata`) und
das gebaute Abbild (`<projektname>-app`) heißen. Verwenden Sie danach bei **jedem** Befehl denselben
Namen. Der Prüfplatz (§9) fährt genau diesen Befehl, mit einem je Lauf eindeutigen Namen.

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

### 5.1 Warum

Die Compose-Datei setzt `COOKIE_SECURE` auf `true`, und der `Dockerfile` setzt `NODE_ENV` auf
`production`. In Produktion wird das Secure-Flag am Sitzungsplätzchen **erzwungen**; abschalten
lässt es sich nicht — ein ausdrückliches `COOKIE_SECURE=false` **bricht den Start ab**
(`services/auth/src/routes.ts`, `assertCookieSecurityConfig`).

**Was das praktisch bedeutet:** Erreichen Sie die Instanz zunächst über `http://` (zum Beispiel
direkt über die IP), sieht die Anmeldung aus, als würde sie funktionieren — der Browser verwirft
das Plätzchen aber stillschweigend, und Sie landen sofort wieder auf der Anmeldemaske. Das ist
**kein** Kennwortfehler. Setzen Sie einen TLS-Proxy davor und rufen Sie die Instanz über `https://`
auf.

### 5.2 Der TLS-Proxy der Prüfstrecke: Caddy im Netz der Instanz

Das ist der Proxy, mit dem die Prüfstrecke (§9) die Instanz im echten Browser bedient — so
gefahren im erfolgreichen Lauf (§9.1). Er läuft als
eigener Container **im Compose-Netz der Instanz** und reicht an den Dienst `app` auf Port 3001
weiter; die Anwendung selbst bleibt unverändert.

1. Zertifikat und Schlüssel für Ihren Namen in einen Ordner legen, als `instanz.pem` und
   `instanz-key.pem`. Der Prüfplatz erzeugt dafür je Lauf eine eigene Test-CA und stellt damit ein
   Zertifikat für `kundeninstanz.pruefplatz.test` aus; im Betrieb ist es das Zertifikat Ihrer Domain.
2. Daneben eine Datei `Caddyfile` mit genau diesem Inhalt (den Namen durch Ihren ersetzen):

<!-- caddyfile-eigenes-zertifikat -->
```caddyfile
{
	auto_https disable_redirects
	admin off
}
https://kundeninstanz.pruefplatz.test {
	tls /certs/instanz.pem /certs/instanz-key.pem
	reverse_proxy app:3001
}
```

3. Den Proxy starten — `<projekt>` ist der Projektname aus §3:

```bash
docker run -d --name <projekt>-tls --restart unless-stopped \
  --network <projekt>_default -p 127.0.0.1:443:443 \
  -v /pfad/zum/zertifikatsordner:/certs:ro -v /pfad/zur/Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:2-alpine
```

`127.0.0.1:443` hält den Proxy zunächst **nur lokal** erreichbar — das ist die Reihenfolge aus §4
(Ersteinrichtung, bevor die Adresse öffentlich wird). Danach die Portabbildung auf `443:443`
umstellen und den Container neu anlegen.

**Nicht gefahren und deshalb nicht zugesagt:** Caddy mit automatisch bezogenem Zertifikat für eine
öffentliche Domain (ein `Caddyfile` ohne `tls`-Zeile). Das ist der übliche Weg, braucht aber eine
echte, öffentlich erreichbare Domain — die hat der Prüfplatz nicht.

**Woran Sie sehen, dass es stimmt:** Der Browser öffnet `https://<ihr-name>/` ohne Warnung und zeigt
die Ersteinrichtung bzw. die Anmeldung. Die Prüfstrecke misst zusätzlich die Gegenrichtung: ein
Browserprofil, das der Test-CA **nicht** vertraut, bekommt die Seite nicht (Zertifikatsfehler) —
die Prüfung des Zertifikats ist also wirklich an.

---

## 6. Neustart

Der Weg der Prüfstrecke beendet **beide** Dienste und startet sie wieder:

```bash
docker compose -f docker-compose.prod.yml stop
docker compose -f docker-compose.prod.yml start
```

`stop`/`start` behalten Container und das Volume `pgdata`; nichts wird neu aufgebaut. Danach meldet
der Anwendungscontainer nach kurzer Zeit wieder `healthy` (`docker compose -f
docker-compose.prod.yml ps`), und die Instanz ist über den TLS-Proxy wieder erreichbar — der
Proxy selbst läuft dabei weiter und antwortet in der Zwischenzeit mit einem Fehler (502).

Erwartet: Konten, Wissensobjekte, Quellen, Anhänge und Rechte sind unverändert da; die
Ersteinrichtung wird **nicht** erneut verlangt. Bestehende Anmeldungen gelten weiter (die Sitzungen
liegen in der Datenbank, nicht im Prozess — gemessen in N1).

**Was davon belegt ist — und womit.** „Neustart" ist dreierlei, und die Belege sind unterschiedlich
stark. `tests/neuinstallation/erstinstallation.integration.test.ts` trennt das ausdrücklich:

| Ebene | Belegt durch | Was dabei gemessen wird |
|---|---|---|
| Anwendung neu **aufgebaut** (gleicher Prozess) | N1 | Bestand, Quelle, Anhangszuordnung, Rechte und Sitzungen kommen aus der Datenhaltung, nicht aus dem Arbeitsspeicher. |
| Anwendungs**prozess** neu gestartet | N3 | Der Produktionseinstieg (`server.ts`, `NODE_ENV=production`) fährt über einen echten Socket gegen den vorhandenen Bestand wieder hoch; die Datei kommt über `/api/objects/:id/raw` **Byte für Byte** zurück. |
| **Datenbankdienst** neu gestartet | N1, aber nur wo der Testlauf die Datenbank selbst betreibt | Läuft der Test gegen eine vorgegebene PostgreSQL, wird deren Dienst **nicht** angefasst; der Lauf meldet das sichtbar. |
| **Der ganze Weg dieser Anleitung**: `up -d --build` aus einem leeren Stand, gebautes Abbild, TLS-Proxy, Chromium über HTTPS, `stop`/`start` beider Dienste | Kundeninstallations-Strecke (§9), K1–K7 — erfolgreich gefahren (§9.1) | Container-Lebenszyklus (Startzeit, Prozess) **beider** Container und die Startzeit des PostgreSQL-Servers ändern sich, Container und Volume bleiben dieselben; ein neues Browserprofil meldet sich neu an und findet Dokument, Fassung, Text, Quelle und die Datei (SHA-256) unverändert; der Betrachter hat dieselben Rechte. |

Aufbau über `docker compose`, gebautes Abbild, Browser und TLS sind damit auf **einem** leeren
Prüfplatz gemessen (§9.1). Ihr Lauf auf Ihrer Maschine bleibt Ihre Messung.

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
| Der Browser meldet einen Zertifikatsfehler | Das Zertifikat am Proxy passt nicht zum Namen, ist abgelaufen oder stammt von einer Stelle, der der Browser nicht vertraut. | Zertifikat für genau den Namen aus `APP_BASE_URL` ausstellen; bei einer eigenen CA deren Stammzertifikat im Browser bzw. System hinterlegen (§5.2). Nicht „trotzdem fortfahren" — dann prüft niemand. |
| Über HTTPS kommt 502 | Der Proxy läuft, die Anwendung (noch) nicht — etwa kurz nach `start` (§6). | `docker compose -f docker-compose.prod.yml ps` abwarten, bis `app` `healthy` meldet. |

---

## 8. Ehrliche Grenzen dieses Textes

- **Nicht gemessen und deshalb nicht zugesagt:** wie lange der erste Build auf **Ihrer** Maschine
  dauert, welche Hardware **mindestens** reicht, und ob **Ihr** Proxy TLS korrekt terminiert. Der
  erfolgreiche Lauf der Prüfstrecke (§9.1) belegt Platz und Dauer **eines** Prüfplatzes.
- Der Abbruch des Ein-Befehl-Weges bei fehlender Pflichtangabe ist als Fall **N2** in
  `tests/neuinstallation/erstinstallation.integration.test.ts` hinterlegt. Auf einer Maschine
  **ohne** `docker compose` meldet dieser Lauf den Grund sichtbar und überspringt — ein
  übersprungener Lauf ist kein bestandener.
  Auf dem Prüfplatz misst die Strecke aus §9 denselben Abbruch am echten `up` (K6a) — dort ohne
  Übersprung.
- SSO/OIDC, eine echte Microsoft-365-Anbindung, SMTP im Echtbetrieb, Skalierung und Monitoring sind
  eigene Themen und hier bewusst nicht beschrieben.

---

## 9. Der Prüfweg: die ganze Strecke als ausführbare Prüfung

`tests/neuinstallation/kundeninstallation-strecke.integration.test.ts` fährt diese Anleitung auf
einem Prüfplatz von vorn bis hinten. **Als gemessen gilt der Weg nur mit einem erfolgreichen,
revisionsgebundenen Lauf (§9.1)** — die Strecke allein ist kein Nachweis. Gestartet wird sie
ausdrücklich, auf einem leeren Linux-Prüfplatz:

```bash
npx vitest run --config vitest.integration.config.ts \
  tests/neuinstallation/kundeninstallation-strecke.integration.test.ts
```

So ruft sie auch der gezielte Prüfweg des Testservers auf
(`testlauf.py --commit <SHA> --gezielt tests/neuinstallation/kundeninstallation-strecke.integration.test.ts`).

**Wann sie Pflicht ist.** Sobald ihr Dateiname auf der Kommandozeile steht (oder
`KLARWERK_KUNDENINSTALLATION=pflicht` gesetzt ist; ausgewertet in `vitest.integration.config.ts`,
Regel in `tests/neuinstallation/kundeninstallation/pflicht.ts`). Dann gibt es **keinen**
Übersprung: ein Platz, der Docker, Compose, HTTPS oder den Browser nicht trägt, ist **rot**. In
einem allgemeinen Integrationslauf ohne diesen Namen läuft sie nicht und meldet das sichtbar — ein
solcher Lauf ist für diese Strecke **kein** Nachweis. In `tools/check` steht sie bewusst **nicht**:
ein Tor, das an einem Compose-Bau hängt, sperrte jeden anderen Auftrag.

**Was der Platz braucht — und was der Lauf dafür tut.** Docker mit Compose, `openssl`, `certutil`
(Paket `libnss3-tools`) und Chromium (`npx playwright install chromium`). Fehlt Docker und ist
`sudo` ohne Passwort möglich, richtet der Lauf es aus der Paketverwaltung ein (die Pakete aus §1);
jeder Einrichtungsschritt steht im Beleg. Ohne Docker und ohne diese Möglichkeit ist der Platz
ungeeignet — rot.

**Der Weg, so wie die Strecke ihn fährt:**

| Schritt | Was geschieht | Was belegt wird |
|---|---|---|
| Leerer Platz | eindeutiger Projektname `kn-kundeninst-<zeit>-<zufall>`; Installationsordner per `git archive` aus genau dem geprüften Commit | Commit und Tree, Platzbefund (Host, Kernel, Kerne, RAM, freier Platz, Docker-/Compose-/Buildx-Fassung, Gesamtbestand), **kein** Container/Volume/Netz/Abbild dieses Projekts |
| K6a | `.env` ohne `APP_BASE_URL`, ohne `POSTGRES_PASSWORD` und unverändert aus `.env.example` → `up -d --build` | Abbruch mit dem Namen des Wertes, danach weiterhin nichts angelegt |
| K1 | `.env` wie §2.0 (plus Test-Mailempfänger, §2.3) → `docker compose -p <projekt> -f docker-compose.prod.yml up -d --build` | Abbild-ID des gebauten `<projekt>-app`, Bauzeit, `healthy`, `/health`, „Datenhaltung: Postgres", Datenbank `klarwerk_prod`, Volume `<projekt>_pgdata`, `COOKIE_SECURE=true`, kein KI-Schlüssel |
| TLS | Test-CA und Serverzertifikat je Lauf; Caddy aus §5.2 mit **genau dem** `Caddyfile` dieser Anleitung | Fingerabdrücke (SHA-256) von CA und Serverzertifikat; Vertrauensweg: CA im NSS-Speicher des Browserprofils |
| K6b | das gebaute Abbild ohne Pflichtwerte gestartet | Abbruch mit „KLARWERK-Start abgebrochen" und den fehlenden Namen |
| K2 | frisches Chromium-Profil über HTTPS: Ersteinrichtung, Anmeldung; zweites Profil versucht die Ersteinrichtung erneut; Betrachter über „Nutzer hinzufügen" | Profil ohne Test-CA bekommt einen Zertifikatsfehler; Sitzungsplätzchen `Secure` und `HttpOnly`; zweiter Versuch 409, genau ein Administrator |
| K3 | Dokument mit festem Unicode-Text über das Blatt, Bild-Anhang (SHA-256 vorab festgehalten), Quelle am Anhang | nach Neuladen über die Oberfläche: Kennung, Fassung (Historie), Titel/Text, Quelle mit Anhang, heruntergeladene Bytes |
| K5 | Betrachter liest; versucht eine Quelle anzuhängen; fragt einen vertraulichen Kontrolleintrag und dessen Datei direkt ab | Lesen gleich, Liste zeigt genau das erlaubte Dokument, Änderung 403, danach unverändert; Kontrolleintrag und Datei 404, Seite gesperrt |
| K6c | „Passwort vergessen?" für den Betrachter | Link der echten Mail zeigt auf `APP_BASE_URL` + `/reset`; die eigene Adresse wird nicht umgeleitet |
| K4 | `stop`/`start` wie §6, dann neues Profil, neue Anmeldung | Startzeit und Prozess beider Container und `pg_postmaster_start_time()` neu, Container und Volume gleich; alles aus K3 unverändert; K5 erneut |
| K7 | Gegenproben im eigenen Aufbau: nur `restart app`; Dateizeile vor einem Neustart beiseitegelegt | genau „DB-Neustart" bzw. genau „Datei" rot, alles andere grün; Rücknahme, danach grün |
| Bereinigung | eigene Container (`<projekt>-tls`, `<projekt>-mailfalle`), `down -v --rmi local` für das Projekt, Arbeitsordner | danach kein Container/Volume/Netz/Abbild dieses Projekts; fremde Abbilder bleiben |

**Wo die Belege liegen.** Am Ende druckt der Lauf seinen Beleg zwischen
`[KLARWERK · Kundeninstallation] BELEG` und `… BELEG ENDE` in seine Ausgabe (der Prüfweg des
Testservers sichert diese Ausgabe als `ausgabe.txt` samt `MANIFEST.json` mit SHA-256 außerhalb des
Servers) und legt ihn
zusätzlich unter `.local/logs/kundeninstallation/<kennung>.json` (nicht versioniert) ab. Passwörter werden je Lauf
erzeugt und im Beleg geschwärzt; der Kennwort-Link erscheint nur als Adresse ohne Token.

### 9.1 Laufstand

Nur ein Lauf mit Ausgang „bestanden" für einen bestimmten Commit — mit `ergebnis.json`,
`ausgabe.txt`, geprüftem HEAD und dem Beleg der Strecke (§9) — macht die Aussagen dieser Anleitung
über Compose, Abbild, Browser/TLS und Neustart zu einer Messung.

**Erfolgreicher Lauf, 26.09.2026** — Prüfauftrag `pa-1790404031-d93165f6`, Commit `c66eb812`
(Tree `567e017a`), Ausgang **bestanden**, 11 von 11 Fällen, kein Übersprung:

| Was | Gemessen |
|---|---|
| Prüfplatz | frischer UpCloud-Server (Anlage `b6-515bb4859f-g1`, Plan 8 Kerne/32 GB), Ubuntu 24.04.4, Kernel 6.8; vorher **0** Container, **0** Volumes, **0** Abbilder |
| Einrichtung | `apt-get install docker.io docker-compose-v2 docker-buildx libnss3-tools openssl` → Docker 29.1.3, Compose 2.40.3, Buildx 0.30.1 |
| K6a | alle drei Fehlfälle (ohne `APP_BASE_URL`, ohne `POSTGRES_PASSWORD`, `.env.example` unverändert) brechen `up` mit dem Namen ab; danach nichts angelegt |
| K1 | `up -d --build` in 66 s, Abbild `<projekt>-app` frisch gebaut und vom laufenden Container benutzt, `healthy`, Datenbank `klarwerk_prod`, eigenes Volume `<projekt>_pgdata`, `COOKIE_SECURE=true`, kein KI-Schlüssel |
| TLS | Caddy mit dem `Caddyfile` aus §5.2; Profil **ohne** Test-CA: „ERR_CERT_AUTHORITY_INVALID“ |
| K6b | gebautes Abbild ohne Werte: `APP_BASE_URL, DATABASE_URL` fehlen; nur mit Datenbank: `APP_BASE_URL` fehlt |
| K2 | Ersteinrichtung im Browser, Plätzchen `Secure`/`HttpOnly`; zweiter Versuch 409 „ALREADY_SETUP“; Rollen genau `admin`, `viewer` |
| K3/K4 | Kennung, Fassung 1, Unicode-Titel/-Text, Quelle mit Anhang und Datei-SHA-256 vor und nach `stop`/`start` gleich; beide Container mit neuer Startzeit und neuem Prozess, neue `pg_postmaster_start_time()`, Container und Volume dieselben |
| K5 | Betrachter liest vor und nach dem Neustart gleich; `PUT … add-source` 403; Kontrolleintrag, Dateiverweis und Rohdatei 404, Seite gesperrt |
| K6c | Kennwort-Link → `https://kundeninstanz.pruefplatz.test/reset` |
| K7 | nur `restart app` → genau `dbNeustart` rot; beiseitegelegte Dateizeile → genau `datei` rot; jeweils Rücknahme, danach grün |
| Bereinigung | danach kein Container/Volume/Netz/Abbild des Projekts, Arbeitsordner entfernt |

Belege: `ergebnis.json` und `ausgabe.txt` (mit dem vollständigen Streckenbeleg) im Belegordner des
Testservers zu diesem Prüfauftrag, gesichert mit `MANIFEST.json` (SHA-256 von `ausgabe.txt`:
`59472d6d…95bcd8`).

**Frühere Versuche (25.09.2026) ohne Lauf der Strecke:** `pa-1790327971-78504ec0` (7481c3d7),
`pa-1790334899-64290c4d` (e349c532), `pa-1790335469-1acf28a2` (4b083cf1),
`pa-1790336130-047a9462` (43c3e565) — jeweils „Prüfumgebung defekt" (Tor-Selbstprüfung des
Testservers am Ausgangsstand rot); diese Commits wurden nie geprüft.
