import React, { useState, useEffect } from 'react';

const LIGHT_THEME = {
  bg: 'linear-gradient(135deg,#e3f6ff 0%,#fff0f6 100%)',
  panel: '#fff',
  headline: '#0a2540',
  label: '#333',
  border: '#eaeaea',
  shadow: '0 4px 24px rgba(0,0,0,0.07)',
  button: '#e91e63',
  buttonText: '#fff',
  refresh: '#2196f3',
  progressbg: '#edf2fa',
  progressbar: 'linear-gradient(90deg,#e91e63 66%,#ffeb3b 100%)',
  progressText: '#0a2540'
};

const DARK_THEME = {
  bg: 'linear-gradient(135deg,#22242a 0%,#282e36 100%)',
  panel: '#23272f',
  headline: '#ffeb3b',
  label: '#e8eaf6',
  border: '#353b47',
  shadow: '0 4px 24px rgba(0,0,0,0.29)',
  button: '#e91e63',
  buttonText: '#fff',
  refresh: '#2196f3',
  progressbg: '#353b47',
  progressbar: 'linear-gradient(90deg,#e91e63 70%,#ffeb3b 100%)',
  progressText: '#fbeaff'
};

function App() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('best');
  const [jobId, setJobId] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [dark, setDark] = useState(false);

  const THEME = dark ? DARK_THEME : LIGHT_THEME;

  const BACKEND = 'https://0e1f8e87-6221-4451-8ba4-bdf531d7699a-00-39solq6fsydy3.riker.repl.co:3003';

  const handleStart = async (e) => {
    e.preventDefault();
    setProgress(0);
    setJobId('');
    setDownloading(true);
    const res = await fetch(`${BACKEND}/start-download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, quality })
    });
    const data = await res.json();
    setJobId(data.job_id);
  };

  useEffect(() => {
    if (jobId) {
      const poll = setInterval(async () => {
        const res = await fetch(`${BACKEND}/progress?job_id=${jobId}`);
        const { percent } = await res.json();
        setProgress(percent);
        if (percent >= 100) {
          clearInterval(poll);
          setTimeout(() => {
            window.location.href = `${BACKEND}/get-file?job_id=${jobId}`;
            setDownloading(false);
          }, 1000);
        }
        if (percent === -1) {
          clearInterval(poll);
          setDownloading(false);
        }
      }, 1000);
      return () => clearInterval(poll);
    }
  }, [jobId]);

  const handleRefresh = () => {
    setUrl('');
    setQuality('best');
    setJobId('');
    setProgress(0);
    setDownloading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: THEME.bg,
      transition: 'background 0.4s'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        minWidth: 280,
        margin: 0,
        padding: 22,
        borderRadius: 16,
        boxShadow: THEME.shadow,
        background: THEME.panel,
        transition: 'background 0.4s, box-shadow 0.4s'
      }}>

        {/* Dark/Light Toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8
        }}>
          <h2 style={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize:27,
            letterSpacing: '.01em',
            color: THEME.headline,
            marginBottom: 20
          }}>
            YouTube Downloader
          </h2>
          <button
            type="button"
            title={dark ? "Light mode" : "Dark mode"}
            onClick={()=>setDark(v=>!v)}
            style={{
              background: dark ? '#fff' : '#212229',
              color: dark ? '#e91e63' : '#ffeb3b',
              borderRadius: 100,
              border: 'none',
              marginBottom:55,
              width: 40,
              height: 40,
              fontSize: 20,
              cursor: "pointer",
              boxShadow: dark ? '0 0px 12px #4442' : '0 1px 8px #fbeaff'
            }}>
            {/* Icon */}
            {dark
              ? <span role="img" aria-label="Light">☀️</span>
              : <span role="img" aria-label="Dark">🌘</span>
            }
          </button>
        </div>

        <form onSubmit={handleStart} autoComplete="off">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste YouTube link"
            required
            style={{
              width: '100%',
              padding: '13px',
              marginBottom: 20,
              borderRadius: 8,
              border: `1px solid ${THEME.border}`,
              fontSize: 17,
              outline: 'none',
              boxSizing: 'border-box',
              background: dark ? '#282e36' : '#f7fafc',
              color: THEME.label
            }}
            autoFocus
            spellCheck="false"
          />

          <div style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
            flexWrap: 'wrap'
          }}>
            <select
              value={quality}
              onChange={e => setQuality(e.target.value)}
              style={{
                padding: "9px 13px",
                borderRadius: 8,
                border: `1px solid ${THEME.border}`,
                fontSize: 16,
                background: dark ? "#22242a" : "#f7fafc",
                color: THEME.label,
                cursor: 'pointer'
              }}>
              <option value="best">Best</option>
              <option value="high">High (720p)</option>
              <option value="medium">Medium (480p)</option>
              <option value="low">Low (360p)</option>
              <option value="audio">Audio Only</option>
            </select>
            {/* Download Button */}
            <button type="submit"
              disabled={downloading || jobId}
              style={{
                padding: '11px 26px',
                borderRadius: 8,
                border: 'none',
                background: THEME.button,
                color: THEME.buttonText,
                fontWeight: 'bold',
                letterSpacing: ".01em",
                fontSize: 17,
                cursor: jobId ? "not-allowed" : "pointer",
                boxShadow: dark ? '0 1px 8px #ecd6e733' : "0 1px 7px #ecd6e7"
              }}>
              {downloading ? "Processing..." : "Download"}
            </button>
            {/* Refresh Button with icon (side by side) */}
            <button
              type="button"
              onClick={handleRefresh}
              style={{
                padding: '10px 15px',
                marginTop:'5px',
                borderRadius: 8,
                border: 'none',
                background: THEME.refresh,
                color: THEME.buttonText,
                fontWeight: 'bold',
                fontSize: 17,
                cursor: 'pointer',
                boxShadow: dark ? '0 1px 8px #b2dbff44' : '0 1px 7px #b2dbff',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
              {/* SVG Circular arrow icon */}
              <svg width="20" height="20" viewBox="0 0 21 21" fill="none" style={{marginRight:3}}>
                <path d="M13.7 3.6A8 8 0 1 0 17 10"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"/>
                <path d="M16.8 3.7V7.1H13.4"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
          </div>
        </form>

        {/* Progress bar */}
        {(progress > 0 || downloading) &&
          <div style={{
            marginTop: 25,
            textAlign: "center",
            marginBottom: -2,
            userSelect:"none"
          }}>
            <div style={{
              height:22,
              width:"100%",
              background:THEME.progressbg,
              borderRadius: 13,
              marginBottom:10,
              boxShadow: dark ? '0 1px 6px #1d183e55' : "0 2px 6px #eee",
              overflow: 'hidden'
            }}>
              <div style={{
                height:22,
                width:`${progress}%`,
                background:THEME.progressbar,
                borderRadius:20,
                transition:"width 0.8s"
              }}/>
            </div>
            <span style={{
              color:THEME.progressText,
              fontWeight:500,
              fontVariantNumeric:'tabular-nums'
            }}>
              {progress}% {downloading && "processing..."}
            </span>
          </div>
        }

        <div style={{
          marginTop:34,
          fontSize:16,
          textAlign:"center",
          color:THEME.label,
          fontWeight: 400,
          lineHeight: 1.65,
          opacity:dark ? .9 : .96
        }}>
          <p>
            <b style={{color:THEME.button
            }}>
              How to Use.
            </b>
            <br/>
<ol style={{
  color: THEME.button,
  textAlign: 'left',         
  margin: '10px auto',
  fontWeight: 500,
  fontSize: 16,
  maxWidth: 250,
  paddingLeft: 24
}}>
  <li>Paste your YouTube link</li>
  <li>Choose quality</li>
  <li>Download and Wait some time</li>
</ol>

            
            <br />
       <p style={{color:THEME.progressText}}>Created by Sandip | Copyright © 2025 </p>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
