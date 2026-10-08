# Vorher-Fassung für `vorher-nachher.integration.test.ts`

`behebung-rueckwaerts.patch` ist die Behebung dieses Auftrags (gesamt-auditprotokoll), RÜCKWÄRTS:
der Unterschied des Produktcodes unter `services/` (ohne `*.test.ts`) vom Kandidaten zum
integrierten Hauptstand ohne die Behebung.

Erzeugt mit Git, nicht von Hand:

```
git diff --binary --output=tests/audit-gesamt/vorher/behebung-rueckwaerts.patch \
  <Kandidat> <Hauptstand> -- services ':(exclude)services/**/*.test.ts'
```

Kandidat und Hauptstand dieser Fassung stehen in `fassung.json`.

Ist der Kandidat noch nicht eingecheckt (Nacharbeit im Arbeitsbaum), gleichbedeutend vom Arbeitsbaum aus:

```
git diff -R --binary --output=tests/audit-gesamt/vorher/behebung-rueckwaerts.patch \
  <Hauptstand> -- services ':(exclude)services/**/*.test.ts'
```

Zuletzt so erzeugt in aufnahme:20260922:gesamt-leserechte, Nacharbeit 17 (Leserecht im Auditprotokoll
hat `audit-routes.ts` und die Registrierung in `build-app.ts` geändert); beide Patches neu.

Achtung: die Kandidatbildung formatiert `services/` (Biome). Ein Patch, der aus einem noch
unformatierten Arbeitsbaum erzeugt wurde, passt danach nicht mehr (Nacharbeit 15). Erst erzeugen,
wenn die geänderten Dateien schon in Formatiererform stehen.

`fassung-758e76c1.patch` (Nacharbeit 8) macht aus denselben verfolgten `services/` die Lauf-2-Fassung
`758e76c1`, an der beleg:6818bd52 gemeldet wurde (gleichzeitige `GET /api/audit/export`). Sie ist von
keinem Branch erreichbar, liegt aber als Git-Objekt vor. Erzeugt mit:

```
git diff --binary --output=tests/audit-gesamt/vorher/fassung-758e76c1.patch \
  <Kandidat> 758e76c1 -- services ':(exclude)services/**/*.test.ts'
```

Auch dieser Patch passt nur auf die `services/` des Kandidaten, an dem er erzeugt wurde
(`fassung.json`, Feld `lauf2`). Der Test kopiert die verfolgten
`services/` des Prüfbaums in ein temporäres Verzeichnis, wendet den Patch dort mit `git apply` an
(ohne Historie, der Prüfweg arbeitet mit einem depth-1-Checkout) und lädt den so entstandenen
Produktcode. Passt der Patch nicht mehr (der Kandidat hat sich unter `services/` geändert), wird
der Test rot mit „Vorher-Fassung veraltet“. Dann ist der Patch mit demselben Befehl neu zu erzeugen.
