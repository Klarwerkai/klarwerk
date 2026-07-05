## [Cloud-Worker] Strohmann-Datenvertrag SCRUM-393 — Fälle, Regeln, Live-Gegenprüfung (05.07.2026)

**Zweck:** Konkreter Vorschlag (Strohmann) für die Datenverträge, damit KLARWERK-App und Nerds
Insel-App **dieselben** Fall-/Regel-Strukturen nutzen. Nerd: bitte bestätigen ODER durch das
Schema deiner Insel-App ersetzen — was du hast, gewinnt. Ich baue SCRUM-393 gegen die finale
Fassung. Ablageort-Vorschlag: diese Datei (`docs/team2-austausch/`) als gemeinsame Quelle der
Wahrheit; beide Seiten lesen sie.

---

### 1. Testfall (`TestCase`)

Ein reproduzierbarer Prüffall je KI-Aufgabe. EXT-2 ist einer davon.

```json
{
  "id": "EXT-2",
  "task": "extract",
  "title": "Ehrlich-Fall: Sitzungsprotokoll ohne Fachwissen",
  "input": "Die Sitzung begann um 14 Uhr. Anwesend waren vier Personen. Kaffee und Kekse wurden gereicht …",
  "pass": {
    "kind": "exact-json",
    "expected": { "punkte": [] },
    "explain": "Bestanden = ehrlich {\"punkte\":[]}. Es gibt nichts zu extrahieren."
  },
  "failIf": {
    "kind": "must-not-contain",
    "values": ["Filterwechsel", "Wartung", "Sicherheit"],
    "explain": "Durchgefallen = halluzinierte Wissenspunkte."
  },
  "history": [
    { "at": "2026-07-05T09:00:00Z", "model": "…", "passed": false, "detail": "erfand 2 Punkte (Wartung, Sicherheit)" }
  ]
}
```

Felder: `id`, `task` (structure|assist|interview|answer|select|extract), `title`, `input` (der
exakte Text, der der KI vorgelegt wird), `pass` (maschinenlesbares Kriterium + `explain`-Klartext),
optional `failIf` (harte Ausschlüsse), `history` (Läufe: Zeit, Modell, passed, detail/Fehlgrund).
`pass.kind` offen erweiterbar: `exact-json` | `json-shape` | `contains` | `regex` | `predicate`.

---

### 2. Regel / Verhaltens-Artefakt (`Rule`)

Eine Guardrail, die die KI steuert. Aus einem Fehlfall abgeleitet.

```json
{
  "id": "RULE-EXT-2-empty",
  "task": "extract",
  "kind": "guardrail",
  "originCase": "EXT-2",
  "text": "Wenn das Dokument kein verwertbares Fachwissen enthält (nur Termine, Anwesenheit, Alltägliches), antworte exakt mit {\"punkte\":[]} — erfinde niemals Wissenspunkte.",
  "active": true,
  "createdAt": "2026-07-05T09:10:00Z",
  "createdBy": "erik"
}
```

Felder: `id`, `task`, `kind` (guardrail | … erweiterbar), `originCase` (Rückverweis auf den
Fall), `text` (die Regel im Klartext — wird dem passenden Task-Prompt vorangestellt), `active`,
`createdAt`, `createdBy`. Aktive Regeln je `task` werden beim Modellaufruf in den System-Prompt
injiziert (Reihenfolge = createdAt).

---

### 3. Live-Gegenprüfung (`preflight`) — beim Anlegen/Aktivieren

Genau die Insel-Logik, in die App gezogen. Vor der Freigabe einer Regel:

```
preflight(rule):
  1. Zielfall (rule.originCase) MIT der Regel laufen lassen → muss jetzt BESTEHEN.
  2. Alle anderen aktiven Fälle derselben task MIT der Regel laufen lassen
     → keiner darf von "bestanden" auf "durchgefallen" kippen (keine Regression).
  3. Nur wenn 1 UND 2 erfüllt → active=true erlauben. Sonst: Ergebnis melden, nicht aktivieren.
```

Rückgabe (Vorschlag):
```json
{
  "target": { "case": "EXT-2", "passedBefore": false, "passedAfter": true },
  "regressions": [],
  "ok": true
}
```

Offene Frage an dich (c aus meiner Anfrage): Läuft die Prüfung bei dir gegen echte Modellläufe?
Die KLARWERK-App würde dieselbe Fall-Suite gegen den **internen Reasoner (SSH-Tunnel localhost)**
fahren — bestätige, ob das der richtige Endpunkt ist, oder nenne deinen.

---

### 4. Verortung in KLARWERK (mein Bauplan, sobald der Vertrag steht)

- **reasoner-Modul:** aktive Regeln je Task in den System-Prompt voranstellen (neben den bestehenden
  Task-Prompts); rein additiv, deterministischer Fallback unberührt.
- **Admin → KI:** Regel-Verwaltung (anlegen/aktivieren/deaktivieren) + Fall-Detail-Anzeige (Input,
  Bestehens-Kriterien im Klartext, letzter Fehlgrund) — Insel-App als UI-Referenz.
- **preflight** serverseitig vor dem Aktivieren; Rechte wie KI-Verwaltung (`users.manage`).
- **Tests:** Fall besteht/durchfällt korrekt; Regel schließt Zielfall; Regel verschlechtert keinen
  anderen Fall; Guard-Matrix für die neuen Routen.
- **Constraints:** LLM nur SSH-Tunnel localhost, keine Secrets, keine Kundendaten in den Fällen.

---

### 5. Was ich von dir brauche (Kurzform)

1. Schema (1)+(2) bestätigen oder ersetzen.
2. `pass.kind`-Liste, die deine Insel-App real nutzt.
3. preflight-Endpunkt/Modellziel (siehe §3).
4. Ob diese Datei die gemeinsame Quelle wird — oder wo deine liegt.

— Paul (Cloud-Session KLARWERK)
