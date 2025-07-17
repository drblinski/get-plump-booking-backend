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
      query GetAppointmentHistory {
        myAppointments(first: 5, sort: START_AT_DESC) {
          edges {
            node {
              id
              startAt
              endAt
              appointmentServices {
                staff {
                  id
                  firstName
                  lastName
                }
                service {
                  id
                  name
                }
              }
              location {
                id
                name
              }
            }
          }
        }
      }
    `;

    // FIXED: Use a proper header variable name
    const basicAuthHeader = 'Basic ' + Buffer.from(process.env.BOULEVARD_API_KEY + ':').toString('base64');
    const response = await fetch(process.env.BOULEVARD_CLIENT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': basicAuthHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('GraphQL Error:', data.errors);
      return res.status(400).json({ error: data.errors[0].message });
    }

    const appointments = data.data.myAppointments.edges.map(edge => edge.node);
    return res.status(200).json({ appointments });

  } catch (error) {
    console.error('Appointment history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
