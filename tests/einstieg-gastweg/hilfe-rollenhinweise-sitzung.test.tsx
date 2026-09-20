// @vitest-environment jsdom
// ================================================================================================
// JOB 4358 · DIE ROLLENHINWEISE DER HILFESEITE HALTEN AUCH, WENN DIE SITZUNG NOCH NICHT FESTSTEHT.
// ================================================================================================
//
// WAS DIE BEIDEN VORHANDENEN PRÜFSTÄNDE NICHT SEHEN KÖNNEN — und warum diese Datei daneben steht:
//
//   · `hilfe-fuehrt-den-gast-nicht-ins-leere.test.tsx` steuert die Rolle über eine ATTRAPPE von
//     `app/RoleContext` (`isSessionRole: true`, fest). Eine Attrappe kann nur zeigen, was sie selbst
//     vorgibt: den Weg, auf dem die Rolle im Betrieb ENTSTEHT (`/auth/status` → `/auth/me` →
//     `AuthProvider` → `RoleProvider.effectiveRole`), sieht sie nicht.
//   · `hilfe-ohne-rollenquelle.test.tsx` misst die Gegenlage — GAR KEINE Rollenquelle. Auch das ist
//     nicht der Betriebsfall: dort steht der Provider, er weiss nur noch nichts.
//
// DAZWISCHEN LIEGT DER BEFUND DIESES AUFTRAGS. `RoleProvider` rechnet die Rolle mit
// `effectiveRole(sessionRole, previewRole)` (`lib/effectiveRole.ts:6-8`), und `previewRole` steht auf
// `"experte"` (`app/RoleContext.tsx:34`). Solange `/auth/me` noch nicht geantwortet hat, ist
// `user === null` — die Seite bekam also `role: "experte"` und führte damit:
//   · einen „öffnen"-Link auf `/erfassen` (Mindestrolle `experte`), der einem Betrachter Sekunden
//     später wieder weggenommen wird, und
//   · den gerechneten Satz „Als Experte stehen dir 4 von 7 offen" über einen Menschen, über den der
//     Server noch gar nichts gesagt hat.
// Dasselbe galt, wenn die Auffrischung SCHEITERTE (401, 500, Netzfehler): auch dann ist `user` null,
// und die Vorschaurolle sprang ein. Das ist genau der Fehler, den JOB 4022 behoben hat, in neuer
// Form — nur ist die falsche Aussage diesmal nicht verdrahtet, sondern geerbt.
//
// GEMESSEN WIRD DESHALB MIT ECHTEM KONTEXT, ohne jede Attrappe der Rollenquelle:
//   echte Fastify-App (`buildApp`) → echte Konten (`/api/auth/register`, `/api/users`) → echter
//   `AuthProvider` mit echtem react-query → echter `RoleProvider` → echte `pages/Help.tsx`.
// EINZIGER ERSATZ IST DER TRANSPORT: `globalThis.fetch` liegt auf einer Brücke, die jeden Aufruf
// über `app.inject` in DIESELBE App schickt — Bauform aus
// `tests/offline-identitaet-anlage/kontowechsel-und-anlage-mounted.test.tsx:210-265`. Nur die
// Antwort auf `/api/auth/me` wird dort angehalten (K1) oder durch die drei Fehlerarten ersetzt (K2);
// alles andere ist echter Server.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ALL_ITEMS, ROLES, ROLE_RANK, type Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { PILOT_CHECKLIST } from "../../apps/web/src/lib/pilotChecklist";
import { Help } from "../../apps/web/src/pages/Help";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;

/** Wie `/api/auth/me` sich verhalten soll — die drei Fehlerarten aus K2 und der Regelfall. */
type MeLage = "echt" | 401 | 500 | "netz";

let app: ReturnType<typeof buildApp>;
/** Das Token, mit dem die Brücke gerade fährt — das ist „wer ist angemeldet". */
let angemeldet = "";
let chefKopf: Record<string, string> = {};
let kontoLea = "";
let meLage: MeLage = "echt";
/** Wie oft `/api/auth/me` BEANTWORTET wurde — daran hängt das Ende des Aufbaus. */
let meAntworten = 0;
/** Wie oft `/api/auth/me` den Halt ERREICHT hat — daran hängt „die Abfrage läuft wirklich". */
let meEintritte = 0;
let meTor: Promise<void> | null = null;
let meFreigabe: (() => void) | null = null;
let vorherigerFetch: typeof globalThis.fetch;

function meSperren(): void {
  meTor = new Promise<void>((aufloesen) => {
    meFreigabe = aufloesen;
  });
}

function meFreigeben(): void {
  meFreigabe?.();
  meTor = null;
  meFreigabe = null;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function anmelden(mail: string, passwort: string): Promise<{ token: string; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: mail, password: passwort },
  });
  const koerper = res.json() as { token: string; user: { id: string } };
  return { token: String(koerper.token), id: String(koerper.user.id) };
}

/**
 * Zwei WIRKLICHE Konten: der Erstadministrator (er vergibt Rollen) und Lea, eine Betrachterin.
 * Lea ist kein erfundener Zustand — sie ist das Konto, für das die Einstiegsführung gebaut wurde.
 */
async function konten(): Promise<void> {
  app = buildApp(buildServices());
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Chef", email: "chef@job4358.test", password: "secret123" },
  });
  const chef = await anmelden("chef@job4358.test", "secret123");
  chefKopf = { authorization: `Bearer ${chef.token}` };
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: chefKopf,
    payload: {
      name: "Lea",
      email: "lea@job4358.test",
      password: "passwort12",
      role: "viewer",
    },
  });
  if (angelegt.statusCode >= 300) {
    throw new Error(`Konto Lea wurde nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  const lea = await anmelden("lea@job4358.test", "passwort12");
  kontoLea = lea.id;
  angemeldet = lea.token;
}

/** Die Rolle eines Kontos serverseitig ändern — der echte Weg (`PUT /api/users/:id`). */
async function rolleSetzen(konto: string, rolle: Role): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/users/${konto}`,
    headers: chefKopf,
    payload: { role: rolle },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Rollenwechsel auf ${rolle} scheiterte: ${res.statusCode} ${res.body}`);
  }
}

/** Die Rolle, die DER SERVER für dieses Konto führt — nicht der Zwischenspeicher der Fläche. */
async function serverrolle(token: string): Promise<string> {
  const res = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  return String((res.json() as { role?: unknown }).role ?? "");
}

function brueckeSetzen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const kopf: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit | undefined).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.authorization = `Bearer ${angemeldet}`;
    const istMe = url.endsWith("/api/auth/me");
    if (istMe && meTor) {
      // Der Aufruf ist RAUS (der Zähler beweist es), die Antwort steht aus. Genau dieses
      // Zeitfenster ist der Messgegenstand von K1.
      meEintritte += 1;
      await meTor;
    }
    if (istMe && meLage !== "echt") {
      meAntworten += 1;
      if (meLage === "netz") {
        // Kein Status, keine Antwort — derselbe Wurf, den ein abgerissener Transport erzeugt.
        throw new TypeError("Failed to fetch");
      }
      const koerper =
        meLage === 401
          ? { error: "UNAUTHORIZED", message: "Nicht angemeldet." }
          : { error: "INTERNAL", message: "Dienst gerade nicht erreichbar." };
      return {
        ok: false,
        status: meLage,
        statusText: String(meLage),
        text: async () => JSON.stringify(koerper),
      };
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url: url.replace(/^https?:\/\/[^/]+/, ""),
      headers: kopf,
      ...(init?.body !== undefined && init?.body !== null ? { payload: String(init.body) } : {}),
    });
    if (istMe) {
      meAntworten += 1;
    }
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
/** Die Auffrischung der ECHTEN Sitzung — aus `useSession()`, nicht nachgebaut (K3). */
let auffrischen: (() => void) | null = null;

/**
 * Ein Beobachter INNERHALB des `AuthProvider`, der dessen eigene `refresh`-Funktion herausreicht.
 * K3 verlangt ausdrücklich „nach AuthProvider.refresh()" — ein `queryClient.invalidateQueries` von
 * aussen wäre ein NACHBAU dieser Zusage und liesse offen, ob die Seite den echten Weg überlebt.
 */
function Sitzungsgriff(): null {
  auffrischen = useSession().refresh;
  return null;
}

/** Montiert die Hilfeseite EINMAL — jeder Fall misst danach an DIESEM Baum weiter. */
async function montieren(sprache: string): Promise<void> {
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          AuthProvider,
          null,
          createElement(Sitzungsgriff),
          createElement(
            RoleProvider,
            null,
            createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)),
          ),
        ),
      ),
    );
    await flush();
  });
}

/** Warten, bis `/api/auth/me` GEANTWORTET hat — nicht auf eine geratene Anzahl Durchläufe. */
async function bisAntwort(vorher: number): Promise<void> {
  for (let i = 0; i < 200 && meAntworten === vorher; i++) {
    await act(flush);
  }
  await act(flush);
  await act(flush);
}

/** Warten, bis der Abruf den Halt ERREICHT hat — Beleg, dass das Zeitfenster wirklich offen ist. */
async function bisEintritt(vorher: number): Promise<void> {
  for (let i = 0; i < 200 && meEintritte === vorher; i++) {
    await act(flush);
  }
}

function abbauen(): void {
  if (root) {
    const wurzel = root;
    act(() => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  auffrischen = null;
}

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Hilfeseite ist nicht montiert.");
  }
  return container;
}

// ------------------------------------------------------------------------------------------------
// DIE MESSSTELLEN — an derselben Stelle gefunden wie in den beiden Bestandsprüfständen: am INHALT,
// nicht an einer Testmarke. So misst diese Datei dieselbe Liste, die ein Mensch dort liest.
// ------------------------------------------------------------------------------------------------

function einstiegsListe(): HTMLElement {
  const anker = i18n.t(PILOT_CHECKLIST[0]?.labelKey ?? "");
  const treffer = [...flaeche().querySelectorAll("ol")].filter((liste) =>
    (liste.textContent ?? "").includes(anker),
  );
  expect(treffer, "genau EINE Einstiegsführung auf der Hilfeseite").toHaveLength(1);
  return treffer[0] as HTMLElement;
}

/** Die verlangte Rolle — aus derselben Quelle, über die der Router entscheidet. */
function mindestrolle(item: { to: string }): Role {
  const eintrag = ALL_ITEMS.find((nav) => nav.path === item.to);
  if (!eintrag) {
    throw new Error(`Route ohne Navigationseintrag: ${item.to}`);
  }
  return eintrag.minRole;
}

/** Ein Schritt, der MEHR als die Grundrolle verlangt — das sind die rollengebundenen aus K1/K2. */
function rollengebunden(): typeof PILOT_CHECKLIST {
  return PILOT_CHECKLIST.filter((item) => ROLE_RANK[mindestrolle(item)] > ROLE_RANK.viewer);
}

function offeneLinks(): HTMLAnchorElement[] {
  return [...einstiegsListe().querySelectorAll("a")];
}

/** Jede Zeile, die eine verlangte Rolle NENNT — der Rollenhinweis, um den es geht. */
function rollenhinweise(): HTMLElement[] {
  return [...einstiegsListe().querySelectorAll("li")].filter((li) =>
    ROLES.some((rolle) =>
      (li.textContent ?? "").includes(
        i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${rolle}`) }),
      ),
    ),
  );
}

function zusammenfassung(rolle: Role): string {
  const offen = PILOT_CHECKLIST.filter(
    (item) => ROLE_RANK[rolle] >= ROLE_RANK[mindestrolle(item)],
  ).length;
  return i18n.t("pilot.access.summary", {
    rolle: i18n.t(`role.name.${rolle}`),
    offen,
    gesamt: PILOT_CHECKLIST.length,
  });
}

function seitentext(): string {
  return (flaeche().textContent ?? "").replace(/\s+/g, " ");
}

/** Wie viele Schritte diese Rolle gehen darf — gerechnet, nie abgeschrieben. */
function offenFuer(rolle: Role): number {
  return PILOT_CHECKLIST.filter((item) => ROLE_RANK[rolle] >= ROLE_RANK[mindestrolle(item)]).length;
}

/**
 * Die ganze Zusage „solange nichts feststeht, wird weder geführt noch gesperrt" — in EINER
 * Messung, damit ein Fall nicht die eine Hälfte prüft und die andere vergisst.
 */
function keineRollenaussage(lage: string): void {
  expect(
    offeneLinks().map((a) => a.getAttribute("href")),
    `${lage}: es wird geführt`,
  ).toEqual([]);
  expect(
    rollenhinweise().map((li) => (li.textContent ?? "").trim()),
    `${lage}: es wird gesperrt`,
  ).toEqual([]);
  for (const rolle of ROLES) {
    expect(seitentext(), `${lage}: die Karte behauptet die Rolle ${rolle}`).not.toContain(
      zusammenfassung(rolle),
    );
  }
  expect(seitentext(), `${lage}: der ehrliche Satz fehlt`).toContain(
    i18n.t("pilot.access.roleUnknown"),
  );
}

/** Jeder Schritt steht mit seinem Text da — die Seite bleibt vollständig lesbar. */
function vollstaendigLesbar(lage: string): void {
  const text = (einstiegsListe().textContent ?? "").replace(/\s+/g, " ");
  for (const item of PILOT_CHECKLIST) {
    expect(text, `${lage}: Schritt „${item.id}" fehlt`).toContain(i18n.t(item.labelKey));
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  meLage = "echt";
  meAntworten = 0;
  meEintritte = 0;
  meFreigeben();
  await konten();
  brueckeSetzen();
});

afterEach(async () => {
  // ZUERST das Tor öffnen: ein zurückgehaltener Abruf hinge sonst über das Ende des Falls hinaus.
  meFreigeben();
  abbauen();
  globalThis.fetch = vorherigerFetch;
  await app?.close();
  await i18n.changeLanguage("de");
});

// ================================================================================================
// K1 — DIE SITZUNG WIRD NOCH BESTÄTIGT: KEIN LINK, KEINE SPERRE, KEINE ROLLE.
// ================================================================================================
describe("JOB 4358 · K1 · die Sitzungsauffrischung steht noch aus", () => {
  for (const sprache of SPRACHEN) {
    it(`K1 (${sprache}): erst nichts behaupten — nach der Antwort 3 Links und 4 Rollenhinweise, ohne Neumontage`, async () => {
      expect(
        await serverrolle(angemeldet),
        "Lea ist serverseitig keine Betrachterin — der Fall misst dann etwas anderes",
      ).toBe("viewer");
      meSperren();
      const eintritteVorher = meEintritte;
      await montieren(sprache);
      await bisEintritt(eintritteVorher);
      expect(
        meEintritte,
        "die Sitzungsabfrage lief gar nicht — dieser Fall misst dann nichts",
      ).toBe(eintritteVorher + 1);

      // WÄHREND DER WARTEZEIT: die rollengebundenen Schritte tragen weder Weg noch Absage.
      expect(rollengebunden().length, "es gibt keine rollengebundenen Schritte zu prüfen").toBe(4);
      vollstaendigLesbar("wartend");
      keineRollenaussage("wartend");

      // UND JETZT ANTWORTET DER SERVER — derselbe Baum, keine zweite Montage.
      const antwortenVorher = meAntworten;
      const wurzelVorher = root;
      await act(async () => {
        meFreigeben();
        await flush();
      });
      await bisAntwort(antwortenVorher);
      expect(root, "die Fläche wurde neu montiert — K1 misst dann nicht mehr denselben Baum").toBe(
        wurzelVorher,
      );

      expect(offenFuer("viewer"), "ein Betrachter darf nicht 3 Schritte gehen").toBe(3);
      expect(
        offeneLinks().map((a) => a.getAttribute("href")),
        "nach der Antwort stehen nicht genau die 3 offenen Wege da",
      ).toEqual(
        PILOT_CHECKLIST.filter((item) => ROLE_RANK.viewer >= ROLE_RANK[mindestrolle(item)]).map(
          (item) => item.to,
        ),
      );
      expect(
        rollenhinweise(),
        "nach der Antwort stehen nicht genau 4 Rollenhinweise da",
      ).toHaveLength(4);
      expect(seitentext(), "die Karte rechnet den Zugang nicht vor").toContain(
        zusammenfassung("viewer"),
      );
      expect(seitentext(), "der Wartesatz blieb stehen").not.toContain(
        i18n.t("pilot.access.roleUnknown"),
      );
    });
  }

  it("K5/K1 KALIBRIERUNG: dieselben Messstellen finden Links und Hinweise, sobald die Rolle steht", async () => {
    // OHNE DIESEN FALL wäre K1 auch dann grün, wenn `offeneLinks()`/`rollenhinweise()` NIE etwas
    // fänden — eine Verneinung über eine blinde Messstelle ist immer wahr.
    const vorher = meAntworten;
    await montieren("de");
    await bisAntwort(vorher);
    expect(offeneLinks(), "die Messstelle für Links ist blind").toHaveLength(3);
    expect(rollenhinweise(), "die Messstelle für Rollenhinweise ist blind").toHaveLength(4);
  });
});

// ================================================================================================
// K2 — DIE AUFFRISCHUNG SCHEITERT: 401, 500, NETZFEHLER.
// ================================================================================================
//
// DREI FEHLERARTEN, DREI BEDEUTUNGEN, EINE ZUSAGE. `AuthContext` unterscheidet sie ausdrücklich
// (`sitzungsfrageBeantwortet`, `:135-150`): 401 ist eine Auskunft über die Sitzung, 500 und der
// Transportfehler sind keine. Für die Hilfeseite endet das in derselben Lage — es steht KEINE Rolle
// fest, und über eine unbekannte Rolle wird weder geführt noch gesperrt noch gerechnet.
describe("JOB 4358 · K2 · die Sitzungsauffrischung scheitert", () => {
  for (const lage of [401, 500, "netz"] as const) {
    it(`K2 (${lage}): die Seite bleibt lesbar, ohne Weg in eine fremde Rolle`, async () => {
      meLage = lage;
      const vorher = meAntworten;
      await montieren("de");
      await bisAntwort(vorher);
      expect(meAntworten, `die ${lage}-Antwort kam nie — der Fall misst dann nichts`).toBe(
        vorher + 1,
      );
      vollstaendigLesbar(String(lage));
      keineRollenaussage(String(lage));
      // Kein Absturz: der Baum steht noch und trägt seine Überschrift.
      expect(seitentext(), "die Hilfeseite ist zusammengebrochen").toContain(
        i18n.t("pilot.access.title"),
      );
    });
  }
});

// ================================================================================================
// K3 — NACH `AuthProvider.refresh()` FOLGEN LINKS UND HINWEISE DER NEUEN SITZUNG.
// ================================================================================================
describe("JOB 4358 · K3 · die Rolle der Sitzung wechselt (viewer → experte)", () => {
  it("die offenen Schritte gehen 3 → 4, die höheren Tore bleiben zu, keine veraltete Rolle bleibt stehen", async () => {
    const vorher = meAntworten;
    await montieren("de");
    await bisAntwort(vorher);
    expect(offeneLinks(), "als Betrachterin stehen nicht 3 Wege da").toHaveLength(3);
    expect(seitentext()).toContain(zusammenfassung("viewer"));

    // DER WECHSEL PASSIERT AM SERVER, nicht im Test: dieselbe Route, die ein Administrator bedient.
    await rolleSetzen(kontoLea, "experte");
    expect(await serverrolle(angemeldet), "der Server führt Lea nicht als Expertin").toBe(
      "experte",
    );

    const vorRefresh = meAntworten;
    await act(async () => {
      auffrischen?.();
      await flush();
    });
    await bisAntwort(vorRefresh);

    expect(offenFuer("experte"), "eine Expertin darf nicht 4 Schritte gehen").toBe(4);
    expect(
      offeneLinks().map((a) => a.getAttribute("href")),
      "die Links folgen der neuen Sitzung nicht",
    ).toEqual(
      PILOT_CHECKLIST.filter((item) => ROLE_RANK.experte >= ROLE_RANK[mindestrolle(item)]).map(
        (item) => item.to,
      ),
    );
    // KEINE RECHTEERWEITERUNG: die Tore über `experte` bleiben zu — mit ihrem Hinweis, nicht mit
    // einem Link.
    for (const item of PILOT_CHECKLIST.filter(
      (s) => ROLE_RANK[mindestrolle(s)] > ROLE_RANK.experte,
    )) {
      const zeile = [...einstiegsListe().querySelectorAll("li")].find((li) =>
        (li.textContent ?? "").includes(i18n.t(item.labelKey)),
      );
      expect(zeile?.querySelector("a"), `Schritt „${item.id}" wurde geöffnet`).toBeFalsy();
      expect(zeile?.textContent ?? "", `Schritt „${item.id}" nennt seine Rolle nicht`).toContain(
        i18n.t("pilot.access.locked", { rolle: i18n.t(`role.name.${mindestrolle(item)}`) }),
      );
    }
    expect(rollenhinweise(), "es stehen nicht genau 3 Rollenhinweise da").toHaveLength(3);
    // KEINE VERALTETE ROLLE: der alte Satz ist WEG, nicht danebengestellt.
    expect(seitentext(), "die alte Rolle steht noch da").not.toContain(zusammenfassung("viewer"));
    expect(seitentext(), "die neue Rolle wird nicht gerechnet").toContain(
      zusammenfassung("experte"),
    );
  });

  it("K5/K3 KALIBRIERUNG: ohne Rollenwechsel ändert dieselbe Auffrischung nichts", async () => {
    // OHNE DIESEN FALL wäre K3 auch mit einer Fassung grün, die bei JEDER Auffrischung einfach
    // aufzählt — gemessen würde dann der Takt und nicht die Rolle.
    const vorher = meAntworten;
    await montieren("de");
    await bisAntwort(vorher);
    const vorRefresh = meAntworten;
    await act(async () => {
      auffrischen?.();
      await flush();
    });
    await bisAntwort(vorRefresh);
    expect(offeneLinks(), "ohne Rollenwechsel wurde etwas geöffnet").toHaveLength(3);
    expect(seitentext()).toContain(zusammenfassung("viewer"));
  });
});
