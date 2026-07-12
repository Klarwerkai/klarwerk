import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_ROUTE, NAV_GROUPS } from "../../apps/web/src/app/navigation";

const logoSource = readFileSync("apps/web/src/shell/Logo.tsx", "utf8");

describe("KW-LOGO-HOME-01: logo home route", () => {
  it("nutzt dieselbe Start-Route wie die Sidebar", () => {
    const startItem = NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.id === "start",
    );

    expect(HOME_ROUTE).toBe("/start");
    expect(startItem?.path).toBe(HOME_ROUTE);
  });

  it("rendert das Markenlogo als Router-Link zur Startseite", () => {
    expect(logoSource).toContain('import { Link } from "react-router-dom";');
    expect(logoSource).toContain("to={HOME_ROUTE}");
    expect(logoSource).toContain('aria-label="Klarwerk - zur Startseite"');
  });
});
