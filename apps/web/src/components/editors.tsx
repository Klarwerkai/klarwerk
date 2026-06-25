import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, TextInput } from "./ui";

// Editor für Listenfelder (Bedingungen, Maßnahmen): eine Zeile je Eintrag.
export function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Reihenfolge ist stabil, Einträge sind editierbar.
          <div key={i} className="flex items-center gap-1.5">
            <TextInput
              value={it}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <button
              type="button"
              aria-label={t("capture.listRemove")}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
            >
              <X size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:opacity-80"
        >
          <Plus size={14} />
          {t("capture.listAdd")}
        </button>
      </div>
    </Field>
  );
}

export function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const add = (): void => {
    const v = draft.trim();
    if (v && !tags.includes(v)) {
      onChange([...tags, v]);
    }
    setDraft("");
  };
  return (
    <Field label={t("capture.fTags")}>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-pill bg-page px-2 py-0.5 text-[12px] text-text"
          >
            {tag}
            <button
              type="button"
              aria-label={t("capture.listRemove")}
              onClick={() => onChange(tags.filter((x) => x !== tag))}
              className="text-muted-2 hover:text-text"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={t("capture.tagPlaceholder")}
        className="mt-2 h-9 w-full rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
      />
    </Field>
  );
}
