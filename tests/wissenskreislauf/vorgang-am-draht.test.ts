// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — DER ARBEITSWEG MIT GETRENNTEN ROLLEN, AM DRAHT.
// ================================================================================================
//
// Ein Durchlauf über die ECHTEN Routen (`buildApp(buildServices())`), mit fiktiven Konten:
//   admin (Verwaltung), frida und fritz (fragen dieselbe Frage), fachmann (Fachzuständigkeit),
//   betrachter (Rolle viewer — keine berechtigte Fachzuständigkeit), fremd (unbeteiligt).
// Die Fachprüfung läuft über die vorhandene Bewertung (`ValidationService.rate`) mit fiktiven
// Prüfenden — derselbe Weg wie das Prüfboard, kein Sonderweg.
//
// Frage → Lücke → (fehlende Zuständigkeit sichtbar) → Übergabe (unberechtigtes Ziel abgewiesen,
// Doppelklick ohne Kopie) → Rückfrage → Antwort → Entwurf → Abschluss ohne Freigabe abgewiesen →
// vorgeschriebene Freigabe → fachlicher Abschluss (Wiederholung ohne zweiten) → je EINE Meldung an
// beide Fragenden → Wiederholungsfrage nutzt denselben Eintrag → Rechteentzug: keine Meldung, kein
// Ergebnis, Wiederaufnahme als neue Lücke → administrative Rücknahme getrennt erkennbar.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// Kunstwörter: kein Bestandseintrag kann diese Frage zufällig beantworten.
const FRAGE = "Wie stelle ich den Zyrlax-Kreislauf der Quorbit-Presse nach dem Stillstand ein?";

type App = ReturnType<typeof buildApp>;
interface Konto {
  headers: Record<string, string>;
  id: string;
}
interface Meldung {
  id: string;
  kind: string;
  lueckenArt?: string;
  gapId?: string;
  koId?: string;
  title: string;
}

async function anmelden(app: App, email: string): Promise<Konto> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return { headers: { authorization: `Bearer ${login.json().token}` }, id: login.json().user.id };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@fiktiv.de", password: "secret123" },
  });
  const admin = await anmelden(app, "admin@fiktiv.de");
  for (const [name, email, role] of [
    ["Frida Fiktiv", "frida@fiktiv.de", "experte"],
    ["Fritz Fiktiv", "fritz@fiktiv.de", "experte"],
    ["Fachmann Fiktiv", "fachmann@fiktiv.de", "experte"],
    ["Betrachter Fiktiv", "betrachter@fiktiv.de", "viewer"],
    ["Fremd Fiktiv", "fremd@fiktiv.de", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name, email, password: "secret123", role },
    });
    expect(res.statusCode, res.body).toBeLessThan(300);
  }
  return {
    app,
    services,
    admin,
    frida: await anmelden(app, "frida@fiktiv.de"),
    fritz: await anmelden(app, "fritz@fiktiv.de"),
    fachmann: await anmelden(app, "fachmann@fiktiv.de"),
    betrachter: await anmelden(app, "betrachter@fiktiv.de"),
    fremd: await anmelden(app, "fremd@fiktiv.de"),
  };
}

const vorgang = (app: App, k: Konto, id: string) =>
  app.inject({ method: "GET", url: `/api/gaps/${id}/vorgang`, headers: k.headers });
const post = (app: App, k: Konto, url: string, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url, headers: k.headers, payload });
const fragen = (app: App, k: Konto) => post(app, k, "/api/ask", { question: FRAGE });
async function meldungen(app: App, k: Konto): Promise<Meldung[]> {
  const res = await app.inject({ method: "GET", url: "/api/notifications", headers: k.headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as Meldung[]).filter((m) => m.kind === "luecke");
}

describe("Wissenskreislauf · Frage bis Rückmeldung mit getrennten Rollen", () => {
  it("der zusammenhängende Arbeitsweg samt Gegenfällen", async () => {
    const b = await buehne();
    const { app } = b;

    // --- Frage → Lücke; dieselbe Frage einer zweiten Person ist DIESELBE Lücke --------------
    const erste = await fragen(app, b.frida);
    expect(erste.statusCode, erste.body).toBe(200);
    const gapId = erste.json().gap.id as string;
    const zweite = await fragen(app, b.fritz);
    expect(zweite.json().gap.id).toBe(gapId);
    expect(zweite.json().gap.askCount).toBe(2);
    expect(zweite.body).not.toContain(b.frida.id);

    // --- Fehlende Zuständigkeit ist sichtbar; Unbeteiligte erfahren nichts --------------------
    const anfang = await vorgang(app, b.frida, gapId);
    expect(anfang.statusCode, anfang.body).toBe(200);
    expect(anfang.json()).toMatchObject({
      phase: "ohne_zustaendigkeit",
      naechsterSchritt: "zustaendigkeit_uebergeben",
      rollen: ["fragend"],
      fragende: 2,
      question: FRAGE,
    });
    const fremd = await vorgang(app, b.fremd, gapId);
    expect(fremd.statusCode).toBe(404);
    expect(fremd.body).not.toContain("Zyrlax");

    // --- Übergabe: unberechtigtes Ziel abgewiesen, berechtigtes angenommen, Doppelklick ohne Kopie
    const unberechtigt = await post(app, b.frida, `/api/gaps/${gapId}/uebergeben`, {
      expertId: b.betrachter.id,
    });
    expect(unberechtigt.statusCode, unberechtigt.body).toBe(400);
    for (let i = 0; i < 2; i++) {
      const ok = await post(app, b.frida, `/api/gaps/${gapId}/uebergeben`, {
        expertId: b.fachmann.id,
      });
      expect(ok.statusCode, ok.body).toBe(200);
      expect(ok.json().phase).toBe("in_bearbeitung");
      expect(ok.json().zuordnungen).toHaveLength(1);
    }
    // Eine verfügbare Zuständigkeit nimmt ein anderer Fragender nicht weg.
    const wegnehmen = await post(app, b.fritz, `/api/gaps/${gapId}/uebergeben`, {
      expertId: b.admin.id,
    });
    expect(wegnehmen.statusCode, wegnehmen.body).toBe(403);

    // --- Rückfrage der zuständigen Person, Antwort einer Fragenden, Meldungen in beide Richtungen
    const rf = await post(app, b.fachmann, `/api/gaps/${gapId}/rueckfrage`, {
      frage: "Welche Baureihe der Quorbit-Presse ist gemeint?",
    });
    expect(rf.statusCode, rf.body).toBe(200);
    expect(rf.json().phase).toBe("rueckfrage_offen");
    const rueckfrageId = rf.json().rueckfragen[0].id as string;
    for (const k of [b.frida, b.fritz]) {
      expect((await meldungen(app, k)).map((m) => m.lueckenArt)).toEqual(["rueckfrage"]);
    }
    expect(await meldungen(app, b.fremd)).toEqual([]);
    const antwort = await post(
      app,
      b.frida,
      `/api/gaps/${gapId}/rueckfrage/${rueckfrageId}/antwort`,
      { antwort: "Baureihe 4, Werk Nord." },
    );
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect((await meldungen(app, b.fachmann)).map((m) => m.lueckenArt)).toEqual([
      "rueckfrage_beantwortet",
    ]);

    // --- Antwortentwurf über die vorhandene Erfassung → verknüpft, Abschluss ohne Freigabe nein --
    // Kein Wort gemeinsam mit der Frage — die Wiederholungsfrage beantwortet sonst die Suche selbst.
    const ko = await b.services.ko.create({
      title: "Kälteanlage im Wiederanlauf hochfahren",
      statement: "Ventil V7 erst bei Druckausgleich öffnen, dann Pumpe P2 starten.",
      type: "best_practice",
      category: "Instandhaltung",
      author: b.fachmann.id,
    });
    const verknuepft = await post(app, b.fachmann, `/api/gaps/${gapId}/entwurf`, { koId: ko.id });
    expect(verknuepft.statusCode, verknuepft.body).toBe(200);
    expect(verknuepft.json().phase).toBe("in_fachpruefung");
    const zuFrueh = await post(app, b.fachmann, `/api/gaps/${gapId}/abschliessen`, {});
    expect(zuFrueh.statusCode, zuFrueh.body).toBe(400);
    expect(zuFrueh.json().gruende).toEqual(
      expect.arrayContaining(["nicht_freigegeben", "bewertungen_fehlen"]),
    );
    expect(await meldungen(app, b.frida)).toEqual([]);

    // --- Vorgeschriebene Fachfreigabe (aktuelle Fassung) → fachlicher Abschluss, einmal --------
    for (let i = 0; i < ko.neededValidations; i++) {
      await b.services.validation.rate(ko.id, `pruefer-fiktiv-${i}`, "up");
    }
    expect((await vorgang(app, b.fachmann, gapId)).json().phase).toBe("bereit_zum_abschluss");
    for (let i = 0; i < 2; i++) {
      const zu = await post(app, b.fachmann, `/api/gaps/${gapId}/abschliessen`, {});
      expect(zu.statusCode, zu.body).toBe(200);
      expect(zu.json()).toMatchObject({
        phase: "geloest",
        abschluss: { art: "fachlich", koVersion: ko.version },
        ergebnis: { koId: ko.id, nutzbarkeit: { nutzbar: true } },
      });
    }
    expect(await b.services.audit.list({ action: "gap.closed" })).toHaveLength(1);

    // --- Je EINE Erfolgsmeldung an beide Fragenden, mit dem nutzbaren Eintrag -----------------
    for (const k of [b.frida, b.fritz]) {
      const geloest = (await meldungen(app, k)).filter((m) => m.lueckenArt === "geloest");
      expect(geloest).toHaveLength(1);
      expect(geloest[0]).toMatchObject({ koId: ko.id, gapId, title: ko.title });
    }
    expect(await meldungen(app, b.fremd)).toEqual([]);
    const liste = await app.inject({ method: "GET", url: "/api/gaps", headers: b.frida.headers });
    expect(
      (liste.json() as { id: string; abschlussArt?: string }[]).find((g) => g.id === gapId)
        ?.abschlussArt,
    ).toBe("fachlich");

    // --- Wiederholungsfrage nutzt denselben gültigen Eintrag, keine neue Lücke ----------------
    const wieder = await fragen(app, b.fritz);
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json().gap).toBeNull();
    expect(wieder.json().geloesteLuecke).toMatchObject({ koId: ko.id, koVersion: ko.version });

    // --- Rechteentzug: vertraulich → keine Erfolgsmeldung, kein Ergebnis, Wiederaufnahme ------
    await b.services.ko.setConfidentiality(ko.id, "vertraulich", b.admin.id);
    expect((await meldungen(app, b.fritz)).filter((m) => m.lueckenArt === "geloest")).toEqual([]);
    const gesperrt = await vorgang(app, b.fritz, gapId);
    expect(gesperrt.json().ergebnis).toEqual({ zugaenglich: false });
    expect(gesperrt.body).not.toContain(ko.title);
    const neu = await fragen(app, b.fritz);
    expect(neu.json().geloesteLuecke).toBeUndefined();
    const neueLuecke = neu.json().gap.id as string;
    expect(neueLuecke).not.toBe(gapId);
    // Die zuständige Autorin sieht ihr vertrauliches Ergebnis weiterhin.
    expect((await vorgang(app, b.fachmann, gapId)).json().ergebnis.koId).toBe(ko.id);

    // --- Administrative Rücknahme: eigener Grund, nicht „gelöst", keine Erfolgsmeldung --------
    const ohneRecht = await app.inject({
      method: "PUT",
      url: `/api/gaps/${neueLuecke}`,
      headers: b.fachmann.headers,
      payload: { action: "withdraw", grund: "dublette" },
    });
    expect(ohneRecht.statusCode).toBe(403);
    const zurueck = await app.inject({
      method: "PUT",
      url: `/api/gaps/${neueLuecke}`,
      headers: b.admin.headers,
      payload: { action: "withdraw", grund: "dublette" },
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect(zurueck.json()).toMatchObject({ status: "geschlossen", abschlussArt: "administrativ" });
    expect(zurueck.body).not.toContain(b.fritz.id);
    const fritzSicht = (await vorgang(app, b.fritz, neueLuecke)).json();
    expect(fritzSicht).toMatchObject({
      phase: "zurueckgenommen",
      abschluss: { art: "administrativ", grund: "dublette" },
      ergebnis: null,
    });
    expect((await meldungen(app, b.fritz)).filter((m) => m.lueckenArt === "geloest")).toEqual([]);
  });
});
