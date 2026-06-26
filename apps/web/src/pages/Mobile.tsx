import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FilePlus2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDrafts } from "../api/hooks";
import { useToast } from "../app/ToastContext";
import {
  type DraftFormState,
  EMPTY_DRAFT_FORM,
  draftTitle,
  draftToForm,
  formToPayload,
  isDraftFormFillable,
} from "../lib/draftForm";

// SCRUM-113 / FE-MOB-02/04/06: echte mobile Erfassung (Entwurf speichern/fortsetzen)
// auf demselben Draft-Pool wie Desktop. Bestätigung über den Toast-Bus.
export function Mobile(): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const drafts = useDrafts();

  const [form, setForm] = useState<DraftFormState>({ ...EMPTY_DRAFT_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = (): void => {
    setForm({ ...EMPTY_DRAFT_FORM });
    setEditingId(null);
  };
  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["drafts"] });
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  const save = useMutation({
    mutationFn: () => {
      const payload = formToPayload(form);
      return editingId
        ? endpoints.drafts.update(editingId, payload)
        : endpoints.drafts.create(payload);
    },
    onSuccess: () => {
      invalidate();
      push("success", editingId ? t("mob.updated") : t("mob.saved"));
      reset();
    },
    onError: fail,
  });

  const discard = useMutation({
    mutationFn: (id: string) => endpoints.drafts.remove(id),
    onSuccess: (_d, id) => {
      invalidate();
      push("success", t("mob.discarded"));
      if (editingId === id) {
        reset();
      }
    },
    onError: fail,
  });

  const resume = (id: string): void => {
    const d = (drafts.data ?? []).find((x) => x.id === id);
    if (d) {
      setForm(draftToForm(d));
      setEditingId(id);
    }
  };

  return (
    <div className="grid min-h-[520px] place-items-center rounded-card bg-page p-6">
      <div className="w-[340px] overflow-hidden rounded-[34px] border-4 border-ink bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-sans text-[15px] font-bold tracking-[2px] text-ink">KLARWERK</span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-trust-pos-text">
            <span className="h-1.5 w-1.5 rounded-full bg-trust-pos-fill" />
            online
          </span>
        </div>

        <h2 className="text-xl font-semibold text-ink">{t("mob.title")}</h2>
        <p className="mt-1 text-[13px] text-muted">{editingId ? t("mob.editing") : t("mob.sub")}</p>

        {/* FE-MOB-02: echte Erfassung */}
        <div className="mt-4 space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t("mob.formTitle")}
            className="h-10 w-full rounded-input border border-hairline bg-page px-3 text-sm outline-none focus:border-ink/30"
          />
          <textarea
            value={form.statement}
            onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
            placeholder={t("mob.formStatement")}
            rows={3}
            className="w-full resize-y rounded-input border border-hairline bg-page p-2.5 text-sm outline-none focus:border-ink/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={save.isPending || !isDraftFormFillable(form)}
              onClick={() => save.mutate()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-btn bg-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              <Check size={15} />
              {editingId ? t("mob.update") : t("mob.save")}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 rounded-btn border border-hairline px-3 py-2.5 text-[13px] font-semibold text-muted hover:text-text"
              >
                <FilePlus2 size={15} />
                {t("mob.new")}
              </button>
            ) : null}
          </div>
        </div>

        {/* FE-MOB-04: Entwürfe listen & fortsetzen (gemeinsamer Pool) */}
        <div className="mt-5">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
            {t("mob.drafts")}
          </div>
          {(drafts.data ?? []).length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("mob.draftsEmpty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {(drafts.data ?? []).map((d) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-2 rounded-input border px-2.5 py-2 ${
                    editingId === d.id ? "border-ink bg-page" : "border-hairline"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                    {draftTitle(d, t("capture.draftFallbackTitle"))}
                  </span>
                  <button
                    type="button"
                    title={t("mob.resume")}
                    onClick={() => resume(d.id)}
                    className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    type="button"
                    title={t("mob.discard")}
                    disabled={discard.isPending}
                    onClick={() => discard.mutate(d.id)}
                    className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
