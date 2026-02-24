import { useRef, useState, useEffect, useCallback } from 'react';
import './Joystick.css';

export default function Joystick({
  onMove,
  throttleMs = 100,
  size = 200,
  knobSize = 80,
}) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const [active, setActive] = useState(false);

  // Active direction label for UI highlighting: null | 'up' | 'down' | 'left' | 'right'
  const [activeDir, setActiveDir] = useState(null);

  // Ref holding the currently resolved direction object so interval callback
  // always reads the latest value without stale closure issues
  const currentDirectionRef = useRef(null);

  // Interval handle for repeated move firing
  const intervalRef = useRef(null);

  // Ref to the base element (for pointer capture & getBoundingClientRect)
  const baseRef = useRef(null);

  // Max distance the knob can travel from center
  const maxRadius = (size - knobSize) / 2;

  /**
   * Resolve a raw offset {x, y} into a cardinal direction + axis,
   * or null if the displacement is within the dead zone.
   */
  const resolveDirection = useCallback(
    (x, y) => {
      const DEAD_ZONE_RATIO = 0.1; // 15% of max radius
      const magnitude = Math.sqrt(x * x + y * y);
      if (magnitude < maxRadius * DEAD_ZONE_RATIO) return null;

      // Dominant axis wins
      if (Math.abs(x) >= Math.abs(y)) {
        return x > 0
          ? { direction: 'right', axis: 'x' }
          : { direction: 'left', axis: 'x' };
      } else {
        return y > 0
          ? { direction: 'down', axis: 'y' }
          : { direction: 'up', axis: 'y' };
      }
    },
    [maxRadius]
  );

  /**
   * Begin firing move commands: fire once immediately, then on an interval.
   */
  const startFiring = useCallback(
    (dirObj) => {
      if (!dirObj || !onMove) return;
      onMove(dirObj.direction, dirObj.axis);
      intervalRef.current = setInterval(() => {
        onMove(dirObj.direction, dirObj.axis);
      }, throttleMs);
    },
    [onMove, throttleMs]
  );

  /** Cancel the active firing interval. */
  const stopFiring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Clamp a point {x, y} to within the circular bounding area.
   * Returns the (possibly clamped) position.
   */
  const clampToCircle = useCallback(
    (x, y) => {
      const dist = Math.sqrt(x * x + y * y);
      if (dist <= maxRadius) return { x, y };
      return {
        x: (x / dist) * maxRadius,
        y: (y / dist) * maxRadius,
      };
    },
    [maxRadius]
  );

  const handlePointerDown = (e) => {
    e.preventDefault();
    // Capture pointer so move/up events are received even outside the element
    baseRef.current.setPointerCapture(e.pointerId);
    setActive(true);
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (!active) return;

      // Offset relative to the center of the base circle
      const rect = baseRef.current.getBoundingClientRect();
      const rawX = e.clientX - (rect.left + rect.width / 2);
      const rawY = e.clientY - (rect.top + rect.height / 2);

      const clamped = clampToCircle(rawX, rawY);
      setKnobPos(clamped);

      // Determine direction and restart firing interval only if it changed
      const newDir = resolveDirection(clamped.x, clamped.y);
      const prevDir = currentDirectionRef.current;

      const changed =
        newDir?.direction !== prevDir?.direction || newDir?.axis !== prevDir?.axis;

      if (changed) {
        stopFiring();
        currentDirectionRef.current = newDir;
        setActiveDir(newDir?.direction ?? null);
        if (newDir) startFiring(newDir);
      }
    },
    [active, clampToCircle, resolveDirection, startFiring, stopFiring]
  );

  const handlePointerUp = useCallback(() => {
    if (!active) return;
    setKnobPos({ x: 0, y: 0 });
    setActive(false);
    setActiveDir(null);
    stopFiring();
    currentDirectionRef.current = null;
  }, [active, stopFiring]);

  // Attach move/up to window so dragging outside the component still works
  useEffect(() => {
    if (active) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [active, handlePointerMove, handlePointerUp]);

  // Clean up interval on unmount
  useEffect(() => () => stopFiring(), [stopFiring]);

  return (
    <div>
      <div
        ref={baseRef}
        className={`joystick-base ${active ? 'joystick-base--active' : ''}`}
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
      >
        <div
          className={`joystick-knob ${active ? 'joystick-knob--active' : ''}`}
          style={{
            width: knobSize,
            height: knobSize,
            // Translate from the top-left corner of the base, centered, then offset by drag
            transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
          }}
          aria-hidden="true"
        >
          <div className="joystick-knob-gloss" />
        </div>
      </div>
    </div>
  );
}