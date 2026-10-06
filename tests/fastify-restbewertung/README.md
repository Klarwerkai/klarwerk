# Fastify-Sicherheitsrest GHSA-3m5p-2c4r-xxw2 — Neubewertung am aktuellen Stand

**Stand:** 06.10.2026, Nacharbeit 1 · **Basis:** `2b1131ad` (1.0.0-beta.1.713) · **Auftrag:** `aufnahme:20260922:fastify-restbewertung`

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
| Gebundene Version | `package-lock.json`, Eintrag `node_modules/fastify` → `5.8.5` (Zeilen 3821–3822) |
| Laufzeitversion | Der Test liest die Version der **laufenden** Produktinstanz (`buildApp(...).version`) nach `npm ci` im Prüfplatz und hält sie gegen die Lockdatei — im Prüflauf des Kandidaten `6519a364` grün. |
| Advisory | GHSA-3m5p-2c4r-xxw2, *moderate*, betroffen `>=5.8.3 <5.12.1`, behoben ab 5.12.1. Gegenstand: `trustProxy` als **Hop-Anzahl**; ein Client, der den Ursprung am Proxy vorbei erreicht, bestimmt die Weiterleitungskette selbst. |
| Datierung | Veröffentlicht 18.08.2026, aktualisiert 02.09.2026 — so von BEN in der Prüfung des Kandidaten `6519a364` an der offiziellen GitHub-Advisory gelesen (`HISTORIE/nacharbeit-1/BEN/ANTWORT.json`, Hinweise). Ältester datierter Beleg im Repository: `npm audit --omit=dev` vom 17.09.2026 (`tests/produktionsabhaengigkeiten/README.md:127`). |

Die Advisory-Seite wurde in dieser Bearbeitung nicht selbst abgerufen (kein Netzzugang); die Datierung
stützt sich auf BENs Lesung.

## 2. Erreichbarkeit und betroffene Konfiguration (K2)

**Bis zu dieser Änderung erreichbar:** `resolveTrustProxy` machte aus einem positiven ganzzahligen
`KLARWERK_TRUST_PROXY` eine Hop-Anzahl, und `build-app.ts` reicht das Ergebnis als `trustProxy` an
Fastify. Abhängig davon:
- Drosseln: `services/auth/src/routes.ts:367` (Registrierung), `:421` (Anmeldung), `:630` (Kennwort
  vergessen), `:664` (Zurücksetzen); `services/app/src/build-app.ts` (Drossel fehlgeschlagener
  Add-in-Anmeldeversuche, `authAttemptThrottle.registerFailure(request.ip, …)`).
  `services/app/src/addon-rate-limit.ts:41` nutzt `request.ip` nur als defensiven Ersatzschlüssel.
- `services/app/src/security-headers.ts:84` (`request.protocol`), `services/app/src/server.ts:51`
  (`request.hostname`).

**Kalibrierung, gemessen** (`trustproxy-hopcount.test.ts`): auf 5.8.5 glaubt eine Fastify-Instanz mit
Hop-Anzahl 1 einem **nicht vertrauten, direkt verbundenen** Client (`198.51.100.200`) seinen eigenen
`X-Forwarded-For: 203.0.113.66` — `request.ip` wird `203.0.113.66`. Damit ließe sich jede IP-Drossel
mit wechselnden Fantasieadressen umgehen.

**Gegenprobe IP-/CIDR-Liste**, an der echten `buildApp`-Instanz: mit `KLARWERK_TRUST_PROXY=10.0.0.5`
wird derselbe Kopf vom direkten Client **zurückgewiesen** (`request.ip` = `198.51.100.200`) und nur über
den vertrauten Proxy `10.0.0.5` angenommen.

**Was das Repository ausliefert:** `docker-compose.prod.yml` reicht `KLARWERK_TRUST_PROXY` nicht durch
und nutzt kein `env_file` (Test); `env.demo.beispiel:67` führt die Variable nur auskommentiert;
`docs/` nennt sie nicht. Auf diesen Wegen war die Bedingung nie erfüllt.

## 3. Behebung (K3)

### Umgesetzt: die Hop-Anzahl erreicht Fastify nicht mehr

- `services/app/src/addon-auth-throttle.ts`: `resolveTrustProxy` verwirft eine Hop-Anzahl wie einen
  Blanket-Wert (`false`, Socket-Adresse gilt). Rückgabetyp jetzt `boolean | string[]` — eine Zahl kann
  den Fastify-Aufbau typseitig nicht mehr erreichen. Neu: `isHopCountTrustProxy`.
- `services/app/src/build-app.ts`: beim Aufbau eine Warnung im Log, wenn eine Hop-Anzahl gesetzt ist
  — sonst sähe ein Betreiber nur, dass alle Drosseln gegen die Proxy-IP zählen.
- Gegenprobe am Produkt: `KLARWERK_TRUST_PROXY=1`, direkter Client mit gefälschtem Kopf →
  `request.ip` bleibt `198.51.100.200`. Die Erwartungen in `addon-auth-throttle.test.ts` („Zahl →
  Hop-Count") sind entsprechend auf `false` umgestellt.

Damit ist die Advisory-Bedingung im Produkt auf **jeder** fastify-Version unerreichbar, auch auf 5.8.5.

**Folge für Betreiber, ehrlich benannt:** Wer bisher eine Zahl gesetzt hatte, verliert die echte
Client-IP hinter dem Proxy; alle Drosseln zählen dann gegen die Proxy-IP (gemeinsames Kontingent),
bis die IP-Adresse(n) des Proxys eingetragen sind. Das ist fail-safe, aber spürbar.

### Nicht umgesetzt: die Versionshebung auf 5.12.1

Die kleinste kompatible Aktualisierung bleibt `fastify` **5.12.1** (innerhalb `^5`). Sie ist in dieser
Bearbeitung **nicht** eingebaut, weil sich `package-lock.json` nur über eine Installation
(`npm install --package-lock-only fastify@5.12.1`) ehrlich neu binden lässt — Integritätswert und
mitgezogene Abhängigkeiten von Hand zu schreiben wäre eine erfundene Lockdatei. Installationen sind in
diesem Ausführungsweg nicht erlaubt; im Arbeitsbaum und in seiner Git-Historie liegt kein Lockeintrag
für 5.12.1. `package.json` allein zu heben würde `npm ci` brechen.

Die Produktänderung oben nimmt der Hebung ihre bekannte Typbruchstelle: der am 17.09.2026 gemessene
`TS2769` am Aufruf `Fastify({ trustProxy: resolveTrustProxy(), … })` passt zu einem Typ, der keine Zahl
mehr annimmt, und `resolveTrustProxy` liefert keine mehr. Ob die Typprüfung mit 5.12.1 damit grün ist
(einschließlich der damals gemeldeten Stelle in `tests/produktionsabhaengigkeiten/kalibrierung.test.ts`),
ist **nicht** gemessen.

Für die Hebung zu tun: `package.json` → `"fastify": "^5.12.1"`, Lockdatei per Installation neu binden,
Typprüfung; Regression: diese Datei samt Test (K1 wird absichtlich rot; der Kalibrierfall mit
nackter Hop-Anzahl ist dann neu zu fassen), `services/app/src/addon-auth-throttle.test.ts`,
`tests/app/csp-upgrade-insecure-requests.test.ts`, `tests/demo-kennzeichnung/schalter.test.ts`,
`tests/produktionsabhaengigkeiten/`.

## Nicht gemessen

- Eigener Abruf der offiziellen Advisory (Datierung nach BENs Lesung).
- Die tatsächliche `KLARWERK_TRUST_PROXY`-Einstellung laufender Instanzen und ob ihr Fastify-Ursprung
  am Proxy vorbei direkt erreichbar ist.
- Das Verhalten von `fastify` 5.12.1 — weder Typprüfung noch Laufzeit.
