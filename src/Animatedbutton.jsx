import React, { useRef, useState } from 'react';

export default function AnimatedButton({ defaultText, hoverText, onClick, ...props }) {
  const [text, setText] = useState(defaultText);
  const [width, setWidth] = useState('auto');
  const buttonRef = useRef(null);
  const measureRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const measureText = (textContent) => {
    if (!measureRef.current) return 0;
    measureRef.current.textContent = textContent;
    return measureRef.current.offsetWidth + 48; // Add padding (24px * 2)
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    const newWidth = measureText(hoverText);
    setText(hoverText);
    setWidth(`${newWidth}px`);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    const newWidth = measureText(defaultText);
    setText(defaultText);
    setWidth(`${newWidth}px`);
  };

  return (
    <>
      {/* Hidden measurement div */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          height: 0,
          width: 'auto',
          whiteSpace: 'nowrap',
          font: 'inherit',
          padding: 0,
        }}
      />
      <button
        ref={buttonRef}
        style={{
          width: width,
          transition: 'all 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        {...props}
      >
        {text}
      </button>
    </>
  );
}
