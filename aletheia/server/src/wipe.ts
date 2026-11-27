import { loadConfig } from "./config.ts";
import { wipeData } from "./store/wipe.ts";
import { TinyFishClient } from "./tinyfish/client.ts";

const { dataDir, tinyfishApiKey } = loadConfig();
const client = tinyfishApiKey ? new TinyFishClient({ apiKey: tinyfishApiKey }) : null;

const { audits, profilesDeleted, profilesLeft } = await wipeData({
  dataDir,
  deleteProfile: client ? (id) => client.deleteProfile(id) : null,
});

console.log(`Wiped ${dataDir}: ${audits} audits, ${profilesDeleted} saved sign-ins.`);
if (profilesLeft.length > 0) {
  console.error(
    `${profilesLeft.length} saved sign-ins could not be deleted. Set TINYFISH_API_KEY and run this again.`,
  );
  process.exitCode = 1;
}
