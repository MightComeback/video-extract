const { LinearClient } = require('@linear/sdk');
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
async function run() {
  try {
    // The SDK might require the UUID, but let's try assuming it handles IDs or we need to look it up.
    // If previous script worked with 'MIG-14', then SDK 'createComment' input issueId likely maps to the internal ID.
    // Wait, 'createComment' takes { issueId: string }.
    // Let's first resolve the issue to get its ID just in case.
    const issues = await client.issues({ filter: { number: { eq: 14 }, team: { key: { eq: "MIG" } } } });
    if (issues.nodes.length === 0) {
        // Fallback: maybe just pass MIG-14 if we can't find it, but it's risky.
        // Actually, the SDK takes the *internal* ID for relations usually.
        // Let's try to find it.
        console.error("Could not find issue MIG-14 via SDK");
        // Try simple fetch by ID string if supported?
        // client.issue("MIG-14") is a thing.
    }
    const issue = await client.issue("MIG-14");
    
    await client.createComment({ 
      issueId: issue.id, 
      body: "Implemented `extractLoom` with metadata parsing from `window.__APOLLO_STATE__` and updated `src/extractor.js` to support both Fathom and Loom.\n\nhttps://github.com/MightComeback/fathom-extract/commit/f9de8da8b3b0df273aff2905213263183526b861" 
    });
    console.log("Commented on " + issue.id);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();