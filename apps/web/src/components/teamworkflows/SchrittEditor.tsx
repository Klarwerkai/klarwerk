import { ArrowDown, ArrowUp, Bot, ClipboardCheck, GitBranch, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AssistentZeile, Urteil } from "../../api/teamassistenten";
import type { Schritt } from "../../api/teamworkflows";
import { eingabestil } from "../teamassistenten/teamKontext";
import { Button, Field, TextInput } from "../ui";

export const schrittIcon = { assistent: Bot, entscheidung: GitBranch, aktion: ClipboardCheck };
export function neuerSchritt(typ: Schritt["typ"]): Schritt {
  if (typ === "assistent")
    return { typ, titel: "", assistentId: "", version: 0, frage: "", erwartet: "belegt" };
  if (typ === "entscheidung") return { typ, titel: "", rolle: "verantwortlich" };
  return { typ, titel: "", aktion: "ergebnis_festhalten" };
}
export function SchrittEditor({
  schritt: s,
  index,
  anzahl,
  assistenten,
  set,
  verschieben,
  entfernen,
}: {
  schritt: Schritt;
  index: number;
  anzahl: number;
  assistenten: AssistentZeile[];
  set: (s: Schritt) => void;
  verschieben: (richtung: number) => void;
  entfernen: () => void;
}) {
  const { t } = useTranslation();
  const Icon = schrittIcon[s.typ];
  const erreichbar =
    s.typ !== "assistent" ||
    assistenten.some((a) => a.id === s.assistentId && a.aktiv === s.version);
  return (
    <li
      className="space-y-3 rounded-card border border-hairline bg-surface p-4"
      data-testid="workflow-schritt"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Icon aria-hidden size={17} />
          {t("workflows.schrittTyp", { n: index + 1, typ: t(`workflows.typ.${s.typ}`) })}
        </h4>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label={t("workflows.auf", { n: index + 1 })}
            disabled={index === 0}
            onClick={() => verschieben(-1)}
          >
            <ArrowUp aria-hidden size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={t("workflows.ab", { n: index + 1 })}
            disabled={index === anzahl - 1}
            onClick={() => verschieben(1)}
          >
            <ArrowDown aria-hidden size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={t("workflows.entfernenSchritt", { n: index + 1 })}
            onClick={entfernen}
          >
            <Trash2 aria-hidden size={15} />
          </Button>
        </div>
      </div>
      <Field label={t("workflows.schrittTitel")}>
        <TextInput
          data-testid="schritt-titel"
          value={s.titel}
          maxLength={150}
          required
          onChange={(e) => set({ ...s, titel: e.target.value })}
        />
      </Field>
      {s.typ === "assistent" ? (
        <>
          <Field label={t("workflows.assistent")}>
            <select
              className={eingabestil}
              data-testid="schritt-assistent"
              value={erreichbar ? s.assistentId : ""}
              onChange={(e) => {
                const a = assistenten.find((x) => x.id === e.target.value);
                set({ ...s, assistentId: a?.id ?? "", version: a?.aktiv ?? 0 });
              }}
            >
              <option value="">{t("workflows.waehlen")}</option>
              {assistenten.map((a) => (
                <option key={a.id} value={a.id}>
                  {t("workflows.nameVersion", { name: a.aktivName || a.name, v: a.aktiv })}
                </option>
              ))}
            </select>
          </Field>
          {!erreichbar && s.assistentId ? (
            <p role="alert" className="text-sm text-muted">
              {t("workflows.ersetzt", { v: s.version })}
            </p>
          ) : null}
          {!assistenten.length ? (
            <p className="text-sm text-muted">
              {t("workflows.keinAssistent")}{" "}
              <a className="text-accent underline" href="/teamassistenten?verwalten=1">
                {t("teamassistenten.verwalten")}
              </a>
            </p>
          ) : null}
          <Field label={t("workflows.frage")}>
            <textarea
              className={eingabestil}
              data-testid="schritt-frage"
              rows={2}
              value={s.frage}
              maxLength={1000}
              onChange={(e) => set({ ...s, frage: e.target.value })}
            />
          </Field>
          <p className="text-sm text-muted">
            {t("workflows.fallHinweis", { platzhalter: "{{fall}}" })}
          </p>
          <Field label={t("workflows.erwartet")}>
            <select
              className={eingabestil}
              value={s.erwartet}
              onChange={(e) => set({ ...s, erwartet: e.target.value as Urteil })}
            >
              {(["belegt", "widerspruch", "offen"] as const).map((u) => (
                <option key={u} value={u}>
                  {t(`teamassistenten.${u}`)}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : s.typ === "entscheidung" ? (
        <Field label={t("workflows.werEntscheidet")}>
          <select
            data-testid="schritt-rolle"
            className={eingabestil}
            value={s.rolle}
            onChange={(e) =>
              set({ ...s, rolle: e.target.value === "mitglied" ? "mitglied" : "verantwortlich" })
            }
          >
            <option value="verantwortlich">{t("workflows.rolle.verantwortlich")}</option>
            <option value="mitglied">{t("workflows.rolle.mitglied")}</option>
          </select>
        </Field>
      ) : (
        <p className="text-sm text-muted">{t("workflows.wirkung")}</p>
      )}
    </li>
  );
}
