// ================================================================================================
// AW06-K02 (Ben, Nacharbeit 8) — DER ANNAHMEBEZUG VON BESTANDSOBJEKTEN OHNE `annahmeRef`.
// ================================================================================================
//
// Objekte, die vor `annahmeRef` validiert wurden, tragen ihre Annahme nur in
// `validationDecisionRef`. Eine gelbe Stimme ersetzte diesen Verweis durch ihre Rückgabe, und die
// Annahmezeile verschwand trotz unveränderter, weiter validierter Fassung.
//
// DER BESTAND WIRD ECHT HERGESTELLT: Annahme über den echten HTTP-Weg, danach wird an der Ablage
// genau `annahmeRef` entfernt — so sieht ein vor dieser Regel angenommenes Objekt aus. Alles
// Weitere läuft wieder über die echten Routen.
//   B1 · belegte Annahme im Entscheidungsverweis → bleibt nach der gelben Stimme, unverändert
//   B2 · GEGENPROBE: zeigt der Verweis auf keinen belegten Annahmeeintrag, wird keiner erfunden
import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

type Kopf = Record<string, string>;

interface Annahme {
  fassung: number;
  person: string;
  zeitpunkt: string;
  kontoregel: string | null;
  benoetigt?: number;
}

async function buehne() {
  const repos = inMemoryRepos();
  const app = buildApp(assembleServices(repos));
  const anmelden = async (email: string): Promise<Kopf> => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    expect(login.statusCode).toBe(200);
    return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  };
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@bs.test", password: "secret123" },
  });
  const admin = { kopf: await anmelden("pedi@bs.test"), id: (erst.json() as { id: string }).id };
  const konto = async (rolle: string, email: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.kopf,
      payload: { name: `Konto ${email}`, email, password: "secret123", role: rolle },
    });
    expect(res.statusCode).toBe(201);
    return { kopf: await anmelden(email), id: (res.json() as { id: string }).id };
  };
  const put = async (kopf: Kopf, id: string, payload: Record<string, unknown>) => {
    const res = await app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: kopf, payload });
    expect(res.statusCode, res.body).toBe(200);
  };
  const annahme = async (kopf: Kopf, id: string) => {
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: kopf });
    expect(res.statusCode).toBe(200);
    return res.json() as { status: string; version: number; annahme?: Annahme };
  };
  /** Macht aus dem Objekt einen Bestandsfall: `annahmeRef` fehlt, sonst bleibt alles. */
  const zumBestand = async (id: string, verweis?: { auditSeq: number; auditHash: string }) => {
    const gespeichert = await repos.koRepo.findById(id);
    if (!gespeichert) {
      throw new Error("Objekt fehlt");
    }
    const { annahmeRef: _neu, ...bestand } = gespeichert;
    await repos.koRepo.update(verweis ? { ...bestand, validationDecisionRef: verweis } : bestand);
  };
  return {
    app,
    repos,
    admin,
    put,
    annahme,
    zumBestand,
    controller: await konto("controller", "carl@bs.test"),
    controller2: await konto("controller", "cleo@bs.test"),
    admin2: await konto("admin", "ada@bs.test"),
    experte: await konto("experte", "eva@bs.test"),
  };
}

async function anlegen(b: Awaited<ReturnType<typeof buehne>>, needed: number): Promise<string> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: b.admin.kopf,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      neededValidations: needed,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

describe("AW06-K02 · Bestandsobjekte ohne annahmeRef", () => {
  it("B1 · die belegte Annahme bleibt nach einer gelben Stimme — dieselbe Person, Zeit und Regel", async () => {
    const b = await buehne();
    const id = await anlegen(b, 3);
    await b.put(b.controller.kopf, id, { action: "rate", verdict: "up" });
    await b.put(b.admin2.kopf, id, { action: "rate", verdict: "up" });
    await b.put(b.admin.kopf, id, { action: "rate", verdict: "up" });
    const verweis = (await b.repos.koRepo.findById(id))?.validationDecisionRef;
    await b.zumBestand(id);
    expect((await b.repos.koRepo.findById(id))?.annahmeRef).toBeUndefined();

    // Vorher, als Bestand: die Annahme kommt aus dem Entscheidungsverweis.
    const vorher = await b.annahme(b.experte.kopf, id);
    expect(vorher.status).toBe("validiert");
    expect(vorher.annahme).toMatchObject({
      person: b.admin.id,
      kontoregel: "peer-pruefung",
      benoetigt: 3,
    });

    await b.put(b.controller2.kopf, id, { action: "rate", verdict: "warn" });
    const nachher = await b.annahme(b.experte.kopf, id);
    expect(nachher.status).toBe("validiert");
    expect(nachher.version).toBe(vorher.version);
    // Unverändert — nichts ergänzt, nichts ersetzt; die gelbe Person ist nicht die Annehmende.
    expect(nachher.annahme).toEqual(vorher.annahme);
    expect(nachher.annahme?.person).not.toBe(b.controller2.id);
    // Der Bezug ist jetzt festgehalten: genau der alte belegte Verweis, an diese Fassung gebunden.
    const gespeichert = await b.repos.koRepo.findById(id);
    expect(gespeichert?.annahmeRef).toEqual({ ...verweis, koVersion: vorher.version });
    expect(gespeichert?.validationDecisionRef).not.toEqual(verweis);
  });

  it("B2 · GEGENPROBE: ohne belegten Annahmeeintrag wird kein Annahmebezug erfunden", async () => {
    const b = await buehne();
    const id = await anlegen(b, 1);
    await b.put(b.admin2.kopf, id, { action: "rate", verdict: "up" });
    // Bestand, dessen Verweis auf keinen vorhandenen Eintrag zeigt.
    await b.zumBestand(id, { auditSeq: 999_999, auditHash: "kein-beleg" });
    expect((await b.annahme(b.experte.kopf, id)).annahme).toBeUndefined();

    await b.put(b.controller.kopf, id, { action: "rate", verdict: "warn" });
    const nachher = await b.annahme(b.experte.kopf, id);
    expect(nachher.status).toBe("validiert");
    expect(nachher.annahme).toBeUndefined();
    expect((await b.repos.koRepo.findById(id))?.annahmeRef).toBeUndefined();
  });
});
