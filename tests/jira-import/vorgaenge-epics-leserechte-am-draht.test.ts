// ================================================================================================
// R-0170 — VORGÄNGE UND EPICS EINES JIRA-PROJEKTS ALS KANDIDATEN, PROJEKTROLLEN ALS LESERECHTE.
// ================================================================================================
//
// DER SATZ, DEN DIESER FALL MISST (Zielzustand R-0170): „Vorgänge und Epics eines Jira-Projekts
// werden als Wissenskandidaten übernommen, die Projektrollen als Leserechte."
//
// GEMESSEN WIRD AM ZURÜCKGELESENEN OBJEKT. Der Weg geht über die echte App: Zugangsauskunft →
// Vorgangsliste → Projektübernahme → Prüf-Warteschlange → Annahme durch einen Menschen →
// `GET /api/kos/:id`. Erst dort steht, was im Bestand angekommen ist: der Herkunftsanker mit
// Anbieter, Schlüssel, Projekt, Epic als Pfad und den Rollenkennungen als `sourceRestrictions`.
//
// DER JIRA-VERTRAG ALS DOUBLE — UND DIE NETZPROBE IN EINEM. `globalThis.fetch` bedient für die Dauer
// dieser Datei NUR die gepinnte Jira-Origin; jede andere Adresse wirft und landet in
// `fremdeAufrufe`. KEIN GEFAHRENER JIRA-LAUF WIRD BEHAUPTET: was hier läuft, ist der Vertrag der
// Jira-REST-API v2, nicht eine echte Jira-Instanz.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// VOR dem ersten `buildServices()`: dort wird der quellneutrale Import-Strang beim BAUEN gelesen.
process.env.KLARWERK_JIRA_IMPORT = "1";
process.env.KLARWERK_JIRA_BASE_URL = "https://jira.example.test";
process.env.KLARWERK_JIRA_USER = "importer@example.test";
process.env.KLARWERK_JIRA_TOKEN = "vertragsdouble-nur-fuer-den-test";
process.env.KLARWERK_JIRA_PROJECT = "WART";

const ORIGIN = "https://jira.example.test";

const ADMIN = { name: "Admin R0170", email: "admin-r0170@example.com", password: "geheim-1234" };

const EPIC = {
  key: "WART-1",
  fields: {
    summary: "Wartungsplan 2026",
    description: "Alle wiederkehrenden Wartungen der Abfüllanlage.",
    updated: "2026-09-01T10:00:00.000+0200",
    issuetype: { name: "Epic", hierarchyLevel: 1 },
    project: { key: "WART" },
  },
};

const STORY = {
  key: "WART-12",
  fields: {
    summary: "Filter der Abfüllanlage tauschen",
    description: "Alle 500 Betriebsstunden tauschen. Vorher Druck ablassen.",
    labels: ["wartung"],
    updated: "2026-09-02T09:30:00.000+0200",
    issuetype: { name: "Story", hierarchyLevel: 0 },
    parent: { key: "WART-1", fields: { summary: "Wartungsplan 2026" } },
    reporter: { displayName: "R. Schuster" },
    project: { key: "WART" },
  },
};

/** Die Besetzung der zwei Projektrollen — genau das, was als Leserechte ankommen muss. */
const LESERECHTE = { users: ["acc-schuster", "acc-weber"], groups: ["wartung-team"] };

const echtesFetch = globalThis.fetch;
const fremdeAufrufe: string[] = [];
const jiraAufrufe: string[] = [];
let rollenGesperrt = false;
/** Was `GET /issue/WART-12` gerade liefert — die Gegenprobe zu Nacharbeit 2 ändert es. */
let storyJetzt: typeof STORY = STORY;

function antwort(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

function jira(url: URL): Response {
  if (url.pathname === "/rest/api/2/search/jql") {
    return antwort({ issues: [EPIC, STORY], isLast: true });
  }
  if (url.pathname === "/rest/api/2/issue/WART-12") {
    return antwort(storyJetzt);
  }
  if (url.pathname === "/rest/api/2/project/WART/role") {
    return rollenGesperrt
      ? antwort({}, 403)
      : antwort({
          Developers: `${ORIGIN}/rest/api/2/project/10000/role/10001`,
          Administrators: `${ORIGIN}/rest/api/2/project/10000/role/10002`,
        });
  }
  if (url.pathname === "/rest/api/2/project/WART/role/10001") {
    return antwort({
      actors: [
        { type: "atlassian-user-role-actor", actorUser: { accountId: "acc-schuster" } },
        { type: "atlassian-group-role-actor", actorGroup: { name: "wartung-team" } },
      ],
    });
  }
  if (url.pathname === "/rest/api/2/project/WART/role/10002") {
    return antwort({
      actors: [{ type: "atlassian-user-role-actor", actorUser: { accountId: "acc-weber" } }],
    });
  }
  return antwort({ errorMessages: ["nicht vorhanden"] }, 404);
}

beforeAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    if (!url.startsWith(`${ORIGIN}/`)) {
      fremdeAufrufe.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    jiraAufrufe.push(url);
    return jira(new URL(url));
  }) as unknown as typeof fetch;
});

afterAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = echtesFetch;
});

async function appMitAdmin() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

interface Kandidat {
  id: string;
  item: {
    provider?: string;
    externalId?: string;
    sourceRestrictions?: { users: string[]; groups: string[] };
  };
}

type KandidatMitStand = Kandidat & { status: string; item: { sourceVersion?: number } };

interface KoQuelle {
  provider?: string | null;
  externalId?: string;
  spaceKey?: string;
  url?: string | null;
  sourcePath?: string[];
  sourceRestrictions?: { users: string[]; groups: string[] };
}

describe("R-0170 · Jira-Projekt → Kandidaten → Wissensobjekte mit Leserechten", () => {
  it("der ganze Weg: Vorgänge und Epic übernehmen, annehmen, zurücklesen", async () => {
    const { app, headers } = await appMitAdmin();

    // --- Zugangsauskunft: eingeschaltet, Zugang vollständig — ohne einen Wert zu nennen ---------
    const zugang = await app.inject({ method: "GET", url: "/api/import/jira/zugang", headers });
    expect(zugang.statusCode, zugang.body).toBe(200);
    expect(zugang.json()).toMatchObject({
      system: "jira",
      enabled: true,
      credentialsUsable: true,
      blocker: null,
    });
    expect(zugang.body).not.toContain("vertragsdouble-nur-fuer-den-test");

    // --- Auswahlliste: Epic und Story, ohne Rollenabruf --------------------------------------
    const liste = await app.inject({
      method: "POST",
      url: "/api/admin/import/jira/issues",
      headers,
      payload: {},
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const vorgaenge = (liste.json() as { vorgaenge: { key: string; epic: boolean }[] }).vorgaenge;
    expect(vorgaenge.map((v) => [v.key, v.epic])).toEqual([
      ["WART-1", true],
      ["WART-12", false],
    ]);
    expect(jiraAufrufe.some((u) => u.includes("/role"))).toBe(false);

    // --- Projektübernahme: EINE Seite, beide Vorgänge werden Kandidaten ------------------------
    const uebernahme = await app.inject({
      method: "POST",
      url: "/api/admin/import/jira/project-apply",
      headers,
      payload: {},
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);
    expect(uebernahme.json()).toMatchObject({
      imported: 2,
      alreadyQueued: 0,
      failed: [],
      notFound: [],
      fortsetzung: null,
      projektAbgeschlossen: true,
    });
    expect((uebernahme.json() as { importId?: string }).importId).toBeTruthy();

    // --- Prüf-Warteschlange: die Leserechte reisen schon mit dem Kandidaten --------------------
    const warteschlange = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    expect(warteschlange.statusCode, warteschlange.body).toBe(200);
    const kandidaten = (warteschlange.json() as Kandidat[]).filter(
      (k) => k.item.provider === "Jira",
    );
    expect(kandidaten.map((k) => k.item.externalId).sort()).toEqual(["WART-1", "WART-12"]);
    for (const k of kandidaten) {
      expect(k.item.sourceRestrictions, k.item.externalId).toEqual(LESERECHTE);
    }

    // --- Annahme durch den Menschen (REVIEW-INVARIANTE) und Rücklesen ------------------------
    const quellen: Record<string, KoQuelle | undefined> = {};
    for (const k of kandidaten) {
      const angenommen = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${k.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(angenommen.statusCode, angenommen.body).toBe(200);
      const koId = (angenommen.json() as { koId?: string }).koId;
      expect(koId, "die Annahme muss ein Wissensobjekt erzeugen").toBeTruthy();
      const gelesen = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
      expect(gelesen.statusCode, gelesen.body).toBe(200);
      const ko = gelesen.json() as { sources: KoQuelle[] };
      quellen[k.item.externalId ?? ""] = ko.sources.find((s) => s.externalId === k.item.externalId);
    }

    const story = quellen["WART-12"];
    expect(story, "das Objekt der Story trägt seinen Herkunftsanker").toBeDefined();
    expect(story).toMatchObject({
      provider: "Jira",
      externalId: "WART-12",
      spaceKey: "WART",
      url: `${ORIGIN}/browse/WART-12`,
      // Das Epic der Story ist ihre Elternkette im Projekt.
      sourcePath: ["Wartungsplan 2026"],
      // Die Projektrollen als Leserechte — genau die Kennungen der Quelle, sonst nichts.
      sourceRestrictions: LESERECHTE,
    });
    const epic = quellen["WART-1"];
    expect(epic).toMatchObject({
      provider: "Jira",
      externalId: "WART-1",
      sourceRestrictions: LESERECHTE,
    });
    expect(epic).not.toHaveProperty("sourcePath");

    // --- Wiederholung: derselbe Stand ist schon angenommen und wird nicht noch einmal eingereiht -
    const wiederholung = await app.inject({
      method: "POST",
      url: "/api/admin/import/jira/project-apply",
      headers,
      payload: {},
    });
    expect(wiederholung.statusCode, wiederholung.body).toBe(200);
    expect(wiederholung.json()).toMatchObject({ imported: 0, alreadyQueued: 2 });

    await app.close();
  });

  it("sind die Projektrollen nicht lesbar, wird NICHTS übernommen — mit eigenem Grund", async () => {
    const { app, headers } = await appMitAdmin();
    rollenGesperrt = true;
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/jira/apply",
        headers,
        payload: { keys: ["WART-12"] },
      });
      expect(res.statusCode, res.body).toBe(403);
      expect(res.json()).toMatchObject({ error: "JIRA_ROLES_FORBIDDEN" });
      const offen = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers,
      });
      const jiraKandidaten = (offen.json() as Kandidat[]).filter((k) => k.item.provider === "Jira");
      expect(jiraKandidaten, "ohne Leserechte entsteht kein Kandidat").toEqual([]);
    } finally {
      rollenGesperrt = false;
      await app.close();
    }
  });

  // NACHARBEIT 2 (Bens Befund): der Quellstand zählt Minuten. Eine Änderung in DERSELBEN Minute nach
  // einer Übernahme darf trotzdem nicht als „schon da" verschluckt werden — und eine unveränderte
  // Wiederholung danach darf nichts neu einreihen.
  it("Änderung in derselben Minute nach einer Übernahme wird übernommen; Wiederholung nicht", async () => {
    const { app, headers } = await appMitAdmin();
    const uebernimm = async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/jira/apply",
        headers,
        payload: { keys: ["WART-12"] },
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as { imported: number; alreadyQueued: number };
    };
    const kandidaten = async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers,
      });
      const alle = res.json() as KandidatMitStand[];
      return alle.filter((k) => k.item.externalId === "WART-12");
    };
    try {
      // --- Übernahme 1 um 10:00:05, angenommen ---------------------------------------------------
      storyJetzt = {
        ...STORY,
        fields: { ...STORY.fields, updated: "2026-09-02T10:00:05.000+0200" },
      };
      expect(await uebernimm()).toMatchObject({ imported: 1, alreadyQueued: 0 });
      const erste = (await kandidaten())[0];
      const ersterStand = erste?.item.sourceVersion ?? 0;
      expect(ersterStand).toBeGreaterThan(0);
      const angenommen = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${erste?.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(angenommen.statusCode, angenommen.body).toBe(200);
      const koId = (angenommen.json() as { koId?: string }).koId;

      // --- Änderung um 10:00:45 — dieselbe Minute, anderer Inhalt -------------------------------
      storyJetzt = {
        ...STORY,
        fields: {
          ...STORY.fields,
          description: "Alle 400 Betriebsstunden tauschen. Neuer Intervall laut Hersteller.",
          updated: "2026-09-02T10:00:45.000+0200",
        },
      };
      expect(await uebernimm()).toMatchObject({ imported: 1, alreadyQueued: 0 });
      const offen = (await kandidaten()).filter((k) => k.status === "neu");
      expect(offen).toHaveLength(1);
      // Ein strikt höherer Stand, weit unter der Fassungsgrenze des Import-Kerns (999_999_999).
      expect(offen[0]?.item.sourceVersion).toBe(ersterStand + 1);
      const zweite = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${offen[0]?.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(zweite.statusCode, zweite.body).toBe(200);
      // Der Re-Sync trägt den neuen Inhalt in DASSELBE Wissensobjekt.
      expect((zweite.json() as { koId?: string }).koId).toBe(koId);
      const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
      expect((ko.json() as { statement: string }).statement).toContain("400 Betriebsstunden");

      // --- unveränderte Wiederholung: nichts Neues ----------------------------------------------
      expect(await uebernimm()).toMatchObject({ imported: 0, alreadyQueued: 1 });
      expect((await kandidaten()).filter((k) => k.status === "neu")).toEqual([]);
    } finally {
      storyJetzt = STORY;
      await app.close();
    }
  });

  it("die Auswahl ist begrenzt und eine fremde Fortsetzung wird abgewiesen", async () => {
    const { app, headers } = await appMitAdmin();
    const leer = await app.inject({
      method: "POST",
      url: "/api/admin/import/jira/apply",
      headers,
      payload: { keys: [] },
    });
    expect(leer.statusCode).toBe(400);
    expect(leer.json()).toMatchObject({ error: "APPLY_EMPTY_SELECTION" });
    const ungueltig = await app.inject({
      method: "POST",
      url: "/api/admin/import/jira/project-apply",
      headers,
      payload: { fortsetzung: "mit leerzeichen" },
    });
    expect(ungueltig.statusCode).toBe(400);
    expect(ungueltig.json()).toMatchObject({ error: "FORTSETZUNG_INVALID" });
    await app.close();
  });

  it("NETZPROBE: in dieser Datei ging kein einziger Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    expect(jiraAufrufe.length).toBeGreaterThanOrEqual(4);
    expect(jiraAufrufe.every((u) => u.startsWith(`${ORIGIN}/`))).toBe(true);
  });
});
