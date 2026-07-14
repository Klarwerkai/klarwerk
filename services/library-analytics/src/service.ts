import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { KnowledgeObject, KoFilter, KoService } from "../../knowledge-object";
import { type CandidateRepo, InMemoryCandidateRepo } from "./repo";
import {
  type Analytics,
  type BusFactorEntry,
  type ExpertiseEntry,
  type Graph,
  type GraphEdge,
  type ImportCandidate,
  type ImportItem,
  type ImportResult,
  LibraryError,
  type ReviewAction,
} from "./types";

export interface LibraryServiceDeps {
  koService: KoService;
  audit?: AuditService;
  // SCRUM-157: persistente Import-Queue. Optional; ohne Angabe In-Memory (Dev/Test).
  candidates?: CandidateRepo;
  genId?: () => string;
  now?: () => number;
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export class LibraryService {
  private readonly koService: KoService;
  private readonly audit: AuditService | undefined;
  private readonly genId: () => string;
  private readonly now: () => number;
  // SCRUM-116/157: Import-/Source-Review-Queue über ein Repo (persistent via Pg, sonst In-Memory).
  private readonly candidates: CandidateRepo;

  constructor(deps: LibraryServiceDeps) {
    this.koService = deps.koService;
    this.audit = deps.audit;
    this.candidates = deps.candidates ?? new InMemoryCandidateRepo();
    this.genId = deps.genId ?? (() => randomUUID());
    this.now = deps.now ?? (() => Date.now());
  }

  // SCRUM-116: JSON-Re-Import erzeugt Review-Kandidaten (keine stille Bulk-Anlage).
  async createImportCandidates(
    items: readonly ImportItem[],
    actor = "system",
  ): Promise<ImportCandidate[]> {
    const existing = await this.koService.list();
    const seen = new Set(existing.map((ko) => `${ko.title}|${ko.statement}`));
    const at = new Date(this.now()).toISOString();
    const created = items.map<ImportCandidate>((item) => ({
      id: this.genId(),
      item,
      status: "neu",
      duplicate: seen.has(`${item.title}|${item.statement}`),
      note: null,
      koId: null,
      createdAt: at,
    }));
    for (const candidate of created) {
      await this.candidates.insert(candidate);
    }
    await this.audit?.record({
      actor,
      action: "import.candidates-created",
      target: "library",
      payload: { count: created.length },
    });
    return created;
  }

  listImportCandidates(): Promise<ImportCandidate[]> {
    return this.candidates.all();
  }

  // SCRUM-116: Review-Aktion. accept → echtes KO (außer Dublette, dann übersprungen).
  async reviewImportCandidate(
    id: string,
    action: ReviewAction,
    actor = "system",
    note?: string,
  ): Promise<ImportCandidate> {
    const candidate = await this.candidates.findById(id);
    if (!candidate) {
      throw new LibraryError("NOT_FOUND", "Importkandidat nicht gefunden.");
    }
    if (candidate.status !== "neu") {
      throw new LibraryError("ALREADY_REVIEWED", "Kandidat wurde bereits bearbeitet.");
    }
    if (action === "reject") {
      candidate.status = "abgelehnt";
    } else if (action === "info") {
      candidate.status = "info-angefragt";
      candidate.note = note?.trim() ? note.trim() : null;
    } else {
      // accept: nicht-Dublette → echtes KO im normalen Wissensobjekt-/Validierungsfluss.
      candidate.status = "angenommen";
      if (!candidate.duplicate) {
        const ko = await this.koService.create({
          title: candidate.item.title,
          statement: candidate.item.statement,
          type: candidate.item.type,
          category: candidate.item.category,
          author: candidate.item.author ?? actor,
          tags: candidate.item.tags ?? [],
        });
        candidate.koId = ko.id;
      }
    }
    // SCRUM-157: geänderten Status/koId/Note persistieren (kein stiller Verlust).
    await this.candidates.update(candidate);
    await this.audit?.record({
      actor,
      action: `import.candidate-${action}`,
      target: candidate.id,
      payload: { duplicate: candidate.duplicate, koId: candidate.koId },
    });
    return { ...candidate };
  }

  // FR-LIB-01: Suche + Filter.
  async search(query: string, filter: KoFilter = {}): Promise<KnowledgeObject[]> {
    const list = await this.koService.list(filter);
    const q = query.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter(
      (ko) => ko.title.toLowerCase().includes(q) || ko.statement.toLowerCase().includes(q),
    );
  }

  // FR-LIB-02: Export als JSON / MediaWiki.
  async exportJson(ids?: readonly string[]): Promise<KnowledgeObject[]> {
    const list = await this.koService.list();
    return ids ? list.filter((ko) => ids.includes(ko.id)) : list;
  }

  async exportMediaWiki(ids?: readonly string[]): Promise<string> {
    const items = await this.exportJson(ids);
    return items.map((ko) => `== ${ko.title} ==\n${ko.statement}`).join("\n\n");
  }

  // FR-LIB-02: echtes Text-Markdown (Überschrift, Listen, Herkunfts-Fußzeile).
  async exportMarkdown(ids?: readonly string[]): Promise<string> {
    const items = await this.exportJson(ids);
    return items
      .map((ko) => {
        const lines: string[] = [`# ${ko.title}`, "", ko.statement];
        if (ko.conditions.length > 0) {
          lines.push("", "**Wann es gilt**", ...ko.conditions.map((c) => `- ${c}`));
        }
        if (ko.measures.length > 0) {
          lines.push("", "**Vorgehen**", ...ko.measures.map((m) => `- ${m}`));
        }
        const author =
          ko.author === ko.originalAuthor
            ? ko.author
            : `${ko.author} (urspr. ${ko.originalAuthor})`;
        lines.push(
          "",
          `_${ko.type} · ${ko.category} · Trust ${ko.trust} · ${ko.status} · Autor: ${author}_`,
        );
        return lines.join("\n");
      })
      .join("\n\n---\n\n");
  }

  // FR-LIB-02: druckfertiges HTML — der Browser erzeugt daraus per „Als PDF sichern" das PDF.
  async exportHtml(ids?: readonly string[]): Promise<string> {
    const items = await this.exportJson(ids);
    const esc = (s: string): string =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const li = (xs: readonly string[]): string => xs.map((x) => `<li>${esc(x)}</li>`).join("");
    const articles = items
      .map((ko) => {
        const conditions = ko.conditions.length
          ? `<p><strong>Wann es gilt</strong></p><ul>${li(ko.conditions)}</ul>`
          : "";
        const measures = ko.measures.length
          ? `<p><strong>Vorgehen</strong></p><ul>${li(ko.measures)}</ul>`
          : "";
        const author =
          ko.author === ko.originalAuthor
            ? esc(ko.author)
            : `${esc(ko.author)} (urspr. ${esc(ko.originalAuthor)})`;
        return `<article><h2>${esc(ko.title)}</h2><p class="meta">${esc(ko.type)} · ${esc(ko.category)} · Trust ${ko.trust} · ${esc(ko.status)}</p><p>${esc(ko.statement)}</p>${conditions}${measures}<p class="src">Autor: ${author}</p></article>`;
      })
      .join("\n");
    const style =
      "body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#1f2a37}" +
      "h2{margin-bottom:.2rem}.meta{color:#666;font-size:.85rem;margin-top:0}" +
      "article{break-inside:avoid;border-bottom:1px solid #eee;padding:1rem 0}" +
      ".src{color:#888;font-size:.8rem}@media print{body{margin:0}}";
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>KLARWERK Export</title><style>${style}</style></head><body><h1>KLARWERK — Wissensexport</h1>${articles}</body></html>`;
  }

  // FR-LIB-02: Import per JSON ohne Duplikate.
  async importJson(items: readonly ImportItem[], defaultAuthor = "import"): Promise<ImportResult> {
    const existing = await this.koService.list();
    const seen = new Set(existing.map((ko) => `${ko.title}|${ko.statement}`));
    let imported = 0;
    let skipped = 0;
    for (const item of items) {
      const key = `${item.title}|${item.statement}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      await this.koService.create({
        title: item.title,
        statement: item.statement,
        type: item.type,
        category: item.category,
        author: item.author ?? defaultAuthor,
        tags: item.tags ?? [],
      });
      seen.add(key);
      imported += 1;
    }
    await this.audit?.record({
      actor: defaultAuthor,
      action: "library.import",
      target: "library",
      payload: { imported, skipped },
    });
    return { imported, skipped };
  }

  // FR-LIB-03: Bus-Faktor je Kategorie (Einzelquelle = nur ein Autor).
  async busFactor(): Promise<BusFactorEntry[]> {
    const list = await this.koService.list();
    const byCategory = new Map<string, { authors: Set<string>; count: number }>();
    for (const ko of list) {
      const entry = byCategory.get(ko.category) ?? { authors: new Set<string>(), count: 0 };
      entry.authors.add(ko.originalAuthor);
      entry.count += 1;
      byCategory.set(ko.category, entry);
    }
    return [...byCategory.entries()].map(([category, entry]) => ({
      category,
      authorCount: entry.authors.size,
      koCount: entry.count,
      singleSource: entry.authors.size <= 1,
    }));
  }

  // Consultant-System (Experten-Matching): Thema (Kategorie) → beitragende Personen. Wissensträger =
  // `originalAuthor` (wer das Wissen einbrachte; bewusste Produktentscheidung, konsistent mit busFactor).
  // BEWUSST ohne Score/Trust/Zeitreihe und OHNE Sortierung nach Beitragsmenge — Reihenfolge ist rein
  // alphabetisch (deterministisch), damit keine Rangliste entsteht. Reine Aggregation, kein DB-Umbau.
  // Sichtbarkeit/Freigabe regelt die Route (Recht ko.assign + Feature-Flag, Default AUS).
  async expertise(): Promise<ExpertiseEntry[]> {
    const list = await this.koService.list();
    const byCategory = new Map<string, Map<string, number>>();
    for (const ko of list) {
      const authors = byCategory.get(ko.category) ?? new Map<string, number>();
      authors.set(ko.originalAuthor, (authors.get(ko.originalAuthor) ?? 0) + 1);
      byCategory.set(ko.category, authors);
    }
    return [...byCategory.entries()].map(([category, authors]) => ({
      category,
      contributors: [...authors.entries()]
        .map(([authorId, koCount]) => ({ authorId, koCount }))
        .sort((a, b) => (a.authorId < b.authorId ? -1 : a.authorId > b.authorId ? 1 : 0)),
    }));
  }

  // FR-LIB-04: Graph aus gemeinsamen Tags.
  async graph(): Promise<Graph> {
    const list = await this.koService.list();
    const nodes = list.map((ko) => ({ id: ko.id, title: ko.title }));
    const edges: GraphEdge[] = [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) {
          continue;
        }
        const shared = a.tags.find((tag) => b.tags.includes(tag));
        if (shared) {
          edges.push({ a: a.id, b: b.id, via: shared });
        }
      }
    }
    return { nodes, edges };
  }

  // FR-ANA-01: Bestände nach Status / Art / Kategorie.
  async analytics(): Promise<Analytics> {
    const list = await this.koService.list();
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const ko of list) {
      increment(byStatus, ko.status);
      increment(byType, ko.type);
      increment(byCategory, ko.category);
    }
    return { total: list.length, byStatus, byType, byCategory };
  }
}
