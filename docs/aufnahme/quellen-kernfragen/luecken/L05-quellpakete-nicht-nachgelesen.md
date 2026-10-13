# L05 · Die Quellpakete der Aufnahme sind nicht nachgelesen

**Betrifft:** die Herkunftskette von R-1384, nicht die fünf Altquellen.

Für die fünf Altquellen der Kernfragen hält der Lesebefund der Quellenhilfe `971decb4` die
Prüfsummen fest (`quellenmatrix.json`, `quellen`). Für die Aufnahmekette selbst gilt das nicht.
`QUELLEN.json` verweist auf diese Dateien:

- `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/quellenpakete/auftraege-003.json`
  (sha256 `2b77e2c5…`)
- `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/quellenpakete/aufnahmepunkte-011.json`
  (sha256 `f389e267…`)
- `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/REGISTER-SNAPSHOT.json`
  (sha256 `6e22ce8e…`)
- `00_CONTROL/FUNKTIONSREGISTER.json:31666`

Gelesen wurde nur der Auszug, den `QUELLEN.json` enthält. Seine Prüfsummen sind nicht gegen die
Dateien nachgerechnet. Der Auszug ist die Grundlage von L04 und nicht mehr.
