import { describe, expect, it } from "vitest";
import { type BestandsresetBefund, BestandsresetGesperrtError } from "../../../db-tx";
import {
  type BestandsresetDienst,
  type BestandsresetVorschau,
  pruefeFreigabe,
  vorschauKennung,
} from "../bestandsreset-dienst";
import { buildApp, buildServices } from "../build-app";

// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSRESET — DER ADMINISTRATIVE AUFRUF AN DER ROUTE (Nacharbeit 2).
// ================================================================================================
//
// Peters Entscheidung vom 11.10.: Folgenvorschau, zweimal das Passwort, ein Häkchen; Konten und
// Firmenwörterbuch bleiben. Diese Datei misst die ROUTE mit einem eingesetzten Dienst — wer darf,
// was abgewiesen wird und dass bei JEDER Abweisung nichts ausgeführt wird. Dass der Dienst gegen
// echtes Postgres wirklich löscht und erhält, misst `tests/db-tx/bestandsreset-e9-pg.integration
// .test.ts` (P4) über dieselbe Route.

const PASSWORT = "secret123";
const WEG = "/api/admin/bestandsreset";

const OK_BEFUND: BestandsresetBefund = {
  zustand: "OK",
  bestandIstP0: false,
  erfolgMeldbar: true,
  begruendung: "Commitmerkmal gesetzt und Abschluss geschrieben: der Reset ist durchgelaufen.",
};

function vorschau(fingerabdruck: string): BestandsresetVorschau {
  const teil = { wissensobjekte: 7, papierkorb: 5, erhalten: { konten: 2, begriffe: 3 } };
  return {
    geloescht: [{ tabelle: "kos", zeilen: 7 }],
    ...teil,
    kennung: vorschauKennung(fingerabdruck, teil),
  };
}

interface Attrappe {
  dienst: BestandsresetDienst;
  laeufe: string[];
  /** Der Bestand „ändert sich": die nächste Vorschau trägt eine andere Kennung. */
  aendere(): void;
  sperre: { gehalten: boolean };
}

function attrappe(): Attrappe {
  let fingerabdruck = "stand-1";
  const laeufe: string[] = [];
  const sperre = { gehalten: false };
  return {
    laeufe,
    sperre,
    aendere: () => {
      fingerabdruck = "stand-2";
    },
    dienst: {
      stand: async () => ({ vorschau: vorschau(fingerabdruck), letzterLauf: null }),
      ausfuehren: async (laufId) => {
        if (sperre.gehalten) {
          throw new BestandsresetGesperrtError();
        }
        laeufe.push(laufId);
        return OK_BEFUND;
      },
    },
  };
}

async function aufbau(mitDienst: boolean) {
  const services = buildServices();
  const a = attrappe();
  if (mitDienst) {
    services.bestandsreset = a.dienst;
  }
  const app = buildApp(services);
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: PASSWORT },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: PASSWORT },
  });
  const admin = { authorization: `Bearer ${login.json().token}` };
  return { app, services, a, admin, adminId: reg.json().id as string };
}

const voll = (kennung: string) => ({
  passwort: PASSWORT,
  passwortWiederholung: PASSWORT,
  folgenBestaetigt: true,
  vorschauKennung: kennung,
});

describe("Bestandsreset · die Tür: nur der Admin", () => {
  it("anonym → 401 an beiden Wegen, der Dienst wird nicht gefragt", async () => {
    const { app, a } = await aufbau(true);
    const get = await app.inject({ method: "GET", url: "/api/admin/bestandsreset" });
    const post = await app.inject({
      method: "POST",
      url: WEG,
      payload: voll((await a.dienst.stand()).vorschau.kennung),
    });
    expect(get.statusCode).toBe(401);
    expect(post.statusCode).toBe(401);
    expect(a.laeufe).toEqual([]);
  });

  it("ein Viewer → 403 an beiden Wegen, auch mit vollständiger Bestätigung", async () => {
    const { app, a, admin } = await aufbau(true);
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: "Gast", email: "gast@x.de", password: PASSWORT, role: "viewer" },
    });
    expect(angelegt.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "gast@x.de", password: PASSWORT },
    });
    const gast = { authorization: `Bearer ${login.json().token}` };
    const kennung = (await a.dienst.stand()).vorschau.kennung;
    const get = await app.inject({ method: "GET", url: WEG, headers: gast });
    const post = await app.inject({
      method: "POST",
      url: WEG,
      headers: gast,
      payload: voll(kennung),
    });
    expect(get.statusCode).toBe(403);
    expect(post.statusCode).toBe(403);
    expect(a.laeufe).toEqual([]);
  });
});

describe("Bestandsreset · ohne Datenbank gibt es ihn nicht", () => {
  it("GET sagt verfuegbar=false, POST antwortet 409 und löscht nichts", async () => {
    const { app, admin } = await aufbau(false);
    const get = await app.inject({ method: "GET", url: WEG, headers: admin });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual({ verfuegbar: false });
    const post = await app.inject({
      method: "POST",
      url: WEG,
      headers: admin,
      payload: voll("0".repeat(64)),
    });
    expect(post.statusCode).toBe(409);
    expect(post.json().error).toBe("BESTANDSRESET_NICHT_VERFUEGBAR");
  });
});

describe("Bestandsreset · Folgenvorschau, zweimal Passwort, Häkchen", () => {
  it("GET liefert die Folgenvorschau mit Kennung", async () => {
    const { app, admin } = await aufbau(true);
    const get = await app.inject({ method: "GET", url: WEG, headers: admin });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({
      verfuegbar: true,
      vorschau: { wissensobjekte: 7, papierkorb: 5, erhalten: { konten: 2, begriffe: 3 } },
      letzterLauf: null,
    });
    expect(get.json().vorschau.kennung).toMatch(/^[0-9a-f]{64}$/);
  });

  it("jede fehlende Bestätigung wird abgewiesen — und es läuft NICHTS", async () => {
    const { app, a, admin } = await aufbau(true);
    const kennung = (await a.dienst.stand()).vorschau.kennung;
    const faelle: [Record<string, unknown>, number, string][] = [
      [{ ...voll(kennung), folgenBestaetigt: false }, 400, "BESTAETIGUNG_FEHLT"],
      [{ ...voll(kennung), folgenBestaetigt: "true" }, 400, "BESTAETIGUNG_FEHLT"],
      [{ ...voll(kennung), vorschauKennung: undefined }, 400, "VORSCHAU_FEHLT"],
      [{ ...voll(kennung), passwort: "" }, 400, "PASSWORT_FEHLT"],
      [{ ...voll(kennung), passwortWiederholung: undefined }, 400, "PASSWORT_FEHLT"],
      [{ ...voll(kennung), passwortWiederholung: "secret124" }, 400, "PASSWORT_UNGLEICH"],
      [
        { ...voll(kennung), passwort: "falsch-1", passwortWiederholung: "falsch-1" },
        401,
        "INVALID_PASSWORD",
      ],
    ];
    for (const [payload, status, code] of faelle) {
      const res = await app.inject({
        method: "POST",
        url: WEG,
        headers: admin,
        payload,
      });
      expect(res.statusCode, code).toBe(status);
      expect(res.json().error, code).toBe(code);
    }
    expect(a.laeufe).toEqual([]);
  });

  it("hat sich der Bestand seit der Vorschau verändert → 409 mit neuer Vorschau, nichts läuft", async () => {
    const { app, a, admin } = await aufbau(true);
    const alt = (await a.dienst.stand()).vorschau.kennung;
    a.aendere();
    const res = await app.inject({
      method: "POST",
      url: WEG,
      headers: admin,
      payload: voll(alt),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("VORSCHAU_VERALTET");
    expect(res.json().vorschau.kennung).not.toBe(alt);
    expect(a.laeufe).toEqual([]);
  });

  it("mit allen drei Bestätigungen läuft der Reset genau einmal und steht im Auditprotokoll", async () => {
    const { app, services, a, admin, adminId } = await aufbau(true);
    const kennung = (await a.dienst.stand()).vorschau.kennung;
    const res = await app.inject({
      method: "POST",
      url: WEG,
      headers: admin,
      payload: voll(kennung),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, befund: { zustand: "OK" }, protokolliert: true });
    expect(a.laeufe).toEqual([res.json().laufId]);
    const eintraege = (await services.audit.list()).filter(
      (e) => e.action === "bestandsreset.ausgefuehrt",
    );
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]).toMatchObject({ actor: adminId, target: res.json().laufId });
    expect(eintraege[0]?.payload).toMatchObject({ erhalten: { konten: 2, begriffe: 3 } });
  });

  it("läuft schon ein Reset → 409 BESTANDSRESET_GESPERRT", async () => {
    const { app, a, admin } = await aufbau(true);
    a.sperre.gehalten = true;
    const res = await app.inject({
      method: "POST",
      url: WEG,
      headers: admin,
      payload: voll((await a.dienst.stand()).vorschau.kennung),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("BESTANDSRESET_GESPERRT");
  });
});

describe("Bestandsreset · die reinen Bausteine", () => {
  it("pruefeFreigabe verlangt das Häkchen als echtes true, nicht als Zeichenkette", () => {
    expect(pruefeFreigabe({ ...voll("a".repeat(64)), folgenBestaetigt: 1 })).toMatchObject({
      ok: false,
      fehler: "BESTAETIGUNG_FEHLT",
    });
    expect(pruefeFreigabe(voll("a".repeat(64)))).toEqual({
      ok: true,
      passwort: PASSWORT,
      vorschauKennung: "a".repeat(64),
    });
    expect(pruefeFreigabe(undefined)).toMatchObject({ ok: false });
  });

  it("vorschauKennung: dieselben Objekte → dieselbe Kennung; andere Objekte → eine andere", () => {
    const teil = { wissensobjekte: 2, papierkorb: 1, erhalten: { konten: 1, begriffe: 0 } };
    expect(vorschauKennung("x", teil)).toBe(vorschauKennung("x", teil));
    expect(vorschauKennung("x", teil)).not.toBe(vorschauKennung("y", teil));
    expect(vorschauKennung("x", teil)).not.toBe(
      vorschauKennung("x", { ...teil, erhalten: { konten: 1, begriffe: 1 } }),
    );
  });
});
