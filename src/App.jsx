import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './App.css';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

function App() {
  const mountRef = useRef(null);

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
    const MIN_SPAWN_DISTANCE = 2; // Adjust as needed

    // Maximum attempts to find a valid spawn position
    const MAX_SPAWN_ATTEMPTS = 10;

    // Helper function to check if the spawn position is valid
    const isPositionValid = (position, boxes, minDistance) => {
      for (let box of boxes) {
        const distance = new THREE.Vector3(...position).distanceTo(box.mesh.position);
        if (distance < minDistance + box.mesh.geometry.parameters.width / 2) {
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
          color: 0x808080,
          metalness: 0.5,
          roughness: 0.5,
          emissive: 0x000000,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(...position);
        this.level = level;
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

      // Method to set emissive color temporarily
      flashColor(colorHex, duration = 200) {
        this.mesh.material.emissive.setHex(colorHex);
        setTimeout(() => {
          this.mesh.material.emissive.setHex(0x000000);
        }, duration);
      }
    }

    // Initialize boxes with larger size
    const boxes = [
      new Box(3, [0, 0, 0], 0) // Increased initial size to 3
    ];

    // Click handler
    const handleClick = (event) => {
      // Calculate mouse position in normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(boxes.map(box => box.mesh));

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const clickedBox = clickedMesh.userData;

        if (clickedBox.level < 4) { // Increased levels (0-4)
          // Flash yellow
          clickedBox.flashColor(0xFFFF00);

          const spawnCount = Math.floor(Math.random() * 4) + 3; // 3 to 6
          const newSize = clickedBox.mesh.geometry.parameters.width * 0.65; // Increased spawn size
          const offset = newSize * 1.5;
          const newLevel = clickedBox.level + 1;

          // Generate random directions for spawning
          for (let i = 0; i < spawnCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const direction = new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.sin(phi) * Math.sin(theta),
              Math.cos(phi)
            ).normalize();

            const spawnDistance = offset + Math.random() * offset;
            let newPos = clickedBox.mesh.position.clone().add(
              direction.clone().multiplyScalar(spawnDistance)
            );

            // Check for proximity and adjust if necessary
            let attempts = 0;
            while (!isPositionValid([newPos.x, newPos.y, newPos.z], boxes, MIN_SPAWN_DISTANCE) && attempts < MAX_SPAWN_ATTEMPTS) {
              // Slightly adjust the position
              newPos = clickedBox.mesh.position.clone().add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * 2,
                  (Math.random() - 0.5) * 2,
                  (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(spawnDistance)
              );
              attempts++;
            }

            // If a valid position is found, spawn the cube
            if (isPositionValid([newPos.x, newPos.y, newPos.z], boxes, MIN_SPAWN_DISTANCE)) {
              // Randomize spawn velocity with speed limit
              const initialSpeed = 0.05 + Math.random() * 0.15; // Adjusted speed range
              const initialVelocity = direction.clone().multiplyScalar(initialSpeed);
              const newBox = new Box(newSize, [newPos.x, newPos.y, newPos.z], newLevel, initialVelocity);
              newBox.flashColor(0xFFFF00);
              boxes.push(newBox);
            } else {
              console.warn('Could not find a valid spawn position after maximum attempts.');
            }
          }

          // Remove the clicked box
          scene.remove(clickedBox.mesh);
          const index = boxes.indexOf(clickedBox);
          if (index > -1) {
            boxes.splice(index, 1);
          }
        }
      }
    };

    // Add event listener to renderer's DOM element
    renderer.domElement.addEventListener('click', handleClick);

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
            const relativeVelocity = boxA.velocity.clone().sub(boxB.velocity);
            const speed = relativeVelocity.dot(normal);

            if (speed < 0) continue; // Prevent double collision

            const impulse = normal.clone().multiplyScalar(speed * 1.05); // Slightly increase speed to avoid sticking

            boxA.velocity = boxA.limitVelocity(boxA.velocity.sub(impulse));
            boxB.velocity = boxB.limitVelocity(boxB.velocity.add(impulse));
          }
        }
      }

      // Handle edge collisions
      boxes.forEach(box => {
        ['x', 'y', 'z'].forEach((axis) => {
          const halfSize = box.mesh.geometry.parameters.width / 2;
          if (box.mesh.position[axis] + halfSize > BOUNDARY) {
            box.mesh.position[axis] = BOUNDARY - halfSize;
            box.velocity[axis] *= -1;
            box.velocity = box.limitVelocity(box.velocity);
          }
          if (box.mesh.position[axis] - halfSize < -BOUNDARY) {
            box.mesh.position[axis] = -BOUNDARY + halfSize;
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
      renderer.domElement.removeEventListener('click', handleClick);
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

        if (distance < 100) { // Repulsion radius
          const angle = Math.atan2(distanceY, distanceX);
          const force = (100 - distance) / 5;
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
          {'NICE TOUCH'.split('').map((char, i) => (
            <span key={i} className="letter">
              {char}
            </span>
          ))}
        </h1>
        <div className="buttons">
          <button onClick={() => window.open('https://youtube.com/YOUR_CHANNEL', '_blank')}>Youtube</button>
          <button onClick={() => window.open('https://discord.gg/YOUR_SERVER', '_blank')}>Discord</button>
          <button onClick={() => window.open('https://gumroad.com/YOUR_PAGE', '_blank')}>Gumroad</button>
        </div>
      </div>
    </div>
  );
}

export default App;
