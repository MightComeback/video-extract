const https = require("https");
const data = JSON.stringify({ query: '{ issue(id: "MIG-14") { description } }' });
const options = {
  hostname: "api.linear.app",
  port: 443,
  path: "/graphql",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": process.env.LINEAR_API_KEY,
    "Content-Length": data.length,
    "User-Agent": "Clawdbot"
  }
};
const req = https.request(options, res => {
  let body = "";
  res.on("data", d => body += d);
  res.on("end", () => {
    try {
      const json = JSON.parse(body);
      console.log(json.data?.issue?.description || "NO_DESC");
    } catch (e) { console.error(e); }
  });
});
req.on("error", console.error);
req.write(data);
req.end();
