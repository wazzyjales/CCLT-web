import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Slide from '@mui/material/Slide';
import Switch from '@mui/material/Switch';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import './SettingsDialog.css';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function FullScreenDialog({ open, onClose }) {
  const [currentView, setCurrentView] = React.useState('main');
  const [settings, setSettings] = React.useState({
    notificationsEnabled: true,
    autonomousModeEnabled: false,
    triggerType: 'detection',
    timeInterval: 2,
    sessionDuration: 5,
  });
  const [originalSettings, setOriginalSettings] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load settings when dialog opens
  React.useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      const result = await response.json();

      if (result.status === 'success') {
        setSettings(result.data);
        setOriginalSettings(result.data);
      } else {
        showSnackbar('Failed to load settings', 'error');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showSnackbar('Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleClose = () => {
    setCurrentView('main');
    // Reset to original settings if not saved
    if (originalSettings) {
      setSettings(originalSettings);
    }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setOriginalSettings(result.data);
        showSnackbar('Settings saved successfully', 'success');
        
        // Close dialog after a brief delay
        setTimeout(() => {
          handleClose();
        }, 1000);
      } else {
        showSnackbar(result.error || 'Failed to save settings', 'error');
        if (result.details) {
          console.error('Validation errors:', result.details);
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all settings to defaults?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/settings/reset', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.status === 'success') {
        setSettings(result.data);
        setOriginalSettings(result.data);
        showSnackbar('Settings reset to defaults', 'success');
      } else {
        showSnackbar('Failed to reset settings', 'error');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      showSnackbar('Error resetting settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const hasChanges = () => {
    if (!originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  const renderMainView = () => (
    <List className="settings-list">
      <Divider className="settings-divider" />
      <ListItemButton 
        className="settings-list-item"
        onClick={() => setCurrentView('notifications')}
        disabled={loading}
      >
        <ListItemText
          primary="Notification Settings"
          secondary="Configure cat detection notifications"
          classes={{
            primary: 'settings-item-primary',
            secondary: 'settings-item-secondary'
          }}
        />
      </ListItemButton>
      <Divider className="settings-divider" />
      <ListItemButton 
        className="settings-list-item"
        onClick={() => setCurrentView('detection')}
        disabled={loading}
      >
        <ListItemText
          primary="Detection Settings"
          secondary="Configure autonomous mode and triggers"
          classes={{
            primary: 'settings-item-primary',
            secondary: 'settings-item-secondary'
          }}
        />
      </ListItemButton>
      <Divider className="settings-divider" />
      <ListItemButton 
        className="settings-list-item"
        onClick={handleReset}
        disabled={loading || saving}
      >
        <ListItemText
          primary="Reset to Defaults"
          secondary="Restore all settings to default values"
          classes={{
            primary: 'settings-item-primary',
            secondary: 'settings-item-secondary'
          }}
        />
      </ListItemButton>
    </List>
  );

  const renderNotificationSettings = () => (
    <Box className="settings-detail-view">
      <List>
        <ListItemButton className="settings-list-item">
          <ListItemText
            primary="Enable Notifications"
            secondary="Receive alerts when your cat is detected"
            classes={{
              primary: 'settings-item-primary',
              secondary: 'settings-item-secondary'
            }}
          />
          <Switch
            checked={settings.notificationsEnabled}
            onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
            color="primary"
            disabled={loading}
          />
        </ListItemButton>
        <Divider className="settings-divider" />
        {!settings.notificationsEnabled && (
          <>
            <Box className="settings-info-box">
              <Typography variant="body2" className="settings-info-text">
                💡 Tip: When notifications are silenced, you can enable Autonomous Mode 
                so your cat still gets playtime automatically.
              </Typography>
            </Box>
            <Divider className="settings-divider" />
          </>
        )}
      </List>
    </Box>
  );

  const renderDetectionSettings = () => (
    <Box className="settings-detail-view">
      <List>
        <ListItemButton className="settings-list-item">
          <ListItemText
            primary="Autonomous Mode"
            secondary="Automatically play with your cat"
            classes={{
              primary: 'settings-item-primary',
              secondary: 'settings-item-secondary'
            }}
          />
          <Switch
            checked={settings.autonomousModeEnabled}
            onChange={(e) => handleSettingChange('autonomousModeEnabled', e.target.checked)}
            color="primary"
            disabled={loading}
          />
        </ListItemButton>
        <Divider className="settings-divider" />

        {settings.autonomousModeEnabled && (
          <>
            <Box className="settings-section">
              <Typography className="settings-section-title">
                Activation Trigger
              </Typography>
              <FormControl component="fieldset" className="settings-form-control">
                <RadioGroup
                  value={settings.triggerType}
                  onChange={(e) => handleSettingChange('triggerType', e.target.value)}
                >
                  <FormControlLabel
                    value="detection"
                    control={<Radio color="primary" disabled={loading} />}
                    label={
                      <Box>
                        <Typography className="settings-radio-primary">
                          Cat Detection
                        </Typography>
                        <Typography className="settings-radio-secondary">
                          Start playing when your cat is detected
                        </Typography>
                      </Box>
                    }
                    className="settings-radio-option"
                  />
                  <FormControlLabel
                    value="interval"
                    control={<Radio color="primary" disabled={loading} />}
                    label={
                      <Box>
                        <Typography className="settings-radio-primary">
                          Time Interval
                        </Typography>
                        <Typography className="settings-radio-secondary">
                          Play at regular intervals
                        </Typography>
                      </Box>
                    }
                    className="settings-radio-option"
                  />
                </RadioGroup>
              </FormControl>
            </Box>
            <Divider className="settings-divider" />

            {settings.triggerType === 'interval' && (
              <>
                <Box className="settings-section">
                  <Typography className="settings-section-title">
                    Time Interval
                  </Typography>
                  <TextField
                    type="number"
                    label="Hours between play sessions"
                    value={settings.timeInterval}
                    onChange={(e) => handleSettingChange('timeInterval', parseInt(e.target.value) || 1)}
                    InputProps={{ inputProps: { min: 1, max: 24 } }}
                    fullWidth
                    className="settings-text-field"
                    disabled={loading}
                  />
                  <Typography className="settings-helper-text">
                    The laser will activate every {settings.timeInterval} hour{settings.timeInterval !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Divider className="settings-divider" />
              </>
            )}

            <Box className="settings-section">
              <Typography className="settings-section-title">
                Session Duration
              </Typography>
              <TextField
                type="number"
                label="Minutes per play session"
                value={settings.sessionDuration}
                onChange={(e) => handleSettingChange('sessionDuration', parseInt(e.target.value) || 1)}
                InputProps={{ inputProps: { min: 1, max: 30 } }}
                fullWidth
                className="settings-text-field"
                disabled={loading}
              />
              <Typography className="settings-helper-text">
                Each play session will last {settings.sessionDuration} minute{settings.sessionDuration !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <Divider className="settings-divider" />

            <Box className="settings-info-box">
              <Typography variant="body2" className="settings-info-text">
                ℹ️ In Autonomous Mode, the laser will move in randomized patterns 
                to keep your cat engaged and active.
              </Typography>
            </Box>
          </>
        )}
      </List>
    </Box>
  );

  if (loading && currentView === 'main') {
    return (
      <Dialog
        open={open}
        fullWidth={true}
        maxWidth={'md'}
        onClose={handleClose}
        slotProps={{
          paper: { className: 'settings-dialog' },
          backdrop: { style: { background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' } },
        }}
      >
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <CircularProgress sx={{ color: 'rgba(255,182,193,0.8)' }} />
        </Box>
      </Dialog>
    );
  }

  return (
    <>
<Dialog
  open={open}
  fullWidth={true}
  maxWidth={'md'}
  onClose={handleClose}
  PaperProps={{ className: 'settings-dialog' }}
  BackdropProps={{ style: { background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' } }}
>
        <AppBar className="settings-appbar">
          <Toolbar>
            <IconButton
              edge="start"
              className="settings-close-btn"
              onClick={currentView === 'main' ? handleClose : () => setCurrentView('main')}
              aria-label={currentView === 'main' ? 'close' : 'back'}
              disabled={saving}
            >
              {currentView === 'main' ? <CloseIcon /> : <ArrowBackIcon />}
            </IconButton>
            <Typography className="settings-title" variant="h6" component="div">
              {currentView === 'main' && 'Settings'}
              {currentView === 'notifications' && 'Notifications'}
              {currentView === 'detection' && 'Detection Settings'}
            </Typography>
            <button 
              className="settings-save-btn" 
              onClick={handleSave}
              disabled={saving || loading || !hasChanges()}
            >
              {saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Save'
              )}
            </button>
          </Toolbar>
        </AppBar>
        
        {currentView === 'main' && renderMainView()}
        {currentView === 'notifications' && renderNotificationSettings()}
        {currentView === 'detection' && renderDetectionSettings()}
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}