// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische — DIE PERSÖNLICHE ZUSTELLUNG IN DER GLOCKE.
// ================================================================================================
//
// Drei Anlässe, je einer aus den Originalpunkten, alle an EINE Person und über den vorhandenen Weg
// der Glocke (`GET /api/notifications`, Gelesen-Stand je Nutzer, Sichtbarkeitsfilter in der Route):
//
//   R-0248 „frist"   — die verantwortliche Person wird VOR Fristende erinnert (Erinnerungsfenster)
//                      und nach Ablauf gemahnt. Kennung je Frist: eine neue Frist ist ungelesen.
//   R-0266 „vorlage" — jede Woche werden ihr ihre ältesten geprüften Beiträge zur Bestätigung
//                      vorgelegt. Kennung je Kalenderwoche: die Vorlage kehrt wöchentlich wieder.
//   R-1635 „anlage"  — wurde ein Objekt mit „Stimmt das noch?" markiert (Anlagenänderung,
//                      Nachbarauslöser, Anforderung aus der Bibliothek), erfährt es sein Autor. Nach
//                      einer Übergabe (`transfer-author`) ist das der Nachfolger — `author` trägt
//                      dann ihn, `originalAuthor` bleibt als Herkunft stehen. Gemeldet wird nur,
//                      solange der Merker noch steht, und nicht an die Person, die selbst markiert hat.
//
// Die Fristregeln rechnet `services/knowledge-object/src/frische.ts`; hier wird nur beschafft.
import type { AuditService } from "../../audit";
import { type KoService, aeltesteVorlageFuer, fristHinweiseFuer } from "../../knowledge-object";
import { type LifecycleService, REVALIDIERUNG_ANGEFORDERT } from "../../lifecycle";
import type { FrischeNotice } from "./notification-feed";

/** R-0266: so viele älteste Beiträge legt die Wochenvorlage vor. */
export const VORLAGE_ANZAHL = 3;

/** Montag 00:00 UTC der Woche, in der `ms` liegt. */
function wochenbeginn(ms: number): number {
  const d = new Date(ms);
  const seitMontag = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - seitMontag);
}

export interface FrischeMeldungenDeps {
  ko: Pick<KoService, "list" | "get" | "gelernteHalbwertszeiten">;
  lifecycle: Pick<LifecycleService, "revalidierungAnstehtFuer">;
  audit: Pick<AuditService, "list">;
  uhr?: () => number;
}

export function frischeMeldungen(deps: FrischeMeldungenDeps): {
  meldungenFuer(nutzerId: string): Promise<FrischeNotice[]>;
} {
  const uhr = deps.uhr ?? Date.now;
  return {
    async meldungenFuer(nutzerId: string): Promise<FrischeNotice[]> {
      const jetzt = uhr();
      const [gelernt, gepruefte, markierungen] = await Promise.all([
        deps.ko.gelernteHalbwertszeiten(),
        deps.ko.list({ status: "validiert" }),
        deps.audit.list({ action: REVALIDIERUNG_ANGEFORDERT }),
      ]);
      const aus: FrischeNotice[] = [];

      // R-0248: Erinnerung vor Fristende, Mahnung danach.
      const fristen = fristHinweiseFuer(gepruefte, nutzerId, jetzt, gelernt);
      for (const f of fristen) {
        aus.push({
          art: "frist",
          // Erinnerung und Mahnung sind zwei Anlässe: die Mahnung erscheint wieder ungelesen.
          schluessel: `frist-${f.koId}-${f.haltbarBis}-${f.abgelaufen ? "abgelaufen" : "erinnerung"}`,
          koId: f.koId,
          title: f.title,
          at: f.abgelaufen ? f.haltbarBis : f.erinnerungAb,
          ...(f.abgelaufen ? { ueberfaellig: true } : {}),
        });
      }

      // R-0266: die wöchentliche Vorlage — ohne die Objekte, an die schon eine Frist erinnert.
      const woche = new Date(wochenbeginn(jetzt)).toISOString();
      const schonErinnert = new Set(fristen.map((f) => f.koId));
      const vorlage = aeltesteVorlageFuer(gepruefte, nutzerId, jetzt, VORLAGE_ANZAHL, gelernt);
      for (const v of vorlage) {
        if (schonErinnert.has(v.koId)) {
          continue;
        }
        aus.push({
          art: "vorlage",
          schluessel: `vorlage-${woche.slice(0, 10)}-${v.koId}`,
          koId: v.koId,
          title: v.title,
          at: woche,
        });
      }

      // R-1635: je markiertem Objekt der JÜNGSTE fremde Beleg; nur solange der Merker steht.
      const juengste = new Map<string, { at: string }>();
      for (const eintrag of markierungen) {
        if (eintrag.actor === nutzerId) {
          continue;
        }
        const bisher = juengste.get(eintrag.target);
        if (!bisher || bisher.at < eintrag.at) {
          juengste.set(eintrag.target, { at: eintrag.at });
        }
      }
      if (juengste.size > 0) {
        const anstehend = await deps.lifecycle.revalidierungAnstehtFuer([...juengste.keys()]);
        for (const [koId, { at }] of juengste) {
          if (!anstehend.has(koId)) {
            continue;
          }
          const ko = await deps.ko.get(koId);
          if (!ko || ko.author !== nutzerId) {
            continue;
          }
          aus.push({
            art: "anlage",
            schluessel: `anlage-${koId}-${at}`,
            koId,
            title: ko.title,
            at,
          });
        }
      }
      return aus;
    },
  };
}
