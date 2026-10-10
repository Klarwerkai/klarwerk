// @vitest-environment jsdom
// ================================================================================================
// ADMIN-04 · KONTENLISTE UND KONTOKARTE, GEMOUNTET — gegen einen fiktiven Speicherserver.
// ================================================================================================
//
// produkt:20261009:admin-nutzer-uebersicht. Gemessen an den ECHTEN Bauteilen (`pages/Admin`,
// `pages/AdminKontenDetails`, `pages/AdminKontenSammel`) unter den echten Anbietern und mit echtem
// Verlauf (`tests/admin-navigation/vorrichtung.tsx`). `fetch` beantwortet ein kleiner Speicherserver
// in DIESER Datei: er hält Konten und Prüfprotokoll, antwortet auf Rollen-, Befristungs- und
// Freigabeaufrufe wie die echten Routen (inklusive 409 `BESTAND_OFFEN` bei Beiträgen) und lässt
// alles Übrige scheitern. Das ist eine SIMULATION der Serverseite; die echten Routen misst
// `routen.test.ts` daneben.
//
//   K1  Suche + Rolle + Zugang gemeinsam, in der Adresse; leeres Ergebnis nennt die aktiven Filter
//       und setzt sie mit einem Knopf zurück; Zurück aus einer Kontokarte landet in der Filterliste.
//   K2  Zeile und Karte nennen den Zugang aus vorhandenen Feldern; letzte Anmeldung/Einladung
//       werden ausdrücklich als nicht erfasst benannt, nicht geschätzt.
//   K3  Beiträge und andere offene Vorgänge stehen getrennt an Zeile und Karte; ihre Knöpfe öffnen
//       den passenden Bestand.
//   K4  Die Rolle ändert sich erst nach sichtbarer Wirkung und Bestätigung; die Bestätigung nennt
//       die Rolle aus der Antwort, nach Neuladen steht sie noch da, das Protokoll trägt den Vermerk.
//       Die Befristung nennt ihre Wirkung vor dem Speichern; eine Ablehnung bleibt sichtbar.
//   K5  Sammelaktion: Auswahl und Wirkung je Konto vor dem Ausführen; ein Teilfehler steht mit dem
//       Satz des Servers da, die Zusammenfassung ist ausdrücklich „nur teilweise".
//
// Alle Konten sind erfundene Testdaten.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({
        id: "u-admin",
        name: "Ada Admin",
        email: "ada@verwaltung.test",
        role: "admin",
      })),
    },
  };
});

import { act } from "../../apps/web/node_modules/react";
import { freiheitenSchluessel } from "../../apps/web/src/components/einstellungen/rollenFreiheiten";
import i18n from "../../apps/web/src/i18n";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  neuLaden,
  ort,
  tippe,
  verlauf,
} from "../admin-navigation/vorrichtung";

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts === undefined ? i18n.t(key) : i18n.t(key, opts);

// ---- Der fiktive Speicherserver ------------------------------------------------------------------
interface Konto {
  id: string;
  name: string;
  email: string;
  role: "viewer" | "experte" | "controller" | "admin";
  approved: boolean;
  createdAt: string;
  accessExpiresAt?: string;
}

const ZUKUNFT = "2099-12-31T22:59:59.999Z";
const VERGANGEN = "2026-01-31T22:59:59.999Z";

function startbestand(): Konto[] {
  return [
    {
      id: "u-admin",
      name: "Ada Admin",
      email: "ada@verwaltung.test",
      role: "admin",
      approved: true,
      createdAt: "2026-09-01T08:00:00.000Z",
    },
    {
      id: "u-carl",
      name: "Carl Controller",
      email: "carl@werk.test",
      role: "controller",
      approved: true,
      createdAt: "2026-09-02T08:00:00.000Z",
    },
    {
      id: "u-erik",
      name: "Erik Experte",
      email: "erik@werk.test",
      role: "experte",
      approved: true,
      createdAt: "2026-09-03T08:00:00.000Z",
    },
    {
      id: "u-gina",
      name: "Gina Gast",
      email: "gina@extern.test",
      role: "viewer",
      approved: true,
      createdAt: "2026-09-04T08:00:00.000Z",
      accessExpiresAt: ZUKUNFT,
    },
    {
      id: "u-alt",
      name: "Alt Ablauf",
      email: "alt@extern.test",
      role: "viewer",
      approved: true,
      createdAt: "2026-01-01T08:00:00.000Z",
      accessExpiresAt: VERGANGEN,
    },
    {
      id: "u-neu",
      name: "Nils Neuling",
      email: "nils@werk.test",
      role: "experte",
      approved: false,
      createdAt: "2026-10-08T08:00:00.000Z",
    },
  ];
}

/** Beiträge (Hauptverantwortung) und offene Vorgänge je Konto — fiktiv, nur für Carl belegt. */
const VERANTWORTUNG: Record<string, { beitraege: number; e: number; l: number; p: number }> = {
  "u-carl": { beitraege: 2, e: 1, l: 1, p: 1 },
};

interface Vermerk {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

interface Server {
  konten: Konto[];
  audit: Vermerk[];
  schreibend: { methode: string; pfad: string; rumpf: unknown }[];
}

let server: Server;

function antwort(status: number, koerper?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: String(status),
    text: async () => (koerper === undefined ? "" : JSON.stringify(koerper)),
  };
}

function vermerk(action: string, target: string, payload: Record<string, unknown>): void {
  server.audit.push({
    seq: server.audit.length + 1,
    at: "2026-10-09T10:00:00.000Z",
    actor: "u-admin",
    action,
    target,
    payload,
    prevHash: "",
    hash: "",
  });
}

function starteServer(): void {
  server = { konten: startbestand(), audit: [], schreibend: [] };
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string; body?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      const rumpf = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
      if (methode !== "GET") {
        server.schreibend.push({ methode, pfad, rumpf });
      }
      if (methode === "GET" && pfad === "/api/users") {
        return antwort(200, server.konten);
      }
      if (methode === "GET" && pfad === "/api/audit") {
        return antwort(200, server.audit);
      }
      if (methode === "GET" && pfad === "/api/verantwortung/uebersicht") {
        return antwort(200, {
          erhobenAm: "2026-10-09T10:00:00.000Z",
          personen: server.konten.map((k) => {
            const v = VERANTWORTUNG[k.id];
            return {
              id: k.id,
              zugang: "aktiv",
              beitraege: v?.beitraege ?? 0,
              vorgaenge: { entwuerfe: v?.e ?? 0, luecken: v?.l ?? 0, pruefaufgaben: v?.p ?? 0 },
            };
          }),
        });
      }
      if (methode === "GET" && pfad === "/api/verantwortung/person/u-carl/vorgaenge") {
        return antwort(200, {
          entwuerfe: [{ id: "d-carl-1" }],
          luecken: [{ id: "g-carl-1" }],
          pruefaufgaben: [{ koId: "ko-pruef", titel: "Kalibrierschein ablegen" }],
        });
      }
      if (methode === "GET" && pfad === "/api/verantwortung/person/u-carl") {
        const zeile = (koId: string, titel: string) => ({
          koId,
          version: 1,
          titel,
          sichtbar: true,
          status: "offen",
          spaceName: null,
          verantwortungsart: "owner",
          autor: { id: "u-carl", name: "Carl Controller" },
          ursprungsautor: { id: "u-carl", name: "Carl Controller" },
          mitwirkende: 0,
          imPapierkorb: false,
          zulaessig: [],
        });
        return antwort(200, {
          person: { id: "u-carl", name: "Carl Controller", role: "controller", zugang: "aktiv" },
          anzahl: 2,
          nichtEinsehbar: 0,
          beitraege: [zeile("ko-a", "Lehrring prüfen"), zeile("ko-b", "Messschieber nullen")],
          ziele: [],
          vertretung: [],
        });
      }
      if (methode === "GET" && pfad === "/api/verantwortung/ungeklaert") {
        return antwort(200, { personen: [], vertretung: [] });
      }
      const kontoweg = /^\/api\/users\/([^/]+)$/.exec(pfad);
      if (methode === "PUT" && kontoweg && rumpf) {
        const konto = server.konten.find((k) => k.id === kontoweg[1]);
        if (!konto) {
          return antwort(404, { error: "NOT_FOUND", message: "Konto nicht gefunden." });
        }
        if (typeof rumpf.role === "string") {
          const vorher = konto.role;
          konto.role = rumpf.role as Konto["role"];
          vermerk("user.role-change", konto.id, { role: konto.role, previousRole: vorher });
        }
        if (typeof rumpf.accessExpiresAt === "string") {
          const v = VERANTWORTUNG[konto.id];
          if (v && v.beitraege > 0) {
            return antwort(409, {
              error: "BESTAND_OFFEN",
              message: `Das Konto ist noch für ${v.beitraege} Beiträge hauptverantwortlich. Eine Befristung beendet den Zugang von selbst — bitte zuerst übergeben. Es wurde nichts geändert.`,
            });
          }
          konto.accessExpiresAt = rumpf.accessExpiresAt;
          vermerk("user.access-expiry-set", konto.id, { expiresAt: rumpf.accessExpiresAt });
        }
        return antwort(200, { ...konto });
      }
      const freigabe = /^\/api\/auth\/users\/([^/]+)\/approve$/.exec(pfad);
      if (methode === "POST" && freigabe) {
        const konto = server.konten.find((k) => k.id === freigabe[1]);
        if (!konto) {
          return antwort(404, { error: "NOT_FOUND", message: "Konto nicht gefunden." });
        }
        konto.approved = true;
        vermerk("user.approve", konto.id, {});
        return antwort(204);
      }
      throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
    },
  });
}

// ---- Griffe ----------------------------------------------------------------------------------
const q = (s: Stand, id: string): HTMLElement | null =>
  s.container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

function zeilen(s: Stand): { name: string; wert: string; el: HTMLElement }[] {
  return [
    ...s.container.querySelectorAll<HTMLElement>(
      '[data-testid="flaeche-nutzer"] button[data-einst="zeile"]',
    ),
  ].map((el) => ({
    name: el.querySelector('[data-einst="label"]')?.textContent ?? "",
    wert: el.querySelector('[data-einst="wert"]')?.textContent ?? "",
    el,
  }));
}

async function waehle(el: HTMLElement | null, wert: string): Promise<void> {
  if (!(el instanceof window.HTMLSelectElement)) {
    throw new Error("Auswahlfeld nicht gefunden.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(el, wert);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(3);
}

async function oeffneKonto(s: Stand, name: string): Promise<void> {
  const zeile = zeilen(s).find((z) => z.name === name);
  await klicke(zeile?.el);
  await beruhige(10);
  expect(q(s, "detail-nutzer"), `Kontokarte ${name} ging nicht auf`).not.toBeNull();
}

let stand: Stand;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  starteServer();
});

afterEach(() => {
  abbauen(stand);
});

describe("ADMIN-04 · K1 Suche und Filter gemeinsam, leeres Ergebnis mit Rücksetzen", () => {
  it("Suche + Rolle + Zugang grenzen gemeinsam ein, stehen in der Adresse und überstehen Zurück", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    expect(zeilen(stand)).toHaveLength(6);

    await tippe(q(stand, "nutzer-suche"), "extern");
    expect(zeilen(stand).map((z) => z.name)).toEqual(["Gina Gast", "Alt Ablauf"]);
    await waehle(q(stand, "nutzer-filter-rolle"), "viewer");
    await waehle(q(stand, "nutzer-filter-zugang"), "abgelaufen");
    expect(zeilen(stand).map((z) => z.name)).toEqual(["Alt Ablauf"]);
    expect(ort(stand)).toBe("/admin?bereich=konten&suche=extern&rolle=viewer&filter=abgelaufen");
    expect(q(stand, "nutzer-filter-stand")?.textContent).toContain(
      t("nutzerliste.treffer", { anzahl: 1, gesamt: 6 }),
    );

    // Konto öffnen und zurück: die Filter reisen mit.
    await oeffneKonto(stand, "Alt Ablauf");
    expect(ort(stand)).toContain("suche=extern&rolle=viewer&filter=abgelaufen");
    await klicke(q(stand, "detail-nutzer")?.querySelector('[data-einst="zurueck"]'));
    expect(ort(stand)).toBe("/admin?bereich=konten&suche=extern&rolle=viewer&filter=abgelaufen");
    expect(zeilen(stand).map((z) => z.name)).toEqual(["Alt Ablauf"]);
  });

  it("ohne Treffer: aktive Filter in Worten, ein Knopf setzt alle zurück", async () => {
    stand = montiere("/admin?bereich=konten&suche=extern&rolle=controller&filter=aktiv");
    await beruhige(20);
    expect(zeilen(stand)).toHaveLength(0);
    const leer = q(stand, "nutzer-filter-leer");
    expect(leer, "die Leermeldung fehlt").not.toBeNull();
    expect(leer?.textContent).toContain(t("nutzerliste.leer"));
    expect(leer?.textContent).toContain(t("nutzerliste.filter.suche", { suche: "extern" }));
    expect(leer?.textContent).toContain(
      t("nutzerliste.filter.rolle", { rolle: t("role.name.controller") }),
    );
    expect(leer?.textContent).toContain(
      t("nutzerliste.filter.zugang", { zugang: t("nutzerliste.zugang.aktiv") }),
    );
    await klicke(q(stand, "nutzer-filter-zuruecksetzen"));
    expect(ort(stand)).toBe("/admin?bereich=konten");
    expect(zeilen(stand)).toHaveLength(6);
    expect(q(stand, "nutzer-filter-leer")).toBeNull();
    // Browser-Zurück bringt die gefilterte Liste wieder.
    await verlauf(stand, -1);
    expect(zeilen(stand)).toHaveLength(0);
  });

  it("`filter=wartet` aus ADMIN-01 ist der Zugang „gesperrt“ und kombiniert mit der Suche", async () => {
    stand = montiere("/admin?bereich=konten&filter=wartet");
    await beruhige(20);
    expect(zeilen(stand).map((z) => z.name)).toEqual(["Nils Neuling"]);
    expect((q(stand, "nutzer-filter-zugang") as HTMLSelectElement).value).toBe("gesperrt");
    await tippe(q(stand, "nutzer-suche"), "gina");
    expect(zeilen(stand)).toHaveLength(0);
    expect(q(stand, "nutzer-filter-leer")).not.toBeNull();
  });
});

describe("ADMIN-04 · K2/K3 Zustand und Verantwortung an Zeile und Karte", () => {
  it("die Zeile nennt Rolle, Zugang und getrennt Beiträge und offene Vorgänge", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    const wert = (name: string) => zeilen(stand).find((z) => z.name === name)?.wert ?? "";
    expect(wert("Nils Neuling")).toContain(t("einst.konten.wartet"));
    expect(wert("Alt Ablauf")).toContain(t("einst.konten.abgelaufen", { datum: "" }).trim());
    expect(wert("Gina Gast")).toContain(t("einst.konten.befristet", { datum: "" }).trim());
    // Ein aktives, unbefristetes Konto ohne Verantwortung: nur die Rolle (wie bisher).
    expect(wert("Erik Experte")).toBe(t("role.name.experte"));
    expect(wert("Carl Controller")).toBe(
      [
        t("role.name.controller"),
        t("nutzerliste.zeile.beitraege", { anzahl: 2 }),
        t("nutzerliste.zeile.vorgaenge", { anzahl: 3 }),
      ].join(" · "),
    );
  });

  it("die Karte: Zustand aus vorhandenen Feldern, nichts geschätzt — und die Zähler öffnen ihren Bestand", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    await oeffneKonto(stand, "Carl Controller");
    const zugang = q(stand, "konto-zugang");
    expect(zugang?.querySelector("[data-zugang]")?.getAttribute("data-zugang")).toBe("aktiv");
    expect(zugang?.textContent).toContain(t("nutzerliste.konto.nichtErfasst"));
    const angelegt = new Date("2026-09-02T08:00:00.000Z").toLocaleDateString("de");
    expect(zugang?.textContent).toContain(t("nutzerliste.konto.angelegt", { datum: angelegt }));

    expect(q(stand, "konto-beitraege")?.getAttribute("data-anzahl")).toBe("2");
    expect(q(stand, "konto-vorgaenge")?.getAttribute("data-anzahl")).toBe("3");

    // Beiträge → die Übergabefläche mit genau diesen Beiträgen.
    await klicke(q(stand, "konto-beitraege-oeffnen"));
    await beruhige(10);
    expect(q(stand, "verantwortung-flaeche")).not.toBeNull();
    expect(
      [...stand.container.querySelectorAll('[data-testid="verantwortung-zeile"]')].map((z) =>
        z.getAttribute("data-ko"),
      ),
    ).toEqual(["ko-a", "ko-b"]);

    // Offene Vorgänge → die Liste dieser Vorgänge; die Prüfaufgabe führt zum Beitrag.
    await klicke(q(stand, "konto-vorgaenge-oeffnen"));
    await beruhige(10);
    const liste = q(stand, "konto-vorgaenge-liste");
    const arten = [...(liste?.querySelectorAll("li") ?? [])].map((li) =>
      li.getAttribute("data-art"),
    );
    expect(arten).toEqual(["pruefaufgabe", "luecke", "entwurf"]);
    expect(liste?.querySelector("a")?.getAttribute("href")).toBe("/wissen/ko-pruef");
  });
});

describe("ADMIN-04 · K4 Rolle und Befristung: Wirkung vor der Änderung, Bestätigung vom Server", () => {
  it("die Rolle wird erst nach sichtbarer Wirkung gesendet; Bestätigung, Neuladen und Protokoll stimmen", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    await oeffneKonto(stand, "Erik Experte");

    await waehle(q(stand, "konto-rolle"), "controller");
    const wirkung = q(stand, "rolle-wirkung");
    expect(wirkung, "die Wirkung erscheint nicht").not.toBeNull();
    for (const k of freiheitenSchluessel("controller")) {
      expect(q(stand, "rolle-wirkung-dazu")?.textContent).toContain(t(k));
    }
    expect(q(stand, "rolle-wirkung-weg")?.textContent).toContain(t("einst.wert.keine"));
    expect(server.schreibend, "schon das Wählen hat gesendet").toEqual([]);

    await klicke(q(stand, "rolle-uebernehmen"));
    await beruhige(10);
    expect(server.schreibend).toEqual([
      { methode: "PUT", pfad: "/api/users/u-erik", rumpf: { role: "controller" } },
    ]);
    expect(q(stand, "rolle-bestaetigt")?.textContent).toBe(
      t("nutzerliste.rolle.bestaetigt", { rolle: t("role.name.controller") }),
    );
    expect((q(stand, "konto-rolle") as HTMLSelectElement).value).toBe("controller");
    const vermerk = q(stand, "konto-protokoll")?.querySelector('[data-testid="konto-vermerk"]');
    expect(vermerk?.getAttribute("data-action")).toBe("user.role-change");
    expect(vermerk?.textContent).toContain(
      `${t("role.name.experte")} → ${t("role.name.controller")}`,
    );

    // Neuladen: der Stand kommt vom Server und ist derselbe.
    stand = neuLaden(stand);
    await beruhige(20);
    expect(q(stand, "detail-nutzer")).not.toBeNull();
    expect((q(stand, "konto-rolle") as HTMLSelectElement).value).toBe("controller");
    expect(q(stand, "konto-protokoll")?.textContent).toContain(t("role.name.controller"));
  });

  it("Abbrechen nimmt die Wahl zurück, ohne zu senden", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    await oeffneKonto(stand, "Erik Experte");
    await waehle(q(stand, "konto-rolle"), "viewer");
    expect(q(stand, "rolle-wirkung-weg")?.textContent).toContain(
      t(freiheitenSchluessel("experte")[0] as string),
    );
    await klicke(q(stand, "rolle-abbrechen"));
    expect(q(stand, "rolle-wirkung")).toBeNull();
    expect((q(stand, "konto-rolle") as HTMLSelectElement).value).toBe("experte");
    expect(server.schreibend).toEqual([]);
  });

  it("die Befristung nennt ihre Wirkung vor dem Speichern; die Ablehnung des Servers bleibt stehen", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    await oeffneKonto(stand, "Carl Controller");
    const setzen = [...stand.container.querySelectorAll("button")].find(
      (b) => b.textContent === t("adm.gastfrist.setzen"),
    );
    await klicke(setzen);
    const feld = q(stand, "detail-nutzer")?.querySelector('input[type="date"]');
    await tippe(feld, "2099-10-31");
    expect(q(stand, "frist-wirkung")?.textContent).toContain("Carl Controller");
    expect(q(stand, "frist-wirkung")?.textContent).toContain(
      new Date(2099, 9, 31).toLocaleDateString("de"),
    );
    expect(server.schreibend).toEqual([]);

    const speichern = [...stand.container.querySelectorAll("button")].find(
      (b) => b.textContent === t("adm.gastfrist.speichern"),
    );
    await klicke(speichern);
    await beruhige(10);
    expect(server.schreibend).toHaveLength(1);
    const alarm = q(stand, "detail-nutzer")?.querySelector('[role="alert"]');
    expect(alarm?.textContent).toContain("hauptverantwortlich");
    expect(alarm?.textContent).toContain(t("adm.gastfrist.fehlerHilfe"));
    expect(server.konten.find((k) => k.id === "u-carl")?.accessExpiresAt).toBeUndefined();
  });
});

describe("ADMIN-04 · K5 Mehrere Konten: prüfbare Auswahl, Teilfehler sichtbar", () => {
  it("Befristen für alle Angezeigten: Vorschau je Konto, dann Ergebnis je Konto — nie pauschal erfolgreich", async () => {
    stand = montiere("/admin?bereich=konten");
    await beruhige(20);
    const schalter = q(stand, "sammel-schalter") as HTMLInputElement | null;
    expect(schalter, "der Sammelschalter fehlt").not.toBeNull();
    await klicke(schalter);
    expect(q(stand, "sammel-flaeche")).not.toBeNull();

    await klicke(q(stand, "sammel-alle"));
    await waehle(q(stand, "sammel-aktion"), "befristen");
    await tippe(q(stand, "sammel-tag"), "2099-10-31");
    // „Ausführen" ist gesperrt, bis die Wirkung geprüft ist.
    expect((q(stand, "sammel-ausfuehren") as HTMLButtonElement).disabled).toBe(true);
    await klicke(q(stand, "sammel-vorschau-holen"));

    const vorschau = [
      ...stand.container.querySelectorAll<HTMLElement>('[data-testid="sammel-vorschau-zeile"]'),
    ].map((z) => [z.getAttribute("data-id"), z.getAttribute("data-art")]);
    expect(vorschau).toEqual([
      ["u-admin", "entfaellt"],
      ["u-carl", "wirkt"],
      ["u-erik", "wirkt"],
      ["u-gina", "wirkt"],
      ["u-alt", "wirkt"],
      ["u-neu", "entfaellt"],
    ]);
    expect(server.schreibend, "die Vorschau hat geschrieben").toEqual([]);

    await klicke(q(stand, "sammel-ausfuehren"));
    await beruhige(20);
    expect(server.schreibend.map((r) => r.pfad)).toEqual([
      "/api/users/u-carl",
      "/api/users/u-erik",
      "/api/users/u-gina",
      "/api/users/u-alt",
    ]);
    const ergebnis = q(stand, "sammel-ergebnis");
    expect(ergebnis?.getAttribute("data-vollstaendig")).toBe("nein");
    expect(ergebnis?.getAttribute("role")).toBe("alert");
    expect(ergebnis?.textContent).toContain(
      t("nutzerliste.sammel.bilanzTeil", { ok: 3, fehler: 1 }),
    );
    const carl = ergebnis?.querySelector('[data-id="u-carl"]');
    expect(carl?.getAttribute("data-ok")).toBe("nein");
    expect(carl?.textContent).toContain("hauptverantwortlich");
    expect(carl?.textContent).toContain(t("nutzerliste.sammel.unveraendert"));
    expect(server.konten.find((k) => k.id === "u-carl")?.accessExpiresAt).toBeUndefined();
    expect(server.konten.find((k) => k.id === "u-erik")?.accessExpiresAt).toBeDefined();
  });

  // BEN, Nacharbeit 3: eine Filteränderung NACH der Vorschau darf nicht die alte Vorschau ausführen.
  it("Filter nach der Vorschau: die alte Vorschau verfällt, ausgeführt wird nur die neu geprüfte Auswahl", async () => {
    stand = montiere("/admin?bereich=konten&suche=extern");
    await beruhige(20);
    expect(zeilen(stand).map((z) => z.name)).toEqual(["Gina Gast", "Alt Ablauf"]);
    await klicke(q(stand, "sammel-schalter"));
    await klicke(q(stand, "sammel-alle"));
    await waehle(q(stand, "sammel-aktion"), "befristen");
    await tippe(q(stand, "sammel-tag"), "2099-10-31");
    await klicke(q(stand, "sammel-vorschau-holen"));
    const vorschauIds = () =>
      [...stand.container.querySelectorAll('[data-testid="sammel-vorschau-zeile"]')].map((z) =>
        z.getAttribute("data-id"),
      );
    expect(vorschauIds()).toEqual(["u-gina", "u-alt"]);
    const ausfuehren = () => q(stand, "sammel-ausfuehren") as HTMLButtonElement;
    expect(ausfuehren().disabled).toBe(false);

    // Suche auf A (Gina) einschränken: Vorschau für A und B gilt nicht mehr.
    await tippe(q(stand, "nutzer-suche"), "gina");
    expect(zeilen(stand).map((z) => z.name)).toEqual(["Gina Gast"]);
    expect(q(stand, "sammel-vorschau"), "die alte Vorschau steht noch da").toBeNull();
    expect(q(stand, "sammel-vorschau-veraltet")?.textContent).toBe(
      t("nutzerliste.sammel.vorschauVeraltet"),
    );
    expect(ausfuehren().disabled, "die alte Vorschau ist noch ausführbar").toBe(true);
    await klicke(ausfuehren());
    expect(server.schreibend).toEqual([]);

    // Leere Liste: null sichtbare ausgewählte Konten — ebenfalls nichts ausführbar.
    await tippe(q(stand, "nutzer-suche"), "niemand");
    expect(zeilen(stand)).toHaveLength(0);
    expect(q(stand, "sammel-vorschau")).toBeNull();
    expect(ausfuehren().disabled).toBe(true);
    await klicke(ausfuehren());
    expect(server.schreibend).toEqual([]);

    // Zurück auf A: erst eine NEUE Prüfung macht ausführbar — und zwar nur für A.
    await tippe(q(stand, "nutzer-suche"), "gina");
    expect(ausfuehren().disabled).toBe(true);
    await klicke(q(stand, "sammel-vorschau-holen"));
    expect(vorschauIds()).toEqual(["u-gina"]);
    expect(q(stand, "sammel-vorschau-veraltet")).toBeNull();
    await klicke(ausfuehren());
    await beruhige(20);
    expect(server.schreibend.map((r) => `${r.methode} ${r.pfad}`)).toEqual([
      "PUT /api/users/u-gina",
    ]);
    expect(server.konten.find((k) => k.id === "u-alt")?.accessExpiresAt).toBe(VERGANGEN);
  });

  it("Freigeben wirkt nur bei wartenden Konten und meldet den vollständigen Erfolg", async () => {
    stand = montiere("/admin?bereich=konten&filter=wartet");
    await beruhige(20);
    await klicke(q(stand, "sammel-schalter"));
    await klicke(q(stand, "sammel-alle"));
    await waehle(q(stand, "sammel-aktion"), "freigeben");
    await klicke(q(stand, "sammel-vorschau-holen"));
    expect(
      [...stand.container.querySelectorAll('[data-testid="sammel-vorschau-zeile"]')].map((z) =>
        z.getAttribute("data-id"),
      ),
    ).toEqual(["u-neu"]);
    await klicke(q(stand, "sammel-ausfuehren"));
    await beruhige(20);
    expect(server.schreibend.map((r) => `${r.methode} ${r.pfad}`)).toEqual([
      "POST /api/auth/users/u-neu/approve",
    ]);
    expect(q(stand, "sammel-ergebnis")?.getAttribute("data-vollstaendig")).toBe("ja");
    expect(server.konten.find((k) => k.id === "u-neu")?.approved).toBe(true);
  });
});
