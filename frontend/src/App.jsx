import { useState, useEffect } from "react";
import "./App.css";
import DirectionButton from "./Components/DirectionButton";
import Alert from "./Components/Alert";
import SettingsIcon from "@mui/icons-material/Settings";
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

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Prevent default behavior for arrow keys
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

    // Handle when user clicks off key
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

        console.log(data.status)
        if (data.status == 'ok') {
          setCatDetected(true);
          //setShowAlert(true);
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
      eventSource.close()
    };
  }, []);

  useEffect(() => {
     if (catDetected) {
       setShowAlert(true)
       const timer = setTimeout(() => {
         setShowAlert(false)
       }, 1000);
       return () => clearTimeout(timer);
     } else {
       setShowAlert(false)
       setCatDetected(false)
     }
   }, [catDetected])


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

      console.log(data);
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

      console.log(data);
      console.log(laser_data);
      console.log(camera_data);
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

      console.log(cameraURL);
    } catch (error) {
      // Backend not reachable
      setBackendStatus("Disconnected");
      setIsConnected(false);
      console.error("Backend health check failed:", error);
    }
  };

  return (
    <div className="app-container">
      {/* Top controls bar */}
      <div className="top-controls">
        <button className="button" onClick={() => checkBackendHealth()}>
          <span>⟳</span>
          Test Connection
        </button>

        <div className="status-badge">
          <div
            className={`status-dot ${
              isConnected ? "connected" : "disconnected"
            }`}
          ></div>
          <span className="status-text">{backendStatus}</span>
        </div>

          <button
            className={`button button-laser ${
              laserOn ? "laser-on" : "laser-off"
            }`}
            onClick={toggleLaser}
          >
            Laser: {laserOn ? "ON" : "OFF"}
          </button>

        <button
          className="button button-right"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
        </button>
      </div>

<div className={`alert-container ${showAlert ? 'show' : ''}`}>
  <Alert />
</div>

      {/* Video section with overlayed controls */}
      <div>
        <img src={cameraURL} alt="Live Camera Stream" className="camera-feed" />
        {/* Overlayed direction controls using DirectionButton component */}
        <div className="overlay-controls">
          <DirectionButton
            direction="ArrowUp"
            onClick={() => moveWithDebounce("up", "y")}
            isPressed={pressedKey ==="ArrowUp"}
          />

          <div className="horizontal-overlay">
            <DirectionButton
              direction="ArrowLeft"
              onClick={() => moveWithDebounce("left", "x")}
              isPressed={pressedKey === "ArrowLeft"}
            />
            <DirectionButton
              direction="ArrowRight"
              onClick={() => moveWithDebounce("right", "x")}
              isPressed={pressedKey === "ArrowRight"}
            />
          </div>

          <DirectionButton
            direction="ArrowDown"
            onClick={() => moveWithDebounce("down", "y")}
            isPressed={pressedKey === "ArrowDown"}
          />
        </div>
        <img src={"./src/Logo/Logo.png"} alt="Logo" className="logo" />
      </div>
      <FullScreenDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default App;