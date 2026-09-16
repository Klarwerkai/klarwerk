// ================================================================================================
// JOB 4193 · ENTWURF-MOBIL-DESKTOP-R — NACH DER AUFLÖSUNG IST ES IMMER NOCH EIN TEXT.
// ================================================================================================
//
// Die Rückfrage darf die Zusage von JOB 3377 nicht beschädigen: ein Entwurf mit Body wird am Handy
// als Fliesstext bearbeitet, und die Vollversion zeigt danach DENSELBEN Text (`payload.bodyHtml`,
// den `Capture.tsx` in den Editor lädt). Gemessen wird am ECHTEN Dienst — echter Merge, echter
// Sanitizer, echter `DraftStaleError` — und zwar über den vollen Weg:
//
//     laden → fremd schreiben → mobil speichern (abgewiesen) → frisch holen → „meine Fassung" →
//     nachlesen.
//
// Dazu die Prüflücke (d) aus §8.6: der `bodyMode`-Schalter (`form.segments`) darf durch den neuen
// Zustand nicht verloren gehen — sonst schriebe das Handy nach einem Konflikt wieder `statement`
// statt `bodyHtml`, und genau der Befund von JOB 3377 wäre zurück.
import { describe, expect, it } from "vitest";
import { draftBodyText, splitDraftBody } from "../../apps/web/src/lib/draftBody";
import { abweichendeFelder, draftToForm, formToUpdate } from "../../apps/web/src/lib/draftForm";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService, DraftStaleError } from "../../services/capture/src/service";

const AUSGANG = "<p>Ursprung</p>";

async function dienst() {
  const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  const angelegt = await svc.createDraft({ title: "Handbuch", bodyHtml: AUSGANG }, "u1");
  return { svc, id: angelegt.id };
}

describe("JOB 4193 · die Kette bis zum Desktop hält auch über den Konflikt hinweg", () => {
  it("„Meine Fassung behalten“ → der gespeicherte Body ist der mobile Text, und beide Flächen lesen ihn gleich", async () => {
    const { svc, id } = await dienst();

    // 1. Das Handy lädt — mit dem gesehenen Stand.
    const geladen = (await svc.resumeDraft(id))?.draft;
    if (!geladen) {
      throw new Error("Entwurf nicht gefunden");
    }
    const form = draftToForm(geladen);
    expect(form.segments).toBeDefined();
    expect(form.body).toBe("Ursprung");
    expect(form.gesehenerStand).toBe(geladen.updatedAt);

    // 2. Der Desktop schreibt dazwischen.
    await svc.continueDraft(id, { bodyHtml: "<p>Fassung Desktop</p>" }, "u2");

    // 3. Das Handy speichert mit seinem Stand — und wird abgewiesen.
    const meins = { ...form, body: "Fassung Handy" };
    const vorgang = formToUpdate(meins);
    expect(vorgang.expectedUpdatedAt).toBe(geladen.updatedAt);
    await expect(
      svc.continueDraft(id, vorgang.payload, "u1", {
        expectedUpdatedAt: vorgang.expectedUpdatedAt,
      }),
    ).rejects.toBeInstanceOf(DraftStaleError);
    // Nachgelesen: nichts überschrieben.
    expect((await svc.resumeDraft(id))?.draft.payload.bodyHtml).toBe("<p>Fassung Desktop</p>");

    // 4. Frisch geholt, Feldangabe gebildet, „meine Fassung behalten".
    const frisch = (await svc.resumeDraft(id))?.draft;
    if (!frisch) {
      throw new Error("Entwurf nicht gefunden");
    }
    expect(abweichendeFelder(meins, draftToForm(frisch))).toEqual(["body"]);
    const zweiter = formToUpdate({ ...meins, gesehenerStand: frisch.updatedAt });
    await svc.continueDraft(id, zweiter.payload, "u1", {
      expectedUpdatedAt: zweiter.expectedUpdatedAt,
    });

    // 5. Nachgelesen — und beide Flächen lesen daraus denselben Text.
    const danach = (await svc.resumeDraft(id))?.draft;
    if (!danach) {
      throw new Error("Entwurf nicht gefunden");
    }
    const bodyHtml = danach.payload.bodyHtml ?? "";
    // Das ist, was `Capture.tsx` in den Editor lädt (`setBodyHtml(p.bodyHtml ?? "")`).
    expect(bodyHtml).toBe("<p>Fassung Handy</p>");
    // Und das ist, was das Handy zeigt — aus derselben Zerlegung.
    expect(draftToForm(danach).body).toBe("Fassung Handy");
    expect(draftBodyText(splitDraftBody(bodyHtml))).toBe(draftToForm(danach).body);
  });

  it("Prüflücke (d): der `bodyMode`-Schalter überlebt den Konflikt — es bleibt beim Body, nicht bei der Kernaussage", async () => {
    const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    const angelegt = await svc.createDraft(
      { title: "Handbuch", statement: "Gespeicherte Kernaussage", bodyHtml: AUSGANG },
      "u1",
    );
    const id = angelegt.id;
    const form = draftToForm((await svc.resumeDraft(id))?.draft ?? angelegt);

    await svc.continueDraft(id, { bodyHtml: "<p>Fassung Desktop</p>" }, "u2");
    const frisch = (await svc.resumeDraft(id))?.draft;
    if (!frisch) {
      throw new Error("Entwurf nicht gefunden");
    }
    const aufgeloest = formToUpdate({
      ...form,
      body: "Fassung Handy",
      gesehenerStand: frisch.updatedAt,
    });
    // Der Schalter steht noch: geschrieben wird der BODY, die Kernaussage reist nicht mit.
    expect(aufgeloest.payload.bodyHtml).toBe("<p>Fassung Handy</p>");
    expect(aufgeloest.payload.statement).toBeUndefined();

    await svc.continueDraft(id, aufgeloest.payload, "u1", {
      expectedUpdatedAt: aufgeloest.expectedUpdatedAt,
    });
    const danach = (await svc.resumeDraft(id))?.draft;
    expect(danach?.payload.bodyHtml).toBe("<p>Fassung Handy</p>");
    // Die gespeicherte Kernaussage steht unberührt da — der partielle Merge hat sie gelassen.
    expect(danach?.payload.statement).toBe("Gespeicherte Kernaussage");
    expect(draftToForm(danach ?? angelegt).segments).toBeDefined();
  });
});
