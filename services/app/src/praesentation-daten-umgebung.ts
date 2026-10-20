import type { KnowledgeObject } from "../../knowledge-object";
import { type ObjectStore, decodeDataUrl } from "../../object-store";
import { can } from "../../rbac";
import type { SessionUser } from "./http";
import { officeFormatFuer } from "./office-wopi";
import { type DatenUmgebung, type FoliensatzDaten, leseFolienDaten } from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";
import { darfSehen } from "./sichtbarkeit";

export interface PraesentationUmgebungsDeps {
  readonly ko: { get(id: string): Promise<KnowledgeObject | undefined> };
  readonly objekte: ObjectStore;
  readonly ablage: DatenpunktAblage;
  readonly konten: () => Promise<readonly { readonly id: string; readonly name: string }[]>;
}

// Dieselbe PP-02-Umgebung für Herkunft, Prüfung und Ergänzung; je Anfrage frisch.
export function praesentationDatenUmgebung(
  deps: PraesentationUmgebungsDeps,
  user: SessionUser,
): DatenUmgebung {
  const gelesen = new Map<string, Promise<FoliensatzDaten | undefined>>();
  let konten: Promise<readonly { readonly id: string; readonly name: string }[]> | undefined;
  const artikel = async (koId: string) => {
    const ko = await deps.ko.get(koId);
    return ko && can(user.role, "ko.read") && darfSehen(user, ko) ? ko : undefined;
  };
  const satzVon = (objectId: string) => {
    const vorhanden = gelesen.get(objectId);
    if (vorhanden) {
      return vorhanden;
    }
    const lauf = (async () => {
      const gespeichert = await deps.objekte.read(objectId);
      const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
      return bytes ? await leseFolienDaten(bytes).catch(() => undefined) : undefined;
    })();
    gelesen.set(objectId, lauf);
    return lauf;
  };
  return {
    artikel,
    async meta(koId) {
      const ko = await deps.ko.get(koId);
      return ko
        ? {
            version: ko.version,
            ...(ko.confidentiality ? { confidentiality: ko.confidentiality } : {}),
            anhaenge: (ko.attachments ?? []).map((a) => ({
              id: a.id,
              ...(a.objectId ? { objectId: a.objectId } : {}),
            })),
          }
        : undefined;
    },
    async folien(koId, anhangId) {
      const ko = await artikel(koId);
      const anhang = ko?.attachments?.find((a) => a.id === anhangId);
      if (!anhang?.objectId || officeFormatFuer(anhang.name, anhang.mime)?.endung !== "pptx") {
        return undefined;
      }
      const satz = await satzVon(anhang.objectId);
      return satz ? { objectId: anhang.objectId, name: anhang.name, satz } : undefined;
    },
    datenpunkt: (id) => deps.ablage.lesen(id),
    async name(nutzerId) {
      konten ??= deps.konten();
      return (await konten).find((k) => k.id === nutzerId)?.name;
    },
  };
}
