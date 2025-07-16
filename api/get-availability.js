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

  const { month, year, locationId, staffId } = req.body;

  try {
    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const startDateISO = startDate.toISOString().split('T')[0];
    const endDateISO = endDate.toISOString().split('T')[0];

    const query = `
      query GetAvailability($locationId: ID, $staffId: ID, $startDate: Date!, $endDate: Date!) {
        location(id: $locationId) {
          appointmentSlots(
            staffId: $staffId
            startDate: $startDate
            endDate: $endDate
          ) {
            startTime
            endTime
            available
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
        query: query,
        variables: {
          locationId: locationId,
          staffId: staffId,
          startDate: startDateISO,
          endDate: endDateISO
        }
      })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('GraphQL Error:', data.errors);
      return res.status(400).json({ error: data.errors[0].message });
    }

    // Transform the availability data into the format expected by frontend
    const availability = {};
    
    if (data.data.location && data.data.location.appointmentSlots) {
      const slots = data.data.location.appointmentSlots;
      
      slots.forEach((slot, index) => {
        if (slot.available) {
          const date = new Date(slot.startTime);
          const dateStr = date.toISOString().split('T')[0];
          
          if (!availability[dateStr]) {
            availability[dateStr] = [];
          }
          
          availability[dateStr].push({
            id: `slot-${dateStr}-${index}`,
            startTime: slot.startTime
          });
        }
      });
    }
    
    return res.status(200).json({ availability });

  } catch (error) {
    console.error('Availability lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
