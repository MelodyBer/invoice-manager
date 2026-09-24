import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "חשבוניות",
    short_name: "חשבוניות",
    description: "ניהול חשבוניות, הכנסות והוצאות לעוסק מורשה",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "צלם חשבונית",
        short_name: "צלם חשבונית",
        url: "/upload?mode=camera",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
