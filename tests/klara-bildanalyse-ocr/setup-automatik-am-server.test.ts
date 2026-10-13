// ================================================================================================
// OCR-03 · SETUP › KLARA „BILDER AUTOMATISCH ANALYSIEREN UND TEXT ERKENNEN“ AM ECHTEN SERVER.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-kontext-setup, Kriterium K4 (und K6 für das Konto).
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`)
// mit fiktiven Konten. Die Einstellung liegt im vorhandenen Assistenzprofil (W17) — keine neue Route.
//
//   S1  Ohne Wahl kein gespeicherter Wert (Voreinstellung „an“ gilt im Client); aus → neue Anmeldung
//       liest „aus“; wieder an → neue Anmeldung liest „an“. Name, Avatar, Einrichtung unberührt.
//   S2  Ungültiger Wert → 400 mit Grund, nichts gespeichert; veraltete Fassung → 409.
//   S3  Ein Profilschreiben ohne das Feld (Namenswechsel) lässt die Wahl stehen.
//   S4  Die Wahl gehört dem Konto: ein zweites Konto behält die Voreinstellung; eine fremde
//       Kontokennung im Rumpf → 403, nichts geändert.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

const BASIS = "/api/me/assistenz";

interface Antwort {
  profil: {
    name: string | null;
    avatar: string | null;
    fassung: number;
    eingerichtetAm: string | null;
    bildAutomatik?: boolean;
  } | null;
  einrichtungOffen: boolean;
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "PUT", payload?: unknown) =>
  app.inject({
    method: methode,
    url: BASIS,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function lies(wer: string): Promise<Antwort> {
  const r = await auf(wer, "GET");
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Antwort;
}

async function setze(wer: string, wert: unknown, fassung: number): Promise<Antwort> {
  const r = await auf(wer, "PUT", { bildAutomatik: wert, fassung });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Antwort;
}

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@bildautomatik.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@bildautomatik.test");
  erik = await konto(adminToken, "experte", "erik@bildautomatik.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@bildautomatik.test", "Vera Viewer");
});

describe("S1 · K4 — Voreinstellung, aus und wieder an, über eine neue Anmeldung hinweg", () => {
  it("ohne Wahl nichts gespeichert; aus und an bleiben nach neuer Anmeldung erhalten", async () => {
    // Ohne abweichende Präferenz steht nichts am Konto — der Client nimmt die Voreinstellung „an“.
    const vorher = await lies(erik.token);
    expect(vorher).toEqual({ profil: null, einrichtungOffen: true });

    const aus = await setze(erik.token, false, 0);
    expect(aus.profil?.bildAutomatik).toBe(false);
    // Die Einstellung richtet kein Profil ein und erfindet weder Namen noch Motiv.
    expect(aus.einrichtungOffen).toBe(true);
    expect(aus.profil).toMatchObject({ name: null, avatar: null, eingerichtetAm: null });

    // „Neuladen“ bzw. zweites Gerät: eine NEUE Anmeldung liest denselben Stand.
    const zweite = await anmelden("erik@bildautomatik.test");
    expect((await lies(zweite)).profil?.bildAutomatik).toBe(false);

    const an = await setze(zweite, true, aus.profil?.fassung ?? 0);
    expect(an.profil?.bildAutomatik).toBe(true);
    const dritte = await anmelden("erik@bildautomatik.test");
    expect((await lies(dritte)).profil?.bildAutomatik).toBe(true);
  });
});

describe("S2 · ungültig oder veraltet — nichts geändert", () => {
  it("kein Wahrheitswert → 400 „bildAutomatik“; veraltete Fassung → 409", async () => {
    const falsch = await auf(erik.token, "PUT", { bildAutomatik: "nein", fassung: 0 });
    expect(falsch.statusCode).toBe(400);
    expect((falsch.json() as { grund: string }).grund).toBe("bildAutomatik");
    expect(await lies(erik.token)).toEqual({ profil: null, einrichtungOffen: true });

    const aus = await setze(erik.token, false, 0);
    const veraltet = await auf(erik.token, "PUT", { bildAutomatik: true, fassung: 0 });
    expect(veraltet.statusCode).toBe(409);
    expect((await lies(erik.token)).profil).toMatchObject({
      bildAutomatik: false,
      fassung: aus.profil?.fassung,
    });
  });
});

describe("S3 · andere Profiländerungen lassen die Wahl stehen", () => {
  it("Einrichtung und Namenswechsel ohne das Feld — die Wahl „aus“ bleibt", async () => {
    const aus = await setze(erik.token, false, 0);
    const eingerichtet = await auf(erik.token, "PUT", {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: aus.profil?.fassung,
    });
    expect(eingerichtet.statusCode, eingerichtet.body).toBe(200);
    const e = eingerichtet.json() as Antwort;
    expect(e.profil).toMatchObject({ name: "Mia", bildAutomatik: false });

    const umbenannt = await auf(erik.token, "PUT", { name: "Nora", fassung: e.profil?.fassung });
    expect(umbenannt.statusCode, umbenannt.body).toBe(200);
    expect((await lies(erik.token)).profil).toMatchObject({ name: "Nora", bildAutomatik: false });
  });
});

describe("S4 · K4/K6 — die Wahl gehört dem eigenen Konto", () => {
  it("ein zweites Konto behält die Voreinstellung; fremde Kennung → 403", async () => {
    await setze(erik.token, false, 0);
    expect(await lies(vera.token)).toEqual({ profil: null, einrichtungOffen: true });

    const fremd = await auf(vera.token, "PUT", {
      bildAutomatik: false,
      fassung: 0,
      kontoId: erik.id,
    });
    expect(fremd.statusCode).toBe(403);
    expect(await lies(vera.token)).toEqual({ profil: null, einrichtungOffen: true });
    expect((await lies(erik.token)).profil?.bildAutomatik).toBe(false);
  });
});
