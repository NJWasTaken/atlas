"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const STAR_COUNT = 190;
const MAX_LINKS = 420;

function makeStars() {
  let seed = 78231;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const phases = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    positions[i * 3] = (random() - 0.5) * 21;
    positions[i * 3 + 1] = (random() - 0.5) * 12;
    positions[i * 3 + 2] = (random() - 0.5) * 8;

    const warm = random() > 0.72;
    const color = warm ? new THREE.Color("#d8bd87") : new THREE.Color("#d9e3ed");
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    phases[i] = random() * Math.PI * 2;
  }

  return { positions, colors, phases };
}

function StarMap({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);
  const links = useRef<THREE.LineSegments>(null);
  const pointer = useRef(new THREE.Vector2(0, 0));
  const stars = useMemo(makeStars, []);

  const pointGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(stars.positions.slice(), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(stars.colors, 3));
    return geometry;
  }, [stars]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3),
    );
    return geometry;
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state) => {
    if (!group.current || !points.current || !links.current) return;

    const time = reducedMotion ? 0 : state.clock.elapsedTime;
    const positions = pointGeometry.getAttribute("position") as THREE.BufferAttribute;
    const current = positions.array as Float32Array;

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const offset = i * 3;
      const phase = stars.phases[i];
      current[offset] = stars.positions[offset] + Math.sin(time * 0.12 + phase) * 0.055;
      current[offset + 1] =
        stars.positions[offset + 1] + Math.cos(time * 0.1 + phase) * 0.045;
      current[offset + 2] = stars.positions[offset + 2];
    }
    positions.needsUpdate = true;

    const lineAttribute = lineGeometry.getAttribute("position") as THREE.BufferAttribute;
    const linePositions = lineAttribute.array as Float32Array;
    let linkCount = 0;
    const mouseX = pointer.current.x * 8;
    const mouseY = pointer.current.y * 4.6;

    for (let i = 0; i < STAR_COUNT && linkCount < MAX_LINKS; i += 1) {
      const ax = current[i * 3];
      const ay = current[i * 3 + 1];
      const az = current[i * 3 + 2];
      const mouseDistance = Math.hypot(ax - mouseX, ay - mouseY);

      for (let j = i + 1; j < STAR_COUNT && linkCount < MAX_LINKS; j += 1) {
        const bx = current[j * 3];
        const by = current[j * 3 + 1];
        const bz = current[j * 3 + 2];
        const distance = Math.hypot(ax - bx, ay - by, (az - bz) * 0.65);

        // A few more links gently appear around the pointer.
        const threshold = mouseDistance < 3.2 ? 2.05 : 1.55;
        if (distance < threshold) {
          const start = linkCount * 6;
          linePositions[start] = ax;
          linePositions[start + 1] = ay;
          linePositions[start + 2] = az;
          linePositions[start + 3] = bx;
          linePositions[start + 4] = by;
          linePositions[start + 5] = bz;
          linkCount += 1;
        }
      }
    }

    lineAttribute.needsUpdate = true;
    lineGeometry.setDrawRange(0, linkCount * 2);

    if (!reducedMotion) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        pointer.current.x * 0.045,
        0.025,
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        -pointer.current.y * 0.025,
        0.025,
      );
      group.current.rotation.z = Math.sin(time * 0.035) * 0.012;
    }
  });

  return (
    <group ref={group}>
      <points ref={points} geometry={pointGeometry}>
        <pointsMaterial
          size={0.052}
          vertexColors
          transparent
          opacity={0.78}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <lineSegments ref={links} geometry={lineGeometry}>
        <lineBasicMaterial color="#c8aa72" transparent opacity={0.22} depthWrite={false} />
      </lineSegments>
      <ShootingStar reducedMotion={reducedMotion} />
    </group>
  );
}

function ShootingStar({ reducedMotion }: { reducedMotion: boolean }) {
  const streak = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!streak.current || reducedMotion) return;
    const cycle = (clock.elapsedTime % 19) / 19;
    const active = cycle > 0.72 && cycle < 0.79;
    streak.current.visible = active;
    if (active) {
      const progress = (cycle - 0.72) / 0.07;
      streak.current.position.set(-10 + progress * 19, 5.2 - progress * 5.5, -1.5);
      streak.current.rotation.z = -0.28;
    }
  });

  return (
    <group ref={streak} visible={false}>
      <mesh>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#f5e6c8" />
      </mesh>
      <mesh position={[-0.28, 0.08, 0]}>
        <boxGeometry args={[0.72, 0.012, 0.008]} />
        <meshBasicMaterial color="#c8aa72" transparent opacity={0.58} />
      </mesh>
    </group>
  );
}

export default function CelestialBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return (
    <div className="atlas-celestial-background" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 52 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
        }}
      >
        <StarMap reducedMotion={reducedMotion} />
      </Canvas>
      <div className="atlas-celestial-vignette" />
    </div>
  );
}
