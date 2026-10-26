// Eigener Nachweis: echte assistText-Kette mit kontrolliertem cappedModelClient, keine assistText-Attrappe.
import { expect, it } from "vitest";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import {
  cappedModelClient,
  mitModellKontext,
  resetModelBudgetForTests,
} from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
// KVS-S3 Beleg (Runde 2): EIN globaler, sequentieller Takt — bestellte Zusammenfassungen eines
// Kontos (Modell künstlich 300 ms) verzögern die schlichte Erinnerung eines anderen Kontos; die
// KI-Anfragebremse (HTTP-Hook) zählt diese Modellaufrufe nicht. Fiktive Daten, app.close().
process.env.KLARWERK_SELF_REGISTRATION = "1";
process.env.EXTERNAL_SEARCH = "off";
process.env.KLARWERK_DEMO_SEED = "1";
process.env.KLARWERK_LOG_LEVEL = "silent";
process.env.KLARWERK_SKIP_KEYCHAIN = "1";
const echt = Date.now.bind(Date);
let versatz = 0;
Date.now = () => echt() + versatz;
async function main() {
  const { assembleServices, buildApp, inMemoryRepos } = await import(
    "../../services/app/src/build-app"
  );
  const services = assembleServices(inMemoryRepos());
  let lauf: null | (() => Promise<KlaraErinnerungLaufbericht>) = null;
  const app = buildApp(services, {
    klaraErinnerungen: (l: () => Promise<KlaraErinnerungLaufbericht>) => {
      lauf = l;
      return 60_000;
    },
  });
  let modellAufrufe = 0;
  resetModelBudgetForTests();
  const client = cappedModelClient(
    {
      name: "lokal:fake",
      complete: async () => {
        modellAufrufe++;
        await new Promise((r) => setTimeout(r, modellAufrufe > 25 ? 300 : 1));
        return JSON.stringify({ text: "Legitime Kurzfassung", changes: [] });
      },
    },
    { rejectsConfidential: false },
  );
  services.reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(services.reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
  try {
    const PW = "Kvs-fiktiv-Kennwort-9";
    const auf = (
      tok: string | null,
      method: "GET" | "POST" | "PUT",
      url: string,
      payload?: Record<string, unknown>,
    ) =>
      app.inject({
        method,
        url,
        headers: tok ? { authorization: `Bearer ${tok}` } : {},
        ...(payload === undefined ? {} : { payload }),
      });
    const login = async (email: string) => {
      const r = await auf(null, "POST", "/api/auth/login", { email, password: PW });
      const token = r.json().token as string;
      const me = await auf(token, "GET", "/api/auth/me");
      return { id: me.json().id as string, token };
    };
    await auf(null, "POST", "/api/auth/register", {
      name: "Admin",
      email: "admin-kvs3@klarwerk.test",
      password: PW,
    });
    const admin = await login("admin-kvs3@klarwerk.test");
    for (const [n, e] of [
      ["Anna", "anna-kvs3@klarwerk.test"],
      ["Bert", "bert-kvs3@klarwerk.test"],
    ]) {
      await auf(admin.token, "POST", "/api/users", {
        name: n,
        email: e,
        password: PW,
        role: "experte",
      });
    }
    const anna = await login("anna-kvs3@klarwerk.test");
    const bert = await login("bert-kvs3@klarwerk.test");
    const d = new Date(Date.now() + 5 * 60_000).toISOString();
    const zeitplan = { art: "einmalig", datum: d.slice(0, 10), uhrzeit: d.slice(11, 16) };
    const N = 20;
    for (let i = 0; i < N; i += 1) {
      const n = await auf(anna.token, "POST", "/api/me/klara/notizen", {
        objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" },
        weg: "geschrieben",
        vorgang: `kvs3-notiz-${String(i).padStart(4, "0")}`,
        titel: `Fiktiv ${i}`,
        inhalt: `Fiktiver Inhalt ${i} `.repeat(20),
      });
      if (n.statusCode !== 201) throw new Error(`Notiz ${n.statusCode} ${n.body}`);
      const notizId = n.json().notiz.id as string;
      const r = await auf(anna.token, "POST", "/api/me/klara/erinnerungen", {
        vorgang: `kvs3-anna-${String(i).padStart(4, "0")}`,
        zeitzone: "UTC",
        zeitplan,
        bezug: { art: "notiz", notizId },
        aktion: "inhalt_zusammenfassen",
      });
      if (r.statusCode !== 201) throw new Error(`lege ${r.statusCode} ${r.body}`);
    }
    const rb = await auf(bert.token, "POST", "/api/me/klara/erinnerungen", {
      vorgang: "kvs3-bert-0001",
      titel: "Bert fiktiv",
      zeitzone: "UTC",
      zeitplan,
    });
    if (rb.statusCode !== 201) throw new Error(`lege bert ${rb.statusCode} ${rb.body}`);
    versatz = 6 * 60_000;
    for (let i = 0; i < 25; i++)
      await mitModellKontext({ actor: anna.id }, () => client.complete("s", "legitim", false));
    const vorlauf = modellAufrufe;
    const t0 = Date.now();
    if (!lauf) throw new Error("kein Lauf");
    const erster = (lauf as () => Promise<KlaraErinnerungLaufbericht>)();
    await new Promise((r) => setTimeout(r, 100));
    const zweiter = await (lauf as () => Promise<KlaraErinnerungLaufbericht>)();
    console.log(
      "S3-1 zweiter Takt waehrend des ersten:",
      JSON.stringify({ faellig: zweiter.faelligeErinnerungen, zugestellt: zweiter.zugestellt }),
    );
    const b = await erster;
    expect(zweiter.faelligeErinnerungen).toBe(0);
    expect(modellAufrufe - vorlauf).toBe(5);
    expect(b.faelligeErinnerungen).toBe(21);
    for (let i = 0; i < 4; i++) await (lauf as () => Promise<KlaraErinnerungLaufbericht>)();
    expect(modellAufrufe - vorlauf).toBe(5);

    console.log(
      "S3-2 erster Takt:",
      JSON.stringify({
        faellig: b.faelligeErinnerungen,
        zugestellt: b.zugestellt,
        teilweise: b.teilweise,
      }),
      "Dauer ms:",
      Date.now() - t0,
      "| Modellaufrufe:",
      modellAufrufe,
    );
    const gl = (await auf(bert.token, "GET", "/api/notifications")).json() as {
      kind: string;
      at: string;
    }[];
    const bm = gl.find((x) => x.kind === "erinnerung");
    expect(bm).toBeDefined();
    expect(Date.parse(bm!.at) - t0).toBeLessThan(100);
    expect(gl.filter((x) => x.kind === "erinnerung")).toHaveLength(1);
  } finally {
    await app.close();
    Date.now = echt;
    resetModelBudgetForTests();
  }
}
it(
  "Berts einfache Erinnerung kommt zuerst; Annas echte Hintergrund-Übertragungen teilen ihr endliches Kontobudget",
  main,
);
