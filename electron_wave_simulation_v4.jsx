import React, { useState, useEffect, useRef, useCallback } from 'react';

// Constants
const SLIT_Y1 = 150;
const SLIT_Y2 = 200;
const SLIT_WIDTH = 10;
const SLIT_X = 180;
const SCREEN_X = 340;
const CENTER_Y = 175;

// Wave interference calculation - produces multiple peaks
const calculateInterference = (y) => {
  const d = SLIT_Y2 - SLIT_Y1;
  const L = SCREEN_X - SLIT_X;
  const wavelength = 22;
  const deltaY = y - CENTER_Y;
  const pathDiff = (d * deltaY) / L;
  const phase = (2 * Math.PI * pathDiff) / wavelength;
  const envelope = Math.pow(Math.sin(deltaY / 40 + 0.001) / (deltaY / 40 + 0.001), 2) || 1;
  const interference = Math.pow(Math.cos(phase / 2), 2);
  return Math.max(0, interference * Math.min(envelope * 1.5, 1));
};

// Classical two-peak distribution
const calculateClassical = (y) => {
  const sigma = 18;
  const peak1 = Math.exp(-Math.pow(y - SLIT_Y1, 2) / (2 * sigma * sigma));
  const peak2 = Math.exp(-Math.pow(y - SLIT_Y2, 2) / (2 * sigma * sigma));
  return (peak1 + peak2) * 0.9;
};

export default function ElectronWaveSimulation() {
  const [mode, setMode] = useState('light');
  const [isRunning, setIsRunning] = useState(false);
  const [particles, setParticles] = useState([]);
  const [screenHits, setScreenHits] = useState([]);
  const [particleCount, setParticleCount] = useState(0);
  const [speed, setSpeed] = useState(1.5);
  const [observerOn, setObserverOn] = useState(false);
  const [waveTime, setWaveTime] = useState(0);
  const [showDistribution, setShowDistribution] = useState(false);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  const reset = useCallback(() => {
    setIsRunning(false);
    setParticles([]);
    setScreenHits([]);
    setParticleCount(0);
    setWaveTime(0);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  const getTargetY = useCallback((isObserved) => {
    const calcFunc = isObserved ? calculateClassical : calculateInterference;
    let attempts = 0;
    while (attempts < 150) {
      const y = CENTER_Y + (Math.random() - 0.5) * 200;
      if (y < 60 || y > 290) continue;
      const probability = calcFunc(y);
      if (Math.random() < probability) return y;
      attempts++;
    }
    return isObserved ? (Math.random() > 0.5 ? SLIT_Y1 : SLIT_Y2) : CENTER_Y;
  }, []);

  const spawnParticle = useCallback(() => {
    const isObserved = mode === 'particle' || observerOn;
    return {
      id: Date.now() + Math.random(),
      x: 25,
      y: CENTER_Y + (Math.random() - 0.5) * 30,
      targetY: getTargetY(isObserved),
      throughSlit: Math.random() > 0.5 ? 1 : 2,
      phase: Math.random() * Math.PI * 2,
      observed: isObserved,
    };
  }, [mode, observerOn, getTargetY]);

  useEffect(() => {
    if (!isRunning) return;
    const animate = (timestamp) => {
      const deltaTime = timestamp - lastTimeRef.current;
      if (deltaTime > 16) {
        lastTimeRef.current = timestamp;
        setWaveTime(t => t + 0.12 * speed);

        if (mode !== 'light') {
          setParticles(prev => {
            const updated = prev.map(p => {
              const newX = p.x + 3 * speed;
              let newY = p.y;
              if (newX > SLIT_X - 25 && newX < SLIT_X + 25) {
                const targetSlitY = p.throughSlit === 1 ? SLIT_Y1 : SLIT_Y2;
                newY = p.y + (targetSlitY - p.y) * 0.1;
              } else if (newX >= SLIT_X + 25) {
                newY = p.y + (p.targetY - p.y) * 0.05;
              }
              return { ...p, x: newX, y: newY, phase: p.phase + 0.25 * speed };
            });

            const stillActive = [];
            updated.forEach(p => {
              if (p.x >= SCREEN_X) {
                setScreenHits(prev => [...prev, { y: p.targetY }]);
                setParticleCount(c => c + 1);
              } else {
                stillActive.push(p);
              }
            });
            return stillActive;
          });

          const spawnRate = mode === 'single' ? 0.025 : 0.15;
          const maxParticles = mode === 'single' ? 1 : 12;
          setParticles(prev => {
            if (prev.length < maxParticles && Math.random() < spawnRate * speed) {
              return [...prev, spawnParticle()];
            }
            return prev;
          });
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isRunning, mode, speed, spawnParticle]);

  const modeInfo = {
    light: { title: 'デモ1: 光（波）', color: '#ff4444', showObserver: false },
    particle: { title: 'デモ2: ボール（粒子）', color: '#ffaa00', showObserver: false },
    electron: { title: 'デモ3: 電子ビーム', color: '#00aaff', showObserver: true },
    single: { title: 'デモ4: 単一電子', color: '#00ff88', showObserver: true },
  };

  // Build histogram
  const buildHistogram = () => {
    const bins = {};
    const binSize = 4;
    screenHits.forEach(hit => {
      const bin = Math.floor(hit.y / binSize) * binSize;
      bins[bin] = (bins[bin] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(bins), 1);
    return { bins, maxCount };
  };

  const { bins, maxCount } = buildHistogram();

  // Generate theory patterns
  const generatePattern = (calcFunc, yMin = 60, yMax = 290, step = 3) => {
    const pattern = [];
    for (let y = yMin; y <= yMax; y += step) {
      pattern.push({ y, intensity: calcFunc(y) });
    }
    return pattern;
  };

  const interferencePattern = generatePattern(calculateInterference);
  const classicalPattern = generatePattern(calculateClassical);
  const isInterference = mode === 'light' || ((mode === 'electron' || mode === 'single') && !observerOn);
  const currentTheoryPattern = (mode === 'particle' || observerOn) ? classicalPattern : interferencePattern;

  // Render concentric waves
  const renderWaves = () => {
    const waves = [];
    for (let i = 0; i < 10; i++) {
      const radius = ((waveTime * 35 + i * 28) % 250);
      if (radius > 8) {
        [SLIT_Y1, SLIT_Y2].forEach((slitY, idx) => {
          waves.push(
            <circle
              key={`wave-${idx}-${i}`}
              cx={SLIT_X + 5}
              cy={slitY}
              r={radius}
              fill="none"
              stroke={modeInfo[mode].color}
              strokeWidth="2.5"
              opacity={Math.max(0, 0.7 - radius / 300)}
              clipPath="url(#rightClip)"
            />
          );
        });
      }
    }
    return waves;
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      maxWidth: 1000, 
      margin: '0 auto', 
      padding: 16,
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      minHeight: '100vh',
      color: 'white'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: 6, fontSize: 26 }}>
        電子の二重性シミュレーション
      </h1>
      <p style={{ textAlign: 'center', color: '#777', marginBottom: 16, fontSize: 13 }}>
        Interactive Lecture Demonstration
      </p>

      {/* Mode buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(modeInfo).map(([key, info]) => (
          <button
            key={key}
            onClick={() => { reset(); setMode(key); setObserverOn(false); setShowDistribution(false); }}
            style={{
              padding: '8px 14px',
              border: mode === key ? `2px solid ${info.color}` : '2px solid #444',
              borderRadius: 6,
              background: mode === key ? `${info.color}22` : '#2a2a4a',
              color: mode === key ? info.color : '#777',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: mode === key ? 'bold' : 'normal',
            }}
          >
            {info.title}
          </button>
        ))}
      </div>

      {/* Observer toggle - simplified */}
      {modeInfo[mode].showObserver && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          marginBottom: 12,
          padding: 10,
          background: observerOn ? '#ff444420' : '#33333340',
          borderRadius: 8,
          border: observerOn ? '2px solid #ff6666' : '2px solid #555'
        }}>
          <span style={{ fontSize: 18 }}>🔬</span>
          <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: 14 }}>
            観測装置（どちらのスリットを通ったか検出）
          </span>
          <button
            onClick={() => { reset(); setObserverOn(!observerOn); }}
            style={{
              padding: '6px 20px',
              border: 'none',
              borderRadius: 5,
              background: observerOn ? '#ff5555' : '#666',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 13
            }}
          >
            {observerOn ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {/* Main area */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        
        {/* Left: Experiment visualization */}
        <div style={{ 
          flex: showDistribution ? '1 1 55%' : '1 1 100%',
          background: '#080815',
          borderRadius: 10,
          border: '1px solid #333',
          overflow: 'hidden',
          transition: 'flex 0.3s'
        }}>
          <svg width="100%" viewBox="0 0 380 350" style={{ display: 'block' }}>
            <defs>
              <clipPath id="rightClip">
                <rect x={SLIT_X + 5} y="0" width="400" height="400" />
              </clipPath>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            <rect width="380" height="350" fill="#080815"/>

            {/* Labels */}
            <text x="40" y="22" fill="#555" fontSize="10">発射源</text>
            <text x={SLIT_X - 5} y="22" fill="#555" fontSize="10">二重スリット</text>
            <text x={SCREEN_X + 5} y="22" fill="#555" fontSize="10">スクリーン</text>

            {/* Source */}
            <rect x="15" y={CENTER_Y - 25} width="40" height="50" fill="#1a1a2a" rx="4" stroke="#333"/>
            <circle cx="35" cy={CENTER_Y} r="10" fill={modeInfo[mode].color} filter="url(#glow)" opacity="0.7"/>
            <circle cx="35" cy={CENTER_Y} r="4" fill="#fff"/>

            {/* Incident waves for light */}
            {mode === 'light' && isRunning && Array.from({ length: 6 }, (_, i) => {
              const x = 55 + ((waveTime * 35 + i * 22) % 120);
              return <line key={`inc-${i}`} x1={x} y1={CENTER_Y - 50} x2={x} y2={CENTER_Y + 50} stroke={modeInfo[mode].color} strokeWidth="2" opacity="0.35"/>;
            })}

            {/* Slit barrier */}
            <rect x={SLIT_X} y="35" width={SLIT_WIDTH} height={SLIT_Y1 - 35 - SLIT_WIDTH/2} fill="#3a4055" stroke="#4a5065"/>
            <rect x={SLIT_X} y={SLIT_Y1 + SLIT_WIDTH/2} width={SLIT_WIDTH} height={SLIT_Y2 - SLIT_Y1 - SLIT_WIDTH} fill="#3a4055" stroke="#4a5065"/>
            <rect x={SLIT_X} y={SLIT_Y2 + SLIT_WIDTH/2} width={SLIT_WIDTH} height={315 - SLIT_Y2 - SLIT_WIDTH/2} fill="#3a4055" stroke="#4a5065"/>

            {/* Slit openings */}
            <rect x={SLIT_X} y={SLIT_Y1 - SLIT_WIDTH/2} width={SLIT_WIDTH} height={SLIT_WIDTH} fill="#0a0a15"/>
            <rect x={SLIT_X} y={SLIT_Y2 - SLIT_WIDTH/2} width={SLIT_WIDTH} height={SLIT_WIDTH} fill="#0a0a15"/>

            {/* Observer indicators */}
            {modeInfo[mode].showObserver && observerOn && (
              <g>
                <circle cx={SLIT_X - 8} cy={SLIT_Y1} r="8" fill="#ff4444" opacity="0.4"/>
                <circle cx={SLIT_X - 8} cy={SLIT_Y2} r="8" fill="#ff4444" opacity="0.4"/>
                <text x={SLIT_X - 8} y={SLIT_Y1 + 4} fill="#ff4444" fontSize="10" textAnchor="middle">👁</text>
                <text x={SLIT_X - 8} y={SLIT_Y2 + 4} fill="#ff4444" fontSize="10" textAnchor="middle">👁</text>
              </g>
            )}

            {/* Concentric waves for light mode */}
            {mode === 'light' && isRunning && renderWaves()}

            {/* Screen */}
            <rect x={SCREEN_X} y="35" width="10" height="280" fill="#1a1a2a" stroke="#333"/>

            {/* Light interference on screen */}
            {mode === 'light' && isRunning && interferencePattern.map((p, i) => (
              <rect key={i} x={SCREEN_X} y={p.y - 1.5} width="10" height="3" fill={modeInfo[mode].color} opacity={p.intensity * 0.95}/>
            ))}

            {/* Particles */}
            {mode !== 'light' && particles.map(p => (
              <g key={p.id}>
                <ellipse cx={p.x - 8} cy={p.y} rx="12" ry="3" fill={modeInfo[mode].color} opacity="0.15"/>
                <circle cx={p.x} cy={p.y} r={mode === 'particle' ? 7 : 4} fill={modeInfo[mode].color} filter="url(#glow)"/>
                {!p.observed && (mode === 'electron' || mode === 'single') && (
                  <circle cx={p.x} cy={p.y} r={8 + Math.sin(p.phase) * 4} fill="none" stroke={modeInfo[mode].color} strokeWidth="1.5" opacity="0.35"/>
                )}
              </g>
            ))}

            {/* Screen hits */}
            {mode !== 'light' && screenHits.slice(-200).map((hit, i) => (
              <circle key={i} cx={SCREEN_X + 5} cy={hit.y} r="2" fill={modeInfo[mode].color} opacity="0.7"/>
            ))}

            {/* Counter */}
            <text x="360" y="340" fill="#555" fontSize="11" textAnchor="end">
              {mode === 'particle' ? 'ボール' : mode === 'light' ? '' : '電子'}{mode !== 'light' ? `: ${particleCount}` : ''}
            </text>
          </svg>
        </div>

        {/* Right: Distribution panel (hidden by default) */}
        {showDistribution && (
          <div style={{ 
            flex: '1 1 45%',
            background: '#0a0a18',
            borderRadius: 10,
            border: '1px solid #333',
            padding: 12
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#aaa', textAlign: 'center' }}>
              スクリーン上の分布
            </h3>

            <svg width="100%" viewBox="0 0 280 280" style={{ display: 'block' }}>
              {/* Y-axis labels */}
              <text x="8" y="20" fill="#444" fontSize="9">上</text>
              <text x="8" y="270" fill="#444" fontSize="9">下</text>

              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line key={i} x1="25" y1={50 + i * 50} x2="270" y2={50 + i * 50} stroke="#222" strokeWidth="1"/>
              ))}

              {/* Theory pattern (background) */}
              <g>
                <text x="200" y="35" fill="#555" fontSize="9">理論予測</text>
                {currentTheoryPattern.map((p, i) => {
                  const barY = ((p.y - 60) / 230) * 220 + 45;
                  return (
                    <rect
                      key={i}
                      x="25"
                      y={barY - 1.5}
                      width={p.intensity * 100}
                      height="3"
                      fill={isInterference ? '#00aaff' : '#ffaa00'}
                      opacity="0.25"
                    />
                  );
                })}
              </g>

              {/* Actual histogram */}
              {mode !== 'light' && (
                <g>
                  <text x="30" y="35" fill="#888" fontSize="9">実験結果</text>
                  {Object.entries(bins).map(([y, count]) => {
                    const barY = ((parseFloat(y) - 60) / 230) * 220 + 45;
                    const barWidth = (count / maxCount) * 120;
                    return (
                      <rect
                        key={y}
                        x="25"
                        y={barY - 2}
                        width={barWidth}
                        height="4"
                        fill={modeInfo[mode].color}
                        opacity="0.9"
                        rx="1"
                      />
                    );
                  })}
                </g>
              )}

              {/* Light mode - show interference directly */}
              {mode === 'light' && isRunning && interferencePattern.map((p, i) => {
                const barY = ((p.y - 60) / 230) * 220 + 45;
                return (
                  <rect
                    key={i}
                    x="25"
                    y={barY - 1.5}
                    width={p.intensity * 120}
                    height="3"
                    fill={modeInfo[mode].color}
                    opacity="0.9"
                  />
                );
              })}

              {/* Slit position indicators */}
              <line x1="20" y1={((SLIT_Y1 - 60) / 230) * 220 + 45} x2="25" y2={((SLIT_Y1 - 60) / 230) * 220 + 45} stroke="#666" strokeWidth="2"/>
              <line x1="20" y1={((SLIT_Y2 - 60) / 230) * 220 + 45} x2="25" y2={((SLIT_Y2 - 60) / 230) * 220 + 45} stroke="#666" strokeWidth="2"/>
              <text x="12" y={((SLIT_Y1 - 60) / 230) * 220 + 48} fill="#666" fontSize="8">S1</text>
              <text x="12" y={((SLIT_Y2 - 60) / 230) * 220 + 48} fill="#666" fontSize="8">S2</text>
            </svg>

            {/* Legend */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 20, 
              marginTop: 8,
              padding: '8px 0',
              borderTop: '1px solid #222'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 4, background: modeInfo[mode].color, borderRadius: 2 }}/>
                <span style={{ color: '#888', fontSize: 11 }}>実験</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 4, background: isInterference ? '#00aaff44' : '#ffaa0044', borderRadius: 2 }}/>
                <span style={{ color: '#666', fontSize: 11 }}>理論</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            padding: '10px 26px',
            fontSize: 14,
            border: 'none',
            borderRadius: 6,
            background: isRunning ? '#ee4444' : '#44aa44',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isRunning ? '⏸ 停止' : '▶ 開始'}
        </button>
        <button
          onClick={reset}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            border: '2px solid #444',
            borderRadius: 6,
            background: 'transparent',
            color: '#999',
            cursor: 'pointer'
          }}
        >
          🔄 リセット
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>速度:</span>
          <input type="range" min="0.5" max="3" step="0.5" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ width: 70 }}/>
          <span style={{ color: '#999', fontSize: 12, width: 28 }}>{speed}x</span>
        </div>
        
        {/* Distribution toggle checkbox */}
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          cursor: 'pointer',
          padding: '6px 12px',
          background: showDistribution ? '#ffffff15' : 'transparent',
          borderRadius: 4,
          border: '1px solid #444'
        }}>
          <input 
            type="checkbox" 
            checked={showDistribution} 
            onChange={(e) => setShowDistribution(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ color: '#aaa', fontSize: 12 }}>分布グラフを表示</span>
        </label>
      </div>
    </div>
  );
}
