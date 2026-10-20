# Klara in PowerPoint mit validierten Daten · PP-01

Auftrag `produkt:20261015:klara-powerpoint-bestand`, Revision 1. Paket PP-01: Bestand und
Integrationsplan; PP-01 selbst ändert am Produkt nichts. PP-02 bis PP-09 sind eigene Aufträge; PP-02
(Datenherkunft) steht in `PP-02-DATENHERKUNFT.md`.

PP-05: implementierter Teilkern für den bestehenden PPTX-Anhang, siehe [PP-05-FOLIENAUFBAU.md](./PP-05-FOLIENAUFBAU.md); Originalgesamtabschluss offen.

| Datei | Inhalt |
| --- | --- |
| [`BESTAND.md`](./BESTAND.md) | Hostmatrix (native App, Web und importierte Datei getrennt), Lese-/Schreib-/Auswahlwege, Validierungsregeln, Datenquellen, Setup, Lücken, Auftragsabgleich |
| [`fundstellen.json`](./fundstellen.json) | derselbe Bestand maschinenlesbar, je Eintrag Datei und wörtlicher Anker |
| [`INTEGRATIONSPLAN.md`](./INTEGRATIONSPLAN.md) | Fähigkeiten und Lücken je Host, Anschluss von PP-02 bis PP-09, Setup, UI-Leitlinien, Stand je PP-ID |
| [`PP-02-DATENHERKUNFT.md`](./PP-02-DATENHERKUNFT.md) | PP-02 (`produkt:20261015:klara-powerpoint-datenherkunft`): Datenobjekt, Bindung an Folien, Herkunft an der Zahl, Prüfstand, Rechte, Grenzen |

Prüfung: `tests/klara-powerpoint/fundstellen.test.ts` (PP-01), `tests/klara-powerpoint/pp02-datenherkunft.test.ts` und `tests/klara-powerpoint/pp02-herkunft-an-der-zahl.test.tsx` (PP-02).
