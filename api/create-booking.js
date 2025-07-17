const fetch = require('node-fetch');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    clientId,
    firstName,
    lastName,
    email,
    phone,
    treatmentType,
    locationId,
    staffId,
    startTime,
    isFlexible
  } = req.body;

  try {
    let finalClientId = clientId;

    if (!clientId && firstName && lastName && email) {
      const createClientMutation = `
        mutation CreateClient($input: CreateClientInput!) {
          createClient(input: $input) {
            client {
              id
              firstName
              lastName
              email
            }
          }
        }
      `;

      const basicAuthHeader = 'Basic ' + Buffer.from(process.env.BOULEVARD_API_KEY + ':').toString('base64');
      const createClientResponse = await fetch(process.env.BOULEVARD_ADMIN_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': basicAuthHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: createClientMutation,
          variables: {
            input: {
              firstName,
              lastName,
              email,
              mobilePhone: phone
            }
          }
        })
      });

      const clientData = await createClientResponse.json();

      if (clientData.errors && clientData.errors.length > 0) {
        return res.status(400).json({ error: clientData.errors[0].message });
      }

      finalClientId = clientData.data.createClient.client.id;
    }

    const createAppointmentMutation = `
      mutation CreateAppointment($input: CreateAppointmentInput!) {
        createAppointment(input: $input) {
          appointment {
            id
            startAt
            endAt
            state
            location {
              name
            }
            appointmentServices {
              service {
                name
              }
              staff {
                firstName
                lastName
              }
            }
          }
        }
      }
    `;

    const appointmentInput = {
      clientId: finalClientId,
      locationId: locationId,
      startAt: startTime,
      notes: `Treatment requested: ${treatmentType}${staffId && staffId !== 'first-available' ? `, Preferred staff: ${staffId}` : ''}${isFlexible ? ', Flexible timing' : ''}`
    };

    const basicAuthHeader = 'Basic ' + Buffer.from(process.env.BOULEVARD_API_KEY + ':').toString('base64');

    const response = await fetch(process.env.BOULEVARD_ADMIN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': basicAuthHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: createAppointmentMutation,
        variables: {
          input: appointmentInput
        }
      })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return res.status(400).json({ error: data.errors[0].message });
    }

    const appointment = data.data.createAppointment.appointment;

    return res.status(200).json({ 
      success: true,
      appointment: appointment,
      message: 'Appointment request submitted successfully'
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
