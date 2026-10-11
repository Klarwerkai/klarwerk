// ================================================================================================
// MOBILE ERFASSUNG (aufnahme:20260922:gesamt-mobile-erfassung) — DIE NUTZLAST, OHNE OBERFLÄCHE.
// ================================================================================================
//
// FR-MOB-02 / R-0092: das Interview am Handy füllt dieselben Felder wie der deterministische
// Interviewweg des Servers. FR-CAP-04: Fotos reisen als Body, so wie der Desktop-Editor sie
// einbettet — und überstehen den Sanitizer an der Persistenzgrenze.
//
// Und das Wichtigste daneben: OHNE die neuen Felder bleibt jede Nutzlast wörtlich wie vorher. Die
// Fälle von JOB 3377/4193 (tests/entwurf-mobil-desktop/**) hängen daran.
import { describe, expect, it } from "vitest";
import { draftBodyMitFotos, splitDraftBody } from "../../apps/web/src/lib/draftBody";
import {
  EMPTY_DRAFT_FORM,
  formToPayload,
  isDraftFormChanged,
  isDraftFormFillable,
} from "../../apps/web/src/lib/draftForm";
import {
  LEERE_INTERVIEW_ANTWORTEN,
  MOBIL_INTERVIEW_FRAGEN,
  interviewBegonnen,
  interviewZuForm,
} from "../../apps/web/src/lib/mobileInterview";
import { de } from "../../apps/web/src/woerterbuch/de";
import { en } from "../../apps/web/src/woerterbuch/en";
import { nl } from "../../apps/web/src/woerterbuch/nl";
import { INTERVIEW_QUESTIONS } from "../../services/reasoner/src/provider";
import { sanitizeHtml } from "../../services/structure";

const FOTO = { id: "f1", name: "Pumpe.jpg", dataUrl: "data:image/jpeg;base64,QUJD" };

describe("FR-MOB-02 · das Handy-Interview", () => {
  it("fragt wörtlich dieselbe feste Folge wie der Server — in allen drei Sprachen", () => {
    const woerterbuch = { de, en, nl } as Record<string, Record<string, string>>;
    for (const sprache of ["de", "en", "nl"] as const) {
      const fragen = MOBIL_INTERVIEW_FRAGEN.map((k) => woerterbuch[sprache]?.[k]);
      expect(fragen, sprache).toEqual([...INTERVIEW_QUESTIONS[sprache]]);
    }
  });

  it("legt die Antworten in Kernaussage, Bedingung, Maßnahme und Stichworte", () => {
    const form = interviewZuForm(
      ["Ventil V3 klemmt bei Frost", "unter 0 °C", "Begleitheizung vorher an", "Ventil, Frost , "],
      { ...EMPTY_DRAFT_FORM },
    );
    expect(formToPayload(form)).toEqual({
      statement: "Ventil V3 klemmt bei Frost",
      conditions: ["unter 0 °C"],
      measures: ["Begleitheizung vorher an"],
      tags: ["Ventil", "Frost"],
    });
  });

  it("ein halbes Interview ist schon ein Entwurf — leere Antworten legen nichts an", () => {
    const form = interviewZuForm(["Nur die Kernaussage"], { ...EMPTY_DRAFT_FORM });
    expect(formToPayload(form)).toEqual({ statement: "Nur die Kernaussage" });
    expect(isDraftFormFillable(form)).toBe(true);
  });

  it("eine Antwort NACH der ersten zählt als Eingabe — für Speichern und Weggeh-Wächter", () => {
    const form = interviewZuForm(["", "nur die Bedingung"], { ...EMPTY_DRAFT_FORM });
    expect(isDraftFormFillable(form)).toBe(true);
    expect(isDraftFormChanged(form, EMPTY_DRAFT_FORM)).toBe(true);
    expect(interviewBegonnen(["", "nur die Bedingung"])).toBe(true);
    expect(interviewBegonnen(LEERE_INTERVIEW_ANTWORTEN)).toBe(false);
  });

  it("Fotos aus der Notiz reisen beim Interview mit", () => {
    const form = interviewZuForm(["Kern"], { ...EMPTY_DRAFT_FORM, fotos: [FOTO] });
    expect(form.fotos).toEqual([FOTO]);
  });
});

describe("FR-CAP-04 · Fotos im neuen Entwurf", () => {
  it("der Body trägt erst den Text, dann jedes Foto als eigenen Block", () => {
    const body = draftBodyMitFotos("Pumpe leckt\n\nan der Welle", [FOTO]);
    expect(body).toBe(
      '<p>Pumpe leckt</p><p>an der Welle</p><p><img src="data:image/jpeg;base64,QUJD" alt="Pumpe.jpg" data-kw-scale="100"></p>',
    );
    // Am Handy kommt das Foto beim Fortsetzen als fester Block zurück — nie als bearbeitbarer Text.
    const segmente = splitDraftBody(body);
    expect(segmente.map((s) => s.art)).toEqual(["text", "text", "fest"]);
    expect(segmente[2]?.marke).toBe("bild");
  });

  it("das Foto übersteht den Sanitizer der Persistenzgrenze", () => {
    const gespeichert = sanitizeHtml(draftBodyMitFotos("Pumpe leckt", [FOTO]));
    expect(gespeichert).toContain('src="data:image/jpeg;base64,QUJD"');
    expect(gespeichert).toContain("<p>Pumpe leckt</p>");
  });

  it("nur Rasterbilder als Base64 — alles andere fällt schon hier heraus", () => {
    const body = draftBodyMitFotos("", [
      { name: "x.svg", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
      { name: "y", dataUrl: "javascript:alert(1)" },
    ]);
    expect(body).toBe("");
  });

  it("Nutzlast: Kernaussage UND Body; die Liste findet ihren Titel weiter in der Kernaussage", () => {
    const payload = formToPayload({ ...EMPTY_DRAFT_FORM, statement: "Pumpe leckt", fotos: [FOTO] });
    expect(payload.statement).toBe("Pumpe leckt");
    expect(payload.bodyHtml).toContain("data:image/jpeg;base64,QUJD");
  });

  it("ein Foto allein ist speicherbar; Hinzufügen und Entfernen sind Änderungen", () => {
    const mitFoto = { ...EMPTY_DRAFT_FORM, fotos: [FOTO] };
    expect(isDraftFormFillable(mitFoto)).toBe(true);
    expect(isDraftFormChanged(mitFoto, EMPTY_DRAFT_FORM)).toBe(true);
    expect(isDraftFormChanged({ ...mitFoto, fotos: [] }, mitFoto)).toBe(true);
    expect(formToPayload({ ...mitFoto, fotos: [] })).toEqual({});
  });

  it("ohne neue Felder bleibt die Nutzlast wörtlich wie bisher", () => {
    expect(formToPayload({ title: "T", statement: "S" })).toEqual({ title: "T", statement: "S" });
    expect(formToPayload({ ...EMPTY_DRAFT_FORM })).toEqual({});
  });
});
