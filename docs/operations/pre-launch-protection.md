# Vorab-Schutz: kein Suchmaschinen-Index + Zugangsschutz

Solange KLARWERK nicht öffentlich live ist (und auch danach für interne Stufen), soll die
Seite **nicht von Google/Suchmaschinen indexiert** und **durch ein Login geschützt** sein.
Zwei Ebenen, beide unabhängig vom App-Login.

## 1. Kein Suchmaschinen-Index

Bereits im Frontend gesetzt:
- `apps/web/public/robots.txt` → `Disallow: /` für alle Bots.
- `apps/web/index.html` → `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">`.

Zusätzlich **am Reverse-Proxy** (wirkt auch für Nicht-HTML-Antworten und ist am robustesten):
Header `X-Robots-Tag: noindex, nofollow` setzen. In Coolify beim Service unter
**Configuration → Headers** (bzw. als Traefik-Label) ergänzen:

```
traefik.http.middlewares.kw-noindex.headers.customResponseHeaders.X-Robots-Tag=noindex, nofollow
```

## 2. Zugangsschutz (Basic Auth auf Proxy-Ebene)

> **Warum nicht im Frontend?** Ein Passwort, das im React-/JS-Bundle steht, ist für jeden
> lesbar, der die Seite öffnet (G-7: „keine Geheimnisse im Client-Bundle"). Deshalb sitzt der
> Vorab-Gate **vor** der App, auf dem Reverse-Proxy (Traefik, von Coolify verwaltet). Der Browser
> zeigt den Login, **bevor** überhaupt etwas geladen wird — ideal gegen Indexierung und Zufallsbesucher.

**Zugang:** Benutzer `admin`, Passwort `!klarwerk!`.

Hinterlegt wird **nicht** das Klartext-Passwort, sondern ein bcrypt-Hash (htpasswd-Format):

```
admin:$2b$10$OkAINtf12shnFsvHrK9CB.5pQFeicD01.c9gppiAa9NfGhLbjcqYG
```

### Einrichtung in Coolify (durch Pedi)
1. Service `app.klarwerk.ai` → **Advanced / Labels** (Traefik).
2. Basic-Auth-Middleware anlegen und auf den Router legen:
   ```
   traefik.http.middlewares.kw-gate.basicauth.users=admin:$$2b$$10$$OkAINtf12shnFsvHrK9CB.5pQFeicD01.c9gppiAa9NfGhLbjcqYG
   traefik.http.routers.<router>.middlewares=kw-gate,kw-noindex
   ```
   **Wichtig:** In Docker/Compose-Labels jedes `$` als `$$` verdoppeln (oben bereits so notiert);
   in einem reinen Traefik-File **ohne** Verdopplung.
3. Redeploy. Danach verlangt `app.klarwerk.ai` zuerst den Basic-Auth-Login, dann erst die App.

### Passwort ändern / neuen Hash erzeugen
```bash
htpasswd -nbB admin 'NEUES_PASSWORT'      # bcrypt, empfohlen
# oder: openssl passwd -apr1 'NEUES_PASSWORT'   # apr1/MD5, Traefik-kompatibel
```

## 3. App-eigener Login (unverändert)
Die Anwendung selbst ist vollständig auth- und rollengeschützt (Backend-Auth, erstes Konto =
Admin via Ersteinrichtung). Der Basic-Auth-Gate ist eine **zusätzliche** Vorab-Schicht, kein
Ersatz. Sobald die Seite offiziell live geht, kann der Gate entfernt werden — `noindex` bleibt,
solange gewünscht.
