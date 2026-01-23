const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Flask server configuration
let FLASK_SERVER_URL = null;
let CAMERA_URL = null;

const FLASK_URLS = {
  primary: process.env.FLASK_SERVER_URL,
  remote: process.env.REMOTE_FLASK_SERVER_URL
};
const CAMERA_URLS = {
  primary: process.env.CAMERA_URL,
  remote: process.env.REMOTE_CAMERA_URL
}

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

async function selectWorkingUrl(urlConfig, serverName) {
  
  // Try primary first
  console.log(`Trying primary: ${urlConfig.primary}`);
  const primaryCheck = await checkServerHealth(urlConfig.primary);
  if (primaryCheck.available) {
    console.log(`Primary ${serverName} server is available`);
    return urlConfig.primary;
  }
  console.log(`Primary ${serverName} server unavailable: ${primaryCheck.error}`);
  
  // Try remote as fallback
  console.log(`Trying remote: ${urlConfig.remote}`);
  const remoteCheck = await checkServerHealth(urlConfig.remote);
  if (remoteCheck.available) {
    console.log(`Remote ${serverName} server is available`);
    return urlConfig.remote;
  }

  // Default return, errors jandeled per-request
  return urlConfig.primary;
}

/**
 * Initialize server URLs on startup
 */
async function initializeServerUrls() {
  FLASK_SERVER_URL = await selectWorkingUrl(FLASK_URLS, 'Flask');
  CAMERA_URL = await selectWorkingUrl(CAMERA_URLS, 'Camera');
}

/*****************************************************************
 * CONFIGURE MIDDLEWARE 
 *****************************************************************/
app.use(cors({
  origin: [ process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://192.168.1.108:*', //raspberry pi 
  'http://100.81.246.79:*', //raspberry pi remote 
  ], 
  credentials: true,
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/*****************************************************************
 * POST ENDPOINTS 
 *****************************************************************/
app.post('/api/detection', (req, res) => {
    console.log('Received data:', req.body);
    res.json({ status: 'success', received: req.body });
});

/*****************************************************************
 * GET ENDPOINTS 
 *****************************************************************/
app.get('/api/camera/health', async (req, res) => {
  try {
    const flaskResponse = await axios.get(`${CAMERA_URL}/health`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Video stream error:', error.message);
    handleFlaskError(error, res, 'Failed to get camera status');
  }
});

app.get('/api/health', async (req, res) => {
  try {
    console.log(FLASK_SERVER_URL)
    const flaskResponse = await axios.get(`${FLASK_SERVER_URL}/health`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      backend: 'operational',
      flaskServer: flaskResponse.data.status || 'healthy',
      flaskDetails: {
        gpio_initialized: flaskResponse.data.gpio_initialized,
        current_pan: flaskResponse.data.details?.current_pan,
        current_tilt: flaskResponse.data.details?.current_tilt,
        data: flaskResponse.data,
      }
    });
  } catch (error) {
    console.error('Laser control error:', error.message);
    handleFlaskError(error, res, 'Failed to get laser status');
  }
});

/**
 * Moves the laser left or right
 * GET /api/laser/move-x?direction=left|right
 */
app.get('/api/laser/move-x', async (req, res) => {
  try {
    const { direction } = req.query;
    
    if (!direction || !['left', 'right'].includes(direction.toLowerCase())) {
      return res.status(400).json({
        error: 'Direction required. Use "left" or "right"',
        status: 'error'
      });
    }
    
    console.log(`Moving laser ${direction}...`);
    
    const flaskResponse = await axios.get(
      `${FLASK_SERVER_URL}/move-x`,
      {
        params: { direction: direction.toLowerCase() },
        timeout: 1000
      }
    );
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('X-axis movement error:', error.message);
    handleFlaskError(error, res, 'Failed to move laser on X-axis');
  }
});

/**
 * Moves the laser up or down
 * GET /api/laser/move-y?direction=up|down
 */
app.get('/api/laser/move-y', async (req, res) => {
  try {
    const { direction } = req.query;
    
    if (!direction || !['up', 'down'].includes(direction.toLowerCase())) {
      return res.status(400).json({
        error: 'Direction required. Use "up" or "down"',
        status: 'error'
      });
    }
    
    console.log(`Moving laser ${direction}...`);
    const flaskResponse = await axios.get(
      `${FLASK_SERVER_URL}/move-y`,
      {
        params: { direction: direction.toLowerCase() },
        timeout: 1000
      }
    );
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Y-axis movement error:', error.message);
    handleFlaskError(error, res, 'Failed to move laser on Y-axis');
  }
});

/**
 * Centers both servos
 */
app.get('/api/laser/center', async (req, res) => {
  try {
    console.log('Centering laser...');
    
    const flaskResponse = await axios.get(`${FLASK_SERVER_URL}/center`, {
      timeout: 10000
    });
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Center error:', error.message);
    handleFlaskError(error, res, 'Failed to center laser');
  }
});

/**
 * Gets current laser status from Flask server
 */
app.get('/api/laser/status', async (req, res) => {
  try {
    const flaskResponse = await axios.get(`${FLASK_SERVER_URL}/status`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Status check error:', error.message);
    handleFlaskError(error, res, 'Failed to get laser status');
  }
});

/**
 * Gets current laser status from Flask server
 */
app.get('/api/laser/off', async (req, res) => {
  try {
    const flaskResponse = await axios.get(`${FLASK_SERVER_URL}/off`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Status check error:', error.message);
    handleFlaskError(error, res, 'Failed to get laser status');
  }
});

/**
 * Gets current laser status from Flask server
 */
app.get('/api/laser/on', async (req, res) => {
  try {
    const flaskResponse = await axios.get(`${FLASK_SERVER_URL}/on`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Status check error:', error.message);
    handleFlaskError(error, res, 'Failed to get laser status');
  }
});


/*****************************************************************
 * ERROR HANDELING 
 *****************************************************************/
function handleFlaskError(error, res, defaultMessage) {
  // Flask server couldnt be reached
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      status: 'error',
      error: 'Flask server is not reachable',
      details: 'Cannot connect to Flask  server',
      message: defaultMessage,
    });
  }
  
  if (error.response) {
    // Flask server returned an error
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

/**
 * Catches any unhandled errors
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    error: 'Internal server error',
    message: err.message
  });
});

/**
 * Handles requests to undefined routes
 */
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'Endpoint not found',
    path: req.path
  });
});

/*****************************************************************
 * ERROR HANDELING 
 *****************************************************************/
async function startServer() {
  try {
    // Initialize server URLs before starting Express
    await initializeServerUrls();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(60));
      console.log(`Port: ${PORT}`);
      console.log(`Flask Server: ${FLASK_SERVER_URL}`);
      console.log(`Camera Server: ${CAMERA_URL}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();