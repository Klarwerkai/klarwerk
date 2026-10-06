# Fastify-Sicherheitsrest GHSA-3m5p-2c4r-xxw2 — Neubewertung am aktuellen Stand

**Stand:** 06.10.2026 · **Basis:** `2b1131ad` (1.0.0-beta.1.713) · **Auftrag:** `aufnahme:20260922:fastify-restbewertung`

Ausgangspunkt ist der in JOB 4272 Runde 4 offen gelassene Rest (`fastify` 5.8.5, GHSA-3m5p-2c4r-xxw2,
s. `tests/produktionsabhaengigkeiten/README.md` Abschnitt „`fastify`", Stand 17.09.2026). Jener Bericht
bleibt unverändert als historische Messung stehen; diese Datei ist die Bewertung am heutigen Stand.

Die beiden Zeilen unten werden von `trustproxy-hopcount.test.ts` gegen `package-lock.json` und gegen den
gemeldeten Versionsbereich gehalten. Ändert sich die gebundene Version, wird der Test rot und verlangt
diese Bewertung neu — er wird dann nicht angepasst, sondern die Bewertung.

**Gebundene Version:** 5.8.5
**Urteil:** im betroffenen Bereich

## 1. Version und Advisory (K1)

| Was | Beleg |
|---|---|
| Bindung in `package.json` | `"fastify": "^5.0.0"` (`package.json:44`) |
| Gebundene Version | `package-lock.json`, Eintrag `node_modules/fastify` → `5.8.5` (Zeilen 3821–3822, `resolved` `fastify-5.8.5.tgz`) |
| Laufzeitversion | Im Cloud-Prüfplatz wird per `npm ci` aus genau dieser Lockdatei installiert. Der Test liest die Version der **laufenden** Produktinstanz (`buildApp(...).version`) und hält sie gegen die Lockdatei. Lokal ist `node_modules` ein Symlink auf einen geteilten Bestand außerhalb dieses Arbeitsbaums und wurde hier **nicht** gelesen. |
| Advisory | GHSA-3m5p-2c4r-xxw2, Schwere *moderate*, betroffener Bereich `>=5.8.3 <5.12.1`, Gegenstand: Fälschung der `X-Forwarded-*`-Kette bei `trustProxy` als **Hop-Anzahl**. |
| Datierte Herkunft | `npm audit --omit=dev` vom **17.09.2026** (liest die GitHub-Advisory-Datenbank), festgehalten in `tests/produktionsabhaengigkeiten/README.md:127`. |

**Ehrliche Grenze zu K1:** Die offizielle Advisory-Seite wurde in diesem Lauf **nicht neu abgerufen**
(kein Netzzugang in dieser Sitzung, und Tests dürfen keine externen Adressen ansprechen). Das
Veröffentlichungsdatum der Advisory selbst und ein seither geänderter Bereich sind daher nicht neu
belegt; der jüngste datierte Beleg ist der Auditstand vom 17.09.2026. Ein erneuter Abruf (z. B. ein
frisches `npm audit --omit=dev --json` im Prüfplatz) bleibt als offene externe Voraussetzung stehen.

5.8.5 liegt in `>=5.8.3 <5.12.1`. Die historische Aussage „5.8.5" ist damit am heutigen Stand
**unverändert zutreffend** — die Lockdatei wurde seit JOB 4272 an dieser Stelle nicht verändert.

## 2. Erreichbarkeit und betroffene Konfiguration (K2)

**Der Codepfad existiert:**
- `services/app/src/addon-auth-throttle.ts:101-103` — `resolveTrustProxy` gibt bei einem positiven
  ganzzahligen `KLARWERK_TRUST_PROXY` eine **Zahl** zurück (Hop-Anzahl).
- `services/app/src/build-app.ts:2308-2311` — `Fastify({ trustProxy: resolveTrustProxy(), … })`.

**Was davon abhängt** (Leser von `request.ip` / `request.protocol` / `request.hostname`):
- Drosseln: `services/auth/src/routes.ts:367` (Registrierung), `:421` (Anmeldung), `:630` (Kennwort
  vergessen), `:664` (Zurücksetzen); `services/app/src/build-app.ts:2457` (Drossel fehlgeschlagener
  Add-in-Anmeldeversuche). `services/app/src/addon-rate-limit.ts:41` nutzt `request.ip` nur als
  defensiven Ersatzschlüssel; gezählt wird dort nach Add-in-Principal.
- `services/app/src/security-headers.ts:84` (`request.protocol` → `upgrade-insecure-requests`).
- `services/app/src/server.ts:51` (`request.hostname` → Kanonik-Umleitung).

Eine gefälschte Weiterleitungskette würde also vor allem die **Drosselschlüssel** verschieben — eine
Umgehung von Sperren, nicht nur eine falsche Logzeile.

**Welche Konfiguration betroffen ist** (gemessen in `trustproxy-hopcount.test.ts` an der echten
`buildApp`-Instanz):

| `KLARWERK_TRUST_PROXY` | `trustProxy` | im Advisory-Fall? |
|---|---|---|
| nicht gesetzt / leer | `false` → `request.ip` = Socket | **nein** — Weiterleitungsköpfe werden ignoriert |
| `true`, `false`, `*`, Catch-all-Netze | `false` | **nein** |
| IP-/CIDR-Liste (z. B. `10.0.0.5`) | Liste | **nein** — die Advisory nennt die Hop-Anzahl als Bedingung |
| positive ganze Zahl (z. B. `1`) | Zahl | **ja** |

**Was das Repository selbst ausliefert:**
- `docker-compose.prod.yml` (Ein-Befehl-Weg): der `environment`-Block des Dienstes `app`
  (Zeilen 48–151) reicht `KLARWERK_TRUST_PROXY` **nicht** durch, und die Datei nutzt kein `env_file`
  (Kommentar Zeile 144). Auf diesem Weg ist `trustProxy` immer `false` → **nicht betroffen**.
  Der Test hält das fest.
- `env.demo.beispiel:67` führt die Variable nur auskommentiert.
- `docs/` nennt die Variable nirgends; insbesondere keine Empfehlung einer Hop-Anzahl.

**Nicht feststellbar von hier:** ob eine laufende Instanz (Coolify/Hetzner o. ä.) die Variable
außerhalb des Repositorys als Zahl setzt. Die Betriebsumgebung liegt nicht im Repository; es wurde
nichts gegen eine laufende Instanz gefahren.

**Urteil K2:** Erreichbar **nur** in der Konfiguration „Hop-Anzahl". Für alle im Repository
ausgelieferten Konfigurationen ist die Bedingung **nicht** erfüllt; für einen Betrieb mit
`KLARWERK_TRUST_PROXY=<Zahl>` ist sie erfüllt.

Der eigentliche Fehlermechanismus der Advisory wurde **nicht** reproduziert. Gemessen ist nur, dass bei
Hop-Anzahl ein vom Client gelieferter `X-Forwarded-For`-Kopf über `request.ip` entscheidet und ohne
Konfiguration nicht.

## 3. Behebung (K3)

**Kleinste kompatible Aktualisierung:** `fastify` **5.12.1** — die einzige Version außerhalb von
`>=5.8.3 <5.12.1` und innerhalb von `^5` (kein Hauptwechsel). Sie schließt zugleich GHSA-w2qp-rph6-63g4
(`<5.12.1`), die laut JOB 4272 für Klarwerk nicht exponiert ist.

**In diesem Auftrag nicht umgesetzt, und warum:**
1. Die Lockdatei lässt sich nur über eine Installation (`npm install --package-lock-only
   fastify@5.12.1`) ehrlich neu binden — Integritätswerte und mitgezogene Abhängigkeiten von Hand zu
   schreiben wäre eine erfundene Lockdatei. Installationen sind in diesem Lauf nicht erlaubt.
2. Am 17.09.2026 gemessen (Cloud-Lauf `0d8ed788e92c1478163febfb`): 5.12.1 bricht den Typprüfer —
   sechs Fehler am `Fastify({ trustProxy, logger })`-Aufruf in `build-app.ts` (heute Zeile 2308) und
   einer in `tests/produktionsabhaengigkeiten/kalibrierung.test.ts:217`. Eine Typkorrektur ohne die
   Typen von 5.12.1 wäre blind und hier nicht prüfbar.

**Vorschlag für den separaten Umsetzungsauftrag** (Lockdatei und `build-app.ts` in einem Zug):
- `package.json`: `"fastify": "^5.12.1"`; Lockdatei per `npm install --package-lock-only fastify@5.12.1`.
- Typbruch am Fastify-Aufbau in `build-app.ts` und `kalibrierung.test.ts:217` beheben, ohne
  `exactOptionalPropertyTypes` abzuschalten.
- Relevante Regression: `tests/fastify-restbewertung/trustproxy-hopcount.test.ts` (wird absichtlich
  rot und verlangt die Neubewertung dieser Datei), `services/app/src/addon-auth-throttle.test.ts`,
  `tests/app/csp-upgrade-insecure-requests.test.ts`, `tests/demo-kennzeichnung/schalter.test.ts`,
  `tests/produktionsabhaengigkeiten/` (Tabelle dort trägt 5.8.5), dazu der Typprüfer.

**Bis dahin — Begrenzung ohne Codeänderung:** Betreiber setzen `KLARWERK_TRUST_PROXY` als
**IP-/CIDR-Liste** des bekannten Proxys statt als Zahl. Diese Form liegt außerhalb der
Advisory-Bedingung und ist ohnehin die engere Vertrauensangabe.

## Nicht gemessen

- Erneuter Abruf der offiziellen Advisory und ihres Veröffentlichungsdatums (s. K1).
- Der konkrete Fälschungsweg der Advisory auf 5.8.5.
- Die tatsächliche `KLARWERK_TRUST_PROXY`-Einstellung laufender Instanzen.
- Das Verhalten von `fastify` 5.12.1 über die Typprüfung hinaus.
