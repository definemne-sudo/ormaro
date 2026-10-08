import { defaultLocale, locales } from "@ormaro/shared";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales,
  defaultLocale,
});
