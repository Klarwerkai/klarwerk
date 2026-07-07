import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Draft, DraftPayload } from "../../apps/web/src/api/types";
import {
  CAPTURE_FRONT_DOOR_ROUTE,
  FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
  FRONT_DOOR_STRUCTURING_UNAVAILABLE_MESSAGE,
  buildFrontDoorPayload,
  buildFrontDoorStructureInput,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  frontDoorStructuredBodyHtml,
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

  it("bereitet den Frontdoor-Inhalt fuer den bestehenden Reasoner-Structure-Pfad vor", () => {
    expect(
      buildFrontDoorStructureInput({
        title: "Wasser",
        bodyHtml: "<h2>Pruefung</h2><p><strong>Ventil</strong> kontrollieren.</p>",
      }),
    ).toBe("Wasser\n\nPruefung Ventil kontrollieren.");
    expect(buildFrontDoorStructureInput({ title: "", bodyHtml: "<p> </p>" })).toBe("");
  });

  it("rendert den KI-Vorschlag als sichere strukturierte HTML-Uebernahme", () => {
    const html = frontDoorStructuredBodyHtml({
      title: "Wasser <script>",
      statement: "Pumpe pruefen & freigeben",
      conditions: ["Druck > 4 bar"],
      measures: ["Ventil schliessen"],
      tags: ["wasser", "betrieb"],
      confidence: 0.7,
      demo: false,
    });

    expect(html).toContain("<h2>Wasser &lt;script&gt;</h2>");
    expect(html).toContain("<strong>Kernaussage:</strong>");
    expect(html).toContain("<h3>Bedingungen</h3>");
    expect(html).toContain("<li>Druck &gt; 4 bar</li>");
    expect(html).toContain("<h3>Massnahmen</h3>");
    expect(html).toContain("wasser, betrieb");
    expect(html).not.toContain("<script>");
  });

  it("bietet optionale KI-Strukturierung ohne Auto-Save oder Auto-Validate an", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("Soll ich das ordnen?");
    expect(pageSource).toContain("endpoints.reasoner.structure");
    expect(pageSource).toContain("buildFrontDoorStructureInput");
    expect(pageSource).toContain("KI-Vorschlag");
    expect(pageSource).toContain("KI-generiert. Bitte pruefen");
    expect(pageSource).toContain("Uebernehmen");
    expect(pageSource).toContain("Verwerfen");
    expect(pageSource).toContain("FRONT_DOOR_STRUCTURING_UNAVAILABLE_MESSAGE");
    expect(FRONT_DOOR_STRUCTURING_UNAVAILABLE_MESSAGE).toBe(
      "Ich kann das gerade nicht verlaesslich ordnen.",
    );
    expect(pageSource).toContain("Originaltext bleibt unveraendert");
    expect(pageSource).toContain("Nichts wird automatisch gespeichert");
    expect(pageSource).toContain("frontDoorStructuredBodyHtml");
    expect(pageSource).not.toContain("endpoints.ko.create");
    expect(pageSource).not.toContain("endpoints.validation");
    expect(pageSource).not.toContain("KnowledgeInputStudio");
  });

  it("/erfassen stellt die Vordertuer als Default heraus und behaelt alte Wege", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(captureSource).toContain("KW-PROD-15");
    expect(captureSource).toContain("Neues Wissensobjekt erfassen");
    expect(captureSource).toContain("Dokument-Canvas oeffnen");
    expect(captureSource).toContain("Weitere Wege");
    expect(captureSource).toContain("NARRATE_MODES.map");
    expect(captureSource).toContain("EXPERT_MODE");
    expect(captureSource).toContain("CAPTURE_FRONT_DOOR_ROUTE");
  });

  it("Default-Vordertuer nutzt genau einen RichTextEditor und kein Studio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );

    expect(pageSource.match(/<RichTextEditor/g) ?? []).toHaveLength(1);
    expect(pageSource).not.toContain("KnowledgeInputStudio");
  });
});
