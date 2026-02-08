const Database = require('better-sqlite3');
const path = require('path');

// Create database file in a data directory
const DB_PATH = path.join(__dirname, 'data', 'cclt.db');

// Initialize database connection
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 */
function initializeDatabase() {
  // Create settings table
  const createSettingsTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'jasmi',
      notifications_enabled BOOLEAN NOT NULL DEFAULT 1,
      autonomous_mode_enabled BOOLEAN NOT NULL DEFAULT 0,
      trigger_type TEXT NOT NULL DEFAULT 'detection',
      time_interval INTEGER NOT NULL DEFAULT 2,
      session_duration INTEGER NOT NULL DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);

  // Create configuration history table (optional - for tracking changes)
  const createConfigHistoryTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS configuration_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      settings_snapshot TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Execute table creation
  createSettingsTable.run();
  createConfigHistoryTable.run();

  // Insert default settings if none exist
  const checkSettings = db.prepare('SELECT COUNT(*) as count FROM settings WHERE user_id = ?');
  const { count } = checkSettings.get('jasmi');

  if (count === 0) {
    const insertDefaults = db.prepare(`
      INSERT INTO settings (
        user_id,
        notifications_enabled, 
        autonomous_mode_enabled, 
        trigger_type, 
        time_interval, 
        session_duration
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertDefaults.run('jasmi', 1, 0, 'detection', 2, 5);
    console.log('jasmi settings inserted into database');
  }

  console.log('Database initialized successfully');
}

/**
 * Get settings for a user
 */
function getSettings(userId = 'jasmi') {
  const stmt = db.prepare(`
    SELECT 
      notifications_enabled,
      autonomous_mode_enabled,
      trigger_type,
      time_interval,
      session_duration,
      updated_at
    FROM settings 
    WHERE user_id = ?
  `);

  const settings = stmt.get(userId);
  
  if (!settings) {
    return null;
  }

  // Convert SQLite boolean (0/1) to JavaScript boolean
  return {
    notificationsEnabled: Boolean(settings.notifications_enabled),
    autonomousModeEnabled: Boolean(settings.autonomous_mode_enabled),
    triggerType: settings.trigger_type,
    timeInterval: settings.time_interval,
    sessionDuration: settings.session_duration,
    updatedAt: settings.updated_at
  };
}

/**
 * Update settings for a user
 */
function updateSettings(userId = 'jasmi', settings) {
  const {
    notificationsEnabled,
    autonomousModeEnabled,
    triggerType,
    timeInterval,
    sessionDuration
  } = settings;

  // Save current settings to history before updating
  const currentSettings = getSettings(userId);
  if (currentSettings) {
    const saveHistory = db.prepare(`
      INSERT INTO configuration_history (user_id, settings_snapshot)
      VALUES (?, ?)
    `);
    saveHistory.run(userId, JSON.stringify(currentSettings));
  }

  // Update settings
  const stmt = db.prepare(`
    UPDATE settings 
    SET 
      notifications_enabled = ?,
      autonomous_mode_enabled = ?,
      trigger_type = ?,
      time_interval = ?,
      session_duration = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);

  const result = stmt.run(
    notificationsEnabled ? 1 : 0,
    autonomousModeEnabled ? 1 : 0,
    triggerType,
    timeInterval,
    sessionDuration,
    userId
  );

  return result.changes > 0;
}

/**
 * Validate settings before saving
 */
function validateSettings(settings) {
  const errors = [];

  // Validate trigger type
  if (!['detection', 'interval'].includes(settings.triggerType)) {
    errors.push('Invalid trigger type. Must be "detection" or "interval"');
  }

  // Validate time interval
  if (settings.timeInterval < 1 || settings.timeInterval > 24) {
    errors.push('Time interval must be between 1 and 24 hours');
  }

  // Validate session duration
  if (settings.sessionDuration < 1 || settings.sessionDuration > 30) {
    errors.push('Session duration must be between 1 and 30 minutes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get configuration history
 */
function getConfigurationHistory(userId = 'jasmi', limit = 10) {
  const stmt = db.prepare(`
    SELECT settings_snapshot, changed_at
    FROM configuration_history
    WHERE user_id = ?
    ORDER BY changed_at DESC
    LIMIT ?
  `);

  const history = stmt.all(userId, limit);
  return history.map(record => ({
    settings: JSON.parse(record.settings_snapshot),
    changedAt: record.changed_at
  }));
}

/**
 * Close database connection
 */
function closeDatabase() {
  db.close();
}

// Initialize database on module load
initializeDatabase();

module.exports = {
  db,
  getSettings,
  updateSettings,
  validateSettings,
  getConfigurationHistory,
  closeDatabase
};