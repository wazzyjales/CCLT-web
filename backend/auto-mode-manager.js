/**
 * Manages autonomous laser control based on user settings
 * Handles both time-based and detection-based triggers
 */
const axios = require('axios');

class AutonomousModeManager {
  constructor(getSettingsFunc, getFlaskUrlFunc) {
    this.getSettings = getSettingsFunc;
    this.getFlaskUrl = getFlaskUrlFunc;
    this.isSessionActive = false;
    this.sessionTimer = null;
    this.intervalTimer = null;
    this.lastActivationTime = null;
    this.configurationSaveTime = Date.now();
    
    console.log('Autonomous Mode Manager initialized');
  }

  /**
   * Initialize autonomous mode - starts monitoring
   */
  async initialize() {
    console.log('Starting autonomous mode monitoring...');
    
    // Check settings every 60 seconds to see if time-based trigger should activate
    this.intervalTimer = setInterval(() => {
      this.checkTimeBasedTrigger();
    }, 60000); // Check every 60 seconds
    
    // Initial check
    await this.checkTimeBasedTrigger();
  }

  /**
   * Check if time-based trigger should activate the laser
   */
  async checkTimeBasedTrigger() {
    try {
      // Get current settings from database
      const settings = this.getSettings('jasmi');
      
      if (!settings) {
        return;
      }

      // Check if autonomous mode is enabled
      if (!settings.autonomousModeEnabled) {
        return;
      }

      // Check if notifications are silenced (disabled)
      if (settings.notificationsEnabled) {
        console.log('Autonomous mode paused - notifications are enabled');
        return;
      }

      // Check if trigger type is interval-based
      if (settings.triggerType !== 'interval') {
        return;
      }

      // Check if a session is already active
      if (this.isSessionActive) {
        return;
      }

      // Calculate time since last activation
      const now = Date.now();
      const intervalMs = settings.timeInterval * 60 * 60 * 1000; // hours to milliseconds

      // If this is the first activation, or enough time has passed
      if (!this.lastActivationTime || (now - this.lastActivationTime >= intervalMs)) {
        console.log(`Time-based trigger activated! Interval: ${settings.timeInterval} hours`);
        await this.startLaserSession(settings.sessionDuration);
      }
    } catch (error) {
      console.error('Error checking time-based trigger:', error);
    }
  }

  /**
   * Handle cat detection event
   */
  async handleCatDetection(detectionData) {
    try {
      console.log('Cat detected!', detectionData);

      // Get current settings from database
      const settings = this.getSettings('jasmi');
      
      if (!settings) {
        console.log('No settings found');
        return;
      }

      // Check if autonomous mode is enabled
      if (!settings.autonomousModeEnabled) {
        console.log('Autonomous mode is disabled');
        return;
      }

      // Check if notifications are silenced (disabled)
      if (settings.notificationsEnabled) {
        console.log('Autonomous mode paused - notifications are enabled');
        return;
      }

      // Check if trigger type is detection-based
      if (settings.triggerType !== 'detection') {
        console.log('Trigger type is not set to detection');
        return;
      }

      // Check if a session is already active
      if (this.isSessionActive) {
        console.log('Session already active, ignoring detection');
        return;
      }

      console.log(`Detection-based trigger activated! Duration: ${settings.sessionDuration} minutes`);
      await this.startLaserSession(settings.sessionDuration);
      
    } catch (error) {
      console.error('Error handling cat detection:', error);
    }
  }

  /**
   * Start a laser play session
   */
  async startLaserSession(durationMinutes) {
    if (this.isSessionActive) {
      console.log('Session already active, cannot start another');
      return;
    }

    const flaskUrl = this.getFlaskUrl();
    try {
      console.log(flaskUrl)
      this.isSessionActive = true;
      this.lastActivationTime = Date.now();
      const durationMs = durationMinutes * 60 * 1000; // minutes to milliseconds
      
      console.log('STARTING AUTONOMOUS LASER SESSION');
      console.log('='.repeat(60));

      await axios.get(`${flaskUrl}/on`, { timeout: 5000 });
      //Send empty req body 
      await axios.post(`${flaskUrl}/autonomous/start`, {}, { timeout: 5000 });

      console.log(`Session active - laser will run for ${durationMinutes} minutes`);
      console.log('='.repeat(60));

      // Set timer to stop session after duration
      this.sessionTimer = setTimeout(async () => {
        await this.stopLaserSession();
      }, durationMs);

    } catch (error) {
      console.error('Error starting laser session:', error.message);
      this.isSessionActive = false;
      
      // Try to clean up if something went wrong
      try {
        await axios.get(`${flaskUrl}/off`, { timeout: 5000 });
        await axios.post(`${flaskUrl}/autonomous/stop`, {}, { timeout: 5000 });
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError.message);
      }
    }
  }

  /**
   * Stop the current laser play session
   */
  async stopLaserSession() {
    if (!this.isSessionActive) {
      return;
    }

    try {
      const flaskUrl = this.getFlaskUrl();
      // Stop laser and turn it off 
      console.log('STOPPING AUTONOMOUS LASER SESSION');
      console.log('='.repeat(60));

      await axios.post(`${flaskUrl}/autonomous/stop`, {}, { timeout: 5000 });
      await axios.get(`${flaskUrl}/off`, { timeout: 5000 });
    } catch (error) {
      console.error('Error stopping laser session:', error.message);
    } finally {
      // Always clear the session state
      this.isSessionActive = false;
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
        this.sessionTimer = null;
      }
    }
  }

  /**
   * Manually stop autonomous mode
   * Useful for emergency stops or when user disables autonomous mode
   */
  async emergencyStop() {
    console.log('Halting all autonomous activities');
    
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    if (this.isSessionActive) {
      await this.stopLaserSession();
    }
  }

  /**
   * Get current autonomous mode status
   */
  getStatus() {
    return {
      isSessionActive: this.isSessionActive,
      lastActivationTime: this.lastActivationTime,
      sessionActive: this.isSessionActive,
      uptime: Date.now() - this.configurationSaveTime
    };
  }

  /**
   * Clean up timers when shutting down
   */
  shutdown() {
    console.log('Shutting down Autonomous Mode Manager...');
    
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
    
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    if (this.isSessionActive) {
      this.stopLaserSession();
    }
  }
}

module.exports = AutonomousModeManager;