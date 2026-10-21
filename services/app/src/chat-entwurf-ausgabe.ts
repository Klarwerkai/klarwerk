import { ohneChatQuelle } from "../../../apps/web/src/lib/chatQuelle";
import type { AuditService } from "../../audit";
import type { Draft } from "../../capture";
import type { KoService } from "../../knowledge-object";
import type { ChatNachricht, ChatRepo } from "./chat";
import type { SessionUser } from "./http";
import type { KlaraFristenQuellen } from "./klara-fristen-quellen";

interface AusgabeDeps {
  audit: Pick<AuditService, "list">;
  chat: Pick<ChatRepo, "nachricht" | "uebernommeneNachrichten">;
  ko: Pick<KoService, "get" | "versionsOf">;
  rechte: Pick<KlaraFristenQuellen, "nutzer" | "lies">;
}

type Herkunft = { art: "keine" } | { art: "unbekannt" } | { art: "nachricht"; n: ChatNachricht };
const NEUTRAL = "Dieser übernommene Inhalt ist derzeit nicht verfügbar.";
const html = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RC1: bestehender Audit-/Nachrichtenbeleg, unveränderter Rohentwurf, heutiger Quellenleser. */
export class ChatEntwurfAusgabe {
  constructor(private readonly d: AusgabeDeps) {}

  private async herkunft(drafts: readonly Draft[]): Promise<Map<string, Herkunft>> {
    // Beide bestehenden autoritativen Belegwege lesen; Tags und Nutztext belegen keine Übernahme.
    // Keine Berechtigungs- oder Herkunftszusage über Anfragen hinweg.
    const [audit, nachrichten] = await Promise.all([
      this.d.audit.list({ action: "chat.wissen_uebernommen" }),
      this.d.chat.uebernommeneNachrichten(drafts.map((d) => d.id)),
    ]);
    const result = new Map<string, Herkunft>();
    for (const draft of drafts) {
      const belege = audit.filter((e) => e.payload.entwurf === draft.id);
      const uebernahmen = nachrichten.filter((n) =>
        n.uebernahmen.some((u) => u.entwurfId === draft.id),
      );
      const ziele = new Set([...belege.map((e) => e.target), ...uebernahmen.map((n) => n.id)]);
      if (ziele.size === 0) {
        result.set(draft.id, { art: "keine" });
        continue;
      }
      const ziel = ziele.values().next().value;
      const n =
        ziele.size === 1 && ziel
          ? (uebernahmen.find((n) => n.id === ziel) ?? (await this.d.chat.nachricht(ziel)))
          : undefined;
      result.set(
        draft.id,
        n &&
          n.id === ziel &&
          belege.every((e) => e.payload.gespraech === n.gespraechId) &&
          (belege.length > 0 || n.uebernahmen.some((u) => u.entwurfId === draft.id))
          ? { art: "nachricht", n }
          : { art: "unbekannt" },
      );
    }
    return result;
  }

  private async zugaenglich(lage: Herkunft, user: SessionUser): Promise<boolean> {
    if (lage.art === "keine") return true;
    if (lage.art === "unbekannt") return false;
    const a = lage.n.ausschnitt;
    if (!a || a.fiktiv) return true;
    if (!a.koId) return false;
    // Ein Speicherausfall bleibt ein Fehler des vorhandenen HTTP-Fehlerwegs, kein erfundener Entzug.
    const ko = await this.d.ko.get(a.koId);
    if (!ko) return false;
    if (
      a.fassung !== undefined &&
      (!Number.isSafeInteger(a.fassung) ||
        a.fassung < 1 ||
        (ko.version !== a.fassung &&
          !(await this.d.ko.versionsOf(a.koId)).some((v) => v.version === a.fassung)))
    )
      return false;
    const aktuell = await this.d.rechte.nutzer(user.id);
    return !!aktuell && !!(await this.d.rechte.lies(aktuell, "wissensobjekt", a.koId));
  }

  private eingeschraenkt<T extends Draft>(draft: T, lage: Herkunft): T {
    const n = lage.art === "nachricht" ? lage.n : undefined;
    // Nur der belegte Nachrichtentext ist trennbar. Spätere Mischbearbeitungen bleiben gespeichert
    // und kehren bei Wiederfreigabe zurück. Keine Clientattribute, Quellenkennungen oder Bilder.
    const eigen = n
      ? ohneChatQuelle(
          {
            title: (n.text.split("\n")[0]?.trim() || n.text).slice(0, 120),
            statement: n.text.slice(0, 2_000),
            bodyHtml: n.text
              .split(/\n{2,}/)
              .map((s) => `<p>${html(s).replace(/\n/g, "<br>")}</p>`)
              .join(""),
          },
          {
            eigeneNachricht: n.text,
            zitat: n.ausschnitt?.text ?? "",
            quelle: n.ausschnitt?.quelle ?? "",
          },
        )
      : { title: "Übernommener Entwurf", statement: NEUTRAL, bodyHtml: `<p>${NEUTRAL}</p>` };
    return {
      ...draft,
      payload: {
        ...eigen,
        ...(draft.payload.confidentiality ? { confidentiality: draft.payload.confidentiality } : {}),
        tags: ["chat"],
      },
    };
  }

  async sicht<T extends Draft>(drafts: readonly T[], user: SessionUser): Promise<T[]> {
    if (drafts.length === 0) return [];
    const herkunft = await this.herkunft(drafts);
    const result: T[] = [];
    for (const draft of drafts) {
      const lage: Herkunft = herkunft.get(draft.id) ?? { art: "unbekannt" };
      result.push((await this.zugaenglich(lage, user)) ? draft : this.eingeschraenkt(draft, lage));
    }
    return result;
  }

  async verarbeitungErlaubt(draft: Draft, user: SessionUser): Promise<boolean> {
    const herkunft = await this.herkunft([draft]);
    return this.zugaenglich(herkunft.get(draft.id) ?? { art: "unbekannt" }, user);
  }
}
