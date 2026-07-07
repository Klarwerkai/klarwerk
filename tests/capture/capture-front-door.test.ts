import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Draft, DraftPayload } from "../../apps/web/src/api/types";
import {
  CAPTURE_FRONT_DOOR_ROUTE,
  FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
  buildFrontDoorPayload,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  withFrontDoorSaveTimeout,
} from "../../apps/web/src/lib/captureFrontDoor";

describe("KW-PROD-02: CaptureFrontDoor", () => {
  it("stellt den neuen Einstieg als stabile Deep-Link-Route bereit", () => {
    expect(CAPTURE_FRONT_DOOR_ROUTE).toBe("/capture/frontdoor");
    const routesSource = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(routesSource).toContain("CAPTURE_FRONT_DOOR_ITEM");
    expect(routesSource).toContain("CaptureFrontDoor");
  });

  it("leitet einen Titel aus Ueberschrift oder erster Zeile ab", () => {
    expect(deriveFrontDoorTitle("", "<h1>Mein Titel</h1><p>Text</p>")).toBe("Mein Titel");
    expect(deriveFrontDoorTitle("", "<p>Erste Zeile</p><p>Zweite Zeile</p>")).toBe("Erste Zeile");
    expect(deriveFrontDoorTitle("Manuell", "<h2>Ignoriert</h2>")).toBe("Manuell");
    expect(deriveFrontDoorTitle("", "")).toBe("Unbenanntes Wissensobjekt");
  });

  it("nutzt die FMT-1-Normalisierung fuer den gespeicherten Body", () => {
    const payload = buildFrontDoorPayload({
      title: "",
      bodyHtml: '<h1>Titel</h1><p><span style="font-weight:700">fett</span></p>',
    });
    expect(payload.title).toBe("Titel");
    expect(payload.statement).toContain("Titel");
    expect(String(payload.bodyHtml)).toContain("<h2>Titel</h2>");
    expect(String(payload.bodyHtml)).toContain("<strong>fett</strong>");
  });

  it("uebernimmt Pedi-Titel und Pedi-Inhalt in den Speicher-Payload", () => {
    const payload = buildFrontDoorPayload({
      title: "wasser",
      bodyHtml: "<p>tesx fall</p>",
    });

    expect(payload.title).toBe("wasser");
    expect(payload.statement).toBe("tesx fall");
    expect(String(payload.bodyHtml)).toContain("tesx fall");
    expect(payload.origin).toBe("frontdoor");
  });

  it("setzt Vordertuer-Drafts mit Formatierung wieder als Body ein", () => {
    expect(frontDoorBodyFromDraft({ bodyHtml: "<p><strong>fett</strong></p>" })).toBe(
      "<p><strong>fett</strong></p>",
    );
    expect(frontDoorBodyFromDraft({ statement: "nur text" })).toBe("<p>nur text</p>");
    expect(frontDoorBodyFromDraft({ statement: "<script>alert(1)</script>" })).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("nutzt den bestehenden Draft-Create-Pfad fuer die Vordertuer-Persistenz", async () => {
    const captured: DraftPayload[] = [];
    const draft = await createFrontDoorDraft(
      { title: "wasser", bodyHtml: "<p>tesx fall</p>" },
      async (payload) => {
        captured.push(payload);
        return {
          id: "draft-frontdoor",
          payload,
          originalAuthor: "pedi",
          lastEditor: "pedi",
          createdAt: "2026-07-07T00:00:00.000Z",
          updatedAt: "2026-07-07T00:00:00.000Z",
        } satisfies Draft;
      },
      100,
    );

    expect(draft.id).toBe("draft-frontdoor");
    expect(captured[0]?.title).toBe("wasser");
    expect(captured[0]?.statement).toBe("tesx fall");
    expect(String(captured[0]?.bodyHtml)).toContain("tesx fall");
    expect(captured[0]?.origin).toBe("frontdoor");
  });

  it("beendet einen haengenden Save mit klarer Fehlermeldung", async () => {
    await expect(withFrontDoorSaveTimeout(new Promise(() => undefined), 1)).rejects.toThrow(
      FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
    );
  });

  it("verwendet den bestehenden KO-Create-Pfad ohne KnowledgeInputStudio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("RichTextEditor");
    expect(pageSource).toContain("Als Wissensobjekt sichern");
    expect(pageSource).toContain("endpoints.drafts.create");
    expect(pageSource).toContain("endpoints.drafts.update");
    expect(pageSource).toContain("get(resumeDraftId)");
    expect(pageSource).toContain("frontDoorBodyFromDraft");
    expect(pageSource).toContain("CAPTURE_FRONT_DOOR_ROUTE");
    expect(pageSource).toContain("createFrontDoorDraft");
    expect(pageSource).toContain("onMutate");
    expect(pageSource).not.toContain("KnowledgeInputStudio");
  });
});
