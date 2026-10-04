module.exports = async (req, res) => {
  res.status(200).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    service: 'ilham-novandi-api',
    version: '8.5.0',
    runtime: 'vercel-node',
    timestamp: new Date().toISOString()
  }));
};
