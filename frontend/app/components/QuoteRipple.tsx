"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

type QuoteRippleTrigger = {
  id: number;
  x: number;
  y: number;
} | null;

export default function QuoteRipple({ trigger }: { trigger: QuoteRippleTrigger }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], zoom: 1 }}
      dpr={1}
      frameloop="demand"
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor("#000000", 0)}
    >
      <Ripple trigger={trigger} />
    </Canvas>
  );
}

function Ripple({ trigger }: { trigger: QuoteRippleTrigger }) {
  const ring = useRef<THREE.Mesh>(null);
  const progress = useRef(1);
  const { invalidate, viewport } = useThree();
  const endRadius = Math.min(viewport.width, viewport.height) * 0.44;

  useEffect(() => {
    if (!trigger || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (ring.current) ring.current.visible = false;
      return;
    }

    if (!ring.current) return;
    ring.current.position.set(
      (trigger.x - 0.5) * viewport.width,
      (0.5 - trigger.y) * viewport.height,
      0,
    );
    ring.current.visible = true;
    progress.current = 0;
    invalidate();
  }, [invalidate, trigger, viewport.height, viewport.width]);

  useFrame((_, delta) => {
    if (!ring.current || progress.current >= 1) return;

    progress.current = Math.min(progress.current + delta / 0.8, 1);
    const eased = 1 - (1 - progress.current) ** 3;
    ring.current.scale.setScalar(3 + eased * (endRadius - 3));
    (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - eased) * 0.9;
    if (progress.current === 1) ring.current.visible = false;
    else invalidate();
  });

  return (
    <mesh ref={ring} visible={false}>
      <torusGeometry args={[1, 0.025, 8, 96]} />
      <meshBasicMaterial color="#dfc28b" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
