import { Inngest } from "inngest";

const isDev = process.env.INNGEST_DEV === "1";

export const inngest = new Inngest({
  id: "world-cup-briefing",
  baseUrl: isDev ? "http://localhost:8288" : undefined,
  eventKey: isDev ? "test-key" : process.env.INNGEST_EVENT_KEY,
});
