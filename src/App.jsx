import React, { useEffect, useState } from 'react';
import './App.css';
import BlocksScene from './components/BlocksScene';
import AnimatedButton from './components/Animatedbutton';
import TickerText from './components/TickerText';

function App() {
  const [buttonTexts] = useState({
    youtube: { default: 'Youtube', hover: 'See what we do and how we do it.' },
    discord: { default: 'Discord', hover: 'Join the community and chat with us!' },
    gumroad: { default: 'Gumroad', hover: 'Free plugins, assets and more.' }
  });

  useEffect(() => {
    const letters = document.querySelectorAll('.letter');

    const handleMouseMove = (e) => {
      letters.forEach((letter) => {
        const rect = letter.getBoundingClientRect();
        const letterX = rect.left + rect.width / 2;
        const letterY = rect.top + rect.height / 2;

        const distanceX = e.clientX - letterX;
        const distanceY = e.clientY - letterY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (distance < 300) {
          const angle = Math.atan2(distanceY, distanceX);
          const force = (200 - distance) / 3;
          const moveX = -Math.cos(angle) * force;
          const moveY = -Math.sin(angle) * force;
          
          // Calculate rotation based on displacement
          const rotationForce = (force / 200) * 45; // Max 45 degrees rotation
          const randomDirection = letter.dataset.rotationDir || (Math.random() > 0.5 ? 1 : -1);
          letter.dataset.rotationDir = randomDirection;
          
          letter.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotationForce * randomDirection}deg)`;
        } else {
          letter.style.transform = 'translate(0, 0) rotate(0deg)';
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <BlocksScene />
      <div className="overlay">
        <h1 className="title">
          {'NICE   TOUCH'.split('').map((char, i) => (
            <span key={i} className="letter">
              {char}
            </span>
          ))}
        </h1>
        <TickerText />
        <div className="buttons">
          <AnimatedButton
            defaultText={buttonTexts.youtube.default}
            hoverText={buttonTexts.youtube.hover}
            onClick={() => window.open('https://www.youtube.com/@NiceTouch318', '_blank')}
          />
          <AnimatedButton
            defaultText={buttonTexts.discord.default}
            hoverText={buttonTexts.discord.hover}
            onClick={() => window.open('https://discord.gg/jpp3mQUCYN', '_blank')}
          />
          <AnimatedButton
            defaultText={buttonTexts.gumroad.default}
            hoverText={buttonTexts.gumroad.hover}
            onClick={() => window.open('https://thatsanicetouch.gumroad.com/', '_blank')}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
