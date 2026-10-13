# L02 · Die frühere Lieferung (JOB 813) ist nicht im Produkt

**Betrifft:** Q1–Q5.

**Altaussage (R-1384, `herkunft[0].wortlaut`, datiert 14.08.2026):** „GEBAUT, wartet auf Einbau: JOB
813 D2 BEN7 GRÜN (16.08.), kein Commit im Produkt gefunden.“

**Befund heute (13.10.2026, Basis `550807b9`):** Die Aussage hält. Im Produktbaum steht keine Spur
der Lieferung: null Treffer für `JOB 797`, `799`, `800`, `801`, `802`, `813`, `856`, für `F-1384`
und `R-1384` und für „Quellenmatrix“. Das schließt die archivierten Patches unter
`tests/audit-gesamt/` ein. Was JOB 813 gebaut hat und wo es liegt, ist ungeklärt.

**Folge:** Es gibt keinen Abschlussbeleg, der wiederverwendet werden könnte. „BEN7 GRÜN“ ist ein
historisches Urteil über ein Artefakt außerhalb des Produkts. Ein Funktionsnachweis für heute ist
es nicht.

**Schließt sich durch:** Das JOB-813-Artefakt ausfindig machen, mit dieser Matrix abgleichen und
den Inhalt übernehmen, soweit er noch zutrifft. Nicht neu bauen, solange es auffindbar ist.
