const fetch = require('node-fetch');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID required' });
  }

  try {
    const mutation = `
      mutation CreateClientAuthToken($input: CreateClientAuthTokenInput!) {
        createClientAuthToken(input: $input) {
          token
          expiresAt
        }
      }
    `;

    const basicAuthHeader = 'Basic ' + Buffer.from(process.env.BOULEVARD_API_KEY + ':').toString('base64');
    const response = await fetch(process.env.BOULEVARD_ADMIN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': basicAuthHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: { clientId }
        }
      })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return res.status(400).json({ error: data.errors[0].message });
    }

    const tokenData = data.data.createClientAuthToken;
    return res.status(200).json({ 
      token: tokenData.token,
      expiresAt: tokenData.expiresAt
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
