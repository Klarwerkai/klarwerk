// ================================================================================================
// AUFTRAG-mega70 BLOCK C — DIE BETONTE NÄCHSTE HANDLUNG MUSS EINE SEIN, DIE DIESE ROLLE TUN KANN.
// ================================================================================================
// bens Befund: `captureNextSteps` markiert `/validierung` fest als `primary` — für jede Rolle
// gleich. Für eine Expertin ist das der dunkel hervorgehobene Hauptknopf DIREKT nach ihrem ersten
// Erfolg, und er führt ins Nichts (der Router weist `/validierung` für `experte` zurück).
//
// Die Zusage hier: die betonte Handlung richtet sich nach dem, was die Rolle darf — beantwortet
// von `routePathAllows`, derselben Registry, aus der der Router sein Gate zieht (GUARDED_ITEMS in
// app/navigation.ts). Kann die Rolle nicht validieren, wird das Objekt-Ansehen betont; der
// Validierungs-Schritt BLEIBT in der Liste (sichtbar als Lage — Block B macht ihn über RoleLink
// unbegehbar), damit der Prozess verständlich bleibt.
//
// Und der Begleittext gehört dazu: „bitte zur Prüfung geben" fordert eine Handlung, die eine
// Expertin nicht tun kann. Er erklärt jetzt den Prozess (erst nach Bewertung in der Validierung
// wird das Objekt nutzbares Wissen), ohne zur Handlung aufzufordern — in DE, EN und NL.
import { describe, expect, it } from "vitest";
import { ROLES, type Role, routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { captureNextSteps, captureSavedStatus } from "../../apps/web/src/lib/captureSuccess";

describe("mega70 C · die betonte nächste Handlung ist für die Rolle begehbar", () => {
  // Die Kern-Zusage, rollenweise gegen die Router-Registry — nicht gegen eine Liste hier im Test.
  for (const rolle of ROLES) {
    it(`${rolle}: der primäre Schritt führt auf eine Route, die der Router dieser Rolle öffnet`, () => {
      const steps = captureNextSteps("ko-1", rolle as Role);
      const primaere = steps.filter((s) => s.primary);
      expect(primaere).toHaveLength(1);
      const ziel = primaere[0]?.to ?? "";
      expect(`${ziel} begehbar: ${routePathAllows(ziel, rolle as Role)}`).toBe(
        `${ziel} begehbar: true`,
      );
    });
  }

  it("controller/admin: die Validierung bleibt die betonte Handlung (nichts verschoben)", () => {
    for (const rolle of ["controller", "admin"] as Role[]) {
      const validate = captureNextSteps("ko-2", rolle).find((s) => s.to.startsWith("/validierung"));
      expect(validate?.primary).toBe(true);
    }
  });

  it("experte: Validierung bleibt SICHTBAR, aber das Objekt-Ansehen ist die betonte Handlung", () => {
    const steps = captureNextSteps("ko-3", "experte");
    const validate = steps.find((s) => s.to.startsWith("/validierung"));
    const viewKo = steps.find((s) => s.to.startsWith("/wissen/"));
    // Die Angabe verschwindet nicht (mega51-Entscheidung: sie hört auf, ein Weg zu sein).
    expect(validate).toBeDefined();
    expect(validate?.primary).toBeFalsy();
    expect(viewKo?.primary).toBe(true);
  });
});

describe("mega70 C · der Begleittext erklärt den Prozess, statt zur Handlung aufzufordern", () => {
  const text = (lng: string): string =>
    String(i18n.getResource(lng, "translation", captureSavedStatus().hintKey) ?? "");

  it("DE/EN/NL: keine Aufforderung mehr, das Objekt selbst zur Prüfung zu geben", () => {
    expect(text("de")).not.toContain("zur Prüfung geben");
    expect(text("en").toLowerCase()).not.toContain("send it for review");
    expect(text("nl").toLowerCase()).not.toContain("geef het ter beoordeling");
  });

  it("DE/EN/NL: der wahre erste Teil bleibt, und der Prozess wird weiterhin benannt", () => {
    expect(text("de")).toContain("noch nicht validiert");
    expect(text("de")).toContain("Validierung");
    expect(text("en").toLowerCase()).toContain("not yet validated");
    expect(text("en").toLowerCase()).toContain("validation");
    expect(text("nl").toLowerCase()).toContain("nog niet gevalideerd");
    expect(text("nl").toLowerCase()).toContain("validatie");
  });
});
