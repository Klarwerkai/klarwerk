# Vorher-Fassung für `vorher-nachher.integration.test.ts`

`behebung-rueckwaerts.patch` ist die Behebung dieses Auftrags (gesamt-auditprotokoll), RÜCKWÄRTS:
der Unterschied des Produktcodes unter `services/` (ohne `*.test.ts`) vom Kandidaten zum
integrierten Hauptstand ohne die Behebung.

Erzeugt mit Git, nicht von Hand:

```
git diff --binary --output=tests/audit-gesamt/vorher/behebung-rueckwaerts.patch \
  <Kandidat> <Hauptstand> -- services ':(exclude)services/**/*.test.ts'
```

Kandidat und Hauptstand dieser Fassung stehen in `fassung.json`. Der Test kopiert die verfolgten
`services/` des Prüfbaums in ein temporäres Verzeichnis, wendet den Patch dort mit `git apply` an
(ohne Historie, der Prüfweg arbeitet mit einem depth-1-Checkout) und lädt den so entstandenen
Produktcode. Passt der Patch nicht mehr (der Kandidat hat sich unter `services/` geändert), wird
der Test rot mit „Vorher-Fassung veraltet“. Dann ist der Patch mit demselben Befehl neu zu erzeugen.
