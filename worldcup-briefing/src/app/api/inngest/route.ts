import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { checkSchedules, createReel } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [createReel, checkSchedules],
});
