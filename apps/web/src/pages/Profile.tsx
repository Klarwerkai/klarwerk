import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { useSession } from "../app/AuthContext";
import { Avatar, Button, Card, Field, PageHeader } from "../components/ui";

export function Profile(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user, refresh } = useSession();
  const logout = useMutation({ mutationFn: () => authApi.logout(), onSuccess: () => refresh() });
  const initials = (user?.name ?? "??").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader kicker={t("prof.kicker")} title={t("nav.profile")} />
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} />
          <div>
            <div className="text-[15px] font-semibold text-text">{user?.name ?? "—"}</div>
            <div className="font-mono text-[12px] text-muted-2">{user?.email ?? ""}</div>
          </div>
          <span className="ml-auto rounded-pill bg-page px-2.5 py-1 text-[12px] font-semibold text-muted">
            {t(`role.name.${user?.role ?? "viewer"}`)}
          </span>
        </div>

        <Field label={t("prof.language")}>
          <div className="flex gap-1.5">
            {(["de", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => void i18n.changeLanguage(l)}
                className={`rounded-btn px-3 py-1.5 text-[13px] font-semibold uppercase ${
                  i18n.language.startsWith(l)
                    ? "bg-ink text-white"
                    : "border border-hairline text-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>

        <div className="border-t border-hairline pt-4">
          <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
            {t("action.logout")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
