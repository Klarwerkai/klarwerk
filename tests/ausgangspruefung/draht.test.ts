// ================================================================================================
// R-1646 · AUSGANGSPRÜFUNG AM DRAHT — echte App, echte Konten, echte Rechte, Prüfprotokoll.
// ================================================================================================
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · Der Controller sieht über `/api/ausgangspruefung` den ausgehenden Text mit hervorgehobenen
//        Ersetzungen und gibt frei oder lehnt ab; erst danach geht etwas hinaus. Ein Experte darf
//        weder sehen noch entscheiden. Ohne Schalter meldet die Route ehrlich „aus".
//
// Der Kontoname der Erstanmeldung ist ein synthetischer Beispielname; er wird als Person ersetzt,
// weil er als Konto dieser Instanz bekannt ist.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  AusgangAbgelehntFehler,
  setzeAusgangspruefung,
} from "../../services/reasoner/src/ausgangspruefung";
import { cappedModelClient } from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;
type Kopf = { headers: { authorization: string } };

const NAME = "Erika Mustermann";
const EMAIL = "erika.mustermann@beispiel.de";
const FRAGE = `Frage von ${NAME}, erreichbar unter ${EMAIL}: Wie lautet die Prüffrist?`;
const ANBIETER = "cloud:testanbieter:ausgangspruefung";

async function anmelden(app: App, email: string, password: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode, `Anmeldung ${email}`).toBe(200);
  return { headers: { authorization: `Bearer ${res.json().token}` } };
}

async function instanz(schalter: boolean) {
  const vorher = process.env.KLARWERK_AUSGANGSPRUEFUNG;
  if (schalter) {
    process.env.KLARWERK_AUSGANGSPRUEFUNG = "an";
  } else {
    // Entfernen, nicht leeren: ein leerer String wäre ein gesetzter Wert.
    Reflect.deleteProperty(process.env, "KLARWERK_AUSGANGSPRUEFUNG");
  }
  const services = buildServices();
  const app = buildApp(services);
  if (vorher === undefined) {
    Reflect.deleteProperty(process.env, "KLARWERK_AUSGANGSPRUEFUNG");
  } else {
    process.env.KLARWERK_AUSGANGSPRUEFUNG = vorher;
  }
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: NAME, email: EMAIL, password: "secret123" },
  });
  const admin = await anmelden(app, EMAIL, "secret123");
  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin.headers,
  });
  expect(seed.statusCode).toBe(200);
  const carla = await anmelden(
    app,
    "carla@demo.klarwerk",
    demoKennwort(seed, "carla@demo.klarwerk"),
  );
  const erik = await anmelden(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
  return { app, services, carla, erik };
}

function attrappe(): { client: ModelClient; gesendet: string[] } {
  const gesendet: string[] = [];
  return {
    gesendet,
    client: {
      name: ANBIETER,
      async complete(_system, user) {
        gesendet.push(user);
        return "Die Frist gilt für [Person 1].";
      },
    },
  };
}

interface Lage {
  aktiv: boolean;
  offen: { id: string; anbieter: string; nutzer: { text: string; ersetzt: string | null }[] }[];
}

/** Die Lage, sobald der Aufruf dieser Attrappe wartet — nur ihre Einträge, sonst nichts. */
async function wartend(app: App, kopf: Kopf): Promise<Lage> {
  let lage: Lage = { aktiv: false, offen: [] };
  for (let i = 0; i < 50; i++) {
    const res = await app.inject({ method: "GET", url: "/api/ausgangspruefung", ...kopf });
    expect(res.statusCode).toBe(200);
    const roh = res.json() as Lage;
    lage = { ...roh, offen: roh.offen.filter((o) => o.anbieter === ANBIETER) };
    if (lage.offen.length > 0) {
      break;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return lage;
}

afterEach(() => {
  setzeAusgangspruefung(null);
});

describe("R-1646 · /api/ausgangspruefung", () => {
  it("Controller sieht den anonymisierten Text, gibt frei — erst dann geht er hinaus", async () => {
    const { app, services, carla, erik } = await instanz(true);
    const { client, gesendet } = attrappe();
    const lauf = cappedModelClient(client, { rejectsConfidential: true }).complete(
      "Antworte knapp.",
      FRAGE,
      false,
    );

    const lage = await wartend(app, carla);
    expect(lage.aktiv).toBe(true);
    const [offen] = lage.offen;
    expect(offen).toBeDefined();
    expect(gesendet).toEqual([]);
    const text = (offen?.nutzer ?? []).map((a) => a.text).join("");
    expect(text).toBe(
      "Frage von [Person 1], erreichbar unter [E-Mail 1]: Wie lautet die Prüffrist?",
    );
    expect((offen?.nutzer ?? []).filter((a) => a.ersetzt).map((a) => a.ersetzt)).toEqual([
      "person",
      "email",
    ]);
    const antwortText = JSON.stringify(lage);
    expect(antwortText).not.toContain(NAME);
    expect(antwortText).not.toContain(EMAIL);

    // Experte: weder sehen noch entscheiden.
    const sieht = await app.inject({ method: "GET", url: "/api/ausgangspruefung", ...erik });
    expect(sieht.statusCode).toBe(403);
    const entscheidet = await app.inject({
      method: "POST",
      url: `/api/ausgangspruefung/${offen?.id}/freigeben`,
      ...erik,
    });
    expect(entscheidet.statusCode).toBe(403);
    expect(gesendet).toEqual([]);

    const frei = await app.inject({
      method: "POST",
      url: `/api/ausgangspruefung/${offen?.id}/freigeben`,
      ...carla,
    });
    expect(frei.statusCode).toBe(200);
    await expect(lauf).resolves.toBe(`Die Frist gilt für ${NAME}.`);
    expect(gesendet).toEqual([text]);

    // Schon entschieden: 404 statt einer zweiten Wirkung.
    const nochmal = await app.inject({
      method: "POST",
      url: `/api/ausgangspruefung/${offen?.id}/ablehnen`,
      ...carla,
    });
    expect(nochmal.statusCode).toBe(404);

    // Prüfprotokoll: die Entscheidung mit Metadaten, ohne den Text.
    const protokoll = (await services.audit.list({})).filter(
      (e) => e.action === "ausgang.freigegeben",
    );
    expect(protokoll).toHaveLength(1);
    const eintrag = JSON.stringify(protokoll[0]);
    expect(eintrag).not.toContain(NAME);
    expect(eintrag).not.toContain("Prüffrist");
  });

  it("Ablehnung durch den Controller: der Aufruf geht nicht hinaus", async () => {
    const { app, carla } = await instanz(true);
    const { client, gesendet } = attrappe();
    const lauf = cappedModelClient(client, { rejectsConfidential: true }).complete(
      "Antworte knapp.",
      FRAGE,
      false,
    );
    const [offen] = (await wartend(app, carla)).offen;
    const ab = await app.inject({
      method: "POST",
      url: `/api/ausgangspruefung/${offen?.id}/ablehnen`,
      ...carla,
    });
    expect(ab.statusCode).toBe(200);
    await expect(lauf).rejects.toBeInstanceOf(AusgangAbgelehntFehler);
    expect(gesendet).toEqual([]);
  });

  it("ohne Schalter: ehrlich ausgeschaltet, nichts zu entscheiden", async () => {
    const { app, carla } = await instanz(false);
    const res = await app.inject({ method: "GET", url: "/api/ausgangspruefung", ...carla });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ aktiv: false, wartezeitMs: null, offen: [] });
    const frei = await app.inject({
      method: "POST",
      url: "/api/ausgangspruefung/unbekannt/freigeben",
      ...carla,
    });
    expect(frei.statusCode).toBe(404);
  });
});
