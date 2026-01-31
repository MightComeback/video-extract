const extractLoom = (url) => { return { platform: 'loom', id: url.split('/').pop() }; }; module.exports = { extractLoom };
