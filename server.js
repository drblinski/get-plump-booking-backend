const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Boulevard API Configuration
const BOULEVARD_CONFIG = {
  apiKey: process.env.BOULEVARD_API_KEY || '93ca3f15-6f0e-491d-840b-681a0fef80ed',
  secretKey: process.env.BOULEVARD_SECRET_KEY || 'your-secret-key-here',
  businessId: process.env.BOULEVARD_BUSINESS_ID || 'f6a06736-1132-4365-b79a-a69c648a746a',
  adminApiUrl: 'https://dashboard.boulevard.io/api/2020-01/admin',
  clientApiUrl: 'https://dashboard.boulevard.io/api/2020-01/f6a06736-1132-4365-b79a-a69c648a746a/client'
};

console.log('🚀 Starting Get Plump Booking Backend Server...');
console.log('📍 Business ID:', BOULEVARD_CONFIG.businessId);

// Helper function to call Boulevard Admin API
async function callBoulevardAdminAPI(query, variables = {}) {
  console.log('📞 Calling Boulevard Admin API...');
  
  const response = await fetch(BOULEVARD_CONFIG.adminApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(BOULEVARD_CONFIG.apiKey + ':').toString('base64'),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors[0].message);
  }
  
  return data.data;
}

// Helper function to call Boulevard Client API
async function callBoulevardClientAPI(query, variables = {}, token = null) {
  console.log('📞 Calling Boulevard Client API...');
  
  const authHeader = token ? 
    'Basic ' + Buffer.from(BOULEVARD_CONFIG.apiKey + ':' + token).toString('base64') :
    'Basic ' + Buffer.from(BOULEVARD_CONFIG.apiKey + ':').toString('base64');
    
  const response = await fetch(BOULEVARD_CONFIG.clientApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors[0].message);
  }
  
  return data.data;
}

// Generate scoped client token for authenticated Boulevard access
function generateClientToken(clientId) {
  console.log('🔐 Generating scoped client token for:', clientId);
  
  const prefix = "blvd-client-v1";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const tokenPayload = prefix + BOULEVARD_CONFIG.businessId + clientId + timestamp;
  
  const rawKey = Buffer.from(BOULEVARD_CONFIG.secretKey, 'base64');
  const rawMac = crypto.createHmac('sha256', rawKey).update(tokenPayload).digest();
  const signature = rawMac.toString('base64');
  
  return signature + tokenPayload;
}

// ===== API ENDPOINTS =====

// 1. CLIENT LOOKUP ENDPOINT
app.post('/api/lookup-client', async (req, res) => {
  console.log('🔍 Client lookup request:', req.body);
  
  try {
    const { email, phone } = req.body;
    
    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone required' });
    }
    
    let searchQuery = '';
    if (email) searchQuery += `email = "${email}"`;
    if (phone) searchQuery += `${email ? ' OR ' : ''}mobilePhone = "${phone}"`;
    
    const query = `
      query FindClient {
        clients(query: "${searchQuery}", first: 1) {
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
    
    const data = await callBoulevardAdminAPI(query);
    
    if (data.clients.edges.length > 0) {
      const client = data.clients.edges[0].node;
      console.log('✅ Client found:', client.firstName, client.lastName);
      res.json({ client });
    } else {
      console.log('❌ Client not found');
      res.json({ client: null });
    }
    
  } catch (error) {
    console.error('❌ Client lookup error:', error.message);
    res.status(500).json({ error: 'Client lookup failed', details: error.message });
  }
});

// 2. TOKEN GENERATION ENDPOINT  
app.post('/api/generate-token', async (req, res) => {
  console.log('🔐 Token generation request for:', req.body.clientId);
  
  try {
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }
    
    const token = generateClientToken(clientId);
    console.log('✅ Token generated successfully');
    res.json({ token });
    
  } catch (error) {
    console.error('❌ Token generation error:', error.message);
    res.status(500).json({ error: 'Token generation failed', details: error.message });
  }
});

// 3. BOOKING OPERATIONS ENDPOINT
app.post('/api/booking', async (req, res) => {
  console.log('🛒 Booking operation request:', req.body.operation);
  
  try {
    const { operation, token, query, variables, cartId, bookingData } = req.body;
    
    switch (operation) {
      case 'getAppointmentHistory':
        const appointmentQuery = `
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
        
        const appointmentData = await callBoulevardClientAPI(appointmentQuery, {}, token);
        const appointments = appointmentData.myAppointments.edges.map(edge => edge.node);
        console.log('✅ Retrieved', appointments.length, 'appointments');
        res.json({ appointments });
        break;

      case 'getMembership':
        const membershipQuery = `
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
        
        const membershipData = await callBoulevardClientAPI(membershipQuery, {}, token);
        const membership = membershipData.myMemberships.edges.length > 0 ? 
          membershipData.myMemberships.edges[0].node : null;
        console.log('✅ Membership status:', membership ? 'Active' : 'None');
        res.json({ membership });
        break;

      case 'createCart':
        const { locationId } = variables;
        const formattedLocationId = locationId.startsWith('urn:blvd:Location:') ? 
          locationId : 'urn:blvd:Location:' + locationId;
        
        const createCartQuery = `
          mutation CreateCart($locationId: ID!) {
            createCart(input: { locationId: $locationId }) {
              cart {
                id
                expiresAt
                availableCategories {
                  name
                  availableItems {
                    id
                    name
                    description
                    ... on CartAvailableBookableItem {
                      listPrice
                      listDuration
                      staffVariants {
                        id
                        price
                        duration
                        staff {
                          id
                          firstName
                          lastName
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        
        const cartData = await callBoulevardClientAPI(createCartQuery, { locationId: formattedLocationId }, token);
        console.log('✅ Cart created:', cartData.createCart.cart.id);
        res.json({ 
          cartId: cartData.createCart.cart.id,
          cart: cartData.createCart.cart
        });
        break;

      case 'getAvailableTimes':
        const { searchDate, tz = 'America/New_York' } = variables;
        
        const timesQuery = `
          query GetCartBookableTimes($cartId: ID!, $searchDate: Date!, $tz: String!) {
            cartBookableTimes(
              id: $cartId,
              searchDate: $searchDate,
              tz: $tz
            ) {
              id
              startTime
            }
          }
        `;
        
        const timesData = await callBoulevardClientAPI(timesQuery, {
          cartId: cartId,
          searchDate: searchDate,
          tz: tz
        }, token);
        
        console.log('✅ Retrieved', timesData.cartBookableTimes.length, 'available times');
        res.json({ times: timesData.cartBookableTimes });
        break;

      case 'completeBooking':
        const checkoutQuery = `
          mutation CheckoutCart($cartId: ID!) {
            checkoutCart(input: {
              id: $cartId
            }) {
              cart {
                id
                completedAt
              }
            }
          }
        `;
        
        const checkoutData = await callBoulevardClientAPI(checkoutQuery, { cartId: cartId }, token);
        console.log('✅ Booking completed');
        res.json({ booking: checkoutData.checkoutCart.cart });
        break;

      default:
        console.log('❌ Unknown operation:', operation);
        res.status(400).json({ error: 'Unknown operation' });
    }
    
  } catch (error) {
    console.error('❌ Booking operation error:', error.message);
    res.status(500).json({ error: 'Booking operation failed', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    business: BOULEVARD_CONFIG.businessId
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Get Plump Booking Backend running on port ${PORT}`);
  console.log(`📱 Frontend should point to: http://localhost:${PORT}/api`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
