import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aпотолков CRM",
    short_name: "CRM",
    description: "Рабочее пространство команды",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#263666",
    lang: "ru",
  };
}
