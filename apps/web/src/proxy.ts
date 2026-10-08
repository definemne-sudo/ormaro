import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // API, Next.js iç dosyaları ve uzantılı dosyalar (resim, favicon) dil yönlendirmesinden geçmez.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
