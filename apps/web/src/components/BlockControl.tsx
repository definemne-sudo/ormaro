import { getTranslations } from "next-intl/server";
import { blockAction } from "@/app/[locale]/profile/actions";

/**
 * Engelle / engeli kaldır düğmesi. Engelleme bir onay adımıyla yapılır;
 * açılan kutu JavaScript gerektirmez.
 */
export async function BlockControl({
  locale,
  userId,
  name,
  blocked,
  back,
}: {
  locale: string;
  userId: string;
  name: string;
  blocked: boolean;
  back: string;
}) {
  const t = await getTranslations("block");
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  if (blocked) {
    return (
      <form action={blockAction}>
        {hidden}
        <input type="hidden" name="unblock" value="1" />
        <button type="submit" className="min-h-11 text-sm font-semibold text-muted underline">
          {t("unblock")}
        </button>
      </form>
    );
  }
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-muted underline [&::-webkit-details-marker]:hidden">
        {t("block")}
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
        <p className="text-sm">{t("confirm", { name })}</p>
        <form action={blockAction}>
          {hidden}
          <button type="submit" className="min-h-11 w-full rounded-xl bg-[#9A2B12] px-3 text-sm font-bold text-white">
            {t("confirmButton")}
          </button>
        </form>
      </div>
    </details>
  );
}
