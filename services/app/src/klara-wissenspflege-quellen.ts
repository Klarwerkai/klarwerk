import { isDeepStrictEqual } from "node:util";
import { type KoService, discloseFrische } from "../../knowledge-object";
import type { LifecycleService } from "../../lifecycle";
import { type FristenQuellenDeps, KlaraFristenQuellen } from "./klara-fristen-quellen";
import type { GelesenePflegeQuelle, PflegeLeser } from "./klara-wissenspflege";
import type { SpacesRepo } from "./spaces";

export interface WissenspflegeQuellenDeps extends FristenQuellenDeps {
  ko: Pick<KoService, "get" | "gelernteHalbwertszeiten">;
  spaces: SpacesRepo;
  lifecycle: Pick<LifecycleService, "offeneFaelle">;
}

/** Aktuelle Quellen aus vorhandenen Rechten und Lebenszyklus; keine eigene Quell-/Frischeablage. */
export class KlaraWissenspflegeQuellen implements PflegeLeser {
  private readonly rechte: KlaraFristenQuellen;
  constructor(private readonly deps: WissenspflegeQuellenDeps) {
    this.rechte = new KlaraFristenQuellen(deps);
  }

  /** Derselbe bestehende Ausschluss wie Spaceänderungen, nur um den begrenzten internen Schreibschritt. */
  unterQuellschutz<T>(arbeit: () => Promise<T>): Promise<T> {
    return this.deps.spaces.exklusiv(arbeit);
  }

  async lies(kontoId: string, id: string): Promise<GelesenePflegeQuelle | null> {
    const user = await this.rechte.nutzer(kontoId);
    if (!user) return null;
    const gelesen = await this.rechte.lies(user, "wissensobjekt", id);
    if (!gelesen) return null;
    const ko = await this.deps.ko.get(id);
    if (!ko || String(ko.version) !== gelesen.quelle.fassung) return null;
    const [fall] = await this.deps.lifecycle.offeneFaelle([id]);
    const frische = discloseFrische(
      ko,
      (this.deps.jetzt ?? Date.now)(),
      {
        revalidierung: { wert: Boolean(fall) },
        konflikt: { ungeprueft: "Für diese vorbereitende Routine nicht erhoben." },
      },
      await this.deps.ko.gelernteHalbwertszeiten(),
    ).frische;
    // Die fachliche Frische kommt aus derselben zentralen Regel. Sie ist keine neue Freigabe.
    const snapshot = structuredClone(ko);
    const fallSnapshot = fall ? structuredClone(fall) : null;
    return {
      quelle: {
        id,
        fassung: ko.version,
        titel: ko.title,
        aussage: ko.statement,
        offenePruefung: fall ? { stand: fall.stand, seit: fall.seit } : null,
        frische: {
          stufe: frische.stufe,
          bezugAm: frische.bezugAm,
          haltbarBis: frische.haltbarBis,
          konflikt: "nicht_erhoben",
        },
      },
      bedingung: {
        sql: (start) => {
          const b = gelesen.bedingung.sql?.(start);
          if (!b) throw new Error("Pflegequelle ohne Quellrechte-Schreibbedingung");
          const i = start + b.params.length;
          return {
            und: [
              ...b.und,
              `EXISTS(SELECT 1 FROM kos WHERE id=$${i}::text AND data=$${i + 1}::jsonb FOR SHARE)`,
              `(SELECT jsonb_build_object('stand',stand,'seit',seit,'anlaesse',anlaesse)
                FROM lifecycle_pending WHERE ko_id=$${i}::text FOR SHARE)
                IS NOT DISTINCT FROM $${i + 2}::jsonb`,
            ],
            params: [
              ...b.params,
              id,
              JSON.stringify(snapshot),
              fallSnapshot
                ? JSON.stringify({
                    stand: fallSnapshot.stand,
                    seit: fallSnapshot.seit,
                    anlaesse: fallSnapshot.anlaesse,
                  })
                : null,
            ],
          };
        },
      },
      nochAktuell: async () => {
        if (!(await gelesen.nochAktuell())) return false;
        const [neu] = await this.deps.lifecycle.offeneFaelle([id]);
        return (
          isDeepStrictEqual(await this.deps.ko.get(id), snapshot) &&
          isDeepStrictEqual(neu ?? null, fallSnapshot)
        );
      },
    };
  }
}
