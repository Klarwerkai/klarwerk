# Fastify-Sicherheitsrest GHSA-3m5p-2c4r-xxw2 — Neubewertung am aktuellen Stand

**Stand:** 26.10.2026, W4.3-Abgleich mit der erhaltenen W4.7-Bindung · **Basis:** `423fa122` (.1046). Die frühere Hebung auf 5.12.1 bleibt unten als Historie erhalten.

Ausgangspunkt ist der in JOB 4272 Runde 4 offen gelassene Rest (`fastify` 5.8.5, GHSA-3m5p-2c4r-xxw2,
s. `tests/produktionsabhaengigkeiten/README.md` Abschnitt „`fastify`", Stand 17.09.2026). Jener Bericht
bleibt unverändert als historische Messung stehen; diese Datei ist die Bewertung am heutigen Stand.

Die beiden Zeilen unten werden von `trustproxy-hopcount.test.ts` gegen `package-lock.json` und gegen den
gemeldeten Versionsbereich gehalten. Ändert sich die gebundene Version, wird der Test rot und verlangt
diese Bewertung neu — er wird dann nicht angepasst, sondern die Bewertung.

**Gebundene Version:** 5.12.7
**Urteil:** außerhalb des betroffenen Bereichs

## 1. Version und Advisory (K1)

| Was | Beleg |
|---|---|
| Bindung in `package.json` | `"fastify": "5.12.7"`, exakt erhalten aus W4.7. Sowohl eine sichere exakte Bindung als auch eine sichere Caret-Untergrenze erfüllen den Test; die behobene Untergrenze bleibt 5.12.1. |
| Gebundene Version | `package-lock.json`, Eintrag `node_modules/fastify` → `5.12.7`. Für den dokumentierten Bereich `>=5.8.3 <5.12.1` liegt diese Bindung außerhalb. |
| Laufzeitversion | Der Test liest die Version der **laufenden** Produktinstanz (`buildApp(...).version`) nach `npm ci` im Prüfplatz und hält sie gegen die Lockdatei. 5.12.7 wurde im aktuellen W4.3-Lauf tatsächlich gemeldet; die unveränderte Versionsgegenprobe läuft erneut im endgültigen Pflichtlauf. |
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

**Kalibrierung auf 5.8.5, gemessen — historisch:** auf 5.8.5 glaubte eine Fastify-Instanz mit
Hop-Anzahl 1 einem **nicht vertrauten, direkt verbundenen** Client (`198.51.100.200`) seinen eigenen
`X-Forwarded-For: 203.0.113.66` — `request.ip` wurde `203.0.113.66`. Damit ließ sich jede IP-Drossel
mit wechselnden Fantasieadressen umgehen. Bestanden im Kandidaten `c277165b`
(`HISTORIE/nacharbeit-2/PRUEFUNG/fastify-restbewertung.json`). Mit der Hebung auf 5.12.1 ist der Fall
aus dem Test entfernt: er beschrieb die nicht mehr gebundene Version.

**Gegenprobe IP-/CIDR-Liste**, an der echten `buildApp`-Instanz: mit `KLARWERK_TRUST_PROXY=10.0.0.5`
wird derselbe Kopf vom direkten Client **zurückgewiesen** (`request.ip` = `198.51.100.200`) und nur über
den vertrauten Proxy `10.0.0.5` angenommen.

**Was das Repository ausliefert:** `docker-compose.prod.yml` verlangt `KLARWERK_TRUST_PROXY` ausdrücklich ohne Vorgabewert und nutzt kein `env_file`. Startvertrag, Beispiel und Betreiberanleitung führen die Produktionspflicht. Die bestehende Ablehnung von Hopzahlen und pauschalen Netzen bleibt erhalten. Die konkrete von Root bestätigte Coolify-Zuordnung und ihre erneute Prüfung nach Proxy-Neuerstellung stehen in `docs/operations/kundeninstanz-neuinstallation.md`; hier wurde kein realer Proxy angesprochen.

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

### Historie: die damalige separate Versionshebung auf 5.12.1

Die kleinste kompatible Aktualisierung ist `fastify` **5.12.1** (innerhalb `^5`, kein Hauptwechsel).
Übernommen sind die beiden **von npm erzeugten** Dateien aus `ROOT-LOCKFILE-20261006/`
(Erzeugung `npm install --package-lock-only --ignore-scripts --no-audit --no-fund fastify@5.12.1`,
Exit 0, Manifest `QUELLEN-FASTIFY-LOCKFILE-20261006.json` neben dem Auftrag) — unverändert, nichts von
Hand geschrieben. Der Diff gegen den Kandidaten `c277165b`:
- `package.json`: `"fastify": "^5.0.0"` → `"^5.12.1"` — sonst dürfte ein späteres `npm install` wieder
  in den betroffenen Bereich auflösen (der Test hält das fest);
- `package-lock.json`: `node_modules/fastify` 5.8.5 → 5.12.1 mit npm-Integritätswert; zwei neue,
  verschachtelte Knoten `node_modules/fastify/node_modules/fast-json-stringify` 7.0.1 und
  `…/fast-uri` 4.2.1 (5.12.1 verlangt `fast-json-stringify ^7`); die Wurzelknoten `fast-uri` 3.1.8 und
  `find-my-way` 9.6.0 bleiben; dazu das Feld `version` der Lockdatei (1.0.0-beta.1.554 → .714), das npm
  an `package.json` nachzieht.

Die Hebung schließt zugleich GHSA-w2qp-rph6-63g4 (`<5.12.1`), die laut JOB 4272 für Klarwerk nicht
exponiert war.

**Typstellen.** Der am 17.09.2026 mit 5.12.1 gemessene `TS2769` am Aufruf
`Fastify({ trustProxy: resolveTrustProxy(), … })` ist durch den engeren Rückgabetyp oben adressiert
(`boolean | string[]`, keine Zahl). Die damals gemeldete Stelle `kalibrierung.test.ts:217` steht heute
als doppelte Umwandlung `as unknown as …` (Zeile 231) da und kann `TS2352` nicht mehr auslösen. Ob die
Typprüfung mit 5.12.1 grün ist, zeigt erst der Prüflauf (`tools/build` im Prüfplatz) — hier ist nichts
gelaufen.

## Heutiger Abgleich

W4.7 bindet Fastify exakt auf 5.12.7. W4.3 verändert weder diese Abhängigkeit noch ihre Lockknoten und verwendet die erhaltene dazu passende Installation. Die zwei veralteten Prüfannahmen (Dokument noch 5.12.1 und ausschließlich Caret erlaubt) sind damit konkret berichtigt; Versionsbereich, sichere Untergrenze und alle echten Proxy-Gegenproben bleiben wirksam. Dies ist eine Einordnung in den bereits dokumentierten Advisory-Bereich, keine neue Advisory-Recherche.

## Nicht gemessen

- Eigener Abruf der offiziellen Advisory (Datierung nach BENs Lesung).
- Die tatsächliche `KLARWERK_TRUST_PROXY`-Einstellung laufender Instanzen und ob ihr Fastify-Ursprung
  am Proxy vorbei direkt erreichbar ist.
- Die frühere 5.12.1-Installation wurde hier nicht wiederhergestellt; geprüft wird die erhaltene 5.12.7-Bindung.
- Das Verhalten von 5.12.1 bei einer numerischen `trustProxy`-Einstellung selbst: das Produkt reicht
  keine mehr durch, gemessen wird deshalb nur das Produkt.
