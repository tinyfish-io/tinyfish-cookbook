import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import * as React from "react";

const SITE_TITLE = "MónAI — Vietnam Food Trend Intelligence";
const SITE_DESCRIPTION =
  "Vietnam's AI-powered food trend intelligence platform. Spot viral dishes, forecast growth, analyze menu gaps, and discover suppliers across Hà Nội, TP.HCM, and beyond.";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Bebas+Neue&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: FONTS_URL },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <React.Fragment>
      <HeadContent />
      <Outlet />
    </React.Fragment>
  );
}
