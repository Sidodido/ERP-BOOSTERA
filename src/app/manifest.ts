import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BOOSTERA ERP — ERP & CRM SaaS",
    short_name: "BOOSTERA ERP",
    description: "Plateforme ERP, CRM, Production & Finance pour BOOSTERA",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#080b11",
    theme_color: "#080b11",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
