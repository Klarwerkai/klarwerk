import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileText, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useGraph, useImportCandidates, useOutputSources } from "../api/hooks";
import type { ImportItemInput, OutputDocument, OutputKind, ReviewAction } from "../api/types";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { Button, Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import { ImportParseError, parseImportItems } from "../lib/importReview";
import { OUTPUT_KIND_OPTIONS, downloadFilename, orderedSelection } from "../lib/outputDoc";

function Stufe2Header({ titleKey, ticket }: { titleKey: string; ticket: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageHeader
      kicker={t("s2.kicker")}
      title={t(titleKey)}
      actions={
        <span className="rounded-pill bg-ai-surface-1 px-2.5 py-1 font-mono text-[11px] font-semibold text-ai">
          Stufe 2 · {ticket}
        </span>
      }
    />
  );
}

function Notice({ textKey }: { textKey: string }): JSX.Element {
  const { t } = useTranslation();
  return <Card className="border-dashed text-center text-sm text-muted">{t(textKey)}</Card>;
}

// FR-EXT-03 / SCRUM-117+109: echte Output Factory — Dokumente NUR aus validierten KOs,
// mit Markdown-Export und voller Herkunft. Kein roher Library-Export, kein Fake.
export function Output(): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const { role } = useRole();
  const sources = useOutputSources();
  const [kind, setKind] = useState<OutputKind>("instruction");
  const [selected, setSelected] = useState<string[]>([]);
  const [doc, setDoc] = useState<OutputDocument | null>(null);

  const sourceIds = (sources.data ?? []).map((s) => s.id);
  const toggle = (id: string): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const generate = useMutation({
    mutationFn: () =>
      endpoints.output.generate({
        kind,
        koIds: orderedSelection(selected, sourceIds),
        audienceRole: role,
      }),
    onSuccess: (d) => setDoc(d),
    onError: () => push("error", t("out.genError")),
  });

  const copy = (): void => {
    if (doc) {
      void navigator.clipboard
        ?.writeText(doc.markdown)
        .then(() => push("success", t("out.copied")));
    }
  };
  const download = (): void => {
    if (!doc) {
      return;
    }
    const blob = new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename(doc);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.output" ticket="SCRUM-117" />

      <Card className="mb-4">
        <SectionLabel>{t("out.kindTitle")}</SectionLabel>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUT_KIND_OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => setKind(o.kind)}
              className={`rounded-card border p-2.5 text-left ${
                kind === o.kind ? "border-ink bg-page" : "border-hairline hover:border-ink/30"
              }`}
            >
              <div className="text-[13px] font-semibold text-ink">{t(o.labelKey)}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{t(o.descKey)}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <SectionLabel>{t("out.sourcesTitle")}</SectionLabel>
        <QueryState query={sources} emptyText={t("out.noValidated")}>
          {(list) => (
            <ul className="mt-2 space-y-1.5">
              {list.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-input border border-hairline px-2.5 py-2 hover:bg-hairline-soft">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">{s.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-2">
                      {s.type} · {s.category} · T{s.trust} · v{s.version}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        <div className="mt-3">
          <Button
            variant="primary"
            disabled={selected.length === 0 || generate.isPending}
            onClick={() => generate.mutate()}
          >
            <FileText size={15} />
            {t("out.generate")}
          </Button>
        </div>
      </Card>

      {doc ? (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>{t("out.previewTitle")}</SectionLabel>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={copy}>
                <Copy size={14} />
                {t("out.copy")}
              </Button>
              <Button variant="ghost" onClick={download}>
                <Download size={14} />
                {t("out.download")}
              </Button>
            </div>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-card bg-page p-3 text-[12.5px] leading-relaxed text-text">
            {doc.markdown}
          </pre>
          <div className="mt-3">
            <SectionLabel>{t("out.provenanceTitle")}</SectionLabel>
            <ul className="mt-1.5 space-y-1">
              {doc.provenance.map((p) => (
                <li key={p.koId} className="text-[12px] text-muted">
                  <span className="font-mono text-[11px] text-ink">{p.koId}</span> · {p.status} · T
                  {p.trust} · {p.validity}
                  {p.uncertain ? (
                    <span className="text-trust-warn-text"> · {t("out.uncertain")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

const REVIEW_TONE: Record<string, string> = {
  neu: "bg-page text-muted",
  angenommen: "bg-trust-pos-bg text-trust-pos-text",
  abgelehnt: "bg-trust-crit-bg text-trust-crit-text",
  "info-angefragt": "bg-trust-warn-bg text-trust-warn-text",
};

// SCRUM-108/116/FE-LIB-04: JSON-Re-Import mit echter Source-Review-Queue.
export function ImportReview(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const query = useImportCandidates();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const createCandidates = useMutation({
    mutationFn: (items: ImportItemInput[]) => endpoints.library.importCandidates.create(items),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["import-candidates"] });
      push("success", t("imp.parsed", { n: created.length }));
    },
    onError: () => push("error", t("state.error")),
  });

  const review = useMutation({
    mutationFn: (v: { id: string; action: ReviewAction; note?: string }) =>
      endpoints.library.importCandidates.review(v.id, v.action, v.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["import-candidates"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      setNoteId(null);
      setNote("");
      push("success", t("imp.reviewed"));
    },
    onError: () => push("error", t("state.error")),
  });

  const onFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      const items = parseImportItems(await file.text());
      createCandidates.mutate(items);
    } catch (err) {
      push("error", err instanceof ImportParseError ? t("imp.parseError") : t("state.error"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.import" ticket="SCRUM-116" />

      <Card className="mb-5">
        <SectionLabel>{t("imp.uploadTitle")}</SectionLabel>
        <p className="mb-3 text-[13px] text-muted">{t("imp.uploadHint")}</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft">
          <Upload size={15} />
          {t("imp.upload")}
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            disabled={createCandidates.isPending}
            onChange={(e) => void onFile(e)}
          />
        </label>
      </Card>

      <SectionLabel>{t("imp.queueTitle")}</SectionLabel>
      <QueryState query={query} emptyText={t("imp.queueEmpty")}>
        {(candidates) =>
          candidates.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted">
              {t("imp.queueEmpty")}
            </Card>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <Card key={c.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${
                        REVIEW_TONE[c.status] ?? "bg-page text-muted"
                      }`}
                    >
                      {t(`imp.status.${c.status}`)}
                    </span>
                    {c.duplicate ? (
                      <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text">
                        {t("imp.duplicate")}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text">
                      {c.item.title}
                    </span>
                    <span className="font-mono text-[11px] text-muted-2">{c.item.category}</span>
                  </div>
                  <p className="text-[13px] text-muted">{c.item.statement}</p>
                  {c.note ? (
                    <p className="text-[12px] text-trust-warn-text">
                      {t("imp.note")}: {c.note}
                    </p>
                  ) : null}

                  {c.status === "neu" ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2">
                      <Button
                        variant="primary"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: c.id, action: "accept" })}
                      >
                        {t("imp.accept")}
                      </Button>
                      <Button
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: c.id, action: "reject" })}
                      >
                        {t("imp.reject")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setNoteId((id) => (id === c.id ? null : c.id));
                          setNote("");
                        }}
                      >
                        {t("imp.info")}
                      </Button>
                    </div>
                  ) : null}

                  {noteId === c.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("imp.notePlaceholder")}
                        className="h-9 flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
                      />
                      <Button
                        variant="primary"
                        disabled={review.isPending || note.trim().length === 0}
                        onClick={() =>
                          review.mutate({ id: c.id, action: "info", note: note.trim() })
                        }
                      >
                        {t("imp.infoSend")}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )
        }
      </QueryState>
    </div>
  );
}

export function Capital(): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.capital" ticket="SCRUM-120" />
      <Notice textKey="s2.capital" />
    </div>
  );
}

export function GraphView(): JSX.Element {
  const { t } = useTranslation();
  const query = useGraph();
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.graph" ticket="SCRUM-119" />
      <QueryState query={query} emptyText={t("s2.graphEmpty")}>
        {(g) => (
          <Card>
            <p className="mb-3 text-[13px] text-muted">
              {t("s2.graphCount", { nodes: g.nodes.length, edges: g.edges.length })}
            </p>
            <div className="space-y-1.5">
              {g.edges.slice(0, 30).map((e) => (
                <div
                  key={`${e.a}-${e.via}-${e.b}`}
                  className="flex items-center gap-2 font-mono text-[12px] text-text"
                >
                  <span className="truncate">{e.a}</span>
                  <span className="text-muted-2">—{e.via}→</span>
                  <span className="truncate">{e.b}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
