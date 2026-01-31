const { LinearClient } = require('@linear/sdk');
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
async function run() {
  try {
    const url = 'https://github.com/MightComeback/fathom-extract/commit/a51f6357b5f09739a1e235f7406c61d4d8cd60d0';
    await client.createComment({ 
      issueId: 'MIG-14', 
      body: `Refactored JSON extraction to a shared utility to improve resilience for YouTube and Loom metadata parsing.\n\n${url}` 
    });
    console.log("Commented.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
