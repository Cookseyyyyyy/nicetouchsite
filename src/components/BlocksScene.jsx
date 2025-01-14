import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

const MAX_LEVEL = 6;
const BOUNDARY = 20;
const CONNECTION_RADIUS = 5;
const LINE_COLOR = 0xffffff;
const MIN_VELOCITY = 0.005;
const MAX_VELOCITY = 0.2;
const MIN_SPAWN_DISTANCE = 1.5;
const MAX_SPAWN_ATTEMPTS = 20;

// Create a single reusable geometry and material outside the component
const lineMaterial = new THREE.LineBasicMaterial({ 
  color: LINE_COLOR,
  transparent: true,
  opacity: 0.3
});

export default function BlocksScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
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
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    mountRef.current.appendChild(renderer.domElement);

    // Add HDRI environment
    const rgbeLoader = new RGBELoader();
    rgbeLoader.setPath('/');
    rgbeLoader.load('studio_small_09_1k.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = new THREE.Color(0x000000);
    });

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(ambientLight, directionalLight);

    // Raycaster and mouse vector
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Helper function to check if the spawn position is valid
    const isPositionValid = (position, boxes, minDistance) => {
      const pos = new THREE.Vector3(...position);
      if (Math.abs(pos.x) > BOUNDARY || Math.abs(pos.y) > BOUNDARY || Math.abs(pos.z) > BOUNDARY * 0.2) {
        return false;
      }

      for (let box of boxes) {
        const distance = pos.distanceTo(box.mesh.position);
        if (distance < minDistance + box.mesh.geometry.parameters.width * 0.4) {
          return false;
        }
      }
      return true;
    };

    // Box class
    class Box {
      constructor(size, position, level = 0, velocity = null) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
          color: 0x202020,
          metalness: 0.5,
          roughness: 0.5,
          emissive: 0x000000,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(...position);
        this.level = level;
        this.mesh.userData = this;
        scene.add(this.mesh);

        const axes = ['x', 'y', 'z'];
        this.rotationAxis = axes[Math.floor(Math.random() * axes.length)];
        this.rotationSpeed = Math.random() * 0.005 + 0.001;

        if (velocity) {
          this.velocity = this.limitVelocity(velocity);
        } else {
          this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
          );
          this.velocity = this.limitVelocity(this.velocity);
        }
      }

      limitVelocity(velocity) {
        const speed = velocity.length();
        if (speed > MAX_VELOCITY) {
          return velocity.normalize().multiplyScalar(MAX_VELOCITY);
        }
        return velocity;
      }

      update() {
        this.mesh.position.add(this.velocity);
        const dampingFactor = 0.98;
        this.velocity.multiplyScalar(dampingFactor);
        this.velocity = this.limitVelocity(this.velocity);

        ['x', 'y', 'z'].forEach((axis) => {
          if (Math.abs(this.velocity[axis]) < MIN_VELOCITY) {
            this.velocity[axis] = this.velocity[axis] < 0 ? -MIN_VELOCITY : MIN_VELOCITY;
          }
        });

        this.mesh.rotation[this.rotationAxis] += this.rotationSpeed;
      }

      flashColor(colorHex, duration = 500) {
        this.mesh.material.emissive.setHex(colorHex);
        const startTime = Date.now();
        
        const fade = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
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

    // Initialize boxes
    const boxes = [
      new Box(5, [-6, 0, 0], 0),
      new Box(5, [6, 0, 0], 0),
      new Box(5, [0, 6, 0], 0)
    ];

    // Mouse interaction handler
    const handleMouseOver = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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
            // ... spawn logic (same as before)
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const direction = new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.sin(phi) * Math.sin(theta),
              Math.cos(phi)
            ).normalize();

            const spawnDistance = offset + Math.random() * offset * 0.5;
            let newPos = hoveredBox.mesh.position.clone().add(
              direction.clone().multiplyScalar(spawnDistance)
            );

            let attempts = 0;
            while (!isPositionValid([newPos.x, newPos.y, newPos.z], boxes, MIN_SPAWN_DISTANCE) && attempts < MAX_SPAWN_ATTEMPTS) {
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
              const initialSpeed = 0.03 + Math.random() * 0.1;
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
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseOver);

    // Create a dynamic line mesh
    const positions = new Float32Array(1000 * 2 * 3); // Start with space for 1000 lines
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    // Function to update connections
    const updateConnections = (boxes) => {
      let lineCount = 0;
      let positions = lineMesh.geometry.attributes.position.array;

      // Resize buffer if needed
      const neededSize = boxes.length * boxes.length * 3 * 2;
      if (positions.length < neededSize) {
        positions = new Float32Array(neededSize);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      }

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const boxA = boxes[i];
          const boxB = boxes[j];

          const distance = boxA.mesh.position.distanceTo(boxB.mesh.position);

          if (distance <= CONNECTION_RADIUS) {
            const index = lineCount * 6;
            
            positions[index] = boxA.mesh.position.x;
            positions[index + 1] = boxA.mesh.position.y;
            positions[index + 2] = boxA.mesh.position.z;
            
            positions[index + 3] = boxB.mesh.position.x;
            positions[index + 4] = boxB.mesh.position.y;
            positions[index + 5] = boxB.mesh.position.z;

            lineCount++;
          }
        }
      }

      // Update the geometry to only show active lines
      lineGeometry.setDrawRange(0, lineCount * 2);
      lineMesh.geometry.attributes.position.needsUpdate = true;
    };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      boxes.forEach(box => box.update());

      // Update connection lines
      updateConnections(boxes);

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

            const correction = normal.clone().multiplyScalar(overlap / 2);
            boxA.mesh.position.add(correction);
            boxB.mesh.position.sub(correction);

            const relativeVelocity = boxA.velocity.clone().sub(boxB.velocity);
            const speed = relativeVelocity.dot(normal);

            if (speed < 0) {
              const impulse = normal.clone().multiplyScalar(-speed * 1.05);
              boxA.velocity.add(impulse);
              boxB.velocity.sub(impulse);

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

    return () => {
      renderer.domElement.removeEventListener('mousemove', handleMouseOver);
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      scene.remove(lineMesh);
      lineGeometry.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
} 
