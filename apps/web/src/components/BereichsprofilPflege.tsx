// ================================================================================================
// R-0751 · R-1639 · R-2183 (Nacharbeit 3) — DIE PFLEGE DER FEHLENDEN EINGÄNGE (NUR ADMIN).
// ================================================================================================
//
// Am Wissensobjekt gibt es weder Kritikalität, Prozessnähe, Wiederholhäufigkeit noch
// Schadenspotenzial, keine Bereichsverantwortung und keinen Ruhestandshorizont. Diese Fläche pflegt
// sie dort, wo das Produkt sie braucht:
//   · je Kategorie: verantwortliche Person (aus dem Verzeichnis) und die vier Stufen — leer heisst
//     weiterhin „keine Eingangsdaten", nie 0;
//   · je Konto: Ruhestand in den nächsten 24 oder 36 Monaten (oder nichts). Gespeichert werden nur
//     Horizont und Frist — kein Geburts- oder Renteneintrittsdatum.
// Die Server-Türen fordern `users.manage`; die Seite zeigt die Fläche nur der Admin-Rolle.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useDirectory, useKos, useManagementProfiles } from "../api/hooks";
import type {
  AssessmentLevel,
  CategoryProfile,
  CategoryProfileInput,
  RetirementHorizon,
} from "../api/types";
import { useToast } from "../app/ToastContext";
import { Button, Card, QueryState, SectionLabel } from "./ui";

const STUFEN: readonly AssessmentLevel[] = ["niedrig", "mittel", "hoch"];
const FAKTOREN = ["criticality", "processProximity", "repetition", "damagePotential"] as const;
const SELECT = "h-8 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted";

function leeresProfil(category: string): CategoryProfileInput {
  return {
    category,
    managerId: null,
    criticality: null,
    processProximity: null,
    repetition: null,
    damagePotential: null,
  };
}

function ProfilZeile({
  category,
  profil,
  personen,
}: {
  category: string;
  profil: CategoryProfile | undefined;
  personen: readonly { id: string; name: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [entwurf, setEntwurf] = useState<CategoryProfileInput>(() => {
    if (!profil) {
      return leeresProfil(category);
    }
    const { updatedAt: _a, updatedBy: _b, ...rest } = profil;
    return rest;
  });
  const speichern = useMutation({
    mutationFn: () => endpoints.management.setCategoryProfile(entwurf),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["management"] }),
  });
  return (
    <div data-testid="pflege-bereich" data-kategorie={category} className="space-y-1.5 py-2">
      <div className="text-[13px] font-medium text-text">{category}</div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t("risk.pflege.manager", { category })}
          data-testid="pflege-manager"
          value={entwurf.managerId ?? ""}
          onChange={(e) => setEntwurf((v) => ({ ...v, managerId: e.target.value || null }))}
          className={SELECT}
        >
          <option value="">{t("risk.pflege.noManager")}</option>
          {personen.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
        {FAKTOREN.map((f) => (
          <select
            key={f}
            aria-label={t(`mgmt.prio.factor.${f}`)}
            data-testid="pflege-faktor"
            data-faktor={f}
            value={entwurf[f] ?? ""}
            onChange={(e) =>
              setEntwurf((v) => ({ ...v, [f]: (e.target.value || null) as AssessmentLevel | null }))
            }
            className={SELECT}
          >
            <option value="">{`${t(`mgmt.prio.factor.${f}`)}: ${t("mgmt.prio.noData")}`}</option>
            {STUFEN.map((s) => (
              <option key={s} value={s}>
                {`${t(`mgmt.prio.factor.${f}`)}: ${t(`risk.horizon.level.${s}`)}`}
              </option>
            ))}
          </select>
        ))}
        <Button
          data-testid="pflege-speichern"
          onClick={() => speichern.mutate()}
          disabled={speichern.isPending}
        >
          {t("risk.pflege.save")}
        </Button>
      </div>
      {speichern.isError ? (
        <p className="text-[11.5px] text-trust-crit-text">{t("risk.pflege.error")}</p>
      ) : null}
    </div>
  );
}

/** Auswahlwert → Horizont; leer heisst „kein Eintrag" (der Server entfernt ihn dann). */
function horizontAus(wert: string): RetirementHorizon | null {
  if (wert === "24") {
    return 24;
  }
  return wert === "36" ? 36 : null;
}

function RuhestandZeile({
  person,
  horizont,
}: {
  person: { id: string; name: string };
  horizont: RetirementHorizon | null;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const name = person.name || person.id;
  // R-0953 / R-0956: bis hierher hing die Auswahl allein am Serverwert, und ein gescheitertes
  // Speichern blieb stumm — die Auswahl sprang kommentarlos auf den alten Wert zurück. Jetzt hält
  // `gewaehlt` die Eingabe, bis der Server sie bestätigt hat (und die Abfrage den neuen Stand
  // trägt); scheitert das Speichern, bleibt sie stehen und lässt sich mit demselben Wert wiederholen.
  // Erfolg und Fehler melden sich zusätzlich über den Benachrichtigungs-Bus.
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const setzen = useMutation({
    mutationFn: (h: RetirementHorizon | null) => endpoints.management.setRetirement(person.id, h),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["management"] });
      setGewaehlt(null);
      push("success", t("risk.pflege.retirementSaved", { name }));
    },
    onError: () => {
      push("error", t("risk.pflege.retirementError", { name }));
    },
  });
  const wert = gewaehlt ?? (horizont === null ? "" : String(horizont));
  return (
    <div data-testid="pflege-ruhestand" data-person={person.id} className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-text">{name}</span>
        <select
          aria-label={t("risk.pflege.retirement", { name })}
          value={wert}
          disabled={setzen.isPending}
          onChange={(e) => {
            setGewaehlt(e.target.value);
            setzen.mutate(horizontAus(e.target.value));
          }}
          className={SELECT}
        >
          <option value="">{t("risk.pflege.noRetirement")}</option>
          <option value="24">{t("risk.horizon.filter", { months: 24 })}</option>
          <option value="36">{t("risk.horizon.filter", { months: 36 })}</option>
        </select>
      </div>
      {setzen.isError && gewaehlt !== null ? (
        <div
          data-testid="pflege-ruhestand-fehler"
          className="flex flex-wrap items-center gap-2 text-[11.5px] text-trust-crit-text"
        >
          <span className="flex-1">{t("risk.pflege.retirementError", { name })}</span>
          <Button
            data-testid="pflege-ruhestand-erneut"
            onClick={() => setzen.mutate(horizontAus(gewaehlt))}
          >
            {t("loadstate.error.retry")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function BereichsprofilPflege(): JSX.Element {
  const { t } = useTranslation();
  const profile = useManagementProfiles(true);
  const kos = useKos();
  const verzeichnis = useDirectory();
  const personen = verzeichnis.data ?? [];
  return (
    <div data-testid="bereichsprofil-pflege">
      <SectionLabel>{t("risk.pflege.title")}</SectionLabel>
      <p className="mb-2 text-[12px] text-muted-2">{t("risk.pflege.intro")}</p>
      <QueryState query={profile}>
        {(p) => {
          const kategorien = [
            ...new Set([
              ...(kos.data ?? []).map((k) => k.category),
              ...p.categories.map((c) => c.category),
            ]),
          ].sort((a, b) => a.localeCompare(b));
          const horizontVon = new Map(p.retirement.map((r) => [r.userId, r.horizonMonths]));
          return (
            <div className="space-y-3">
              <Card className="divide-y divide-hairline">
                {kategorien.map((c) => (
                  <ProfilZeile
                    key={c}
                    category={c}
                    profil={p.categories.find((x) => x.category === c)}
                    personen={personen}
                  />
                ))}
              </Card>
              <Card className="space-y-1.5">
                <div className="text-[12.5px] font-medium text-text">
                  {t("risk.pflege.retirementTitle")}
                </div>
                {personen.map((person) => (
                  <RuhestandZeile
                    key={person.id}
                    person={person}
                    horizont={horizontVon.get(person.id) ?? null}
                  />
                ))}
              </Card>
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
