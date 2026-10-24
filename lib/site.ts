import type { Metadata } from "next";

export const SITE_URL = "https://signal-analytics-monoedge.vercel.app";
export const SITE_NAME = "Signal Analytics";
export const SITE_TITLE = "Signal Analytics Platform";
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`;

export function pageMeta(
  title: string | { absolute: string },
  description: string,
  path: string,
): Metadata {
  const label = typeof title === "string" ? title : title.absolute;
  const branded = typeof title === "string" ? TITLE_TEMPLATE.replace("%s", label) : label;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: branded,
      description,
      url: path,
      siteName: SITE_TITLE,
      type: "website",
      locale: "en_US",
    },
  };
}
