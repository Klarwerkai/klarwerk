# L05 · Quellpakete der Aufnahme nicht nachgelesen

**Betrifft:** die Herkunftskette von R-1384.

`QUELLEN.json` verweist auf drei Dateien mit relativen Pfaden, aber ohne Wurzel:

- `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/quellenpakete/auftraege-003.json`
  (sha256 `2b77e2c5…`)
- `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/quellenpakete/aufnahmepunkte-011.json`
  (sha256 `f389e267…`)
- `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/REGISTER-SNAPSHOT.json`
  (sha256 `6e22ce8e…`)

Ebenso auf die Altquelle `00_CONTROL/FUNKTIONSREGISTER.json:31666`. Keine davon liegt im
Produktbaum. Gelesen wurde in diesem Lauf nur der Auszug, den `QUELLEN.json` selbst enthält. Die
Prüfsummen sind genannt, aber nicht gegen die Dateien nachgerechnet.

**Folge:** Es ist nicht geprüft, ob der Auszug den Originalen entspricht. Er ist die Arbeitsgrundlage
dieser Erhebung und nicht mehr.
