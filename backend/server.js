const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Import helper functions
const {
  getFlaskServerUrl,
  getCameraUrl,
  handleFlaskError,
  sendCatDetected,
  setupSseConnection,
  startServer
} = require('./server-helpers');

// Import database functions
const {
  getSettings,
  updateSettings,
  validateSettings,
  getConfigurationHistory
} = require('./database');

const AutonomousModeManager = require('./auto-mode-manager');

// Create instance
const autonomousModeManager = new AutonomousModeManager(
  getSettings,
  getFlaskServerUrl
);

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 2000;
const sseClients = new Set()

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
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

/**
 * Update settings for the user
 */
app.put('/api/settings', (req, res) => {
  try {
    const userId = 'jasmi';
    const settingsData = req.body;

    // Validate settings
    const validation = validateSettings(settingsData);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid settings',
        details: validation.errors
      });
    }

    // Update settings
    const success = updateSettings(userId, settingsData);

    if (!success) {
      return res.status(500).json({
        status: 'error',
        error: 'Failed to update settings'
      });
    }

    // Get updated settings to return
    const updatedSettings = getSettings(userId);

    res.json({
      status: 'success',
      data: updatedSettings,
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to update settings',
      details: error.message
    });
  }
});

/*****************************************************************
 * PATCH ENDPOINTS 
 *****************************************************************/
/**
 * PATCH /api/settings/notifications
 * Quick toggle for notifications only
 */
app.patch('/api/settings/notifications', (req, res) => {
  try {
    const userId = 'jasmi';
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        error: 'enabled must be a boolean value'
      });
    }

    const currentSettings = getSettings(userId);
    if (!currentSettings) {
      return res.status(404).json({
        status: 'error',
        error: 'Settings not found'
      });
    }

    currentSettings.notificationsEnabled = enabled;
    const success = updateSettings(userId, currentSettings);

    if (!success) {
      return res.status(500).json({
        status: 'error',
        error: 'Failed to update notification settings'
      });
    }

    res.json({
      status: 'success',
      data: { notificationsEnabled: enabled },
      message: `Notifications ${enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to update notification settings',
      details: error.message
    });
  }
});

/**
 * PATCH /api/settings/autonomous
 * Quick toggle for autonomous mode only
 */
app.patch('/api/settings/autonomous', (req, res) => {
  try {
    const userId = 'jasmi';
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        error: 'enabled must be a boolean value'
      });
    }

    const currentSettings = getSettings(userId);
    if (!currentSettings) {
      return res.status(404).json({
        status: 'error',
        error: 'Settings not found'
      });
    }

    currentSettings.autonomousModeEnabled = enabled;
    const success = updateSettings(userId, currentSettings);

    if (!success) {
      return res.status(500).json({
        status: 'error',
        error: 'Failed to update autonomous mode settings'
      });
    }

    res.json({
      status: 'success',
      data: { autonomousModeEnabled: enabled },
      message: `Autonomous mode ${enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating autonomous mode settings:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to update autonomous mode settings',
      details: error.message
    });
  }
});

/*****************************************************************
 * POST ENDPOINTS 
 *****************************************************************/
/**
 * Recieve cat detected alert from camera 
 */
app.post('/api/detection', (req, res) => {
    console.log('Received data:', req.body);
    res.json({ status: 'success', received: req.body });
    sendCatDetected(sseClients, req.body)
    autonomousModeManager.handleCatDetection(req.body);
});

/**
 * Reset settings to defaults
 */
app.post('/api/settings/reset', (req, res) => {
  try {
    const userId = 'jasmi';
    
    const defaultSettings = {
      notificationsEnabled: true,
      autonomousModeEnabled: false,
      triggerType: 'detection',
      timeInterval: 2,
      sessionDuration: 5
    };

    const success = updateSettings(userId, defaultSettings);

    if (!success) {
      return res.status(500).json({
        status: 'error',
        error: 'Failed to reset settings'
      });
    }

    const resetSettings = getSettings(userId);

    res.json({
      status: 'success',
      data: resetSettings,
      message: 'Settings reset to defaults',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to reset settings',
      details: error.message
    });
  }
});

/*****************************************************************
 * GET ENDPOINTS 
 *****************************************************************/
/***
 * SSE connection endpoint.
 * The frontend connects here and keeps the connection open.
 * Each connected browser tab is a separate client in the Set.
 ***/
app.get('/api/detection/events', (req, res) => {
  setupSseConnection(req, res, sseClients);
})

app.get('/api/camera/health', async (req, res) => {
  let camera_server_url = getCameraUrl();
  try {
    const flaskResponse = await axios.get(`${camera_server_url}/health`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      data: flaskResponse.data,
      timestamp: new Date().toISOString(),
      url: camera_server_url,
      video_url: `${camera_server_url}/video_feed`
    });
  } catch (error) {
    console.error('Video stream error:', error.message);
    handleFlaskError(error, res, 'Failed to get camera status');
  }
});

app.get('/api/health', async (req, res) => {
  let flask_server_url = getFlaskServerUrl();
  try {
    console.log(flask_server_url)
    const flaskResponse = await axios.get(`${flask_server_url}/health`, {
      timeout: 5000
    });
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      url:  flask_server_url,
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
  let flask_server_url = getFlaskServerUrl();
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
      `${flask_server_url}/move-x`,
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
  let flask_server_url = getFlaskServerUrl();
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
      `${flask_server_url}/move-y`,
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
  let flask_server_url = getFlaskServerUrl();
  try {
    console.log('Centering laser...');
    
    const flaskResponse = await axios.get(`${flask_server_url}/center`, {
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
  let flask_server_url = getFlaskServerUrl();
  try {
    const flaskResponse = await axios.get(`${flask_server_url}/status`, {
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
  let flask_server_url = getFlaskServerUrl();
  try {
    const flaskResponse = await axios.get(`${flask_server_url}/off`, {
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
  let flask_server_url = getFlaskServerUrl();
  try {
    const flaskResponse = await axios.get(`${flask_server_url}/on`, {
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
 * GET /api/settings/history
 * Get configuration change history
 */
app.get('/api/settings/history', (req, res) => {
  try {
    const userId = 'jasmi';
    const limit = parseInt(req.query.limit) || 10;
    
    const history = getConfigurationHistory(userId, limit);

    res.json({
      status: 'success',
      data: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching settings history:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to fetch settings history',
      details: error.message
    });
  }
});

app.get('/api/settings', (req, res) => {
// Retrieve current settings for the user
  try {
    const userId = 'jasmi';
    
    const settings = getSettings(userId);
    
    if (!settings) {
      return res.status(404).json({
        status: 'error',
        error: 'Settings not found'
      });
    }

    res.json({
      status: 'success',
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to fetch settings',
      details: error.message
    });
  }
});

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

// Start the server
startServer(app, PORT). then(() => {
   autonomousModeManager.initialize();
});