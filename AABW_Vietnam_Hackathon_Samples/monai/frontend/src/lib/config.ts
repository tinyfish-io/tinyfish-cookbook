export function getDefaultLocation(): string {
  return import.meta.env.VITE_DEFAULT_LOCATION?.trim() ?? "";
}

export function getDefaultCategory(): string {
  return import.meta.env.VITE_DEFAULT_CATEGORY?.trim() || "food and beverage";
}
