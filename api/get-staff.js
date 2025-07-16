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

  const { locationId } = req.body;

  try {
    const query = `
      query GetStaff($locationId: ID) {
        location(id: $locationId) {
          staff {
            id
            firstName
            lastName
            role {
              name
            }
            avatar {
              url
            }
          }
        }
      }
    `;

const authHeader = 'Basic ' + btoa(process.env.BOULEVARD_API_KEY + ':');
    const response = await fetch(process.env.BOULEVARD_ADMIN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        variables: {
          locationId: locationId
        }
      })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('GraphQL Error:', data.errors);
      return res.status(400).json({ error: data.errors[0].message });
    }

    const staff = data.data.location ? data.data.location.staff : [];
    
    return res.status(200).json({ staff });

  } catch (error) {
    console.error('Staff lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
