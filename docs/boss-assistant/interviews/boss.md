# Interview — The Boss (Steuerungsebene)

_Erhalten: 2026-07-06. Enthält Korrekturen am Team-Bild + Steuerungshistorie._

## Korrekturen am Team-Bild (WICHTIG)
1. **Team 2 entfällt NICHT.** Team 2 (Local LLM) war einer der aktivsten Tracks:
   - UpCloud-L40S-Eval mit Prüfstand-Messung (Qwen3-32B **16/24** vs. Claude **22/24**).
   - Ein-Klick-App „KLARWERK LLM".
   - App-Anbindung als zweites KI-Backend (**SCRUM-424**).
   - Aktuell: KWN-2 / Mac-Studio-Insel (**KLLM-62**).
   - Die „pausiert"-Angabe (Team 3/6) stammt aus **hartkodierter Beispiel-Konfiguration in `app.js` des
     PMO-Dashboards, Stand ~30.06., nie nachgeführt** → veraltet.
2. **Readiness-Zahlen „45 % / 13 P0 / Trend ▼" sind veraltet** (markierte Alt-Schätzwerte/Beispieldaten aus
   derselben `app.js`-Quelle, KEINE aktuelle Aggregation).
   - **Lebende Ist-Zahl:** `data/pmo-items.json`, Stand **03.07.**: **144 Items, 29 done, 33 partially;
     beta-relevant 20/49 done.**
   - ⚠️ Regel: Dashboard-Anzeigetexte (`app.js`) NIE als Ist übernehmen — Berater und Boss haben diesen Fehler
     schon zweimal geflaggt.
3. **Team 7 liest nicht mehr nur** (read-only überholt): seit **03.07.** gibt es die **PMO-Automatik** — Paul legt
   Drafts in die Brücke, der Runner wendet sie via `apply-item-update.mjs` an (**SCRUM-434**).

## Steuerungshistorie — drei Phasen
- **Phase 1 (bis 02.07.) — manuell:** Pedi moderierte einzelne Team-Chats manuell; Übergaben per Boss-Stand-Dokument.
  Kernproblem: **Wissensverlust bei jedem Session-Ende.**
- **Phase 2 (02.–03.07.) — Boss-zentral:** Boss als koordinierende UND ausführende Instanz („Alles hier direkt"),
  hartes Regelwerk: Gates vor Lieferung, Commit lokal / Push nur via Sync-App, After-Report-Pflicht,
  Schreibtisch-App-Prinzip. Ergebnisse: **v0.9.14–0.9.21** + gesamte Werkzeuglandschaft (Sync-, LLM-, Prüfstand-Apps).
- **Phase 3 (seit 03.07. abends) — arbeitsteilig:** Budget-Grenze erzwang Trennung: **Paul baut, Boss prüft/committet/
  verwaltet, Pedi klickt und entscheidet.**
- **Größter Kurswechsel:** Freeze **`v1.0.0-beta.1`** (03.07. nachts) und dessen **Aufhebung (04.07.)** —
  Geschwindigkeit bewusst über Stand-Stabilität gestellt, mit dokumentierten Auflagen (Entscheidungs-Log 04.07.).

## Offene Widersprüche der Steuerungsebene (vom Boss ehrlich benannt)
- **(a) Commit `d25e7df` (04.07., 11:49):** kam von einer **unbekannten lokalen Session unter Pedis Git-Identität** —
  bis heute ungeklärt, **wer auf dem Mac committen darf.**
- **(b) Freeze-Aufhebung vor Beantwortung der Rückfrage:** formal sauber (Pedi entscheidet), aber die Doku-Kette lief
  der Entscheidung hinterher.
- **(c) Mandat für „Assistent" (mich) und „Nerd" nicht als Pedi-Entscheidung dokumentiert** → gehört ins
  Entscheidungs-Log, sonst wiederholt sich das `d25e7df`-Muster mit mehr Akteuren.

## Anweisung des Boss an mich (Assistent)
- **Jeden Baustein der Wissensbasis gegen After-Report + Git-Log + `pmo-items.json` verifizieren** — NICHT gegen
  Dashboard-Anzeigetexte.
- **Ergebnis nach `PROJECT_CONTEXT` legen, nicht in ein Silo.** → mit Pedi abstimmen (Pedi hatte „eigenen Ordner"
  gewünscht; Ziel beider vereinbaren: Arbeitsordner OK, aber verifizierte Erkenntnisse müssen in PROJECT_CONTEXT fließen).
