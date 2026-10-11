import type { Role } from "../../auth";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  type ExternalKnowledgePolicyRepo,
  type ExternalSearchService,
  externalSearchAllowed,
} from "../../external-search";
import type { Confidentiality } from "../../knowledge-object";
import { can } from "../../rbac";
import {
  FaehigkeitsAusfuehrung,
  type FaehigkeitsLage,
  FaehigkeitsVormerkungen,
  Faehigkeitsregistry,
  type GeheimnisQuelle,
  type KontextPruefung,
  type KontextTeil,
  type LageQuelle,
  PERPLEXITY_SUCHE,
  ProfilFaehigkeitsAblage,
  WIKIPEDIA_SUCHE,
  suchAdapter,
} from "./assistenz-faehigkeiten";
import type { AssistenzProfilRepo } from "./assistenz-profil";
import type { SessionUser } from "./http";
import { type SichtbarkeitsFakten, darfSehen } from "./sichtbarkeit";

// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) — DIE ANBINDUNG AN DIE VORHANDENEN DIENSTE.
// ================================================================================================
//
// Kein zweiter Kern: die Fähigkeitsausführung liest jede Entscheidung aus dem Dienst, der sie schon
// trifft, und zwar bei JEDEM Schritt frisch (auch im Hintergrund):
//
//   · „Keine KI"          — `reasoner.kiAbschaltung()`, die gespeicherte Adminwahl (D5).
//   · Vertrauliches       — `reasoner.vertraulicheAusleitungFreigegeben()`, beide Adminfreigaben.
//   · Externe Abfrage     — der Admin-Regler `external_knowledge_policy` (SCRUM-414).
//   · Anbieterfreigabe    — der vorhandene Wikipedia-Weg ist durch genau diesen Regler freigegeben.
//                           Für Perplexity gibt es KEINE Freigabe (O09 offen); diese Anbindung
//                           erteilt keine.
//   · Konto- und Kontextrechte — Konto freigegeben und `ko.read`, jedes gebundene Kontextobjekt
//                           über `darfSehen` mit den lesbaren Spaces des Kontos.
//   · Ablage              — die Aufträge im vorhandenen Assistenzprofil (`ProfilFaehigkeitsAblage`).
//
// Zugänge: es gibt für Fähigkeiten noch keinen sicheren Betreiberweg. Die Geheimnisquelle liefert
// deshalb nichts — eine Fähigkeit mit Zugang bleibt mit dieser konkreten Voraussetzung offen.

/** Die Kennung des Mandanten dieser Instanz — Klarwerk läuft je Instanz für genau einen. */
export const FAEHIGKEITEN_MANDANT = "instanz";

export interface FaehigkeitenAnbindungDeps {
  readonly reasoner: {
    kiAbschaltung(): { readonly abgeschaltet: boolean };
    vertraulicheAusleitungFreigegeben(): boolean;
  };
  readonly externeWissensabfrage: ExternalKnowledgePolicyRepo;
  /** Der vorhandene externe Suchweg (`createExternalSearchFromEnv`); fehlt er, kein Adapter. */
  readonly externeSuche: ExternalSearchService | undefined;
  readonly profile: AssistenzProfilRepo;
  readonly konten: () => Promise<
    readonly { readonly id: string; readonly role: Role; readonly approved: boolean }[]
  >;
  readonly wissen: {
    get(id: string): Promise<(SichtbarkeitsFakten & { version: number }) | undefined>;
  };
  readonly lesbareSpaces: (nutzerId: string) => Promise<ReadonlySet<string>>;
  readonly protokoll?: (zeile: string) => void;
}

export function produktFaehigkeitsLage(
  deps: Pick<FaehigkeitenAnbindungDeps, "reasoner" | "externeWissensabfrage">,
): LageQuelle {
  return async (): Promise<FaehigkeitsLage> => {
    const stufe = (await deps.externeWissensabfrage.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
    return {
      keineKi: deps.reasoner.kiAbschaltung().abgeschaltet,
      externeWissensabfrage: stufe,
      vertraulichNachExtern: deps.reasoner.vertraulicheAusleitungFreigegeben(),
      freigegebeneAnbieter: externalSearchAllowed(stufe) ? ["wikimedia"] : [],
    };
  };
}

/** Der Betrachter eines Kontos, wie `makeGuards` ihn je Anfrage erhebt — oder `null`. */
async function betrachter(
  deps: Pick<FaehigkeitenAnbindungDeps, "konten" | "lesbareSpaces">,
  nutzer: string,
): Promise<SessionUser | null> {
  const konto = (await deps.konten()).find((k) => k.id === nutzer);
  if (!konto || !konto.approved || !can(konto.role, "ko.read")) {
    return null;
  }
  return { id: konto.id, role: konto.role, spaceLesbar: await deps.lesbareSpaces(konto.id) };
}

const KEIN_RECHT =
  "Das Konto darf den gebundenen Arbeitsbereichskontext nicht mehr lesen; das Ergebnis bleibt gesperrt.";

export function produktKontextPruefung(
  deps: Pick<FaehigkeitenAnbindungDeps, "konten" | "lesbareSpaces" | "wissen">,
): KontextPruefung {
  return {
    async pruefe(nutzer, kontext, anlass) {
      const user = await betrachter(deps, nutzer);
      if (!user) {
        return { art: "kontextrecht", text: KEIN_RECHT };
      }
      for (const k of kontext) {
        const ko = await deps.wissen.get(k.kennung);
        if (!ko || !darfSehen(user, ko)) {
          return { art: "kontextrecht", text: KEIN_RECHT };
        }
        if (anlass === "ausfuehrung" && String(ko.version) !== k.fassung) {
          return {
            art: "kontext_geaendert",
            text: "Ein Kontextobjekt wurde seit der Vorschau geändert. Bitte neu vorbereiten.",
          };
        }
      }
      return null;
    },
    async lade(nutzer, kontext) {
      const user = await betrachter(deps, nutzer);
      return user
        ? ladeKontext(
            deps,
            user,
            kontext.map((k) => k.kennung),
          )
        : null;
    },
  };
}

/**
 * Lädt den Arbeitsbereichskontext eines Auftrags aus dem Bestand — nur Objekte, die das Konto JETZT
 * sehen darf. `null`, sobald eines fehlt oder verborgen ist; die Antwort sagt nicht, welches.
 */
export async function ladeKontext(
  deps: Pick<FaehigkeitenAnbindungDeps, "wissen">,
  user: SessionUser,
  kennungen: readonly string[],
): Promise<KontextTeil[] | null> {
  const out: KontextTeil[] = [];
  for (const kennung of kennungen) {
    const ko = (await deps.wissen.get(kennung)) as
      | (SichtbarkeitsFakten & { version: number; title?: unknown; statement?: unknown })
      | undefined;
    if (!ko || !darfSehen(user, ko)) {
      return null;
    }
    const schutz = (ko.confidentiality ?? null) as Confidentiality | null;
    out.push({
      kennung,
      fassung: String(ko.version),
      schutz,
      text: [ko.title, ko.statement].filter((t) => typeof t === "string").join("\n"),
    });
  }
  return out;
}

/** Die Fähigkeiten dieser Instanz. Registrierung und Adapterinstallation sind getrennte Schritte. */
export function produktFaehigkeitsregistry(
  externeSuche: ExternalSearchService | undefined,
): Faehigkeitsregistry {
  const registry = new Faehigkeitsregistry();
  registry.registriere(WIKIPEDIA_SUCHE);
  if (externeSuche) {
    registry.installiereAdapter(
      suchAdapter(
        WIKIPEDIA_SUCHE,
        { name: externeSuche.providerName, search: (q) => externeSuche.search(q) },
        "echt",
      ),
    );
  }
  // Vertrag ja, Adapter NEIN: die Installation ist ein eigener administrativer Schritt und setzt
  // Anbieterfreigabe, belegte Kosten und Budgetzuordnung voraus (O09). Bis dahin erklärt die
  // Übersicht diese Voraussetzungen konkret.
  registry.registriere(PERPLEXITY_SUCHE);
  return registry;
}

/** Bis ein sicherer Betreiberweg für Fähigkeitszugänge besteht, gibt es keinen Zugangswert. */
export const KEINE_ZUGAENGE: GeheimnisQuelle = { hole: () => null };

export interface Faehigkeiten {
  readonly registry: Faehigkeitsregistry;
  readonly vormerkungen: FaehigkeitsVormerkungen;
  readonly ausfuehrung: FaehigkeitsAusfuehrung;
}

export function baueFaehigkeiten(deps: FaehigkeitenAnbindungDeps): Faehigkeiten {
  const registry = produktFaehigkeitsregistry(deps.externeSuche);
  const vormerkungen = new FaehigkeitsVormerkungen({ profile: deps.profile, registry });
  const ausfuehrung = new FaehigkeitsAusfuehrung({
    registry,
    lage: produktFaehigkeitsLage(deps),
    geheimnisse: KEINE_ZUGAENGE,
    ablage: new ProfilFaehigkeitsAblage(deps.profile),
    vormerkungen,
    kontext: produktKontextPruefung(deps),
    ...(deps.protokoll ? { protokoll: deps.protokoll } : {}),
  });
  return { registry, vormerkungen, ausfuehrung };
}
