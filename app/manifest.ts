import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moat",
    short_name: "Moat",
    description:
      "Uganda-first personal finance tracking with local-first accounts, goals, and investment guidance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111111",
    theme_color: "#111111",
    categories: ["finance", "productivity", "utilities"],
    share_target: {
      action: "/transactions",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    icons: [
      {
        src: "/icons/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
