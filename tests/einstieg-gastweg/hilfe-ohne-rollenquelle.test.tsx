// @vitest-environment jsdom
// ================================================================================================
// JOB 4022 · DER LADEFALL — SOLANGE DIE ROLLE NICHT FESTSTEHT, WIRD WEDER GEFÜHRT NOCH GESPERRT.
// ================================================================================================
//
// WARUM DIESE DATEI OHNE JEDE ATTRAPPE ARBEITET. Der Zwilling
// `hilfe-fuehrt-den-gast-nicht-ins-leere.test.tsx` steuert die Rolle über eine Attrappe von
// `app/RoleContext`. Eine Attrappe kann aber nur zeigen, was sie selbst vorgibt — sie kann nicht
// belegen, wie sich die Seite verhält, wenn die Rollenquelle GAR NICHT da ist. Genau das ist hier
// der Messgegenstand: die echte `pages/Help.tsx` mit dem echten `RoleContext`, ohne
// `<RoleProvider>`. `useRole` wirft in dieser Lage (`app/RoleContext.tsx:66`).
//
// DAS IST KEIN AUSGEDACHTER ZUSTAND. Die Hilfeseite hängt an keinem Abruf und soll in jeder Lage
// lesbar bleiben (dieselbe Zusage, die `Help.tsx` für das Importkapitel schon trifft). Drei
// vorhandene Prüfstände montieren sie deshalb ohne jede Umgebung
// (`tests/review26-hilfe-import/hilfe-karte-dateiimport.test.tsx`, `tests/iso-hilfe/…`,
// `tests/seitenhilfe-navkapitel/…`). Das Zustandsmodell des Auftrags verlangt für diesen Fall:
// KEIN „öffnen"-Link (das wäre der alte Fehler in neuer Form) und KEINE Sperrbehauptung — eine
// negative Aussage über eine unbekannte Rolle wäre genauso unbelegt wie eine positive.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ALL_ITEMS, ROLES } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { PILOT_CHECKLIST } from "../../apps/web/src/lib/pilotChecklist";
import { Help } from "../../apps/web/src/pages/Help";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function hilfeOhneRollenquelle(): Promise<HTMLElement> {
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
  });
  return flaeche;
}

afterEach(async () => {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

function einstiegsListe(flaeche: HTMLElement): HTMLElement {
  const anker = i18n.t(PILOT_CHECKLIST[0]?.labelKey ?? "");
  const treffer = [...flaeche.querySelectorAll("ol")].filter((liste) =>
    (liste.textContent ?? "").includes(anker),
  );
  expect(treffer, "genau EINE Einstiegsführung auf der Hilfeseite").toHaveLength(1);
  return treffer[0] as HTMLElement;
}

describe("JOB 4022 · Hilfeseite ohne Rollenquelle", () => {
  it("Z1: die Seite bleibt vollständig lesbar — jeder Schritt steht mit seinem Text da", async () => {
    const flaeche = await hilfeOhneRollenquelle();
    const liste = einstiegsListe(flaeche);
    for (const item of PILOT_CHECKLIST) {
      expect(liste.textContent ?? "", `Schritt „${item.id}" fehlt`).toContain(
        i18n.t(item.labelKey),
      );
    }
  });

  it('Z2: kein „öffnen"-Link — ohne bekannte Rolle wird niemand geführt', async () => {
    const flaeche = await hilfeOhneRollenquelle();
    expect(einstiegsListe(flaeche).querySelectorAll("a")).toHaveLength(0);
  });

  it("Z3: keine Sperrbehauptung — ohne bekannte Rolle wird auch niemand ausgesperrt", async () => {
    const flaeche = await hilfeOhneRollenquelle();
    const text = einstiegsListe(flaeche).textContent ?? "";
    for (const rolle of ROLES) {
      expect(text).not.toContain(
        i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${rolle}`) }),
      );
    }
  });

  it("Z4: statt einer Zahl steht der ehrliche Satz, dass die Rolle noch nicht feststeht", async () => {
    const flaeche = await hilfeOhneRollenquelle();
    const text = flaeche.textContent ?? "";
    expect(text).toContain(i18n.t("pilot.access.roleUnknown"));
    const offenAlsGast = PILOT_CHECKLIST.filter((item) => {
      const eintrag = ALL_ITEMS.find((nav) => nav.path === item.to);
      return eintrag?.minRole === "viewer";
    }).length;
    expect(text).not.toContain(
      i18n.t("pilot.access.summary", {
        rolle: i18n.t("role.name.viewer"),
        offen: offenAlsGast,
        gesamt: PILOT_CHECKLIST.length,
      }),
    );
  });
});
