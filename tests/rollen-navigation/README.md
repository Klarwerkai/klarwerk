# Rollen und Navigation (Aufnahme `gesamt-rollen-navigation`)

| Datei | Prüft | Quelle |
|---|---|---|
| `rollenmatrix-seitenleiste.test.ts` (neu) | Vier Rollen in fester Rangfolge. Jede höhere Rolle sieht alles, was eine niedrigere sieht. Die Matrix aus R-1027 im Wortlaut gegen `navigation.ts`: Experte sieht Erfassen und Aufgaben, Controller zusätzlich Validierung und Konflikte, Admin zusätzlich die Steuerung. | R-0516, R-0535, R-1027, R-1668 |
| `pruefen-handelt-als-mounted.test.tsx` (neu) | Der Prüfen-Kopf sagt „Du prüfst als …“ mit der echten Sitzungsrolle. Bei laufender Rollenvorschau bleibt die Sitzungsrolle maßgeblich. Ohne Sitzung steht keine Aussage da. Gleicher Satz in EN und NL. | R-0563, R-0551 |
| `../app/admin-bestand-zuerst-mounted.test.tsx` (neuer Fall) | Ein Verwalterkonto trägt in der Kontenliste „Administrator“; ein Expertenkonto trägt es nicht. | R-0533 |
| `../app/mega70-rohlink-sammler.test.ts` (erweitert) | mega72 A: Der Rohzähler ist exakt gegen die gelesenen `to=` kalibriert. Zwei Negativkalibrierungen werden rot: verschachtelte Klammern und zwei unterschiedlich geschützte Template-Ziele. mega72 B: Der Zweier-Rollensatz ist durch `ROLES` ersetzt. | R-1877 (B41), R-0968 |

**Nicht geliefert:** mega72 C ist die Vorlage zu den 26 app-weiten Folgekandidaten. Die Liste stammt
aus dem mega70-Bericht und liegt nicht im Repository.
