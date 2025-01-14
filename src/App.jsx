import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';
import AnimatedButton from './AnimatedButton';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

const MAX_LEVEL = 6; // Adjust as needed

function App() {
  const mountRef = useRef(null);
  const [buttonTexts] = useState({
    youtube: { default: 'Youtube', hover: 'See what we do and how we do it.' },
    discord: { default: 'Discord', hover: 'Join the community and chat with us!' },
    gumroad: { default: 'Gumroad', hover: 'Free plugins, assets and more.' }
  });

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 15;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1); // Black background
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    mountRef.current.appendChild(renderer.domElement);

    // Add HDRI environment
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setPath('/'); // Ensure the HDRI file is in the public folder
    rgbeLoader.load('studio_small_09_1k.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = new THREE.Color(0x000000); // Keep background black
    });

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(ambientLight, directionalLight);

    // Raycaster and mouse vector
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Define scene boundaries
    const BOUNDARY = 20;

    // Velocity constraints
    const MIN_VELOCITY = 0.005;
    const MAX_VELOCITY = 0.2; // Maximum speed limit

    // Minimum spawn distance from existing cubes
    const MIN_SPAWN_DISTANCE = 1.5; // Reduced from 2
    const MAX_SPAWN_ATTEMPTS = 20; // Increased from 10

    // Helper function to check if the spawn position is valid - made less restrictive
    const isPositionValid = (position, boxes, minDistance) => {
      // Check if position is within boundaries first
      const pos = new THREE.Vector3(...position);
      if (Math.abs(pos.x) > BOUNDARY || Math.abs(pos.y) > BOUNDARY || Math.abs(pos.z) > BOUNDARY * 0.2) {
        return false;
      }

      // Check distance from other boxes with more tolerance
      for (let box of boxes) {
        const distance = pos.distanceTo(box.mesh.position);
        // Reduce the required distance by using a smaller multiplier
        if (distance < minDistance + box.mesh.geometry.parameters.width * 0.4) { // Reduced from 0.5
          return false;
        }
      }
      return true;
    };

    // Box class to manage properties
    class Box {
      constructor(size, position, level = 0, velocity = null) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
          color: 0x404040,
          metalness: 0.5,
          roughness: 0.5,
          emissive: 0x000000,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(...position);
        this.level = level; // Remove the capping of level
        this.mesh.userData = this;
        scene.add(this.mesh);

        // Assign random rotation axis and slower rotation speed
        const axes = ['x', 'y', 'z'];
        this.rotationAxis = axes[Math.floor(Math.random() * axes.length)];
        this.rotationSpeed = Math.random() * 0.005 + 0.001; // Slower rotation

        // Assign velocity with speed limit
        if (velocity) {
          this.velocity = this.limitVelocity(velocity);
        } else {
          // Random initial velocity
          this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
          );
          this.velocity = this.limitVelocity(this.velocity);
        }
      }

      // Method to limit velocity
      limitVelocity(velocity) {
        const speed = velocity.length();
        if (speed > MAX_VELOCITY) {
          return velocity.normalize().multiplyScalar(MAX_VELOCITY);
        }
        return velocity;
      }

      update() {
        // Move the cube
        this.mesh.position.add(this.velocity);

        // Apply damping to the velocity
        const dampingFactor = 0.98; // Adjust the damping factor as needed (0 < dampingFactor < 1)
        this.velocity.multiplyScalar(dampingFactor);

        // Ensure minimum velocity and limit maximum velocity
        this.velocity = this.limitVelocity(this.velocity);

        ['x', 'y', 'z'].forEach((axis) => {
          if (Math.abs(this.velocity[axis]) < MIN_VELOCITY) {
            this.velocity[axis] = this.velocity[axis] < 0 ? -MIN_VELOCITY : MIN_VELOCITY;
          }
        });

        // Rotate the cube
        this.mesh.rotation[this.rotationAxis] += this.rotationSpeed;
      }

      // Method to set emissive color temporarily with smooth fade
      flashColor(colorHex, duration = 500) {
        // Set initial color instantly
        this.mesh.material.emissive.setHex(colorHex);
        
        // Start time for animation
        const startTime = Date.now();
        
        // Animate the fade
        const fade = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Interpolate color from yellow to black
          const currentColor = new THREE.Color(colorHex);
          currentColor.multiplyScalar(1 - progress);
          this.mesh.material.emissive.copy(currentColor);
          
          if (progress < 1) {
            requestAnimationFrame(fade);
          }
        };
        
        requestAnimationFrame(fade);
      }
    }

    // Initialize boxes with larger size
    const boxes = [
      new Box(5, [-6, 0, 0], 0),  // Left box
      new Box(5, [6, 0, 0], 0),   // Right box
      new Box(5, [0, 6, 0], 0)    // Top box
    ];

    // Rename handleClick to handleMouseOver, and call it on mouse move
    const handleMouseOver = (event) => {
      // Convert mouse positions to [-1, 1] range
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Cast ray
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(boxes.map(box => box.mesh));

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object;
        const hoveredBox = hoveredMesh.userData;

        hoveredBox.flashColor(0xFFFF00);

        if (hoveredBox.level < MAX_LEVEL) {
          const spawnCount = Math.floor(Math.random() * 3) + 2;
          const newSize = hoveredBox.mesh.geometry.parameters.width * 0.7;
          const offset = newSize * 1.2;
          const newLevel = hoveredBox.level + 1;

          let successfulSpawns = 0;

          for (let i = 0; i < spawnCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const direction = new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.sin(phi) * Math.sin(theta),
              Math.cos(phi)
            ).normalize();

            const spawnDistance = offset + Math.random() * offset * 0.5; // Reduced random variation
            let newPos = hoveredBox.mesh.position.clone().add(
              direction.clone().multiplyScalar(spawnDistance)
            );

            // More systematic position adjustment when initial position is invalid
            let attempts = 0;
            while (!isPositionValid([newPos.x, newPos.y, newPos.z], boxes, MIN_SPAWN_DISTANCE) && attempts < MAX_SPAWN_ATTEMPTS) {
              // Try different distances and angles systematically
              const adjustedDistance = spawnDistance * (1 + (attempts * 0.1));
              const adjustedTheta = theta + (attempts * Math.PI / 8);
              const adjustedPhi = phi + (attempts * Math.PI / 8);
              
              newPos = hoveredBox.mesh.position.clone().add(
                new THREE.Vector3(
                  Math.sin(adjustedPhi) * Math.cos(adjustedTheta),
                  Math.sin(adjustedPhi) * Math.sin(adjustedTheta),
                  Math.cos(adjustedPhi)
                ).normalize().multiplyScalar(adjustedDistance)
              );
              attempts++;
            }

            if (isPositionValid([newPos.x, newPos.y, newPos.z], boxes, MIN_SPAWN_DISTANCE)) {
              const initialSpeed = 0.03 + Math.random() * 0.1; // Reduced initial velocity
              const initialVelocity = direction.clone().multiplyScalar(initialSpeed);
              const newBox = new Box(newSize, [newPos.x, newPos.y, newPos.z], newLevel, initialVelocity);
              newBox.flashColor(0xFFFF00);
              boxes.push(newBox);
              successfulSpawns++;
            }
          }

          if (successfulSpawns > 0) {
            scene.remove(hoveredBox.mesh);
            const index = boxes.indexOf(hoveredBox);
            if (index > -1) {
              boxes.splice(index, 1);
            }
          }
        } else {
          console.log('Max level reached, box will not be removed.');
        }
      }
    };

    // Attach mouse move event instead of click
    renderer.domElement.addEventListener('mousemove', handleMouseOver);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Update all boxes
      boxes.forEach(box => box.update());

      // Handle collisions between cubes
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const boxA = boxes[i];
          const boxB = boxes[j];

          const distance = boxA.mesh.position.distanceTo(boxB.mesh.position);
          const minDistance = (boxA.mesh.geometry.parameters.width + boxB.mesh.geometry.parameters.width) / 2;

          if (distance < minDistance) {
            const normal = boxA.mesh.position.clone().sub(boxB.mesh.position).normalize();
            const overlap = minDistance - distance;

            // Separate the boxes to prevent sticking
            const correction = normal.clone().multiplyScalar(overlap / 2);
            boxA.mesh.position.add(correction);
            boxB.mesh.position.sub(correction);

            const relativeVelocity = boxA.velocity.clone().sub(boxB.velocity);
            const speed = relativeVelocity.dot(normal);

            if (speed < 0) { // Only proceed if boxes are moving towards each other
              const impulse = normal.clone().multiplyScalar(-speed * 1.05); // Slightly increase speed to avoid sticking
              boxA.velocity.add(impulse);
              boxB.velocity.sub(impulse);

              // Limit velocities after collision
              boxA.velocity = boxA.limitVelocity(boxA.velocity);
              boxB.velocity = boxB.limitVelocity(boxB.velocity);
            }
          }
        }
      }

      // Handle edge collisions
      boxes.forEach(box => {
        ['x', 'y', 'z'].forEach((axis) => {
          const halfSize = box.mesh.geometry.parameters.width / 2;
          const boundaryForAxis = axis === 'z' ? BOUNDARY * 0.2 : BOUNDARY;
          if (box.mesh.position[axis] + halfSize > boundaryForAxis) {
            box.mesh.position[axis] = boundaryForAxis - halfSize;
            box.velocity[axis] *= -1;
            box.velocity = box.limitVelocity(box.velocity);
          }
          if (box.mesh.position[axis] - halfSize < -boundaryForAxis) {
            box.mesh.position[axis] = -boundaryForAxis + halfSize;
            box.velocity[axis] *= -1;
            box.velocity = box.limitVelocity(box.velocity);
          }
        });
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      renderer.domElement.removeEventListener('mousemove', handleMouseOver);
      window.removeEventListener('resize', handleResize);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

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

        if (distance < 300) { // Increased repulsion radius
          const angle = Math.atan2(distanceY, distanceX);
          const force = (200 - distance) / 3; // Increased force factor
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
    <div id="mount" ref={mountRef}>
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
