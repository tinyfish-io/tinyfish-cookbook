import type { Portal, TrackedSearch } from "./types";

// 5 real, currently active, major Vietnam property portals — confirmed via
// research (batdongsan.com.vn is the dominant #1 site; the rest are its
// most-cited real competitors).
export const PORTALS: Portal[] = [
  { id: "batdongsan", name: "Batdongsan.com.vn", url: "https://batdongsan.com.vn/" },
  { id: "nhatot", name: "Nha Tot", url: "https://nhatot.com/" },
  { id: "alonhadat", name: "Alonhadat", url: "https://alonhadat.com.vn/" },
  { id: "homedy", name: "Homedy", url: "https://homedy.com/" },
  { id: "cafeland", name: "Cafeland", url: "https://nhadat.cafeland.vn/" },
];

// One example tracked search so a fresh install isn't a completely blank
// homepage — a real, plausible agency use case (District 2 / Thao Dien is
// HCMC's expat-heavy rental hotspot, genuinely high inquiry volume).
export const EXAMPLE_SEARCH: TrackedSearch = {
  id: "search-example",
  area: "District 2, Thao Dien",
  propertyType: "apartment",
  intent: "rent",
  clientName: null,
  createdAt: new Date().toISOString(),
  lastSweptAt: null,
};
