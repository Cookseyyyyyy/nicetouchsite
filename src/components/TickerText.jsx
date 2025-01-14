import React from 'react';
import './TickerText.css';

export default function TickerText() {
  const text = "DATA DRIVEN VFX // VIRTUAL PRODUCTION MUSIC VIDEOS // INTERACTIVE ART // ";
  
  return (
    <div className="ticker-container">
      <div className="ticker">
        <div className="ticker-content">
          {text + text + text + text + text + text}
        </div>
      </div>
    </div>
  );
}
