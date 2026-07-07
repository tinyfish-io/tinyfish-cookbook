// Module-level (not sessionStorage) on purpose: this resets on any genuine
// fresh JS load — a hard refresh or a brand new tab both reinitialize the
// module — but stays "true" across client-side route changes within the
// same already-running app, since Next.js client navigation doesn't tear
// down the JS module scope. That's exactly "show on open/refresh, not on
// navigating back from a sub-page."
let shown = false;
export function hasShownGuide(): boolean {
  return shown;
}
export function markGuideShown(): void {
  shown = true;
}
