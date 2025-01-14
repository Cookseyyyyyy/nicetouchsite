import React, { useEffect, useState } from 'react';
import './App.css';
import BlocksScene from './components/BlocksScene';
import AnimatedButton from './components/Animatedbutton';

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

          letter.style.transform = `translate(${moveX}px, ${moveY}px)`;
        } else {
          letter.style.transform = 'translate(0, 0)';
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
        <div className="buttons">
          <AnimatedButton
            defaultText={buttonTexts.youtube.default}
            hoverText={buttonTexts.youtube.hover}
            onClick={() => window.open('https://youtube.com/YOUR_CHANNEL', '_blank')}
          />
          <AnimatedButton
            defaultText={buttonTexts.discord.default}
            hoverText={buttonTexts.discord.hover}
            onClick={() => window.open('https://discord.gg/YOUR_SERVER', '_blank')}
          />
          <AnimatedButton
            defaultText={buttonTexts.gumroad.default}
            hoverText={buttonTexts.gumroad.hover}
            onClick={() => window.open('https://gumroad.com/YOUR_PAGE', '_blank')}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
