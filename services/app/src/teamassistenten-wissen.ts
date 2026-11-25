import { AskError, type AskResult, type AskService, belegstellenLink } from "../../ask";
import type { SessionUser } from "../../auth";
import type { ConflictService } from "../../conflicts";
import {
  type GelernteHalbwertszeiten,
  type KnowledgeObject,
  type KoService,
  erkenneSchutzdaten,
  haltbarkeitAbgelaufen,
  isConfidential,
} from "../../knowledge-object";
import { type KnowledgeRef, rankCandidates } from "../../reasoner";
import { htmlToPlainText } from "../../structure";
import { darfSehen } from "./sichtbarkeit";
import type { TeamSprache, TeamassistentWissen } from "./teamassistenten";

export interface TeamAntwort {
  stand: "belegt" | "widerspruch" | "offen";
  text: string;
  quellen: { id: string; version: number; titel: string; auszug: string; href: string }[];
}

const texte = {
  de: {
    offen: "Die ausgewählten freigegebenen Quellen reichen für eine Antwort nicht aus.",
    belegt: "Die freigegebene Quelle bestätigt diese Aussage.",
    ja: "Ja. Die freigegebene Quelle bestätigt das.",
    nein: "Nein. Die freigegebene Quelle widerspricht dem.",
    fund: "In der freigegebenen Quelle steht:",
    widerspruch: "Die freigegebene Quelle widerspricht dieser Aussage.",
    konflikt: "Zu dieser Frage widersprechen sich die freigegebenen Quellen.",
  },
  en: {
    offen: "There is not enough evidence in the selected approved sources to answer.",
    belegt: "The approved source confirms this statement.",
    ja: "Yes. The approved source confirms this.",
    nein: "No. The approved source contradicts this.",
    fund: "The approved source says:",
    widerspruch: "The approved source contradicts this statement.",
    konflikt: "The approved sources disagree on this question.",
  },
  nl: {
    offen: "De geselecteerde goedgekeurde bronnen bieden onvoldoende bewijs voor een antwoord.",
    belegt: "De goedgekeurde bron bevestigt deze uitspraak.",
    ja: "Ja. De goedgekeurde bron bevestigt dit.",
    nein: "Nee. De goedgekeurde bron spreekt dit tegen.",
    fund: "In de goedgekeurde bron staat:",
    widerspruch: "De goedgekeurde bron spreekt deze uitspraak tegen.",
    konflikt: "De goedgekeurde bronnen spreken elkaar tegen over deze vraag.",
  },
};

export function offeneTeamAntwort(sprache: TeamSprache): TeamAntwort {
  return { stand: "offen", text: texte[sprache].offen, quellen: [] };
}

// The team and source checks continue after the knowledge service returns.
// Keep the model-run gate on the server until delivery, outside the JSON data.
const modellAuslieferung = new WeakMap<
  TeamAntwort,
  { pruefen: () => void; sprache: TeamSprache }
>();

export function pruefeTeamAntwortVorAuslieferung(antwort: TeamAntwort): TeamAntwort {
  const tor = modellAuslieferung.get(antwort);
  if (!tor) return antwort;
  try {
    tor.pruefen();
    return antwort;
  } catch (e) {
    if (e instanceof AskError && e.code === "KI_ABGESCHALTET")
      return offeneTeamAntwort(tor.sprache);
    throw e;
  }
}

function lesbar(
  user: SessionUser,
  artikel: KnowledgeObject | undefined,
  gelernt: GelernteHalbwertszeiten,
): artikel is KnowledgeObject {
  return (
    !!artikel &&
    artikel.status === "validiert" &&
    !artikel.deletedAt &&
    !artikel.schutzdatenQuarantaene &&
    darfSehen(user, artikel) &&
    !haltbarkeitAbgelaufen(artikel, Date.now(), gelernt)
  );
}

function normal(text: string) {
  return (
    text
      .normalize("NFC")
      .trim()
      .toLowerCase()
      .replace(/[‐‑]/gu, "-")
      .replace(/\s+/gu, " ")
      .replace(/[.!?]$/u, "")
      // Normalize an explicit, unambiguously written quantity. Three digits after
      // a separator can be a decimal or thousands group, so keep them untouched.
      .replace(
        /(\b(?:beträgt|kostet|costs|lasts|bedraagt|kost)\s+[€£$]?\s*)(\d+)[.,](\d{1,2})(?=\s|$)/gu,
        (_m, verb: string, ganz: string, rest: string) => {
          const nachkomma = rest.replace(/0+$/u, "");
          return nachkomma ? `${verb}${ganz}.${nachkomma}` : `${verb}${ganz}`;
        },
      )
      .trim()
  );
}

// Compare the entire proposition. A shared topic or a different number alone
// never establishes a contradiction. Keep compound claims and "not only" open.
function gegenseitigeErsetzung(a: string, b: string, paare: string[][]): boolean {
  const links = a.split(" ");
  const rechts = b.split(" ");
  if (links.length !== rechts.length) return false;
  const anders = links.flatMap((wort, index) =>
    wort === rechts[index] ? [] : [[wort, rechts[index]]],
  );
  return (
    anders.length === 1 &&
    paare.some((paar) => anders[0]?.every((wort) => wort && paar.includes(wort)))
  );
}

function gegenteil(aussage: string, quelle: string) {
  const gegensatzpaare = [
    ["erlaubt", "verboten"],
    ["zulässig", "unzulässig"],
    ["allowed", "forbidden"],
    ["permitted", "prohibited"],
    ["toegestaan", "verboden"],
  ];
  if (gegenseitigeErsetzung(aussage, quelle, gegensatzpaare)) return true;
  const zahl = /\d+(?:[.,]\d+)?/gu;
  if (
    /\b(?:beträgt|kostet|costs|lasts|bedraagt|kost)\s+[€£$]?\s*\d/u.test(aussage) &&
    !/\b(?:nicht|kein|geen|not|no|unless|außer|tenzij|and|or|oder|of)\b/u.test(aussage) &&
    !/[.,]\d{3}/u.test(aussage) &&
    !/[.,]\d{3}/u.test(quelle) &&
    aussage.match(zahl)?.length === 1 &&
    quelle.match(zahl)?.length === 1 &&
    aussage !== quelle &&
    aussage.replace(zahl, "#") === quelle.replace(zahl, "#")
  )
    return true;
  const negation = /\b(?:not|nicht|niet)\b/gu;
  const istGegenform = (negativ: string, positiv: string) =>
    negativ.match(negation)?.length === 1 &&
    !/\b(?:only|nur|alleen|and|und|en|or|oder|of|unless|außer|tenzij)\b/u.test(negativ) &&
    /\b(?:must|may|can|is|are|ist|sind|darf|dürfen|kann|kan|mag|mogen|zijn)\b/u.test(negativ) &&
    normal(negativ.replace(negation, "")) === positiv;
  return istGegenform(aussage, quelle) || istGegenform(quelle, aussage);
}

// For an already registered truth conflict, a changed quantity in the otherwise
// identical proposition locates the other passage, including spelled-out values.
function andereMengenangabe(a: string, b: string) {
  const menge =
    /\b(?:\d+(?:[.,]\d+)?|ein[se]?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|one|two|three|four|five|six|seven|eight|nine|ten|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\b/giu;
  return (
    a !== b &&
    a.match(menge)?.length === 1 &&
    b.match(menge)?.length === 1 &&
    a.replace(menge, "#") === b.replace(menge, "#")
  );
}

function beleg(ko: KnowledgeObject, auszug: string): TeamAntwort["quellen"][number] {
  const href = belegstellenLink(ko.id, auszug, ko.version);
  return {
    id: ko.id,
    version: ko.version,
    titel: ko.title,
    auszug,
    href: href.includes("?") ? href : `${href}?fassung=${ko.version}`,
  };
}

interface Fundstelle {
  ko: KnowledgeObject;
  zitat: string;
  ref: KnowledgeRef;
}

function fundstellen(artikel: KnowledgeObject[]): Fundstelle[] {
  const liste: Fundstelle[] = [];
  for (const ko of artikel) {
    const inhalte = [
      ko.statement,
      ko.bodyHtml ? htmlToPlainText(ko.bodyHtml) : "",
      ...ko.conditions,
      ...ko.measures,
    ];
    const saetze = new Set(
      inhalte
        .flatMap((text) => text.split(/(?<=[.!?])\s+|\n+/u))
        .map((satz) => satz.trim())
        .filter(Boolean),
    );
    for (const zitat of saetze) {
      liste.push({
        ko,
        zitat,
        ref: {
          id: String(liste.length),
          title: ko.title,
          statement: zitat,
          status: "validiert",
          trust: ko.trust,
        },
      });
    }
  }
  return liste;
}

const FRAGE =
  /^(?:was|wer|wie|welche\w*|wann|wo|warum|wieviel\w*|what|which|where|when|how|who|why|wat|welk\w*|waar|waarom|wanneer|hoe|hoeveel)\b/iu;
const HILFSVERB =
  /^(?:can|must|may|is|are|darf|dürfen|muss|müssen|ist|sind|mag|mogen|moet|moeten|kan|kann|zijn)\b/iu;

// Form the yes/no question from the source itself. Only move the finite verb.
// Subject, object, quantities and qualifications stay in their original order.
function frageform(quelle: string, frage: string): string {
  const verb = frage.match(HILFSVERB)?.[0];
  if (!verb) return quelle;
  const woerter = quelle.split(" ");
  let an = woerter.indexOf(verb);
  if (an === -1 && (verb === "can" || verb === "may") && quelle.includes(" must not "))
    an = woerter.indexOf("must");
  if (an < 1) return quelle;
  return [verb, ...woerter.slice(0, an), ...woerter.slice(an + 1)].join(" ");
}

const FUNKTIONSWOERTER = new Set(
  (
    "was wer wie wann wo warum welche welcher welches welchen welchem viel viele lang lange gilt gelten soll sollen muss müssen ich wir habe haben für der die das den dem des eine einer einen einem ein ist sind zum zur um von zu im am bei nach bis mit uns meine unsere " +
    "what which where when how who why many much long is are do does i we have the a an of for to my our on in after from by about can need " +
    "wat welk welke waar waarom wanneer hoe hoeveel lang heb hebben kan moet moeten ik wij geld geldt de het een voor van over op bij na om te mijn onze"
  ).split(" "),
);
const ZEITFRAGE =
  /\b(?:frist|deadline|termijn|hoe lang|how long|how many days|wie lange|wie viel zeit)\b/iu;
const ZEITANGABE =
  /\b(?:\d+|one|two|three|ten|een|twee|drie|zehn|zwei|drei)\s*(?:werk|arbeits|working |business )?(?:tag\w*|dag\w*|days?|stund\w*|uur|uren|hours?|wochen?|week\w*|month\w*|maand\w*|monat\w*)\b/iu;

function suchbegriffe(frage: string) {
  const worte = frage.match(/[\p{L}\p{N}]+/gu) ?? [];
  return worte.filter(
    (w) =>
      !FUNKTIONSWOERTER.has(w) &&
      !(ZEITFRAGE.test(frage) && /^(?:frist|deadline|termijn|days|zeit)$/u.test(w)),
  );
}

function decktThema(stelle: Fundstelle, worte: string[]) {
  const quelle = normal(stelle.zitat).match(/[\p{L}\p{N}]+/gu) ?? [];
  return (
    worte.length > 0 &&
    worte.every((w) =>
      quelle.some((q) => q === w || (w.length >= 4 && q.startsWith(w) && q.length - w.length <= 4)),
    )
  );
}

// Only return literal, current passages. The free-form model text and its links
// are never pasted into the team's answer. Every cited claim must be grounded.
function modellBelege(out: AskResult, stellen: Fundstelle[]): TeamAntwort["quellen"] {
  if (
    !out.result.answered ||
    out.result.demo ||
    !out.aussagen?.aussagen.length ||
    out.aussagen.fehlendeDeckung.length ||
    !out.result.sources.length
  )
    return [];
  const bindungen = new Map(stellen.map((s) => [s.ko.id, s.ko.version]));
  if (
    out.result.sources.some(
      (id) => !bindungen.has(id) || out.quellenStand?.[id] !== bindungen.get(id),
    )
  )
    return [];
  const belege: TeamAntwort["quellen"] = [];
  for (const satz of out.aussagen.aussagen) {
    if (satz.deckung !== "belegt" || !satz.teile.length) return [];
    for (const teil of satz.teile) {
      const treffer = teil.fundstellen.find(
        (f) =>
          f.art === "intern" &&
          f.wortbezug &&
          f.auszug.trim() &&
          out.result.sources.includes(f.koId) &&
          stellen.some(
            (s) => s.ko.id === f.koId && s.ko.version === f.koVersion && s.zitat.includes(f.auszug),
          ),
      );
      if (!treffer) return [];
      const stelle = stellen.find(
        (s) => s.ko.id === treffer.koId && s.zitat.includes(treffer.auszug),
      );
      if (!stelle) return [];
      if (!belege.some((q) => q.id === stelle.ko.id && q.auszug === stelle.zitat))
        belege.push(beleg(stelle.ko, stelle.zitat));
    }
  }
  return belege;
}

export function baueTeamassistentWissen(dienste: {
  ko: Pick<KoService, "get" | "gelernteHalbwertszeiten">;
  conflicts: Pick<ConflictService, "unresolved">;
  ask?: Pick<AskService, "ask" | "kiStand" | "kiSperreVorFrage" | "kiSperreVorAuslieferung">;
}): TeamassistentWissen {
  const lade = async (
    user: SessionUser,
    ids: string[],
    gebunden?: Readonly<Record<string, number>>,
  ) => {
    const [daten, gelernt] = await Promise.all([
      Promise.all(ids.map((id) => dienste.ko.get(id))),
      dienste.ko.gelernteHalbwertszeiten(),
    ]);
    return daten.filter(
      (ko): ko is KnowledgeObject =>
        lesbar(user, ko, gelernt) && (!gebunden || gebunden[ko.id] === ko.version),
    );
  };
  return {
    async quellstand(user, definition) {
      const artikel = await lade(user, definition.quellen);
      return artikel.length === definition.quellen.length && artikel.length > 0
        ? Object.fromEntries(artikel.map((ko) => [ko.id, ko.version]))
        : null;
    },
    async fragen(user, definition, frage, sprache, gebundeneQuellen, pruefeSitzung) {
      const kiStand = dienste.ask?.kiStand();
      let vorAuslieferung: (() => void) | undefined;
      const t = texte[sprache];
      const offen = offeneTeamAntwort(sprache);
      const artikel = await lade(user, definition.quellen, gebundeneQuellen);
      const stellen = fundstellen(artikel);
      const eingabe = normal(frage);
      if (!eingabe || !stellen.length) return offen;
      const sachfrage =
        FRAGE.test(eingabe) || HILFSVERB.test(eingabe) || frage.trimEnd().endsWith("?");
      if (definition.sachfragen === false && sachfrage) return offen;
      const aussageform = (s: Fundstelle) => frageform(normal(s.zitat), eingabe);
      const fits = stellen.filter((s) => aussageform(s) === eingabe);
      const gegensaetze = stellen.filter((s) => gegenteil(eingabe, aussageform(s)));
      const refs = stellen.map((s) => s.ref);
      const aufgabebegriffe = suchbegriffe(normal(definition.aufgabe));
      const schwerpunkt = new Map(
        stellen.map((s) => {
          const bezug: string[] = normal(`${s.ko.title} ${s.zitat}`).match(/[\p{L}\p{N}]+/gu) ?? [];
          return [s.ref.id, aufgabebegriffe.filter((w) => bezug.includes(w)).length];
        }),
      );
      const byAufgabe = (a: Fundstelle, b: Fundstelle) =>
        (schwerpunkt.get(b.ref.id) ?? 0) - (schwerpunkt.get(a.ref.id) ?? 0);
      let stand: TeamAntwort["stand"] = "belegt";
      let aussage = HILFSVERB.test(eingabe) ? t.ja : t.belegt;
      let treffer = fits.sort(byAufgabe)[0];
      if (gegensaetze.length) {
        treffer = gegensaetze.sort(byAufgabe)[0];
        stand = "widerspruch";
        aussage = HILFSVERB.test(eingabe) ? t.nein : t.widerspruch;
      } else if (!treffer && FRAGE.test(eingabe)) {
        const worte = suchbegriffe(eingabe);
        const thema = worte.join(" ");
        const rang = new Map(
          rankCandidates(thema, refs, refs.length).map((s) => [s.ref.id, s.keywordScore]),
        );
        const passend = stellen
          .filter(
            (s) => decktThema(s, worte) && (!ZEITFRAGE.test(eingabe) || ZEITANGABE.test(s.zitat)),
          )
          .sort((a, b) => (rang.get(b.ref.id) ?? 0) - (rang.get(a.ref.id) ?? 0) || byAufgabe(a, b));
        treffer = passend[0];
        aussage = t.fund;
      }
      let quellen: TeamAntwort["quellen"] = [];
      if (
        !treffer &&
        sachfrage &&
        definition.sachfragen !== false &&
        dienste.ask &&
        pruefeSitzung &&
        artikel.every((ko) => !isConfidential(ko.confidentiality)) &&
        !erkenneSchutzdaten([frage, definition.aufgabe]).length
      ) {
        await pruefeSitzung();
        const bindungen = new Map(artikel.map((ko) => [ko.id, ko.version]));
        const gelernt = await dienste.ko.gelernteHalbwertszeiten();
        const ask = dienste.ask;
        try {
          ask.kiSperreVorFrage(kiStand);
          const out = await ask.ask(
            frage,
            user.id,
            sprache,
            {
              validatedOnly: true,
              gapPolicy: "count_only",
              seitenkontext: { kontext: definition.aufgabe },
            },
            (ko) => bindungen.get(ko.id) === ko.version && lesbar(user, ko, gelernt),
          );
          vorAuslieferung = () => ask.kiSperreVorAuslieferung(kiStand);
          vorAuslieferung();
          quellen = modellBelege(out, stellen);
        } catch (fehler) {
          if (fehler instanceof AskError && fehler.code === "KI_ABGESCHALTET") return offen;
          throw fehler;
        }
        const erste = quellen[0];
        if (erste) treffer = stellen.find((s) => s.ko.id === erste.id && s.zitat === erste.auszug);
        aussage = t.fund;
      }
      if (!treffer) return offen;
      if (!quellen.length) quellen.push(beleg(treffer.ko, treffer.zitat));
      const gegenstelle = fits.find((s) => s.ko.id !== treffer?.ko.id || s.zitat !== treffer.zitat);
      if (stand === "widerspruch" && gegenstelle) {
        quellen.push(beleg(gegenstelle.ko, gegenstelle.zitat));
        aussage = t.konflikt;
      } else if (artikel.length > 1) {
        const gefunden = treffer;
        const konflikte = await dienste.conflicts.unresolved();
        const konflikt = konflikte.find(
          (k) =>
            k.type === "truth" &&
            (k.koA === gefunden.ko.id || k.koB === gefunden.ko.id) &&
            artikel.some(
              (ko) =>
                ko.id === k.koA && (k.koAVersion === undefined || k.koAVersion === ko.version),
            ) &&
            artikel.some(
              (ko) =>
                ko.id === k.koB && (k.koBVersion === undefined || k.koBVersion === ko.version),
            ),
        );
        if (konflikt) {
          const partner = konflikt.koA === gefunden.ko.id ? konflikt.koB : konflikt.koA;
          const worte = suchbegriffe(eingabe);
          const andere = stellen.find(
            (s) =>
              s.ko.id === partner &&
              (gegenteil(normal(gefunden.zitat), normal(s.zitat)) ||
                andereMengenangabe(normal(gefunden.zitat), normal(s.zitat)) ||
                (FRAGE.test(eingabe) && decktThema(s, worte))),
          );
          if (!andere) return offen;
          if (!quellen.some((q) => q.id === andere.ko.id && q.auszug === andere.zitat))
            quellen.push(beleg(andere.ko, andere.zitat));
          stand = "widerspruch";
          aussage = t.konflikt;
        }
      }
      const aktuell = await lade(user, [...new Set(quellen.map((q) => q.id))], gebundeneQuellen);
      if (quellen.some((q) => !aktuell.some((ko) => ko.id === q.id && ko.version === q.version)))
        return offen;
      const antwort = {
        stand,
        text: [aussage, ...quellen.map((q) => q.auszug)].join("\n\n"),
        quellen,
      };
      if (vorAuslieferung) modellAuslieferung.set(antwort, { pruefen: vorAuslieferung, sprache });
      return pruefeTeamAntwortVorAuslieferung(antwort);
    },
  };
}
