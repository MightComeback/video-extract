const https = require("https");
const q = JSON.stringify({ query: "{ issue(id: \"MIG-14\") { state { type } } }" });
const req = https.request("https://api.linear.app/graphql", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": process.env.LINEAR_API_KEY
  }
}, res => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log(json.data?.issue?.state?.type || "UNKNOWN");
    } catch (e) { console.error(e); }
  });
});
req.on("error", console.error);
req.write(q);
req.end();
