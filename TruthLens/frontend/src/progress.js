// Turns backend progress events into the state shown by <AnalysisProgress />.

export const STEPS = [
  { id: "planning", title: "Breaking down your claim" },
  { id: "searching", title: "Searching the web" },
  { id: "fetching", title: "Reading sources" },
  { id: "generating", title: "Generating your report" },
];

export const initialProgress = {
  stage: "planning",
  queries: [],
  searches: [], // one entry per finished search: { query, found, ok }
  sources: [], // { url, title, domain, tier }
  fetched: null,
  requested: null,
};

export function progressReducer(state, event) {
  switch (event.stage) {
    case "reset":
      return initialProgress;
    case "planning":
      return { ...state, stage: "planning" };
    case "planned":
      return { ...state, stage: "searching", queries: event.queries || [] };
    case "searched":
      return { ...state, searches: [...state.searches, event] };
    case "sources":
      return {
        ...state,
        sources: event.sources || [],
        stage: event.sources?.length ? "fetching" : state.stage,
      };
    case "fetching":
      return { ...state, stage: "fetching", requested: event.total };
    case "fetched":
      return { ...state, fetched: event.fetched, requested: event.requested };
    case "judging":
    case "verifying":
      return { ...state, stage: "generating" };
    default:
      return state;
  }
}
