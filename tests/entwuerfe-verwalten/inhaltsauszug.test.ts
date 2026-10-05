// ================================================================================================
// N-0065 · DER KURZE INHALTSAUSZUG JE ENTWURF — die reine Regel aus `lib/draftListView.ts`.
// ================================================================================================
//
// Die Fläche (`CaptureDraftList`, Übersicht „Meine Entwürfe") zeigt den Auszug; was er enthält,
// entscheidet allein `draftExcerpt`. Gemessen wird deshalb hier, DOM-frei:
// A  wörtlich aus dem Fließtext, Auszeichnung entfernt, Leerraum zusammengezogen
// B  ohne Fließtext die Kernaussage — aber nur, wenn ein eigener Titel dasteht
// C  er wiederholt nie den angezeigten Titel
// D  kein Text → `null` (kein Platzhalter)
// E  lang → an einer Wortgrenze gekürzt, höchstens DRAFT_EXCERPT_MAX Zeichen plus „ …"
import { describe, expect, it } from "vitest";
import type { Draft } from "../../apps/web/src/api/types";
import { DRAFT_EXCERPT_MAX, draftExcerpt } from "../../apps/web/src/lib/draftListView";

const entwurf = (payload: Record<string, unknown>): Pick<Draft, "payload"> =>
  ({ payload }) as unknown as Pick<Draft, "payload">;

describe("N-0065 · draftExcerpt", () => {
  it("A: wörtlich aus dem Fließtext, ohne Auszeichnung", () => {
    const a = draftExcerpt(
      entwurf({
        title: "Pumpe P7",
        statement: "Lager tauschen.",
        bodyHtml: "<p>Ab einem <strong>Schwingungswert</strong> über 7 mm/s</p><p>tauschen.</p>",
      }),
    );
    expect(a).toBe("Ab einem Schwingungswert über 7 mm/s tauschen.");
  });

  it("B: ohne Fließtext die Kernaussage — nur neben einem eigenen Titel", () => {
    expect(draftExcerpt(entwurf({ title: "Ventil V2", statement: "Dichtring wechseln" }))).toBe(
      "Dichtring wechseln",
    );
    // Ohne Titel IST die Kernaussage der Titel (`draftTitle`) — sie reist nicht zweimal.
    expect(draftExcerpt(entwurf({ title: "", statement: "Dichtring wechseln" }))).toBeNull();
  });

  it("C: ein Text, der dem angezeigten Titel gleicht, wird nicht wiederholt", () => {
    expect(draftExcerpt(entwurf({ title: "Gleich", bodyHtml: "<p>Gleich</p>" }))).toBeNull();
  });

  it("D: kein Text → null", () => {
    expect(draftExcerpt(entwurf({ title: "Nur Titel" }))).toBeNull();
    expect(draftExcerpt(entwurf({ title: "Nur Titel", bodyHtml: "<p>   </p>" }))).toBeNull();
  });

  it("E: lang → an einer Wortgrenze gekürzt", () => {
    const wort = "Prüfschritt";
    const lang = Array.from({ length: 40 }, () => wort).join(" ");
    const a = draftExcerpt(entwurf({ title: "Lang", bodyHtml: `<p>${lang}</p>` })) ?? "";
    expect(a.endsWith(" …")).toBe(true);
    const kern = a.slice(0, -2);
    expect(kern.length).toBeLessThanOrEqual(DRAFT_EXCERPT_MAX);
    // Kein halbes Wort am Ende: jedes Wort des Auszugs ist ein ganzes.
    expect(kern.split(" ").every((w) => w === wort)).toBe(true);
  });
});
