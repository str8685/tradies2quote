"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const BAR_COUNT = 32;
const BAR_WIDTH = 0.12;
const BAR_GAP = 0.18;
const TOTAL_W = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

function Bars() {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        pointer.current.x * 0.18,
        0.05,
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -pointer.current.y * 0.08,
        0.05,
      );
    }
    meshRefs.current.forEach((m, i) => {
      if (!m) return;
      const phase = i * 0.32;
      const k = Math.sin(t * 2.4 + phase) * 0.5 + 0.5;
      const k2 = Math.sin(t * 1.1 + phase * 1.7) * 0.5 + 0.5;
      const height = 0.4 + k * 2.2 + k2 * 0.6;
      m.scale.y = height;
      m.position.y = height / 2;
      const mat = m.material as THREE.MeshBasicMaterial;
      const mix = 0.4 + k * 0.6;
      mat.color.setRGB(1.0, 0.37 * mix + 0.15, 0.08 * mix);
    });
  });

  return (
    <group ref={groupRef} position={[0, -0.6, 0]}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const x = -TOTAL_W / 2 + i * (BAR_WIDTH + BAR_GAP);
        return (
          <mesh
            key={i}
            ref={(el) => {
              meshRefs.current[i] = el;
            }}
            position={[x, 0, 0]}
          >
            <boxGeometry args={[BAR_WIDTH, 1, BAR_WIDTH]} />
            <meshBasicMaterial transparent opacity={0.85} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

export function VoiceWaveform3D() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Wrap mount + initial reduced-motion read in a 0-ms timer so the
    // setStates sit inside a subscribed callback. React 19's
    // `react-hooks/set-state-in-effect` rule rejects synchronous
    // setState in the effect body.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(mq.matches);
    const t = setTimeout(() => {
      setMounted(true);
      setReducedMotion(mq.matches);
    }, 0);
    mq.addEventListener("change", handler);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", handler);
    };
  }, []);

  if (!mounted || reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="hero-voice-waveform"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] z-0 hidden md:block"
      style={{
        maskImage:
          "linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage:
          "linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0) 100%)",
        opacity: 0.55,
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        camera={{ position: [0, 1.4, 6.2], fov: 35 }}
        dpr={[1, 1.5]}
      >
        <Bars />
      </Canvas>
    </div>
  );
}
