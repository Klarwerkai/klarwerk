import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KnowledgeObject } from "../api/types";
import { KoView } from "./KoView";
import { Modal } from "./Modal";
import { Button } from "./ui";

// Pedi 04.07.: Auswahl des widersprechenden Objekts als durchsuchbares Pop-up statt Dropdown.
// Skaliert auf hunderte Objekte: Suche, Trefferliste, Vorschau zum Prüfen des richtigen Objekts
// und ein Link ins ganze Objekt — bevor man den Konflikt eröffnet.
interface ConflictTargetPickerProps {
  open: boolean;
  onClose: () => void;
  // Kandidaten (das aktuelle Objekt ist bereits herausgefiltert).
  candidates: KnowledgeObject[];
  onSelect: (koId: string) => void;
}

export function ConflictTargetPicker({
  open,
  onClose,
  candidates,
  onSelect,
}: ConflictTargetPickerProps): JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = candidates.filter((k) => {
    if (q === "") {
      return true;
    }
    return k.title.toLowerCase().includes(q) || k.statement.toLowerCase().includes(q);
  });

  return (
    <Modal open={open} onClose={onClose} title={t("ko.conflictTarget")}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("ko.conflictTargetSearch")}
        className="mb-3 h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text outline-none focus:border-ink/30"
      />
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">{t("ko.conflictTargetEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((k) => (
            <li key={k.id} className="rounded-card border border-hairline bg-page p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-text">{k.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {k.statement.length > 120 ? `${k.statement.slice(0, 120)} …` : k.statement}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button variant="primary" onClick={() => onSelect(k.id)}>
                    {t("ko.conflictTargetChoose")}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPreviewId(previewId === k.id ? null : k.id)}
                    className="text-[11.5px] font-semibold text-ai hover:underline"
                  >
                    {previewId === k.id ? t("ko.conflictTargetHide") : t("ko.conflictTargetShow")}
                  </button>
                </div>
              </div>
              {previewId === k.id ? (
                <div className="mt-2 border-t border-hairline pt-2">
                  <KoView ko={k} />
                  <Link
                    to={`/wissen/${k.id}`}
                    className="mt-2 inline-block text-[11.5px] font-semibold text-ai hover:underline"
                  >
                    {t("con.openKo")} →
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
