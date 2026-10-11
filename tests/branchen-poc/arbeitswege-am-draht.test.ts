// ================================================================================================
// produkt:20261010:branchen-poc-arbeitswege — DIE DREI ARBEITSGESCHICHTEN, AM DRAHT.
// ================================================================================================
//
// AGENTENPROBE, KEINE ECHTE NUTZUNG: ein automatisierter Durchlauf über die ECHTEN Routen
// (`buildApp(buildServices())`, In-Memory, deterministischer Antwortweg ohne Modell). Er belegt,
// dass die Geschichten vom definierten Ausgangsbestand aus mit den vorgesehenen Rollen bis zum
// Abschluss durchlaufen. Er misst KEINE Bediendauer, keinen Hilfebedarf und kein Verständnis von
// Menschen — das Messprotokoll dafür steht in docs/poc/branchen-poc-arbeitswege.md und ist offen.
//
// Ausgangsbestand = „Demodaten laden" (`POST /api/admin/demo-seed`) durch die Verwaltung; Rollen
// sind die Demo-Konten dieses Ladevorgangs (Einmalkennwörter aus der Antwort):
//   Ada   (Verwaltung, lädt den Bestand, hat die Demo-Lückenfrage gestellt)
//   Carla (Controller: fragt, prüft fachlich, meldet die Quellenänderung)
//   Erik  (Experte: Fachzuständigkeit, beantwortet die Lücke, prüft die Folgefälle)
//
//   Geschichte 1  Quellenantwort mit Fundstelle, Fassung und Prüfstand; eine Frage ohne Quelle
//                 bekommt keine Referenz, sondern wird Lücke.
//   Geschichte 2  Lücke → Übergabe → Rückfrage → Antwort → Entwurf → Fachprüfung → Abschluss →
//                 Meldung → Wiederholung zeigt den abgeschlossenen Stand.
//   Geschichte 3  Fassung 2 der Betriebsanleitung → genau die zwei gekoppelten Einträge betroffen,
//                 begründet; der unbeteiligte nicht; gezielte Folgeprüfung beider Fälle.
//   Wiederholung  Erneutes Laden (force) stellt den Ausgangsbestand her; echte Arbeit bleibt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  DEMO_TEXTS,
  POC_ANLAGE,
  POC_ANLAGE_UNBETEILIGT,
  POC_TAG,
} from "../../services/app/src/demo-content";
import type { KnowledgeRef } from "../../services/reasoner";
import { queryTokens, rankCandidates } from "../../services/reasoner";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;
interface Konto {
  headers: Kopf;
  id: string;
}
interface Ko {
  id: string;
  title: string;
  status: string;
  version: number;
  tags?: string[];
  asset?: string;
  sources?: { label: string; url: string | null; excerpt: string | null }[];
}
interface Fundstelle {
  art: string;
  koId: string;
  koVersion: number;
  feld?: string;
  start?: number;
  ende?: number;
  fingerabdruck?: string;
  link?: string;
}
interface Fall {
  koId: string;
  version: number;
  stand: number;
  zustaendig: { name: string | null; vorhanden: boolean };
  anlaesse: { grund: string; assetRef: string | null; aenderung: string | null }[];
}
interface Meldung {
  kind: string;
  lueckenArt?: string;
  gapId?: string;
  koId?: string;
}

const t = DEMO_TEXTS.de;
const p = t.poc;
const KENNWORT_ADA = "geheim-poc-12345";

interface Ladeantwort {
  skipped: boolean;
  einmalkennwoerter: { email: string; kennwort: string }[];
}

async function anmelden(app: App, email: string, password: string): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode, res.body).toBe(200);
  const body = res.json() as { token: string; user: { id: string } };
  return { headers: { authorization: `Bearer ${body.token}` }, id: body.user.id };
}

function kennwortAus(seed: Ladeantwort, email: string): string {
  const zugang = seed.einmalkennwoerter.find((z) => z.email === email);
  expect(zugang, `kein Einmalkennwort für ${email} in der Ladeantwort`).toBeDefined();
  return zugang?.kennwort ?? "";
}

const post = (app: App, k: Konto, url: string, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url, headers: k.headers, payload });
const put = (app: App, k: Konto, url: string, payload: Record<string, unknown>) =>
  app.inject({ method: "PUT", url, headers: k.headers, payload });
const lies = (app: App, k: Konto, url: string) =>
  app.inject({ method: "GET", url, headers: k.headers });

async function demodatenLaden(app: App, ada: Konto, force: boolean): Promise<Ladeantwort> {
  const res = await post(app, ada, "/api/admin/demo-seed", force ? { force: true } : {});
  expect(res.statusCode, res.body).toBe(200);
  const body = res.json() as Ladeantwort;
  expect(body.skipped).toBe(false);
  return body;
}

async function pocEintraege(app: App, k: Konto) {
  const res = await lies(app, k, "/api/kos");
  expect(res.statusCode, res.body).toBe(200);
  const alle = (res.json() as Ko[]).filter((ko) => (ko.tags ?? []).includes(POC_TAG));
  const nachTitel = (titel: string): Ko => {
    const treffer = alle.filter((ko) => ko.title === titel);
    expect(treffer, `PoC-Eintrag „${titel}" nicht genau einmal im Bestand`).toHaveLength(1);
    return treffer[0] as Ko;
  };
  return {
    alle,
    quelle: nachTitel(p.koQuelle.title),
    a: nachTitel(p.koAnlageA.title),
    b: nachTitel(p.koAnlageB.title),
    c: nachTitel(p.koUnbeteiligt.title),
  };
}

async function folgefaelle(app: App, k: Konto): Promise<Fall[]> {
  const res = await lies(app, k, "/api/lifecycle/folgepruefung");
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Fall[];
}

async function lueckenMeldungen(app: App, k: Konto): Promise<Meldung[]> {
  const res = await lies(app, k, "/api/notifications");
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as Meldung[]).filter((m) => m.kind === "luecke");
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@musterwerk.test", password: KENNWORT_ADA },
  });
  const ada = await anmelden(app, "ada@musterwerk.test", KENNWORT_ADA);

  // „Echte Arbeit" VOR dem Laden: ein eigener Eintrag der Verwaltung. Er darf durch keinen
  // Demo-Durchlauf verändert oder entfernt werden.
  const echt = await post(app, ada, "/api/kos", {
    confidentiality: "intern",
    title: "Eigener Eintrag: Pausenraum Halle 2 freitags reinigen",
    statement: "Der Pausenraum in Halle 2 wird freitags zum Dienstende gereinigt.",
    type: "best_practice",
    category: "Eigene Erfassung",
  });
  expect(echt.statusCode, echt.body).toBe(201);
  const echtKo = echt.json() as Ko;

  const seed = await demodatenLaden(app, ada, false);
  const demoKonto = (email: string) => anmelden(app, email, kennwortAus(seed, email));
  const carla = await demoKonto("carla@demo.klarwerk");
  const erik = await demoKonto("erik@demo.klarwerk");
  return { services, app, ada, carla, erik, echtKo };
}

describe("Branchen-PoC · Wortwahl je Sprache (Antwortsuche des Produkts)", () => {
  const ref = (id: string, text: { title: string; statement: string }): KnowledgeRef => ({
    id,
    title: text.title,
    statement: text.statement,
    status: "validiert",
    trust: 100,
  });
  for (const locale of ["de", "en", "nl"] as const) {
    const s = DEMO_TEXTS[locale];
    const bestand = [
      ref("quelle", s.poc.koQuelle),
      ref("a", s.poc.koAnlageA),
      ref("b", s.poc.koAnlageB),
      ref("c", s.poc.koUnbeteiligt),
      ref("antwort", s.poc.lueckenAntwort),
    ];

    it(`[${locale}] die typische Frage findet die Antwortquelle (Geschichte 1)`, () => {
      expect(rankCandidates(s.poc.quellenFrage, bestand).map((x) => x.ref.id)).toContain("quelle");
    });

    it(`[${locale}] die Demo-Lückenfrage trifft keinen PoC-Text (Geschichte 2)`, () => {
      // Sonst entstünde keine Lücke, oder die Wiederholungsfrage würde von der Suche beantwortet
      // statt vom Lückenabschluss — die Geschichte bewiese dann nichts.
      expect(rankCandidates(s.gapQuestion, bestand)).toEqual([]);
      const frage = new Set(queryTokens(s.gapQuestion));
      for (const eintrag of bestand) {
        const gemeinsam = queryTokens(`${eintrag.title} ${eintrag.statement}`).filter((w) =>
          frage.has(w),
        );
        expect(gemeinsam, `${locale}/${eintrag.id}`).toEqual([]);
      }
    });
  }
});

describe("Branchen-PoC · Ausgangsbestand der fiktiven Musterorganisation", () => {
  it("K1 · Fragen, Quellen, Verantwortung und Rollen passen zusammen; alles als Demo markiert", async () => {
    const { services, app, ada } = await buehne();
    const poc = await pocEintraege(app, ada);
    expect(poc.alle).toHaveLength(4);
    for (const ko of poc.alle) {
      // Fiktiver Bestand auf dem bestehenden Demo-Weg: derselbe Herkunftsmerker wie der Rest.
      expect(ko.tags).toContain("pilot-demo");
      expect(ko.status).toBe("validiert");
    }
    // Geschichte 1: Quelle mit Bezeichnung und wörtlichem Auszug — und KEINE erfundene Adresse.
    const detail = (await lies(app, ada, `/api/kos/${poc.quelle.id}`)).json() as Ko;
    expect(detail.sources).toEqual([
      expect.objectContaining({ label: p.quelleLabel, url: null, excerpt: p.koQuelle.statement }),
    ]);
    // Geschichte 3: Ausgangsstand „aktuell" — der Bestand meldet selbst keine Änderung.
    const offen = (await folgefaelle(app, ada)).map((f) => f.koId);
    for (const ko of [poc.a, poc.b, poc.c]) {
      expect(offen).not.toContain(ko.id);
    }
    // Geschichte 2: Start ist die vorhandene, offene Demo-Lücke.
    const demoLuecken = (await services.ask.listGaps()).filter((g) => g.demoSeed === true);
    expect(demoLuecken.map((g) => [g.question, g.status])).toEqual([[t.gapQuestion, "offen"]]);
  });
});

describe("Branchen-PoC · die drei Arbeitsgeschichten mit getrennten Rollen", () => {
  it("Geschichten 1–3, persönliche Assistenz, erneuter Ladevorgang", async () => {
    const { services, app, ada, carla, erik, echtKo } = await buehne();
    const poc = await pocEintraege(app, ada);

    // ============================== GESCHICHTE 1 · QUELLENANTWORT ==============================
    const antwort = await post(app, carla, "/api/ask", { question: p.quellenFrage });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const a1 = antwort.json() as {
      result: {
        answered: boolean;
        citedSources: string[];
        belastbarkeit: {
          lage: string;
          quellen: { koId: string; version: number; validiert: boolean }[];
        };
      };
      quellenStand: Record<string, number>;
      aussagen: { aussagen: { teile: { fundstellen: Fundstelle[] }[] }[] };
    };
    expect(a1.result.answered).toBe(true);
    expect(a1.result.citedSources).toContain(poc.quelle.id);
    // Quellenfassung: die Antwort ist an die geprüfte Fassung gebunden.
    expect(a1.quellenStand[poc.quelle.id]).toBe(poc.quelle.version);
    // Verständlicher Prüfstand: belegt, und die tragende Quelle ist validiert.
    expect(a1.result.belastbarkeit.lage).toMatch(/^belegt/);
    expect(a1.result.belastbarkeit.quellen).toContainEqual(
      expect.objectContaining({
        koId: poc.quelle.id,
        version: poc.quelle.version,
        validiert: true,
      }),
    );
    // Aufrufbare Quelle: die Fundstelle führt in den Eintrag, mit Stelle und Fassung …
    const fundstelle = a1.aussagen.aussagen
      .flatMap((x) => x.teile.flatMap((teil) => teil.fundstellen))
      .find((f) => f.art === "intern" && f.koId === poc.quelle.id);
    expect(fundstelle, JSON.stringify(a1.aussagen)).toBeDefined();
    const link = new URL(fundstelle?.link ?? "", "https://poc.klarwerk.test");
    expect(link.pathname).toBe(`/wissen/${poc.quelle.id}`);
    expect(link.searchParams.get("fassung")).toBe(String(poc.quelle.version));
    // … und löst sich mit den Rechten der Fragenden als „aktuell" auf.
    const aufgeloest = await post(app, carla, "/api/ask/fundstellen", {
      fundstellen: [
        {
          art: fundstelle?.art,
          koId: fundstelle?.koId,
          koVersion: fundstelle?.koVersion,
          feld: fundstelle?.feld,
          start: fundstelle?.start,
          ende: fundstelle?.ende,
          fingerabdruck: fundstelle?.fingerabdruck,
        },
      ],
    });
    expect(aufgeloest.statusCode, aufgeloest.body).toBe(200);
    expect(aufgeloest.json().fundstellen[0]).toMatchObject({
      zustand: "aktuell",
      koId: poc.quelle.id,
    });

    // Gegenfall: eine Frage ohne Quelle bekommt KEINE Referenz — sie bleibt eine Lücke.
    const ohneQuelle = await post(app, ada, "/api/ask", { question: t.gapQuestion });
    expect(ohneQuelle.statusCode, ohneQuelle.body).toBe(200);
    const o1 = ohneQuelle.json() as {
      gap: { id: string } | null;
      result?: { answered?: boolean; citedSources?: string[] };
    };
    expect(o1.gap).not.toBeNull();
    expect(o1.result?.answered ?? false).toBe(false);
    expect(o1.result?.citedSources ?? []).toEqual([]);
    const gapId = o1.gap?.id ?? "";

    // ============================ GESCHICHTE 2 · LÜCKENABSCHLUSS ===============================
    const vorgang = (k: Konto) => lies(app, k, `/api/gaps/${gapId}/vorgang`);
    expect((await vorgang(ada)).json()).toMatchObject({
      phase: "ohne_zustaendigkeit",
      question: t.gapQuestion,
    });
    const uebergabe = await post(app, ada, `/api/gaps/${gapId}/uebergeben`, { expertId: erik.id });
    expect(uebergabe.statusCode, uebergabe.body).toBe(200);
    expect(uebergabe.json().phase).toBe("in_bearbeitung");

    const rf = await post(app, erik, `/api/gaps/${gapId}/rueckfrage`, { frage: p.rueckfrage });
    expect(rf.statusCode, rf.body).toBe(200);
    expect(rf.json().phase).toBe("rueckfrage_offen");
    expect((await lueckenMeldungen(app, ada)).map((m) => m.lueckenArt)).toContain("rueckfrage");
    const rueckfrageId = rf.json().rueckfragen[0].id as string;
    const antwortRf = await post(
      app,
      ada,
      `/api/gaps/${gapId}/rueckfrage/${rueckfrageId}/antwort`,
      { antwort: p.rueckfrageAntwort },
    );
    expect(antwortRf.statusCode, antwortRf.body).toBe(200);

    // Die Fachzuständigkeit erfasst den Eintrag über die vorhandene Erfassung und verknüpft ihn.
    const erfasst = await post(app, erik, "/api/kos", {
      confidentiality: "intern",
      title: p.lueckenAntwort.title,
      statement: p.lueckenAntwort.statement,
      type: "best_practice",
      category: "Musterwerk Nordtal (fiktiv)",
      neededValidations: 2,
    });
    expect(erfasst.statusCode, erfasst.body).toBe(201);
    const antwortKo = erfasst.json() as Ko;
    const entwurf = await post(app, erik, `/api/gaps/${gapId}/entwurf`, { koId: antwortKo.id });
    expect(entwurf.statusCode, entwurf.body).toBe(200);
    expect(entwurf.json().phase).toBe("in_fachpruefung");
    // Keine manuelle Fertigmeldung: ohne Fachprüfung kein Abschluss.
    const zuFrueh = await post(app, erik, `/api/gaps/${gapId}/abschliessen`, {});
    expect(zuFrueh.statusCode, zuFrueh.body).toBe(400);

    // Fachprüfung über die vorhandene Bewertung (Carla, Ada).
    for (const pruefer of [carla, ada]) {
      const bewertet = await put(app, pruefer, `/api/kos/${antwortKo.id}`, {
        action: "rate",
        verdict: "up",
      });
      expect(bewertet.statusCode, bewertet.body).toBe(200);
    }
    expect((await vorgang(erik)).json().phase).toBe("bereit_zum_abschluss");
    const abschluss = await post(app, erik, `/api/gaps/${gapId}/abschliessen`, {});
    expect(abschluss.statusCode, abschluss.body).toBe(200);
    expect(abschluss.json()).toMatchObject({
      phase: "geloest",
      abschluss: { art: "fachlich" },
      ergebnis: { koId: antwortKo.id, nutzbarkeit: { nutzbar: true } },
    });

    // Meldung an die Fragende — genau eine, mit dem nutzbaren Eintrag.
    const geloest = (await lueckenMeldungen(app, ada)).filter((m) => m.lueckenArt === "geloest");
    expect(geloest).toHaveLength(1);
    expect(geloest[0]).toMatchObject({ gapId, koId: antwortKo.id });

    // Spätere Wiederholung: der abgeschlossene Wissensstand, keine neue Lücke.
    const wieder = await post(app, ada, "/api/ask", { question: t.gapQuestion });
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json().gap).toBeNull();
    expect(wieder.json().geloesteLuecke).toMatchObject({ koId: antwortKo.id });

    // =========================== GESCHICHTE 3 · QUELLENÄNDERUNG ================================
    const gemeldet = await post(app, carla, "/api/lifecycle/asset-changed", {
      assetRef: POC_ANLAGE,
      aenderung: p.anlageAenderung,
    });
    expect(gemeldet.statusCode, gemeldet.body).toBe(200);
    expect((gemeldet.json() as string[]).sort()).toEqual([poc.a.id, poc.b.id].sort());

    const faelle = await folgefaelle(app, erik);
    const ids = faelle.map((f) => f.koId);
    expect(ids).toContain(poc.a.id);
    expect(ids).toContain(poc.b.id);
    // Unbeteiligt bleibt unbetroffen — auch die Antwortquelle aus Geschichte 1.
    expect(ids).not.toContain(poc.c.id);
    expect(ids).not.toContain(poc.quelle.id);
    for (const ko of [poc.a, poc.b]) {
      expect(faelle.find((f) => f.koId === ko.id)).toMatchObject({
        stand: 1,
        zustaendig: { name: "Erik Experte", vorhanden: true },
        anlaesse: [{ grund: "anlage", assetRef: POC_ANLAGE, aenderung: p.anlageAenderung }],
      });
    }
    const cDetail = (await lies(app, erik, `/api/kos/${poc.c.id}`)).json() as Ko;
    expect(cDetail.status).toBe("validiert");
    expect(cDetail.asset).toBe(POC_ANLAGE_UNBETEILIGT);

    // Folgeprüfung A: inhaltlich weiter gültig → bestätigt für genau den gesehenen Stand.
    const fallA = faelle.find((f) => f.koId === poc.a.id) as Fall;
    const bestaetigt = await put(app, erik, `/api/kos/${poc.a.id}`, {
      action: "revalidate",
      stand: fallA.stand,
      fassung: fallA.version,
    });
    expect(bestaetigt.statusCode, bestaetigt.body).toBe(200);

    // Folgeprüfung B: an Fassung 2 angepasst → neue Fassung, dann für sie bestätigt.
    const fallB = faelle.find((f) => f.koId === poc.b.id) as Fall;
    const ueberarbeitet = await put(app, erik, `/api/kos/${poc.b.id}`, {
      action: "revise",
      changes: { statement: p.koAnlageBNeu },
    });
    expect(ueberarbeitet.statusCode, ueberarbeitet.body).toBe(200);
    const alteFassung = await put(app, erik, `/api/kos/${poc.b.id}`, {
      action: "revalidate",
      stand: fallB.stand,
      fassung: fallB.version,
    });
    expect(alteFassung.statusCode, "die alte Fassung zeichnet die neue nicht frei").toBe(409);
    const neueFassung = (await folgefaelle(app, erik)).find((f) => f.koId === poc.b.id) as Fall;
    expect(neueFassung.version).toBe(fallB.version + 1);
    const bestaetigtB = await put(app, erik, `/api/kos/${poc.b.id}`, {
      action: "revalidate",
      stand: neueFassung.stand,
      fassung: neueFassung.version,
    });
    expect(bestaetigtB.statusCode, bestaetigtB.body).toBe(200);
    const nachher = (await folgefaelle(app, erik)).map((f) => f.koId);
    expect(nachher).not.toContain(poc.a.id);
    expect(nachher).not.toContain(poc.b.id);
    // Die überarbeitete Fassung braucht erneut die Fachprüfung — keine abgeschwächte Prüfung.
    for (const pruefer of [carla, ada]) {
      const bewertet = await put(app, pruefer, `/api/kos/${poc.b.id}`, {
        action: "rate",
        verdict: "up",
      });
      expect(bewertet.statusCode, bewertet.body).toBe(200);
    }
    const bNachPruefung = (await lies(app, erik, `/api/kos/${poc.b.id}`)).json() as Ko;
    expect(bNachPruefung.status).toBe("validiert");

    // ======================== PERSÖNLICHE ASSISTENZ (vorhandener Vertrag) =======================
    // Erik richtet Name und eines der dreizehn Motive ein; das Profil gehört seinem Konto.
    const profil = await put(app, erik, "/api/me/assistenz", {
      name: "Nora",
      avatar: "eule",
      bewegung: "standard",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(profil.statusCode, profil.body).toBe(200);
    expect((await lies(app, erik, "/api/me/assistenz")).json().profil).toMatchObject({
      name: "Nora",
      avatar: "eule",
    });
    expect((await lies(app, carla, "/api/me/assistenz")).json().profil).toBeNull();

    // ============================ ERNEUTER DURCHLAUF (force) ===================================
    await demodatenLaden(app, ada, true);
    const kos = (await lies(app, ada, "/api/kos")).json() as Ko[];
    // Echte Arbeit bleibt unverändert …
    const echtNachher = kos.find((k) => k.id === echtKo.id);
    expect(echtNachher).toMatchObject({ title: echtKo.title, version: echtKo.version });
    // … auch der im Durchlauf erfasste Antworteintrag (er ist kein Demo-Bestand).
    expect(kos.some((k) => k.id === antwortKo.id)).toBe(true);
    // Der PoC-Ausgangsbestand steht wieder: neue Einträge, validiert, ohne offene Folgeprüfung.
    const neu = await pocEintraege(app, ada);
    expect(neu.a.id).not.toBe(poc.a.id);
    const offenNeu = (await folgefaelle(app, ada)).map((f) => f.koId);
    for (const ko of [neu.a, neu.b, neu.c]) {
      expect(ko.status).toBe("validiert");
      expect(offenNeu).not.toContain(ko.id);
    }
    // Die Demo-Lücke ist wieder offen — Geschichte 2 ist wiederholbar.
    const demoLuecken = (await services.ask.listGaps()).filter((g) => g.demoSeed === true);
    expect(demoLuecken).toHaveLength(1);
    expect(demoLuecken[0]?.id).not.toBe(gapId);
    expect(demoLuecken[0]?.status).toBe("offen");
  });
});
