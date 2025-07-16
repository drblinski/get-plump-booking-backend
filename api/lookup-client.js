const fetch = require('node-fetch');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ error: 'Email or phone required' });
  }

  try {
    const query = `
      query FindClient {
        clients(query: "${email ? `email = "${email}"` : ''}${phone ? ` OR mobilePhone = "${phone}"` : ''}", first: 1) {
          edges {
            node {
              id
              firstName
              lastName
              email
              mobilePhone
              currentAccountBalance
              active
            }
          }
        }
      }
    `;

    const authHeader = 'Basic ' + Buffer.from(process.env.BOULEVARD_API_KEY + ':').toString('base64');

    const response = await fetch(process.env.BOULEVARD_ADMIN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
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

    const client = data.data.clients.edges.length > 0 ? 
      data.data.clients.edges[0].node : null;

    return res.status(200).json({ client });

  } catch (error) {
    console.error('Client lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
