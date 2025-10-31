// api/webhook.js - Minimal version with ZERO dependencies
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-levanta-hmac-sha256');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Health check on GET
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok',
      message: 'Levanta webhook is running!',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get raw body
    let rawBody = '';
    for await (const chunk of req) {
      rawBody += chunk.toString();
    }
    
    // Get signature
    const signature = req.headers['x-levanta-hmac-sha256'];
    
    if (!signature) {
      console.error('No signature provided');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
    // Verify signature if secret is set
    const secret = process.env.LEVANTA_WEBHOOK_SECRET;
    
    if (secret) {
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      
      const trusted = Buffer.from(computedSignature, 'utf-8');
      const untrusted = Buffer.from(signature, 'utf-8');
      
      if (!crypto.timingSafeEqual(trusted, untrusted)) {
        console.error('Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      console.log('✅ Signature verified');
    } else {
      console.warn('⚠️ No webhook secret set');
    }
    
    // Parse event
    const event = JSON.parse(rawBody);
    
    // Log event
    console.log('📥 EVENT RECEIVED:', event.type);
    console.log('Event ID:', event.id);
    console.log('Created:', new Date(event.created).toISOString());
    console.log('Data:', JSON.stringify(event.data, null, 2));
    
    // Format notification
    let message = '';
    switch (event.type) {
      case 'link.disabled':
        message = `🔗 Link Disabled: ${event.data.id} - ${event.data.sourceName}`;
        break;
      case 'product.access.gained':
        message = `✅ Access Gained: ${event.data.asin} on ${event.data.marketplace}`;
        break;
      case 'product.added':
        message = `➕ Product Added: ${event.data.asin} on ${event.data.marketplace}`;
        break;
      case 'product.removed':
        message = `➖ Product Removed: ${event.data.asin}`;
        break;
      default:
        message = `📨 Event: ${event.type}`;
    }
    
    console.log('📬 NOTIFICATION:', message);
    
    // Return success
    return res.status(200).json({ 
      received: true,
      eventType: event.type,
      eventId: event.id,
      message: message
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};
