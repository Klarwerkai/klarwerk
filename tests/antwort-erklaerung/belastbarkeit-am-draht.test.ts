// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — DIE BELASTBARKEIT AM DRAHT.
// ================================================================================================
//
// Gemessen an der echten Route `POST /api/ask` über `app.inject()` (buildApp, InMemory-Bestand) —
// nicht am Modul. Ein Modultest wäre grün, während die Route das Feld gar nicht mitschickt.
//
//   R-0281/R-0318  die Antwort trägt Lage, Begründung, Vertrauenswert, Stand und Verantwortung
//   R-0319         Vertrauenswert an der Antwort = `trust` des Eintrags in der Bibliothek
//   R-0321         offener Konflikt → beide Seiten mit Beleg, Beschreibung, kein Gewinner
//   R-0322         Konto des Verantwortlichen gelöscht → Antwort bleibt, Lücke benannt
//   R-0284         Wissenslücke → Prüfrahmen statt nackter Null (Sitzungs- und Word-Modus)
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DEFAULT_TOP_K } from "../../services/reasoner";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const SELTENES_WORT = "Querstromventilhaube";

async function anmelden(app: App, mail: string): Promise<{ kopf: Kopf; id: string }> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: mail, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return {
    kopf: { authorization: `Bearer ${login.json().token}` },
    id: login.json().user.id as string,
  };
}

async function start(mail: string): Promise<{ app: App; admin: Kopf; adminId: string }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: mail, password: "geheim12345" },
  });
  const { kopf, id } = await anmelden(app, mail);
  return { app, admin: kopf, adminId: id };
}

async function anlegen(app: App, kopf: Kopf, titel: string, aussage: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: aussage,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = res.json().id as string;
  const val = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: kopf,
    payload: { action: "admin-validate" },
  });
  expect(val.statusCode, val.body).toBe(200);
  return id;
}

interface Belastbarkeit {
  lage: string;
  gruende: string[];
  vertrauenswert: { wert: number | null; herleitung: string; schwaechsteQuelle: string | null };
  quellenAnzahl: { herangezogen: number; tragend: number };
  quellen: {
    koId: string;
    vertrauenswert: number;
    stand: string;
    validiert: boolean;
    verantwortung: {
      art: string;
      person: { id: string; name: string | null } | null;
      erreichbar: boolean | null;
    };
  }[];
  konflikte: {
    konfliktId: string;
    beschreibung: string | null;
    seiten: { einsehbar: boolean; koId?: string; aussage?: string; traegtAntwort: boolean }[];
  }[];
  hinweis: string;
}

interface Antwort {
  result: {
    answered: boolean;
    trust: number;
    citedSources?: string[];
    belastbarkeit?: Belastbarkeit;
  };
  pruefrahmen?: { umfang: string; verglichen: number; hoechstens: number; nurWoertlich: boolean };
}

async function fragen(app: App, kopf: Kopf, frage: string, mode?: string): Promise<Antwort> {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: kopf,
    payload: mode ? { question: frage, mode } : { question: frage },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort;
}

function belastbarkeit(a: Antwort): Belastbarkeit {
  expect(a.result.belastbarkeit, "Die Antwort trägt keine Belastbarkeit am Draht").toBeDefined();
  return a.result.belastbarkeit as Belastbarkeit;
}

describe("Antwort-Erklärung · Belastbarkeit an POST /api/ask", () => {
  it("R-0318/R-0319: Lage, Begründung, Stand, Verantwortung — Vertrauenswert wie in der Bibliothek", async () => {
    const { app, admin, adminId } = await start("bel-a@antwort.test");
    const ko = await anlegen(
      app,
      admin,
      `Wartung ${SELTENES_WORT}`,
      `Die ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
    );
    const antwort = await fragen(app, admin, `${SELTENES_WORT} Wartung entlasten`);
    expect(antwort.result.answered).toBe(true);
    expect(antwort.result.citedSources).toContain(ko);

    const b = belastbarkeit(antwort);
    expect(b.lage).toBe("belegt");
    expect(b.hinweis).toBe("vertrauen_ist_kein_wahrheitsversprechen");
    expect(b.gruende).toContain("alle_tragenden_quellen_validiert");
    expect(b.quellenAnzahl.tragend).toBe(1);

    // R-0319: dieselbe Größe an Antwort, Quelle und Bibliothekseintrag.
    const eintrag = await app.inject({ method: "GET", url: `/api/kos/${ko}`, headers: admin });
    expect(eintrag.statusCode, eintrag.body).toBe(200);
    const bibliothek = eintrag.json() as { trust: number; author: string };
    expect(b.vertrauenswert).toEqual({
      wert: bibliothek.trust,
      herleitung: "minimum_tragender_quellen",
      schwaechsteQuelle: ko,
    });
    expect(antwort.result.trust).toBe(bibliothek.trust);

    // R-0318: je tragender Quelle Stand, Quellenqualität und Verantwortung — vom Server.
    const [quelle] = b.quellen;
    expect(quelle?.koId).toBe(ko);
    expect(Number.isNaN(Date.parse(quelle?.stand ?? ""))).toBe(false);
    expect(quelle?.validiert).toBe(true);
    expect(quelle?.verantwortung.person?.id).toBe(adminId);
    expect(quelle?.verantwortung.person?.name).toBe("Admin");
    expect(quelle?.verantwortung.erreichbar).toBe(true);
  });

  it("R-0321: ein offener Widerspruch zeigt BEIDE Seiten mit Beleg und benennt ihn", async () => {
    const { app, admin } = await start("bel-b@antwort.test");
    const tragend = await anlegen(
      app,
      admin,
      `Wartung ${SELTENES_WORT}`,
      `Die ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
    );
    const partner = await anlegen(
      app,
      admin,
      `Gegenanweisung ${SELTENES_WORT}`,
      `Die ${SELTENES_WORT} bleibt waehrend der Wartung unter Druck.`,
    );
    const konflikt = await app.inject({
      method: "PUT",
      url: `/api/kos/${tragend}`,
      headers: admin,
      payload: {
        action: "conflict",
        conflict: {
          koA: tragend,
          koB: partner,
          type: "truth",
          description: `Widerspruch zur ${SELTENES_WORT}`,
        },
      },
    });
    expect(konflikt.statusCode, konflikt.body).toBe(201);

    const antwort = await fragen(app, admin, `${SELTENES_WORT} Wartung entlasten`);
    expect(antwort.result.citedSources).toContain(tragend);
    const b = belastbarkeit(antwort);
    expect(b.lage).toBe("belegt_mit_konflikt");
    expect(b.gruende).toContain("offener_konflikt");
    expect(b.konflikte).toHaveLength(1);
    const [k] = b.konflikte;
    expect(k?.beschreibung).toBe(`Widerspruch zur ${SELTENES_WORT}`);
    expect(k?.seiten.map((s) => s.einsehbar)).toEqual([true, true]);
    expect(k?.seiten.map((s) => s.koId).sort()).toEqual([tragend, partner].sort());
    // Beide Aussagen stehen da — die eine trägt die Antwort, die andere widerspricht ihr.
    expect(k?.seiten.find((s) => s.koId === partner)?.aussage).toContain("unter Druck");
    expect(k?.seiten.filter((s) => s.traegtAntwort).map((s) => s.koId)).toEqual([tragend]);
  });

  it("R-0322: Konto des Verantwortlichen gelöscht — die Antwort bleibt, die Lücke wird benannt", async () => {
    const { app, admin } = await start("bel-c@antwort.test");
    const anlage = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: {
        name: "Expertin",
        email: "expertin@antwort.test",
        password: "geheim12345",
        role: "admin",
      },
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    const expertin = await anmelden(app, "expertin@antwort.test");
    const ko = await anlegen(
      app,
      expertin.kopf,
      `Wartung ${SELTENES_WORT}`,
      `Die ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
    );

    // Vorher: erreichbar.
    const vorher = belastbarkeit(await fragen(app, admin, `${SELTENES_WORT} Wartung entlasten`));
    expect(vorher.lage).toBe("belegt");
    expect(vorher.quellen[0]?.verantwortung.erreichbar).toBe(true);

    const loeschen = await app.inject({
      method: "DELETE",
      url: `/api/users/${expertin.id}`,
      headers: admin,
    });
    expect(loeschen.statusCode, loeschen.body).toBe(204);

    const nachher = await fragen(app, admin, `${SELTENES_WORT} Wartung entlasten`);
    // Das Wissen bleibt nutzbar …
    expect(nachher.result.answered).toBe(true);
    expect(nachher.result.citedSources).toContain(ko);
    // … und die Verantwortungslücke wird benannt statt verschwiegen.
    const b = belastbarkeit(nachher);
    expect(b.lage).toBe("belegt_zustaendig_fehlt");
    expect(b.gruende).toContain("zustaendig_nicht_erreichbar");
    expect(b.quellen[0]?.verantwortung.erreichbar).toBe(false);
    expect(b.quellen[0]?.verantwortung.person?.id).toBe(expertin.id);
  });

  it("R-0284: die Wissenslücke nennt, wogegen geprüft wurde — Konsole und Word-Modus", async () => {
    const { app, admin } = await start("bel-d@antwort.test");
    await anlegen(
      app,
      admin,
      `Wartung ${SELTENES_WORT}`,
      `Die ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
    );
    const frage = "Wie lautet die Kantinenordnung fuer Feiertage";

    const konsole = await fragen(app, admin, frage);
    expect(konsole.result.answered).toBe(false);
    expect(belastbarkeit(konsole).lage).toBe("wissensluecke");
    expect(konsole.pruefrahmen).toEqual({
      umfang: "nicht_vertraulich",
      verglichen: 0,
      hoechstens: DEFAULT_TOP_K,
      nurWoertlich: false,
    });

    const word = await fragen(app, admin, frage, "retrieval-only");
    expect(word.result.answered).toBe(false);
    expect(word.pruefrahmen).toEqual({
      umfang: "validiert",
      verglichen: 0,
      hoechstens: DEFAULT_TOP_K,
      nurWoertlich: true,
    });
  });
});
