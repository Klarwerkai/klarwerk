// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement as h } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Link, MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { GUARDED_ITEMS, ROLES, canSee } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import {
  TutorialEinstieg,
  TutorialFlaeche,
  TutorialProvider,
  useTutorialFuerKlara,
} from "../../apps/web/src/tutorial/TutorialRahmen";
import { FRAGEN_LEKTION } from "../../apps/web/src/tutorial/fragen/lektion";
import { tutorialFuerPfad } from "../../apps/web/src/tutorial/rahmen";
import { SEITEN, SPEZIALWEGE } from "../../apps/web/src/tutorial/seiten/daten";
import { echtesZiel, markiereEchtesZiel } from "../../apps/web/src/tutorial/seiten/ziele";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const aufraeumen: Array<() => void> = [];
const q = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"], [id="${id}"]`);
async function ruhe(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}
async function klick(el: Element | null): Promise<void> {
  expect(el).not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await ruhe();
}
beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hidden
      ? ([] as unknown as DOMRectList)
      : ([new DOMRect(0, 0, 100, 30)] as unknown as DOMRectList);
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  for (const ende of aufraeumen.splice(0)) ende();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

it("ordnet jede vorhandene produktive Route zu und bewahrt die vorhandenen Spezialwege", () => {
  const zugeordnet = new Set([...SEITEN.flatMap((s) => [...s.pfade]), ...Object.keys(SPEZIALWEGE)]);
  for (const gate of GUARDED_ITEMS) expect(zugeordnet.has(gate.path), gate.path).toBe(true);
  const router = readFileSync("apps/web/src/routes.tsx", "utf8");
  const literal = Array.from(router.matchAll(/<Route\s+path="([^"]+)"/g), (m) => m[1] ?? "");
  for (const pfad of literal.filter((p) => p !== "/" && p !== "*"))
    expect(zugeordnet.has(pfad), pfad).toBe(true);
  expect(tutorialFuerPfad("/fragen")).toBe(FRAGEN_LEKTION);
  expect(tutorialFuerPfad("/fragen/unterseite")).toBeNull();
  expect(tutorialFuerPfad("/wissen/a/gemeinsam")?.id).toBe("seite-gemeinsam");
  expect(tutorialFuerPfad("/wissen/a/beliebig")).toBeNull();
});

it("beachtet die bestehenden Rollen- und Stufe-2-Gates einschließlich Rollenrücknahme", () => {
  expect(tutorialFuerPfad("/admin", "viewer")).toBeNull();
  expect(tutorialFuerPfad("/validierung", "experte")).toBeNull();
  expect(tutorialFuerPfad("/validierung", "controller")).not.toBeNull();
  expect(tutorialFuerPfad("/import/lauf/lauf-1", "admin", false)).toBeNull();
  expect(tutorialFuerPfad("/import/lauf/lauf-1", "admin", true)).not.toBeNull();
  expect(tutorialFuerPfad("/unternehmen", "viewer")).toBeNull();
  expect(tutorialFuerPfad("/ausgangspruefung", "experte")).toBeNull();
  expect(tutorialFuerPfad("/admin", "admin")).not.toBeNull();
  expect(tutorialFuerPfad("/admin", "viewer")).toBeNull();
});

const VORDERTUER_ALIAS = "/erfassen/vordertuer";

it("I-ORIG-1 ordnet den tatsächlich gerouteten Vordertüralias derselben Erfassungslektion zu", () => {
  const router = readFileSync("apps/web/src/routes.tsx", "utf8");
  expect(router).toContain(`const VORDERTUER_ALIAS = "${VORDERTUER_ALIAS}"`);
  expect(router).toContain("path={VORDERTUER_ALIAS} element={<Guarded item={VORDERTUER_ITEM} />");
  expect(SEITEN.find((s) => s.id === "erfassen")?.pfade).toContain(VORDERTUER_ALIAS);
  const kanonisch = tutorialFuerPfad(CAPTURE_FRONT_DOOR_ROUTE, "experte", false);
  expect(kanonisch?.id).toBe("seite-erfassen");
  for (const pfad of [VORDERTUER_ALIAS, `${VORDERTUER_ALIAS}/`, VORDERTUER_ALIAS.toUpperCase()]) {
    const alias = tutorialFuerPfad(pfad, "experte", false);
    expect(alias?.id, pfad).toBe(kanonisch?.id);
    expect(alias?.schritte, pfad).toEqual(kanonisch?.schritte);
    expect(alias?.echteZiele, pfad).toEqual(kanonisch?.echteZiele);
  }
  expect(tutorialFuerPfad(`${VORDERTUER_ALIAS}/kein-weg`, "admin")).toBeNull();
});

it("I-ORIG-1 übernimmt Rollen und eine Stufe-2-Bindung vom selben kanonischen Guard", () => {
  const gate = GUARDED_ITEMS.find((g) => g.path === CAPTURE_FRONT_DOOR_ROUTE);
  if (!gate) throw new Error("Der bestehende Vordertürguard fehlt");
  for (const role of ROLES) {
    for (const stufe2 of [false, true]) {
      for (const pfad of [
        VORDERTUER_ALIAS,
        `${VORDERTUER_ALIAS}/`,
        VORDERTUER_ALIAS.toUpperCase(),
      ]) {
        expect(Boolean(tutorialFuerPfad(pfad, role, stufe2)), `${pfad}/${role}/${stufe2}`).toBe(
          canSee(gate, role, stufe2),
        );
      }
    }
  }
  // Der heutige Guard hat keine Stufe-2-Pflicht. Diese begrenzte Konfigurationsprobe belegt,
  // dass auch eine solche Pflicht vom Originaleintrag geerbt und nicht am Alias kopiert wird.
  const vorher = gate.stufe2;
  try {
    gate.stufe2 = true;
    for (const role of ROLES) {
      expect(tutorialFuerPfad(VORDERTUER_ALIAS, role, false)).toBeNull();
      expect(Boolean(tutorialFuerPfad(VORDERTUER_ALIAS, role, true))).toBe(
        canSee(gate, role, true),
      );
    }
  } finally {
    if (vorher === undefined) Reflect.deleteProperty(gate, "stufe2");
    else gate.stufe2 = vorher;
  }
});

function AliasRollenwechsel(): JSX.Element {
  const { setRole } = useRole();
  return h(
    "button",
    { "data-testid": "alias-viewer", onClick: () => setRole("viewer") },
    "Ansicht als Viewer",
  );
}

it("I-ORIG-1 zeigt am Alias den echten Einstieg und entfernt ihn bei Rollenrücknahme", async () => {
  const fetchProbe = vi.spyOn(globalThis, "fetch");
  const query = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  query.setQueryData(["auth", "status"], { needsSetup: false, oidcEnabled: false });
  query.setQueryData(["auth", "me"], {
    id: "i-alias-test",
    name: "Aliasprüfung",
    email: "alias@example.invalid",
    role: "admin",
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  aufraeumen.push(() => {
    act(() => root.unmount());
    query.clear();
  });
  await act(async () => {
    root.render(
      h(
        QueryClientProvider,
        { client: query },
        h(
          AuthProvider,
          null,
          h(
            RoleProvider,
            null,
            h(
              MemoryRouter,
              { initialEntries: [`${VORDERTUER_ALIAS}?draft=i-original`] },
              h(TutorialProvider, null, h(TutorialEinstieg), h(TestSeite), h(AliasRollenwechsel)),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  expect(q("tutorial-knopf")).not.toBeNull();
  await klick(q("tutorial-knopf"));
  expect(q("tutorial-bereich")?.getAttribute("data-tutorial")).toBe("seite-erfassen");
  expect(q("ort")?.textContent).toBe(`${VORDERTUER_ALIAS}?draft=i-original`);
  await klick(q("alias-viewer"));
  expect(q("tutorial-knopf")).toBeNull();
  expect(q("tutorial-bereich")).toBeNull();
  expect(fetchProbe).not.toHaveBeenCalled();
});

it("liefert alle Erklärungen und wiederverwendeten Fähigkeitshilfen in DE/EN/NL ohne rohe Schlüssel", async () => {
  for (const sprache of ["de", "en", "nl"]) {
    await i18n.changeLanguage(sprache);
    for (const seite of SEITEN) {
      for (const key of [
        seite.titelKey,
        ...(seite.hilfeKeys ?? []),
        ...["aktion", "ergebnis", "sonderfall"].map((k) => `seitentutorial.${seite.id}.${k}`),
      ]) {
        expect(i18n.exists(key), `${sprache}/${key}`).toBe(true);
        expect(i18n.t(key), `${sprache}/${key}`).not.toBe(key);
      }
    }
  }
  await i18n.changeLanguage("de");
});

it("überspringt gesperrte und ausgeblendete echte Ziele und baut temporäre Markierungen zurück", () => {
  document.body.innerHTML =
    '<input disabled data-testid="ziel"><div hidden><input data-testid="ziel"></div><input data-testid="ziel" data-tutorial-ziel="vorher" tabindex="2">';
  const el = echtesZiel('[data-testid="ziel"]');
  expect(el).toBe(document.querySelectorAll("input")[2]);
  const ende = markiereEchtesZiel(el as HTMLElement, "jetzt");
  expect(el?.getAttribute("data-tutorial-ziel")).toBe("jetzt");
  ende();
  expect(el?.getAttribute("data-tutorial-ziel")).toBe("vorher");
  expect(el?.tabIndex).toBe(2);
  expect(el?.hasAttribute("data-tutorial-aktiv")).toBe(false);
});

function TestSeite(): JSX.Element {
  const ort = useLocation();
  const tutorial = useTutorialFuerKlara();
  return h(
    "main",
    null,
    h(TutorialFlaeche),
    h("p", { "data-testid": "ort" }, ort.pathname + ort.search),
    h("input", { "data-testid": "bib-suchfeld", defaultValue: "unveränderte Eingabe" }),
    h(Link, { to: "/bibliothek?q=zweites-objekt", id: "anderes-objekt" }, "Anderes Objekt"),
    h(Link, { to: "/start", id: "wechsel" }, "Start"),
    h(
      "button",
      { type: "button", "data-testid": "zwischenfrage", onClick: () => tutorial.lage?.pause() },
      "Zwischenfrage",
    ),
    h(
      "output",
      { "data-testid": "klara-stand" },
      tutorial.lage
        ? `${tutorial.lage.definitionId}/${tutorial.lage.schrittIndex}/${tutorial.lage.spielt}`
        : "geschlossen",
    ),
  );
}
async function montiere(): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  aufraeumen.push(() => act(() => root.unmount()));
  await act(async () => {
    root.render(
      h(
        MemoryRouter,
        { initialEntries: ["/bibliothek?q=ursprung"] },
        h(TutorialProvider, null, h(TutorialEinstieg), h(TestSeite)),
      ),
    );
  });
  await ruhe();
}

it("behält denselben Schritt bei Zwischenfrage, Schließen, Zurück und Fortsetzen ohne Arbeitsmutation", async () => {
  const fetchProbe = vi.spyOn(globalThis, "fetch");
  await montiere();
  await klick(q("tutorial-knopf"));
  await klick(q("tutorial-weiter"));
  await klick(q("tutorial-weiter"));
  expect(q("klara-stand")?.textContent).toBe("seite-bibliothek/2/false");
  await klick(q("zwischenfrage"));
  await klick(q("tutorial-schliessen"));
  await klick(q("tutorial-knopf"));
  expect(q("klara-stand")?.textContent).toBe("seite-bibliothek/2/false");
  await klick(q("tutorial-zurueck"));
  expect(q("klara-stand")?.textContent).toBe("seite-bibliothek/1/false");
  for (let i = 0; i < 100 && !q("seitentutorial-zeigen"); i++) await ruhe();
  await klick(q("seitentutorial-zeigen"));
  expect(document.activeElement).toBe(q("bib-suchfeld"));
  expect((q("bib-suchfeld") as HTMLInputElement).value).toBe("unveränderte Eingabe");
  expect(fetchProbe).not.toHaveBeenCalled();
});

it("bindet Unterbrechung an Route und Query und kehrt mit pausiertem Originalschritt zurück", async () => {
  await montiere();
  await klick(q("tutorial-knopf"));
  await klick(q("tutorial-weiter"));
  await klick(q("anderes-objekt"));
  expect(q("tutorial-bereich")).toBeNull();
  expect(q("tutorial-rueckkehr")?.textContent).toContain("/bibliothek?q=ursprung");
  await klick(q("tutorial-rueckkehr"));
  await klick(q("tutorial-knopf"));
  expect(q("ort")?.textContent).toBe("/bibliothek?q=ursprung");
  expect(q("klara-stand")?.textContent).toBe("seite-bibliothek/1/false");
  await klick(q("wechsel"));
  expect(q("tutorial-rueckkehr")?.textContent).toContain("/bibliothek?q=ursprung");
});

it("zeigt fehlendes echtes Ziel statt eines erfundenen Erfolgs und erhält tastaturbedienbare Erklärung", async () => {
  await montiere();
  await klick(q("tutorial-knopf"));
  await act(async () => {
    q("bib-suchfeld")?.remove();
  });
  await ruhe();
  expect(document.querySelector("[data-tutorial-ziel-fehlt]")?.textContent).toContain(
    "nicht bedienbar",
  );
  await klick(q("tutorial-weiter"));
  expect(q("klara-stand")?.textContent).toBe("seite-bibliothek/1/false");
  await act(async () => {
    q("tutorial-bereich")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  expect(q("tutorial-bereich")).toBeNull();
  expect(document.activeElement).toBe(q("tutorial-knopf"));
});

it("kehrt auch nach einem zweiten geöffneten Tutorial zum ausgewählten Originalschritt zurück", async () => {
  await montiere();
  await klick(q("tutorial-knopf"));
  await klick(q("tutorial-weiter"));
  await klick(q("wechsel"));
  await klick(q("tutorial-knopf"));
  await klick(q("tutorial-weiter"));
  await klick(q("tutorial-weiter"));
  expect(q("klara-stand")?.textContent).toBe("seite-start/2/false");
  await klick(q("tutorial-rueckkehr"));
  await klick(q("tutorial-knopf"));
  expect(q("klara-stand")?.textContent).toBe("seite-bibliothek/1/false");
});
