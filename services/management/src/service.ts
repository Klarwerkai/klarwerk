// SCRUM-120: Management-Service. Sammelt echte Live-Daten aus den bestehenden
// Services und ruft die reinen Metriken. Stateless, keine Persistenz, keine KO-Mutation.
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { computeSnapshot } from "./metrics";
import type { BusFactorLike, ManagementSnapshot } from "./types";

export interface ManagementDeps {
  koService: KoService;
  listGaps: () => Promise<{ status: "offen" | "geschlossen" }[]>;
  // AUFTRAG-mega76 BLOCK D: ein Konflikt nennt ZWEI Wissensobjekte; sichtbar ist er nur, wenn
  // beide es sind (dieselbe Paar-Regel wie das Konflikt-Board). Die Auflösung braucht den
  // KO-Bestand und bleibt deshalb beim Aufrufer — hier reist nur die Entscheidung hinein.
  countOpenConflicts: (opts: { sichtbar: (ko: KnowledgeObject) => boolean }) => Promise<number>;
  pendingRevalidation: () => Promise<string[]>;
  // AUFTRAG-mega76 BLOCK D: der Bus-Faktor rechnet selbst über einer Grundmenge und braucht die
  // Sichtbarkeitsentscheidung deshalb DURCHGEREICHT — sonst hinge ein gefilterter Snapshot an
  // ungefilterten Kategoriezeilen.
  busFactor: (opts: { sichtbar: (ko: KnowledgeObject) => boolean }) => Promise<BusFactorLike[]>;
  now?: () => number;
}

export class ManagementService {
  private readonly deps: ManagementDeps;
  private readonly now: () => number;

  constructor(deps: ManagementDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => Date.now());
  }

  // AUFTRAG-mega76 BLOCK D — DER BREITESTE DER SECHS LECKPFADE (ben, sammel72).
  //
  // Der Snapshot leitet aus dem KO-Bestand Gesamt-, Validierungs- und Offen-Zähler ab, dazu
  // durchschnittliches Vertrauen, Reife-, Kapital- und Risikoscores, Kategorieprioritäten MIT
  // NAMEN, Knowledge-House-Zeilen mit `category`/`koCount`/`validatedRatio` und die
  // 30/60/90-Tage-Fenster. Ein einzelnes vertrauliches KO konnte eine neue Kategoriezeile
  // erzeugen, Zeitfenster verändern und mehrere globale Scores verschieben; bei einer
  // vertraulich-only Kategorie zeigte `house` unmittelbar Name und `koCount: 1`.
  //
  // `sichtbar` ist PFLICHT und greift an der GRUNDMENGE — vor `computeSnapshot`, nicht danach.
  async snapshot(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
  }): Promise<ManagementSnapshot> {
    const [alle, gaps, openConflicts, pending, busFactor] = await Promise.all([
      this.deps.koService.list({}),
      this.deps.listGaps(),
      this.deps.countOpenConflicts(opts),
      this.deps.pendingRevalidation(),
      this.deps.busFactor(opts),
    ]);
    const kos = alle.filter(opts.sichtbar);
    // Die Revalidierungsliste sind KO-Kennungen. Sie wird gegen den SICHTBAREN Bestand geschnitten
    // — ein unsichtbares Objekt darf auch nicht als Zahl in der Risikorechnung auftauchen.
    const sichtbareIds = new Set(kos.map((ko) => ko.id));
    const openGaps = gaps.filter((g) => g.status === "offen").length;
    const body = computeSnapshot({
      kos,
      openGaps,
      openConflicts,
      pendingRevalidation: pending.filter((id) => sichtbareIds.has(id)),
      busFactor,
      now: this.now(),
    });
    return { generatedAt: new Date(this.now()).toISOString(), ...body };
  }
}
