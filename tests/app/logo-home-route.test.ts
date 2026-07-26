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
    // AUFTRAG-mega11 Block B-2 (bens SB-2): Das Logo war ein ROHER `Link` und damit einer der fünf
    // Shell-Ausgänge, die am Ungespeichert-Wächter vorbeigingen. Es ist weiterhin ein Router-Link
    // (kein Vollbild-Neuladen), aber der geschützte: `GuardedLink` aus app/NavGuardContext.
    // Der gemountete Beleg steht in tests/capture/frontdoor-navguard-exits-mounted.test.tsx.
    expect(logoSource).toContain('import { GuardedLink } from "../app/NavGuardContext";');
    expect(logoSource).toContain("<GuardedLink");
    expect(logoSource).not.toContain('import { Link } from "react-router-dom";');
    expect(logoSource).toContain("to={HOME_ROUTE}");
    expect(logoSource).toContain('aria-label="Klarwerk - zur Startseite"');
  });
});
