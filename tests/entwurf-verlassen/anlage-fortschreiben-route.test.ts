// ================================================================================================
// entscheidung:14ce8681 / entscheidung:8b909a1e — DER SERVERVERTRAG VON `POST /api/drafts`.
// ================================================================================================
//
// Pedi, 30.09.2026, jeweils Option A:
//   14ce8681  „Der zweite Speicherversuch aktualisiert denselben Entwurf mit dem neuen Inhalt. Es
//             gibt immer nur einen Eintrag."
//   8b909a1e  Ein sichtbarer Hinweis „war bereits gespeichert, kein zweiter Eintrag" — dafür muss
//             die Antwort sagen, DASS nichts neu angelegt wurde.
//
// GEMESSEN an der echten Anwendung (`buildApp`) mit dem echten `CaptureService` und der echten
// `InMemoryDraftRepo`. Die Oberfläche steht in `erfassen-doppelklick-echte-api-mounted.test.tsx`
// (E1–E7), Chromium + PostgreSQL in `speicherknopf-ganzdokument-pg-im-browser.integration.test.ts`
// (Q7–Q9).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";

type App = ReturnType<typeof buildApp>;

async function setup() {
  const ablage = new InMemoryDraftRepo();
  const capture = new CaptureService({ repo: ablage });
  const app = buildApp({ ...buildServices(), capture });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, ablage, capture, headers };
}

const anlegen = (app: App, headers: Record<string, string>, body: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/drafts", headers, payload: body });

describe("entscheidung:14ce8681/8b909a1e · POST /api/drafts fortschreiben und Auskunft", () => {
  it("S1 · Erstspeicherung: 201 OHNE `anlage`; Wiederholung mit demselben Inhalt: 200 mit `anlage: bestehend`", async () => {
    const { app, ablage, headers } = await setup();

    const erst = await anlegen(app, headers, { title: "Ventil", operationId: "op-1" });
    expect(erst.statusCode).toBe(201);
    expect(Object.hasOwn(erst.json(), "anlage"), "Hinweis bei echter Erstspeicherung").toBe(false);

    const zweit = await anlegen(app, headers, {
      title: "Ventil",
      operationId: "op-1",
      fortschreiben: true,
    });
    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().anlage).toBe("bestehend");
    expect(zweit.json().id).toBe(erst.json().id);
    expect(await ablage.list()).toHaveLength(1);
  });

  it("S2 · derselbe Schlüssel, GEÄNDERTER Inhalt, `fortschreiben`: 200, derselbe Entwurf trägt den neuen Inhalt", async () => {
    const { app, ablage, headers } = await setup();

    const erst = await anlegen(app, headers, {
      title: "Ventil",
      statement: "alt",
      operationId: "op-1",
    });
    const zweit = await anlegen(app, headers, {
      title: "Ventil",
      statement: "neu",
      operationId: "op-1",
      fortschreiben: true,
    });

    expect(zweit.statusCode).toBe(200);
    expect(zweit.json().anlage).toBe("fortgeschrieben");
    expect(zweit.json().id).toBe(erst.json().id);
    const bestand = await ablage.list();
    expect(bestand, "zweiter Entwurf nach geändertem Inhalt").toHaveLength(1);
    expect(bestand[0]?.payload.statement).toBe("neu");
    // Transport bleibt Transport: weder `fortschreiben` noch `anlage` landen im Dokument.
    expect(Object.hasOwn(bestand[0]?.payload ?? {}, "fortschreiben")).toBe(false);
    expect(Object.hasOwn(bestand[0] ?? {}, "anlage")).toBe(false);

    // Und eine weitere Wiederholung DIESES neuen Inhalts ist wieder „bestehend".
    const dritt = await anlegen(app, headers, {
      title: "Ventil",
      statement: "neu",
      operationId: "op-1",
      fortschreiben: true,
    });
    expect(dritt.statusCode).toBe(200);
    expect(dritt.json().anlage).toBe("bestehend");
    expect(await ablage.list()).toHaveLength(1);
  });

  it("S3 · OHNE `fortschreiben` bleibt der Abdruckkonflikt (409) — die übrigen Aufrufer ändern sich nicht", async () => {
    const { app, ablage, headers } = await setup();

    await anlegen(app, headers, { title: "Ventil", operationId: "op-1" });
    const konflikt = await anlegen(app, headers, { title: "Ganz anders", operationId: "op-1" });

    expect(konflikt.statusCode).toBe(409);
    expect(konflikt.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    expect((await ablage.list())[0]?.payload.title).toBe("Ventil");
  });

  it("S4 · inzwischen anderswo bearbeitet: KEIN Überschreiben, sondern 409 — die fremde Bearbeitung bleibt", async () => {
    const { app, ablage, headers } = await setup();

    const erst = await anlegen(app, headers, { title: "Ventil", operationId: "op-1" });
    const id = erst.json().id as string;
    const bearbeitet = await app.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers,
      payload: { title: "Ventil (im zweiten Tab)" },
    });
    expect(bearbeitet.statusCode).toBe(200);

    const versuch = await anlegen(app, headers, {
      title: "Ventil neu",
      operationId: "op-1",
      fortschreiben: true,
    });

    expect(versuch.statusCode).toBe(409);
    expect(versuch.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    const bestand = await ablage.list();
    expect(bestand).toHaveLength(1);
    expect(bestand[0]?.payload.title).toBe("Ventil (im zweiten Tab)");
  });

  it("S5 · `fortschreiben` für einen Vorgang, den der Server nie gesehen hat: 201, genau EIN Entwurf mit dem aktuellen Inhalt", async () => {
    const { app, ablage, headers } = await setup();

    const res = await anlegen(app, headers, {
      title: "Ventil",
      statement: "aktuell",
      operationId: "op-nie-angekommen",
      fortschreiben: true,
    });

    expect(res.statusCode).toBe(201);
    expect(Object.hasOwn(res.json(), "anlage")).toBe(false);
    const bestand = await ablage.list();
    expect(bestand).toHaveLength(1);
    expect(bestand[0]?.payload.statement).toBe("aktuell");
  });

  // BEN, nacharbeit-8: das Fortschreiben ist ein Speicherweg wie Anlage und Fortsetzen — der
  // technische Entwurfsindex (R-1133) muss dem fortgeschriebenen Stand folgen. Sonst fehlt der
  // Eintrag bei der Duplikatsfrage eines anderen Entwurfs mit demselben neuen Inhalt.
  it("S6 · Anlage → Fortschreiben unter demselben Vorgang → die Duplikatsfrage eines anderen Entwurfs findet den fortgeschriebenen", async () => {
    const { app, ablage, capture, headers } = await setup();

    const erst = await anlegen(app, headers, {
      title: "Ventil",
      statement: "alt",
      operationId: "op-1",
    });
    const fort = await anlegen(app, headers, {
      title: "Ventil",
      statement: "neu",
      operationId: "op-1",
      fortschreiben: true,
    });
    expect(fort.json().anlage).toBe("fortgeschrieben");
    const anderer = await anlegen(app, headers, { title: "Ventil", statement: "neu" });
    expect(anderer.statusCode).toBe(201);
    // Die Indexarbeit ist entkoppelt eingeplant; wer den Index liest, wartet sie ab.
    await capture.indexArbeitAbgeschlossen();

    const index = await ablage.entwurfsIndexVon(erst.json().id);
    expect(index?.stand, "der Index hängt am Stand vor dem Fortschreiben").toBe(
      fort.json().updatedAt,
    );
    expect(index?.text).toContain("neu");

    const frage = await app.inject({
      method: "GET",
      url: `/api/drafts/${anderer.json().id}/gleicher-inhalt`,
      headers,
    });
    expect(frage.statusCode, frage.body).toBe(200);
    expect(
      (frage.json() as { entwuerfe: { id: string }[] }).entwuerfe.map((e) => e.id),
      "der fortgeschriebene Entwurf fehlt bei der Duplikatsfrage",
    ).toEqual([erst.json().id]);
  });
});
