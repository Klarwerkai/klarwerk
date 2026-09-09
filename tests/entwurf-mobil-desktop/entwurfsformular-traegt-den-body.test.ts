// ================================================================================================
// JOB 3377 · ENTWURF-MOBIL-DESKTOP-R — DAS MOBILFORMULAR SCHREIBT IN DAS FELD, DAS DER DESKTOP ZEIGT.
// ================================================================================================
//
// DIE AUSGANGSLAGE (auf main gemessen): `formToPayload` schrieb ausschliesslich `title` und
// `statement`. Der Desktop-Editor zeigt aber `bodyHtml` (`Capture.tsx`, `setBodyHtml(p.bodyHtml ?? "")`
// — z. Zt. :2146). Weil der Server partiell merged, blieb der alte Body unangetastet stehen: die
// Ergänzung vom Handy lag in einem anderen Feld und war am Desktop nicht zu sehen. Das ist A08.
//
// Hier wird die UMWANDLUNGSKETTE gemessen, ohne Fläche und ohne Netz: gespeicherter Entwurf →
// `draftToForm` → (Eingabe) → `formToPayload` → Nutzlast. Die gemountete Kette bis zur geöffneten
// Desktop-Fläche steht in `mobil-schreibt-denselben-text-mounted.test.tsx`.
import { describe, expect, it } from "vitest";
import type { Draft } from "../../apps/web/src/api/types";
import { draftToForm, formToPayload } from "../../apps/web/src/lib/draftForm";

const LINK_BODY =
  '<p><a href="https://klarwerk.de">Hand<br><br>buch</a></p><p><strong>A</strong></p>';

function entwurf(payload: Draft["payload"], anchorsMissing?: string[]): Draft {
  return {
    id: "d1",
    payload,
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-09-09T08:00:00.000Z",
    updatedAt: "2026-09-09T08:00:00.000Z",
    ...(anchorsMissing ? { anchorsMissing } : {}),
  };
}

describe("JOB 3377 · draftToForm/formToPayload — ein Text, ein Weg", () => {
  it("ein Entwurf MIT Body kommt als Fliesstext ins Formular", () => {
    const form = draftToForm(entwurf({ title: "T", statement: "S", bodyHtml: LINK_BODY }));
    expect(form.body).toBe("Hand\n\nbuch\n\nA");
    expect(form.segments).toHaveLength(2);
    // Die gespeicherte Kernaussage reist unverändert mit — sie wird nicht überschrieben.
    expect(form.statement).toBe("S");
  });

  it("Fortsetzen und OHNE Eingabe speichern lässt den Body byte-gleich (BEN Prüfpunkt 4)", () => {
    const form = draftToForm(entwurf({ title: "T", bodyHtml: LINK_BODY }));
    expect(formToPayload(form)).toEqual({ title: "T", bodyHtml: LINK_BODY });
  });

  it("ein angehängter Satz geht als bodyHtml raus — die Kernaussage bleibt aus der Nutzlast", () => {
    const form = draftToForm(entwurf({ title: "T", statement: "S", bodyHtml: LINK_BODY }));
    const payload = formToPayload({ ...form, body: `${form.body ?? ""}\n\nNachtrag vom Handy` });
    expect(payload).toEqual({
      title: "T",
      bodyHtml: `${LINK_BODY}<p>Nachtrag vom Handy</p>`,
    });
    expect(payload.statement).toBeUndefined();
  });

  it("ein Entwurf OHNE Body verhält sich unverändert wie bisher (Kernaussage-Weg)", () => {
    const form = draftToForm(entwurf({ title: "T", statement: "S" }));
    expect(form.segments).toBeFalsy();
    expect(formToPayload({ ...form, statement: "S neu" })).toEqual({
      title: "T",
      statement: "S neu",
    });
  });

  it("fehlt das gesicherte Original (anchorsMissing), wird der Body NICHT angefasst", () => {
    // Der Server dünnt den Entwurf dann aus (`bodyHtml: null`, services/capture/src/service.ts
    // `withAnchorCheck`). Ein Zurückschreiben aus diesem Stand hiesse, den echten Body zu löschen.
    const form = draftToForm(entwurf({ title: "T", statement: "S", bodyHtml: null }, ["obj-1"]));
    expect(form.segments).toBeFalsy();
    expect(formToPayload(form)).toEqual({ title: "T", statement: "S" });
  });
});
