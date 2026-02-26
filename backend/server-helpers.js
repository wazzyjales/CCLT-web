const axios = require('axios');

const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let lastAlertTime = 0;
/*****************************************************************
 * FLASK SERVER CONFIGURATION
 *****************************************************************/
let FLASK_SERVER_URL = null;
let CAMERA_URL = null;

const FLASK_URLS = {
  primary: process.env.FLASK_SERVER_URL,
  remote: process.env.REMOTE_FLASK_SERVER_URL
};

const CAMERA_URLS = {
  primary: process.env.CAMERA_URL,
  remote: process.env.REMOTE_CAMERA_URL
};

/*****************************************************************
 * SERVER HEALTH CHECKING
/*****************************************************************

/**
 * Check if a server URL is responding
 */
async function checkServerHealth(url) {
  try {
    const response = await axios.get(`${url}/health`, { 
      timeout: 5000,
    });
    return { available: true, url, response: response.data };
  } 
  catch (error) {
    return { available: false, url, error: error.message };
  }
}

/**
 * Select a working URL from primary/remote options
 */
async function selectWorkingUrl(urlConfig, serverName) {
  // Try primary first
  const primaryCheck = await checkServerHealth(urlConfig.primary);
  if (primaryCheck.available) {
    return urlConfig.primary;
  }
  
  // Try remote as fallback
  const remoteCheck = await checkServerHealth(urlConfig.remote);
  if (remoteCheck.available) {
    return urlConfig.remote;
  }
  
  return null;
}

/**
 * Initialize Flask and Camera server URLs
 * Called once on server startup
 */
async function initializeServerUrls() {
  console.log('Initializing server connections...\n');
  
  FLASK_SERVER_URL = await selectWorkingUrl(FLASK_URLS, 'Flask');
  CAMERA_URL = await selectWorkingUrl(CAMERA_URLS, 'Camera');
  
  console.log('\nServer URLs initialized:');
  console.log(`  Flask Server: ${FLASK_SERVER_URL}`);
  console.log(`  Camera Server: ${CAMERA_URL}`);
}

/*****************************************************************
 * GETTERS FOR SERVER URLS
 *****************************************************************/
function getFlaskServerUrl() {
  return FLASK_SERVER_URL;
}

function getCameraUrl() {
  return CAMERA_URL;
}

/*****************************************************************
 * ERROR HANDLING
 *****************************************************************/

/**
 * Handle errors from Flask server requests
 */
function handleFlaskError(error, res, defaultMessage) {
  // Connection errors - Flask server couldn't be reached
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      status: 'error',
      error: 'Flask server is not reachable',
      details: 'Cannot connect to Flask server',
      message: defaultMessage,
    });
  }
  
  // Flask server returned an error response
  if (error.response) {
    return res.status(error.response.status).json({
      status: 'error',
      error: 'Flask server error',
      details: error.response.data,
      message: defaultMessage
    });
  }
  
  // Generic error
  return res.status(500).json({
    status: 'error',
    error: 'Internal server error',
    details: error.message,
    message: defaultMessage
  });
}

/*****************************************************************
 * SSE HELPERS
 *****************************************************************/

/**
 * Send cat detection event to all connected SSE clients
 */
function sendCatDetected(sseClients, catDetectedPayload) {
  const message = `data: ${JSON.stringify(catDetectedPayload)}\n\n`;
  
  console.log(`Broadcasting cat detection to ${sseClients.size} client(s)`);
  
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending SSE message to client:', error);
      sseClients.delete(client);
    }
  }
}

/**
 * Setup SSE connection for a client
 */
function setupSseConnection(req, res, sseClients) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Add client to set
  sseClients.add(res);
  console.log(`SSE client connected. Total clients: ${sseClients.size}`);
  
  // Remove client on disconnect
  req.on('close', () => {
    sseClients.delete(res);
    console.log(`SSE client disconnected. Total clients: ${sseClients.size}`);
  });
}

/**
 * Send a cat detection notification to a Discord channel via webhook
 */
async function sendDiscordNotification(body) {
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  if (!webhookUrl) return;

  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;

  lastAlertTime = now;
  const timestamp = new Date().toLocaleTimeString();
  try {
    await axios.post(webhookUrl, {
      content: ` **Cat detected!**\nTime: ${timestamp}\n Go say hi to the kids! :3 `
    });
    console.log('Discord notification sent');
  } catch (error) {
    console.error('Failed to send Discord notification:', error.message);
  }
}

/*****************************************************************
 * SERVER STARTUP
 *****************************************************************/

/**
 * Start the Express server
 */
async function startServer(app, port) {
  try {
    // Initialize server URLs before starting Express
    await initializeServerUrls();
    
    // Start Express server
    app.listen(port, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log(`Port:        ${port}`);
      console.log(`Flask:       ${FLASK_SERVER_URL}`);
      console.log(`Camera:      ${CAMERA_URL}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/*****************************************************************
 * EXPORTS
 *****************************************************************/
module.exports = {
  // Server URL functions
  initializeServerUrls,
  getFlaskServerUrl,
  getCameraUrl,
  
  // Health checking
  checkServerHealth,
  selectWorkingUrl,
  
  // Error handling
  handleFlaskError,
  
  // SSE helpers
  sendCatDetected,
  setupSseConnection,

  // Notifications
  sendDiscordNotification,
  
  // Server startup
  startServer
};