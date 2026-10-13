# L01 · Der heutige Stand je Kernfrage ist nur inspiziert, nicht gemessen

**Betrifft:** Q1–Q5.

**Was belegt ist:** Gegenstand, Fundstellen und historische Aussage jeder Kernfrage. Sie stammen
aus fünf Altquellen. Der Lesebefund der Quellenhilfe `971decb4` (13.10.2026) hat sie gelesen und je
Datei die Prüfsumme festgehalten (Tabelle „Quellen“ in der `README.md`). Es gibt keine
Zugangshürde.

**Was offen ist:** Die dritte Ebene der Matrix („heutiger Stand“) ist Quelleninspektion am
Produktbaum (Basis `550807b9`, `1.0.0-beta.1.954`). Ein Test- oder Datenbanklauf dazu fehlt. Im
Einzelnen:

- **Zuordnung zum heutigen Code:** Die Gegenstände sind über Begriffe und Bauform den heutigen
  Stellen in `services/library-analytics` zugeordnet: Importlauf, `advance`, Zähler,
  Sieben-Felder-Snapshot `importRunItemRefSnapshot`, `JSON.stringify(ref)` und FREEZE-144. In diesem
  Lauf gelesen wurde der Lesebefund, nicht der Originalwortlaut von `vertrag` und `d1`.
- **Q1:** Ob der PostgreSQL-Weg von `advance` einen negativen Zähler heute annimmt, zeigt nur der
  Code (`repo-pg.ts:903-940`, kein Zähler-CHECK in `repo-pg.ts:740-770`). Gemessen ist es nicht.
- **Q3:** Ob im Betrieb Altzeilen in `import_run_item_refs` liegen, ist nicht gemessen (historisch
  U-4/U-6).
- **Q5:** Einen heutigen Integritäts- oder Wiederherstellungsnachweis gibt es nicht.

**Abgrenzung:** Die Inspektion meldet keinen heutigen Fehler und gibt nichts frei. Q1–Q5 hängen an
offenen Entscheidungen, die hier nicht getroffen werden (`README.md`, „Offene Entscheidungen“).
