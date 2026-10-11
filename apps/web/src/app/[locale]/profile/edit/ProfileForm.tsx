"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useRef, useState } from "react";
import { compress, upload } from "@/lib/imageUpload";
import { type ProfileState, updateProfileAction } from "../actions";

type Option = { value: string; label: string };

const field =
  "h-12 w-full rounded-xl border border-field bg-white px-3.5 text-[15px] text-ink focus:border-brand-strong focus:outline-none";

export function ProfileForm(props: {
  locale: string;
  name: string;
  cityKey: string;
  avatarSrc: string | null;
  cities: Option[];
}) {
  const t = useTranslations("profileEdit");
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfileAction, {});
  // "keep": değişmedi, "remove": kaldırılacak, diğer: yeni yüklenen dosyanın anahtarı.
  const [avatar, setAvatar] = useState("keep");
  const [preview, setPreview] = useState<string | null>(props.avatarSrc);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const f = state.fields ?? { name: props.name, cityKey: props.cityKey };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(false);
    setUploading(true);
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const key = await upload(await compress(file, 512), "avatar");
      setAvatar(key);
    } catch {
      setUploadError(true);
      setPreview(props.avatarSrc);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-5 bg-white px-4 py-5"
    >
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="avatar" value={avatar} />

      {state.error && (
        <p role="alert" className="rounded-xl border border-[#F3B8A8] bg-[#FDF0EC] p-3 text-[15px] font-semibold text-[#9A2B12]">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={t("photoAlt")}
            referrerPolicy="no-referrer"
            className={"h-20 w-20 flex-none rounded-full object-cover " + (uploading ? "opacity-50" : "")}
          />
        ) : (
          <span aria-hidden="true" className="flex h-20 w-20 flex-none items-center justify-center rounded-full bg-brand-tint text-3xl font-bold text-brand-deep">
            {(f.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="flex flex-col items-start gap-1">
          <label className="flex min-h-11 cursor-pointer items-center rounded-xl border border-field px-3.5 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-strong">
            {preview ? t("changePhoto") : t("addPhoto")}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onFile(e.currentTarget.files?.[0])}
            />
          </label>
          {preview && (
            <button
              type="button"
              onClick={() => {
                setAvatar("remove");
                setPreview(null);
              }}
              className="min-h-11 text-sm font-semibold text-muted underline"
            >
              {t("removePhoto")}
            </button>
          )}
          {uploading && <p className="text-[13px] text-muted">{t("uploading")}</p>}
          {uploadError && <p className="text-[13px] font-semibold text-[#9A2B12]">{t("errors.photo")}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-[15px] font-bold">
          {t("name")}
        </label>
        <input id="name" name="name" required minLength={2} maxLength={60} defaultValue={f.name} autoComplete="name" className={field} />
        <p className="text-[13px] text-muted">{t("nameHint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cityKey" className="text-[15px] font-bold">
          {t("city")} <span className="font-normal text-muted">{t("optional")}</span>
        </label>
        <select id="cityKey" name="cityKey" defaultValue={f.cityKey} className={field}>
          <option value="">{t("noCity")}</option>
          {props.cities.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[13px] text-muted">{t("cityHint")}</p>
      </div>

      <button
        type="submit"
        disabled={pending || uploading}
        className="min-h-13 rounded-xl bg-brand text-base font-bold text-ink disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
