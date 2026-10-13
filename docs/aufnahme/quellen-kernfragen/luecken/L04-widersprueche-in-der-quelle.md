# L04 · Widersprüche innerhalb der Quelle

**Betrifft:** die Einordnung von R-1384.

Der Eintrag in `QUELLEN.json` (Register-Schnappschuss, `$.eintraege[1383]`) widerspricht den
Altquellen und sich selbst:

1. **„Gebaut, wartet auf Einbau“ gegen reine Nachweislieferung.** `altbestand.beleg_status` lautet:
   „GEBAUT, wartet auf Einbau: JOB 813 D2 BEN7 GRÜN (16.08.), kein Commit im Produkt gefunden.“
   Das legt einen ausstehenden Produkteinbau nahe. d2:114–118 und ben7:19 belegen dagegen eine reine
   Nachweislieferung mit null Produktwrites. Einen Einbau gibt es nicht nachzuholen; der fehlende
   Produktcommit ist der erwartete Zustand (L02).
2. **Stand:** `zustand: "angedacht"`, `altbestand.status: "IN_ARBEIT"` und `beleg_status: "GEBAUT"`.
   Der Bestand passt zu keinem der drei: Der Nachweis ist abgeschlossen (D2), die Ownerentscheidungen
   sind offen.
3. **Datum:** Die Herkunft ist auf den **14.08.2026** datiert, zitiert aber das BEN7-Urteil vom
   **16.08.** Entweder ist das Datum falsch, oder der Wortlaut wurde später nachgetragen, ohne
   dass das Datum mitging.
4. **Kategorie:** `bereich: "Maschine"`, `altbestand.kategorie: "KLARWERK-intern"` und die Notiz
   „Kategorie korrigiert: Werkstatt-Beleglage“. Ob die Korrektur übernommen ist, geht aus dem Eintrag
   nicht hervor.
5. **Begründung:** `altbestand.begruendung: "Begruendung nicht dokumentiert"`.
