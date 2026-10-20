import { createHash } from "node:crypto";
import { canonicalJson } from "../../audit";
import type { KlaraAufgabeEingabe, KlaraAufgabeSchreibfreigabe } from "./klara-aufgabe";
import type { KlaraAuftrag, KlaraAuftragEingabe, KlaraDNormAuftragHerkunft } from "./klara-auftrag";
import { bindeAuftragsnotizen, liesAuftragsnotiz } from "./klara-auftragsnotiz";
import { KlaraAusfuehrung, type KlaraRufe } from "./klara-ausfuehrung";
import type {
  KlaraDNormAuftragsAntwort,
  KlaraDNormAuftragsEingabe,
  KlaraDNormAuftragsKontext,
  KlaraDNormAuftragsPort,
} from "./klara-d-normauftrag-vertrag";
import { type KlaraGespraechDienst, KlaraGespraechFehler } from "./klara-gespraech";
import type { NotizSchreibbedingung } from "./klara-notiz";

export type KlaraLaufsitzung = <T>(
  kontoId: string,
  arbeit: (rufe: KlaraRufe, setze: (freigabe: KlaraAufgabeSchreibfreigabe) => void) => Promise<T>,
) => Promise<T>;
export interface KlaraDNormAuftragsDeps {
  readonly gespraeche: KlaraGespraechDienst;
  readonly mitSitzung: KlaraLaufsitzung;
}
function gesperrt(grund: string): never {
  throw new KlaraGespraechFehler(409, "herkunft_gesperrt", grund);
}
function normal(roh: KlaraDNormAuftragsEingabe): KlaraDNormAuftragsEingabe {
  const text = (v: unknown, max = 200) => {
    if (typeof v !== "string" || !v.trim() || v.length > max)
      throw new KlaraGespraechFehler(400, "eingabe", "D-Auftragsbindung fehlt oder ist zu lang.");
    return v.trim();
  };
  const fassung = (v: unknown) => {
    if (!Number.isSafeInteger(v) || Number(v) < 1)
      throw new KlaraGespraechFehler(400, "eingabe", "Tatsächliche D-Fassung fehlt.");
    return Number(v);
  };
  return {
    kontoId: text(roh.kontoId),
    gespraechId: text(roh.gespraechId),
    erinnerungId: text(roh.erinnerungId),
    erinnerungFassung: fassung(roh.erinnerungFassung),
    routineFassung: fassung(roh.routineFassung),
    normId: text(roh.normId),
    ereignisId: text(roh.ereignisId),
    pruefVorgang: text(roh.pruefVorgang),
    notiz: { id: text(roh.notiz?.id), fassung: fassung(roh.notiz?.fassung) },
    titel: text(roh.titel),
  };
}
const abdruckVon = (e: KlaraDNormAuftragsEingabe) =>
  createHash("sha256").update(canonicalJson(e)).digest("hex");
const schluesselVon = (e: KlaraDNormAuftragsEingabe) =>
  `d-norm-${createHash("sha256").update(e.pruefVorgang).digest("hex")}`;

/** Enger Adapter am bestehenden G-Journal. Ohne echten D-Guard und Schreibbedingung keine Wirkung. */
export function dNormAuftragsPort(deps: KlaraDNormAuftragsDeps): KlaraDNormAuftragsPort {
  // Derselbe bestehende Schrittmutex für parallele D-Aufrufe; Guard bleibt je tatsächlichem Versuch.
  const ausfuehrung = new KlaraAusfuehrung(deps.gespraeche);
  async function original(e: KlaraDNormAuftragsEingabe) {
    try {
      return (
        (await deps.gespraeche.auftraege(e.kontoId, e.gespraechId)).find(
          (a) =>
            a.herkunft?.art === "d_normereignis" &&
            a.herkunft.eigentuemer === e.kontoId &&
            a.herkunft.pruefVorgang === e.pruefVorgang,
        ) ?? null
      );
    } catch (fehler) {
      if (fehler instanceof KlaraGespraechFehler && fehler.status === 404) return null;
      throw fehler;
    }
  }
  async function pruefe(
    k: KlaraDNormAuftragsKontext,
    e: KlaraDNormAuftragsEingabe,
    a: KlaraAuftrag | null,
    phase: "lesen" | "anlegen" | "wirken",
  ) {
    if (!k || typeof k.pruefe !== "function" || !k.vorkommenId || !k.besitzer)
      gesperrt("Der echte D-Laufnachweis fehlt.");
    if (phase !== "lesen" && !k.bedingung?.sql) gesperrt("Die D-Schreibbedingung fehlt.");
    try {
      await k.pruefe({ phase, eingabe: e, abdruck: abdruckVon(e), original: a });
    } catch (fehler) {
      if (fehler instanceof KlaraGespraechFehler) throw fehler;
      gesperrt(
        "Die ausdrückliche D-Bestellung, aktuelle Laufbindung oder Quelle ist nicht freigegeben.",
      );
    }
    if (phase !== "lesen" && k.bedingung.gilt?.() === false)
      gesperrt("Die ausdrückliche D-Bestellung oder aktuelle Laufbindung gilt nicht mehr.");
  }
  function antwort(
    e: KlaraDNormAuftragsEingabe,
    a: KlaraAuftrag,
    wiederholt: boolean,
  ): KlaraDNormAuftragsAntwort {
    const s = a.schritte.find((s) => s.nr === 1);
    return {
      referenz: {
        gespraechId: e.gespraechId,
        auftragId: a.id,
        nr: 1,
        schluessel: s?.schluessel ?? schluesselVon(e),
      },
      auftrag: a,
      schritt: s ?? null,
      wiederholt,
    };
  }
  async function liesErgebnis(a: KlaraAuftrag, rufe: KlaraRufe) {
    const s = a.schritte.find((s) => s.nr === 1);
    if (s?.ergebnis?.art !== "persoenliche_aufgabe") return;
    const r = await rufe("GET", `/api/me/klara/aufgaben/${encodeURIComponent(s.ergebnis.id)}`);
    const task = (r.daten as { aufgabe?: { id?: unknown } } | null)?.aufgabe;
    if (r.status !== 200 || task?.id !== s.ergebnis.id)
      gesperrt("Die gebundene Originalaufgabe ist nicht mehr lesbar. Keine Ersatzanlage.");
  }
  function plan(e: KlaraDNormAuftragsEingabe): KlaraAuftragEingabe {
    const ziel = {
      art: "neue_persoenliche_aufgabe" as const,
      id: null,
      titel: e.titel,
      stand: null,
      pfad: null,
    };
    return {
      quelle: "d_routine",
      wortlaut: `Gespeicherte ausdrückliche D-Bestellung: persönliche Prüfung zum Normereignis ${e.ereignisId}.`,
      ziel: e.titel,
      erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
      erlaubteZiele: [ziel],
      erlaubteQuellen: [`notiz:${e.notiz.id}`],
      ergebnis:
        "Eine tatsächliche persönliche Prüfaufgabe mit Originalbezug; keine fachliche Annahme.",
      geplanteSchritte: 1,
      plan: [
        {
          aktion: "persoenliche_aufgabe_anlegen",
          ziel,
          ausSchritt: null,
          notizQuelle: { weg: "geschrieben", id: e.notiz.id, fassung: e.notiz.fassung },
        },
      ],
    };
  }
  async function freigabe(
    e: KlaraDNormAuftragsEingabe,
    k: KlaraDNormAuftragsKontext,
    a: KlaraAuftrag,
    rufe: KlaraRufe,
  ): Promise<KlaraAufgabeSchreibfreigabe> {
    const jetzt = async () => {
      await pruefe(k, e, a, "wirken");
      await liesAuftragsnotiz(
        { weg: "geschrieben", id: e.notiz.id, fassung: e.notiz.fassung },
        rufe,
      );
      const aktuell = await deps.gespraeche.auftrag(e.kontoId, e.gespraechId, a.id);
      if (
        aktuell.abgebrochenAm ||
        aktuell.unterbrochenAm ||
        aktuell.fassung !== a.fassung ||
        aktuell.herkunft?.art !== "d_normereignis" ||
        aktuell.herkunft.abdruck !== abdruckVon(e) ||
        !aktuell.erlaubteAktionen.includes("persoenliche_aufgabe_anlegen") ||
        !aktuell.erlaubteQuellen.includes(`notiz:${e.notiz.id}`)
      )
        gesperrt("Die aktuelle G-Grenze oder der Stopp verhindert die neue D-Aufgabe.");
    };
    const bedingung: NotizSchreibbedingung = {
      ...(k.bedingung.gilt ? { gilt: () => k.bedingung.gilt?.() === true } : {}),
      sql(start) {
        const d = k.bedingung.sql?.(start);
        if (!d || !d.und.length) gesperrt("Die tatsächliche D-SQL-Bedingung fehlt.");
        const ix = start + d.params.length;
        return {
          params: [
            ...d.params,
            e.kontoId,
            e.gespraechId,
            a.id,
            a.fassung,
            abdruckVon(e),
            e.notiz.id,
            e.titel,
            e.notiz.fassung,
          ],
          und: [
            ...d.und,
            `EXISTS (SELECT 1 FROM klara_gespraeche dg WHERE dg.konto_id=$${ix} AND dg.id=$${ix + 1} AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(dg.data->'auftraege','[]'::jsonb)) da WHERE da->>'id'=$${ix + 2} AND (da->>'fassung')::int=$${ix + 3} AND da->>'abgebrochenAm' IS NULL AND da->>'unterbrochenAm' IS NULL AND da->'herkunft'->>'art'='d_normereignis' AND da->'herkunft'->>'abdruck'=$${ix + 4} AND da->'erlaubteAktionen' ? 'persoenliche_aufgabe_anlegen' AND da->'erlaubteQuellen' ? ('notiz:' || $${ix + 5}::text) AND da->'plan'->0->'ziel'->>'titel'=$${ix + 6} AND da->'plan'->0->>'aktion'='persoenliche_aufgabe_anlegen' AND da->'plan'->0->'notizQuelle'->>'id'=$${ix + 5} AND (da->'plan'->0->'notizQuelle'->>'fassung')::int=$${ix + 7}) FOR SHARE)`,
            `EXISTS (SELECT 1 FROM klara_notizen dqn WHERE dqn.konto_id=$${ix} AND dqn.id=$${ix + 5} AND dqn.fassung=$${ix + 7} FOR SHARE)`,
          ],
        };
      },
    };
    return {
      bedingung,
      async pruefe(x: KlaraAufgabeEingabe) {
        const ziel = x.quelle as { notizId?: unknown } | null;
        // Sitzungsbindung gilt ausschließlich für diesen einen tatsächlichen Planschritt.
        if (
          x.vorgang !== `klara-auftrag-${a.id}-1` ||
          x.weg !== "notiz" ||
          ziel?.notizId !== e.notiz.id ||
          x.notizFassung !== e.notiz.fassung ||
          x.titel !== e.titel ||
          x.inhalt !== undefined ||
          x.prioritaet !== undefined ||
          x.bereich !== undefined
        )
          gesperrt("Die D-Laufsitzung ist nicht für andere Aufgaben freigegeben.");
        await jetzt();
      },
    };
  }
  return {
    async eingang(roh, k) {
      const v = normal({ ...roh, gespraechId: "offen" });
      const id = `d-norm-${createHash("sha256")
        .update(JSON.stringify([v.kontoId, v.pruefVorgang]))
        .digest("hex")}`;
      const e = { ...v, gespraechId: id };
      return deps.mitSitzung(e.kontoId, async (rufe) => {
        await liesAuftragsnotiz(
          { weg: "geschrieben", id: e.notiz.id, fassung: e.notiz.fassung },
          rufe,
        );
        // D bindet Eingang/Abdruck vor G-Schreiben. Ein früheres echtes Original nie als null melden.
        const vorhanden = await original(e);
        if (vorhanden && vorhanden.herkunft?.abdruck !== abdruckVon(e))
          throw new KlaraGespraechFehler(
            409,
            "konflikt",
            "Der echte ursprüngliche D-Eingang gehört zu anderen Eingaben.",
          );
        await pruefe(k, e, vorhanden, "anlegen");
        const g = await deps.gespraeche.dNormEingang(e.kontoId, e.pruefVorgang, k.bedingung);
        if (g.id !== e.gespraechId) gesperrt("Abweichender kanonischer D-Eingang.");
        return e;
      });
    },
    async original(roh, k) {
      const e = normal(roh);
      return deps.mitSitzung(e.kontoId, async (rufe) => {
        const a = await original(e);
        await pruefe(k, e, a, "lesen");
        if (!a) return null;
        await liesErgebnis(a, rufe);
        return antwort(e, a, true);
      });
    },
    async ausfuehren(roh, k) {
      const e = normal(roh);
      return deps.mitSitzung(e.kontoId, async (rufe, setze) => {
        let a = await original(e);
        const warDa = !!a;
        await pruefe(k, e, a, "lesen");
        if (a && a.herkunft?.abdruck !== abdruckVon(e))
          throw new KlaraGespraechFehler(
            409,
            "konflikt",
            "Dieser Normvorgang gehört zu anderen gebundenen Eingaben. Original erhalten.",
          );
        if (!a) {
          const gebunden = await bindeAuftragsnotizen({ ...plan(e) }, rufe);
          await pruefe(k, e, null, "anlegen");
          const h: KlaraDNormAuftragHerkunft = {
            art: "d_normereignis",
            eigentuemer: e.kontoId,
            erinnerungId: e.erinnerungId,
            erinnerungFassung: e.erinnerungFassung,
            routineFassung: e.routineFassung,
            normId: e.normId,
            ereignisId: e.ereignisId,
            pruefVorgang: e.pruefVorgang,
            abdruck: abdruckVon(e),
          };
          a = await deps.gespraeche.legeAuftragAn(
            e.kontoId,
            e.gespraechId,
            gebunden,
            h,
            k.bedingung,
          );
        }
        await liesErgebnis(a, rufe);
        setze(await freigabe(e, k, a, rufe));
        const vorWirkung = async (
          konto: string,
          h: import("./klara-auftrag").KlaraServerAuftragHerkunft,
        ) => {
          if (konto !== e.kontoId || h.art !== "d_normereignis" || h.abdruck !== abdruckVon(e))
            return "Kein passender echter D-Herkunftsnachweis.";
          await pruefe(
            k,
            e,
            await deps.gespraeche.auftrag(e.kontoId, e.gespraechId, a.id),
            "wirken",
          );
          return null;
        };
        const r = await ausfuehrung.fuehreAus(
          e.kontoId,
          e.gespraechId,
          a.id,
          antwort(e, a, warDa).referenz.schluessel,
          { nr: 1, auftragFassung: a.fassung },
          rufe,
          { vorWirkung },
        );
        await liesErgebnis(r.auftrag, rufe);
        return {
          ...antwort(e, r.auftrag, warDa),
          schritt: r.schritt,
          wiederholt: warDa || r.wiederholt,
        };
      });
    },
  };
}
