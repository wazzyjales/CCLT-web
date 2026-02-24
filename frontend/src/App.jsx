import { useState, useEffect, useRef } from "react";
import "./App.css";
import Joystick from "./Components/Joystick";
import Alert from "./Components/Alert";
import SettingsIcon from "@mui/icons-material/Settings";
import RefreshIcon from "@mui/icons-material/Refresh";
import FullScreenDialog from "./Components/SettingsDialog";

function App() {
  const [backendStatus, setBackendStatus] = useState("checking...");
  const [isConnected, setIsConnected] = useState(false);
  const [laserOn, setLaserOn] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);
  const [cameraURL, setCameraURL] = useState(null);
  const [catDetected, setCatDetected] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  // Tracks the last time the alert was shown so we can enforce the cooldown
  const lastAlertTimeRef = useRef(0);
  // Mirrors catDetected in a ref so interval callbacks always read the latest value
  const catDetectedRef = useRef(false);

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        setPressedKey(event.key);
      }

      switch (event.key) {
        case "ArrowUp":
          moveWithDebounce("up", "y");
          break;
        case "ArrowDown":
          moveWithDebounce("down", "y");
          break;
        case "ArrowLeft":
          moveWithDebounce("left", "x");
          break;
        case "ArrowRight":
          moveWithDebounce("right", "x");
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        setPressedKey(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isMoving]);

  useEffect(() => {
    const eventSource = new EventSource('/api/detection/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Cat detection event:', data);

        if (data.status == 'ok') {
          setCatDetected(true);
        } else {
          setCatDetected(false);
        }
      } catch (error) {
        console.error('Failed to parse detection event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Keep the ref in sync so interval callbacks always see the latest value
  useEffect(() => {
    catDetectedRef.current = catDetected;
  }, [catDetected]);

  useEffect(() => {
    if (!catDetected) return;
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) return;

    lastAlertTimeRef.current = now;
    setShowAlert(true);
    const timer = setTimeout(() => setShowAlert(false), 1500);
    return () => clearTimeout(timer);
  }, [catDetected]);

  // re-check every cooldown period and alert again if still there
  useEffect(() => {
    const interval = setInterval(() => {
      if (!catDetectedRef.current) return;
      const now = Date.now();
      if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) return;

      lastAlertTimeRef.current = now;
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 1500);
    }, ALERT_COOLDOWN_MS);

    return () => clearInterval(interval);
  }, []);

  const moveWithDebounce = async (direction, axis) => {
    if (isMoving) return;

    setIsMoving(true);
    try {
      await fetch(`api/laser/move-${axis}?direction=${direction}`);
    } finally {
      setTimeout(() => setIsMoving(false), 300);
    }
  };

  const toggleLaser = async () => {
    try {
      const endpoint = laserOn ? "/api/laser/off" : "/api/laser/on";
      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.status === "success") {
        setLaserOn(!laserOn);
      }
    } catch (error) {
      console.error("Failed to toggle laser:", error);
    }
  };

  const checkBackendHealth = async () => {
    try {
      const response = await fetch("/api/health");
      const laser_response = await fetch("/api/laser/status");
      const camera_response = await fetch("/api/camera/health");
      const data = await response.json();
      const laser_data = await laser_response.json();
      const camera_data = await camera_response.json();

      if (
        data.status === "success" &&
        laser_data.status === "success" &&
        camera_data.status === "success"
      ) {
        setBackendStatus("Connected");
        setIsConnected(true);
      } else {
        setBackendStatus("Backend error");
        setIsConnected(false);
      }
      setCameraURL(camera_data.video_url);
    } catch (error) {
      setBackendStatus("Disconnected");
      setIsConnected(false);
      console.error("Backend health check failed:", error);
    }
  };

  return (
    <div className="app-container">

      <div className="video-fullscreen">
        <img
          src={cameraURL}
          alt="Live Camera Stream"
          className={`camera-feed`}
        />
      </div>

      <nav className="top-menu">
        <div className="menu-left">
          <button
            className={`overlay-btn btn-laser ${laserOn ? "laser-on" : "laser-off"}`}
            onClick={toggleLaser}
          >
            Laser: {laserOn ? "ON" : "OFF"}
          </button>

          <button className="overlay-btn" onClick={checkBackendHealth}>
            <RefreshIcon fontSize="small" />
            Test Connection
          </button>

          <div className="status-badge">
            <div className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
            <span className="status-text">{backendStatus}</span>
          </div>
        </div>

        <button className="overlay-btn btn-settings" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon fontSize="small" />
          Settings
        </button>
      </nav>

      <div className="joystick-overlay">
        <Joystick
          onMove={(direction, axis) => moveWithDebounce(direction, axis)}
        />
      </div>

      <Alert show={showAlert} />

      <FullScreenDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
