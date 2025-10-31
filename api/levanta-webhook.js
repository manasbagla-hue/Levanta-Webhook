// api/levanta-webhook.js
// Deploy this to Vercel for a free, permanent webhook endpoint

import { createHmac, timingSafeEqual } from 'crypto';

// Get raw body as text
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Verify webhook signature
function verifySignature(rawBody, signature, secret) {
  try {
    const computedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    
    const trusted = Buffer.from(computedSignature, 'utf-8');
    const untrusted = Buffer.from(signature, 'utf-8');
    
    return timingSafeEqual(trusted, untrusted);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Send notification (you can customize this!)
async function sendNotification(event) {
  const message = formatNotification(event);
  console.log('📬 NOTIFICATION:', message);
  
  // ADD YOUR NOTIFICATION LOGIC HERE:
  // Uncomment the method you want to use
  
  // Option 1: Discord Webhook (easiest!)
  // if (process.env.DISCORD_WEBHOOK_URL) {
  //   await fetch(process.env.DISCORD_WEBHOOK_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ content: message })
  //   });
  // }
  
  // Option 2: Slack Webhook
  // if (process.env.SLACK_WEBHOOK_URL) {
  //   await fetch(process.env.SLACK_WEBHOOK_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ text: message })
  //   });
  // }
  
  // Option 3: Telegram Bot
  // if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  //   await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       chat_id: process.env.TELEGRAM_CHAT_ID,
  //       text: message
  //     })
  //   });
  // }
  
  // For now, notifications are just logged to console
  // View them in Vercel Dashboard > Your Project > Functions > Logs
}

// Format notification message
function formatNotification(event) {
  const timestamp = new Date(event.created).toLocaleString();
  
  switch (event.type) {
    case 'link.disabled':
      return `🔗 LINK DISABLED
Time: ${timestamp}
Link ID: ${event.data.id}
Source: ${event.data.sourceName}
URL: ${event.data.url}`;
      
    case 'product.access.gained':
      return `✅ PRODUCT ACCESS GAINED
Time: ${timestamp}
ASIN: ${event.data.asin}
Marketplace: ${event.data.marketplace}
Commission: ${(event.data.commission * 100).toFixed(2)}%
Price: ${event.data.pricing.currency} ${event.data.pricing.price}`;
      
    case 'product.added':
      return `➕ NEW PRODUCT ADDED
Time: ${timestamp}
ASIN: ${event.data.asin}
Marketplace: ${event.data.marketplace}
Commission: ${(event.data.commission * 100).toFixed(2)}%
Price: ${event.data.pricing.currency} ${event.data.pricing.price}`;
      
    case 'product.removed':
      return `➖ PRODUCT REMOVED
Time: ${timestamp}
ASIN: ${event.data.asin}
Marketplace: ${event.data.marketplace}`;
      
    default:
      return `📨 UNKNOWN EVENT: ${event.type}
Time: ${timestamp}
Data: ${JSON.stringify(event.data, null, 2)}`;
  }
}

// Main handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-levanta-hmac-sha256');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok',
      message: 'Levanta webhook endpoint is running!',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get raw body
    const rawBody = await getRawBody(req);
    
    // Get signature from header
    const signature = req.headers['x-levanta-hmac-sha256'];
    
    if (!signature) {
      console.error('❌ No signature provided');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
    // Verify signature (if secret is set)
    const secret = process.env.LEVANTA_WEBHOOK_SECRET;
    
    if (secret) {
      if (!verifySignature(rawBody, signature, secret)) {
        console.error('❌ Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('✅ Signature verified');
    } else {
      console.warn('⚠️ No webhook secret set - skipping verification');
    }
    
    // Parse event
    const event = JSON.parse(rawBody);
    
    console.log(`📥 Received event: ${event.type} (ID: ${event.id})`);
    console.log('Event data:', JSON.stringify(event, null, 2));
    
    // Send notification
    await sendNotification(event);
    
    // Respond with success
    return res.status(200).json({ 
      received: true,
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Config to disable body parsing (we need raw body for HMAC)
export const config = {
  api: {
    bodyParser: false,
  },
};
