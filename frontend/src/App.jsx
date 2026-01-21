import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [backendStatus, setBackendStatus] = useState('checking...')
  const [isConnected, setIsConnected] = useState(false)
  const [laserOn, setLaserOn] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [pressedKey, setPressedKey] = useState(null)

  const CAMERA_URL = 'http://192.168.1.108:5000/video_feed';

  useEffect(() => {
    checkBackendHealth()
  }, [])

  // Add keyboard controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Prevent default behavior for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        setPressedKey(event.key)
      }

      switch(event.key) {
        case 'ArrowUp':
          moveWithDebounce('up', 'y')
          break
        case 'ArrowDown':
          moveWithDebounce('down', 'y')
          break
        case 'ArrowLeft':
          moveWithDebounce('left', 'x')
          break
        case 'ArrowRight':
          moveWithDebounce('right', 'x')
          break
        default:
          break
      }
    }

    const handleKeyUp = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        setPressedKey(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isMoving]) 

  const checkBackendHealth = async () => {
    try {
      const response = await fetch('/api/health')
      const laser_response = await fetch('/api/laser/status')
      const camera_response = await fetch('/api/camera/health')
      const data = await response.json()
      const laser_data = await laser_response.json()
      const camera_data = await camera_response.json()
      
      console.log(data)
      console.log(laser_data)
      console.log(camera_data)
      if (data.status === 'success' && 
          laser_data.status === 'success' && 
          camera_data.status === 'success') 
      {
        setBackendStatus('Connected')
        setIsConnected(true)
      } else {
        setBackendStatus('Backend error')
        setIsConnected(false)
      }
    } catch (error) {
      // Backend not reachable
      setBackendStatus('Disconnected')
      setIsConnected(false)
      console.error('Backend health check failed:', error)
    }
  }

  const moveWithDebounce = async (direction, axis) => {
    if (isMoving) return  
    
    setIsMoving(true)
    try {
      await fetch(`api/laser/move-${axis}?direction=${direction}`)
    } finally {
      setTimeout(() => setIsMoving(false), 300) 
    }
  }

  // Toggle laser on/off
  const toggleLaser = async () => {
    try {
      const endpoint = laserOn ? '/api/laser/off' : '/api/laser/on'
      const response = await fetch(endpoint)
      const data = await response.json()
      
      console.log(data)
      if (data.status === 'success') {
        setLaserOn(!laserOn) 
      }
    } catch (error) {
      console.error('Failed to toggle laser:', error)
    }
  }

  return (
    <div className="app-container">
      {/* Top controls bar */}
      <div className="top-controls">
        <button 
          className="test-button"
          onClick={() => checkBackendHealth()}
        >
          <span className="button-icon">⟳</span>
          Test Connection
        </button>

        <div className="status-badge">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span className="status-text">{backendStatus}</span>
        </div>

        <button className="settings-button">
          ⚙ Settings
        </button>
      </div>

      {/* Video section with overlayed controls */}
      <div className="video-container">
        <img
          src={CAMERA_URL}
          alt="Live Camera Stream"
          className="camera-feed"
        />
        
        {/* Overlayed direction controls */}
        <div className="overlay-controls">
          <button 
            className={`overlay-button ${pressedKey === 'ArrowUp' ? 'pressed' : ''}`}
            onClick={() => moveWithDebounce('up', 'y')}>
            ↑
          </button>
          
          <div className="horizontal-overlay">
            <button 
              className={`overlay-button ${pressedKey === 'ArrowLeft' ? 'pressed' : ''}`}
              onClick={() => moveWithDebounce('left', 'x')}>
              ←
            </button>
            <button 
              className={`overlay-button ${pressedKey === 'ArrowRight' ? 'pressed' : ''}`}
              onClick={() => moveWithDebounce('right', 'x')}>
              →
            </button>
          </div>

          <button 
            className={`overlay-button ${pressedKey === 'ArrowDown' ? 'pressed' : ''}`}
            onClick={() => moveWithDebounce('down', 'y')}>
            ↓
          </button>
        </div>

        {/* Overlayed laser button */}
        <div className="laser-overlay">
          <button 
            className="laser-button"
            onClick={toggleLaser}
            style={{
              backgroundColor: laserOn ? '#4CAF50' : '#f44336'
            }}
          >
            Laser: {laserOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App