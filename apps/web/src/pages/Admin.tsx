import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useUsers } from "../api/hooks";
import { ROLES, type Role } from "../app/navigation";
import { Card, PageHeader, QueryState } from "../components/ui";

export function Admin(): JSX.Element {
  const { t } = useTranslation();
  const query = useUsers();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["users"] });
  const approve = useMutation({ mutationFn: (id: string) => endpoints.users.approve(id), onSuccess: invalidate });
  const setRole = useMutation({
    mutationFn: (v: { id: string; role: Role }) => endpoints.users.setRole(v.id, v.role),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => endpoints.users.remove(id), onSuccess: invalidate });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("adm.kicker")} title={t("nav.admin")} />
      <QueryState query={query} emptyText={t("adm.empty")}>
        {(users) => (
          <Card className="p-0">
            <div className="divide-y divide-hairline">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-text">{u.name}</div>
                    <div className="truncate font-mono text-[11px] text-muted-2">{u.email}</div>
                  </div>
                  {u.approved ? (
                    <select
                      value={u.role}
                      onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as Role })}
                      className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.name.${r}`)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => approve.mutate(u.id)}
                      className="rounded-btn bg-trust-pos-bg px-3 py-1.5 text-[12.5px] font-semibold text-trust-pos-text hover:opacity-80"
                    >
                      {t("adm.approve")}
                    </button>
                  )}
                  <button
                    type="button"
                    title={t("adm.remove")}
                    onClick={() => remove.mutate(u.id)}
                    className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
