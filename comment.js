import https from 'node:https';

const issueId = process.argv[2];
const commentBody = process.argv[3];

if (!issueId || !commentBody) {
  console.error('Usage: node comment.js <issueId> <commentBody>');
  process.exit(1);
}

const mutation = `mutation {
  commentCreate(input: {
    issueId: "${issueId}",
    body: "${commentBody}"
  }) {
    success
    comment {
      id
      body
    }
  }
}`;

const postData = JSON.stringify({ query: mutation });

const options = {
  hostname: 'api.linear.app',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log(data));
});

req.on('error', (e) => {
  console.error(e);
});

req.write(postData);
req.end();
