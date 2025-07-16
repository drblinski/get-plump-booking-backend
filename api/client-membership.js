const fetch = require('node-fetch');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const clientToken = authHeader.replace('Bearer ', '');

  try {
    const query = `
      query GetMembership {
        myMemberships(first: 1, query: "status = ACTIVE") {
          edges {
            node {
              id
              name
              status
              accountCredit
              startOn
              endOn
            }
          }
        }
      }
    `;

    const clientAuthHeader = 'Basic ' + Buffer.from(process.env.BOULEVARD_API_KEY + ':' + clientToken).toString('base64');

    const response = await fetch(process.env.BOULEVARD_CLIENT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': clientAuthHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: query
      })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('GraphQL Error:', data.errors);
      return res.status(400).json({ error: data.errors[0].message });
    }

    const membership = data.data.myMemberships.edges.length > 0 ? 
      data.data.myMemberships.edges[0].node : null;
    
    return res.status(200).json({ membership });

  } catch (error) {
    console.error('Membership error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
