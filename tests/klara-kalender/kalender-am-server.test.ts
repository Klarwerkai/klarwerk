// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender) · DIE KALENDERANBINDUNG AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()), …)`, `app.inject`):
// Anmeldung, Rechtetor `requireUser`, Routen, Dienst und Ablage. Der Kalenderanbieter ist das strenge
// Vertragsdouble (`vertragsdouble.ts`), eingespeist über dieselbe Option, über die sonst die
// Betreiber-Einspeisung kommt — KEIN echter Microsoft-365-Kalender. Dass Anbindungen, Zuordnungen,
// Sperrmarken und Laufstände einen Neustart überstehen, misst `kalender-pg.integration.test.ts`.
//
//   S1 (K1)       Konto und Zielkalender sichtbar; Eintragen, Lesen, Zuordnungen über die Türen.
//   S2 (K3)       Ohne Einspeisung „nicht verbunden“; fremdes Konto 404; ohne Anmeldung 401.
//   S3 (AW17-K04) Löschen nur mit der gesehenen Fassung; geändert → 409 + sichtbarer Konflikt.
//   S4 (AW17-K06/K08, P07-AC05/06) Externe Löschung → Abgleich pausiert NUR diesen Lauf; Laufauskunft;
//                 Dialogschließen ändert nichts; Beenden nur mit Umfang.
import { beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { DOUBLE_KALENDER, StrengerTestkalender, testTermin } from "./vertragsdouble";

type App = ReturnType<typeof buildApp>;

const BASIS = "/api/me/klara/kalender";
const KENNWORT = "secret123";

let app: App;
let kalender: StrengerTestkalender;
const eingespeist = new Set<string>();
let ada = { id: "", token: "" };
let erik = { id: "", token: "" };

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await auf("", "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

beforeEach(async () => {
  kalender = new StrengerTestkalender();
  eingespeist.clear();
  app = buildApp(assembleServices(inMemoryRepos()), {
    klaraKalenderAnbieter: async (kontoId) => (eingespeist.has(kontoId) ? kalender : null),
  });
  await auf("", "POST", "/api/auth/register", {
    name: "Ada Admin",
    email: "ada@klara-kalender-k11.test",
    password: KENNWORT,
  });
  const adaToken = await anmelden("ada@klara-kalender-k11.test");
  const ich = await auf(adaToken, "GET", "/api/auth/me");
  ada = { id: (ich.json() as { id: string }).id, token: adaToken };
  const angelegt = await auf(adaToken, "POST", "/api/users", {
    name: "Erik Experte",
    email: "erik@klara-kalender-k11.test",
    password: KENNWORT,
    role: "experte",
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  erik = {
    id: (angelegt.json() as { id: string }).id,
    token: await anmelden("erik@klara-kalender-k11.test"),
  };
  eingespeist.add(ada.id);
});

async function verbinde(): Promise<string> {
  const r = await auf(ada.token, "POST", `${BASIS}/anbindungen`, {
    kalenderId: DOUBLE_KALENDER.id,
    umfang: "lesen_schreiben",
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { anbindung: { id: string } }).anbindung.id;
}

interface ZuordnungSicht {
  schluessel: string;
  externeId: string | null;
  stand: string;
  entscheidung: { anlass: string; umfaenge: string[] } | null;
  sperrmarke: { grund: string } | null;
}

async function eintragen(anbindungId: string, ereignisId = "ereignis-1") {
  const r = await auf(ada.token, "POST", `${BASIS}/anbindungen/${anbindungId}/termine`, {
    termin: testTermin(ereignisId),
  });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { zuordnung: ZuordnungSicht }).zuordnung;
}

async function laufStand(ereignisId = "ereignis-1"): Promise<string> {
  const r = await auf(
    ada.token,
    "GET",
    `${BASIS}/lauf?auftragId=auftrag-zertifikat-3&ereignisId=${ereignisId}`,
  );
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { stand: string }).stand;
}

/** Eine Tür an einer eigenen Zuordnung: `loeschvorschau`, `loeschen` oder `entscheidung`. */
const tuer = (schluessel: string, name: string, rumpf: Record<string, unknown>) =>
  auf(ada.token, "POST", `${BASIS}/zuordnungen/${schluessel}/${name}`, rumpf);

describe("S1 · K1 — Konto, Zielkalender und Wirkung über die Anwendungstüren", () => {
  it("zeigt Konto und Kalender, trägt ein, liest nach und führt die Zuordnung", async () => {
    const start = await auf(ada.token, "GET", BASIS);
    expect(start.statusCode, start.body).toBe(200);
    expect(start.json()).toMatchObject({
      auswahl: { verbunden: true, konto: { anzeige: "Testkalender Klarwerk" } },
      anbindungen: [],
    });
    const id = await verbinde();
    const z = await eintragen(id);
    expect(z).toMatchObject({ stand: "projiziert", externeId: "dbl-1" });
    expect(z).not.toHaveProperty("kontoId");
    expect(kalender.termine.get("dbl-1")?.titel).toBe("Zertifikat TÜV verlängern");

    const termine = await auf(
      ada.token,
      "GET",
      `${BASIS}/anbindungen/${id}/termine?von=2026-10-26T00:00:00&bis=2026-10-27T00:00:00`,
    );
    expect(termine.statusCode, termine.body).toBe(200);
    expect(termine.json()).toMatchObject({
      ok: true,
      termine: [{ id: "dbl-1", art: "persoenlich" }],
    });

    const liste = await auf(ada.token, "GET", `${BASIS}/anbindungen/${id}/zuordnungen`);
    expect((liste.json() as { zuordnungen: ZuordnungSicht[] }).zuordnungen).toHaveLength(1);
  });

  it("ein unvollständiger Termin wird vor jeder Wirkung abgewiesen", async () => {
    const id = await verbinde();
    const r = await auf(ada.token, "POST", `${BASIS}/anbindungen/${id}/termine`, {
      termin: { ...testTermin(), inhalt: { ...testTermin().inhalt, zeitzone: "Mars/Olympus" } },
    });
    expect(r.statusCode, r.body).toBe(400);
    expect(kalender.aufrufe).not.toContain("lege");
  });
});

describe("S2 · K3 — keine Verbindung, fremde Konten, keine Anmeldung", () => {
  it("ohne Einspeisung: „nicht verbunden“ und kein Verbinden", async () => {
    const r = await auf(erik.token, "GET", BASIS);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ auswahl: { verbunden: false }, anbindungen: [] });
    const v = await auf(erik.token, "POST", `${BASIS}/anbindungen`, {
      kalenderId: DOUBLE_KALENDER.id,
      umfang: "lesen_schreiben",
    });
    expect(v.statusCode).toBe(409);
  });

  it("fremde Anbindung und Zuordnung antworten 404 – auch für eine andere angemeldete Person", async () => {
    const id = await verbinde();
    const z = await eintragen(id);
    eingespeist.add(erik.id);
    for (const [methode, url] of [
      ["GET", `${BASIS}/anbindungen/${id}/zuordnungen`],
      ["POST", `${BASIS}/anbindungen/${id}/abgleich`],
      ["POST", `${BASIS}/zuordnungen/${z.schluessel}/loeschvorschau`],
      ["POST", `${BASIS}/zuordnungen/${z.schluessel}/entscheidung`],
    ] as const) {
      const r = await auf(erik.token, methode, url, methode === "POST" ? {} : undefined);
      expect(r.statusCode, `${methode} ${url}`).toBe(404);
    }
    expect((await auf("", "GET", BASIS)).statusCode).toBe(401);
    expect(kalender.termine.size).toBe(1);
  });
});

describe("S3 · AW17-K04 — Löschen nur mit der gesehenen Fassung", () => {
  it("geändert nach der Vorschau → 409 und sichtbarer Konflikt; ohne Fassung → 400", async () => {
    const id = await verbinde();
    const z = await eintragen(id);
    const vorschau = await tuer(z.schluessel, "loeschvorschau", { umfang: "einzeltermin" });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    const fassung = (vorschau.json() as { fassung: string }).fassung;

    const ohne = await tuer(z.schluessel, "loeschen", { umfang: "einzeltermin" });
    expect(ohne.statusCode).toBe(400);

    kalender.aendereExtern("dbl-1", { titel: "fremd geändert" });
    const alt = await tuer(z.schluessel, "loeschen", { umfang: "einzeltermin", fassung });
    expect(alt.statusCode, alt.body).toBe(409);
    expect(alt.json()).toMatchObject({
      ok: false,
      grund: "version_geaendert",
      zuordnung: { stand: "konflikt", entscheidung: { anlass: "loeschen_veraltet" } },
    });
    expect(kalender.termine.has("dbl-1")).toBe(true);
    expect(kalender.aufrufe).not.toContain("loesche");

    const neu = await tuer(z.schluessel, "loeschvorschau", { umfang: "einzeltermin" });
    const geloescht = await tuer(z.schluessel, "loeschen", {
      umfang: "einzeltermin",
      fassung: (neu.json() as { fassung: string }).fassung,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(200);
    expect(kalender.termine.has("dbl-1")).toBe(false);
    expect(kalender.ohneFassung).toEqual([]);
  });
});

describe("S4 · AW17-K06/K08 · P07-AC05/06 — externe Löschung pausiert nur diesen Lauf", () => {
  it("Abgleich pausiert, Dialogschließen hält an, Beenden braucht den Umfang", async () => {
    const id = await verbinde();
    const z = await eintragen(id, "ereignis-1");
    await eintragen(id, "ereignis-2");
    kalender.termine.delete("dbl-1");

    const ab = await auf(ada.token, "POST", `${BASIS}/anbindungen/${id}/abgleich`, {});
    expect(ab.statusCode, ab.body).toBe(200);
    const wirkungen = (ab.json() as { ergebnisse: { laufWirkung: string | null }[] }).ergebnisse
      .map((e) => e.laufWirkung)
      .sort();
    expect(wirkungen).toEqual(["keine", "pausiert"]);
    expect(await laufStand("ereignis-1")).toBe("pausiert");
    expect(await laufStand("ereignis-2")).toBe("laeuft");

    const zu = await tuer(z.schluessel, "entscheidung", { wahl: "dialog_geschlossen" });
    expect(zu.statusCode, zu.body).toBe(200);
    expect(await laufStand("ereignis-1")).toBe("pausiert");

    const ohneUmfang = await tuer(z.schluessel, "entscheidung", { wahl: "beenden" });
    expect(ohneUmfang.statusCode).toBe(400);
    expect(await laufStand("ereignis-1")).toBe("pausiert");

    const ende = await tuer(z.schluessel, "entscheidung", {
      wahl: "beenden",
      umfang: "einzeltermin",
    });
    expect(ende.statusCode, ende.body).toBe(200);
    expect(await laufStand("ereignis-1")).toBe("beendet");
    expect(await laufStand("ereignis-2")).toBe("laeuft");
  });
});

describe("S5 · K3/AW17-K01 · Nacharbeit 4 — Wiederholung mit derselben Identität, keine Dublette", () => {
  it("Nachlesen scheitert nach der Anlage: 202 ohne Erfolg; dieselbe Identität erneut → ein Ereignis", async () => {
    const id = await verbinde();
    const pfad = `${BASIS}/anbindungen/${id}/termine`;
    kalender.holeStoerung = "verbindung_abgelaufen";
    const erst = await auf(ada.token, "POST", pfad, { termin: testTermin("ereignis-v") });
    expect(erst.statusCode, erst.body).toBe(202);
    expect(erst.json()).toMatchObject({ ok: false, stand: "ausstehend" });
    // Die Wirkung ist beim Anbieter angekommen — aber nicht als Erfolg gemeldet.
    expect(kalender.termine.size).toBe(1);

    // Die Oberfläche wiederholt mit DERSELBEN Auftrags-/Ereigniskennung.
    const zweit = await auf(ada.token, "POST", pfad, { termin: testTermin("ereignis-v") });
    expect(zweit.statusCode, zweit.body).toBe(200);
    expect(zweit.json()).toMatchObject({ ok: true, zuordnung: { stand: "projiziert" } });
    expect(kalender.termine.size).toBe(1);
    expect(kalender.aufrufe.filter((x) => x === "lege")).toHaveLength(1);
  });
});
