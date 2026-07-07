import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPTURE_FRONT_DOOR_ROUTE,
  buildFrontDoorPayload,
  deriveFrontDoorTitle,
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

  it("verwendet den bestehenden KO-Create-Pfad ohne KnowledgeInputStudio-Overlay", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("RichTextEditor");
    expect(pageSource).toContain("Als Wissensobjekt sichern");
    expect(pageSource).toContain("endpoints.ko.create");
    expect(pageSource).toContain('to="/erfassen"');
    expect(pageSource).not.toContain("KnowledgeInputStudio");
  });
});
