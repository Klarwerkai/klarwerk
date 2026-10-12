# Rollen und Navigation (Aufnahme `gesamt-rollen-navigation`)

| Datei | Prüft | Quelle |
|---|---|---|
| `rollenmatrix-seitenleiste.test.ts` (neu) | Vier Rollen in fester Rangfolge. Jede höhere Rolle sieht alles, was eine niedrigere sieht. Die Matrix aus R-1027 im Wortlaut gegen `navigation.ts`: Experte sieht Erfassen und Aufgaben, Controller zusätzlich Validierung und Konflikte, Admin zusätzlich die Steuerung. | R-0516, R-0535, R-1027, R-1668 |
| `pruefen-handelt-als-mounted.test.tsx` (neu) | Der Prüfen-Kopf sagt „Du prüfst als …“ mit der echten Sitzungsrolle. Bei laufender Rollenvorschau bleibt die Sitzungsrolle maßgeblich. Ohne Sitzung steht keine Aussage da. Gleicher Satz in EN und NL. | R-0563, R-0551 |
| `../app/admin-bestand-zuerst-mounted.test.tsx` (neuer Fall) | Ein Verwalterkonto trägt in der Kontenliste „Administrator“; ein Expertenkonto trägt es nicht. | R-0533 |
| `../app/mega70-rohlink-sammler.test.ts` (erweitert) | mega72 A: Der Rohzähler erfasst jedes `to`-Attribut in jeder Schreibweise (`to=`, `to = `, Zeilenumbruch um das `=`) und ist exakt gegen die gelesenen kalibriert. Ein Ausdruck liefert nur Ziele, wenn er vollständig verstanden ist; ein Ternär mit einem unbekannten Zweig ist als ganzer Ausdruck unbekannt. Vier Negativkalibrierungen werden rot: verschachtelte Klammern, zwei unterschiedlich geschützte Template-Ziele, Leerraum um das `=` und ein Ternär aus Template und unbekanntem Zweig. mega72 B: Der Zweier-Rollensatz ist durch `ROLES` ersetzt. | R-1877 (B41), R-0968 |

**B41 Teil C (Vorlage, kein Bau):** `B41-C-vorlage-folgekandidaten.md`. Die Vorlage ordnet die 27
markierten Stellen der wiedergefundenen mega70-Erhebung gegen den heutigen Stand ein. Die historische
Zusammenfassung nennt 26; die Abweichung ist dort erklärt. Ergebnis: 18 Stellen erledigt oder
entfallen, 1 harmlos, 8 offen. Die nächsten Sammlerflächen sind nach Aufwand geordnet. Es ist eine
Teilprüfung: Die 48 unmarkierten Vorkommen und Link-Stellen, die seit dem 30.07. neu entstanden
sind, sind nicht erneut erhoben. Der Auftrag heißt im Archiv `AUFTRAG-mega73.md`; „mega72“ in
OFFEN.md ist eine Fehlbenennung.
