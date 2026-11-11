"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PLANES, buildPlaneMesh } from "@/game/planes";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function PlanePreview({ planeId, className }: { planeId: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x223344, 1.4));
    const d = new THREE.DirectionalLight(0xffffff, 2.5);
    d.position.set(10, 20, 10);
    scene.add(d);
    const spec = PLANES[planeId] ?? PLANES[0];
    const m = buildPlaneMesh(spec);
    scene.add(m);
    const size = Math.max(spec.len, spec.span);
    cam.position.set(size * 1.1, size * 0.5, size * 1.2);
    cam.lookAt(0, 0, 0);
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      const t = (performance.now() - t0) / 1000;
      m.rotation.y = t * 0.6;
      m.rotation.z = Math.sin(t * 1.2) * 0.15;
      m.position.y = Math.sin(t * 1.5) * 0.3;
      const p = m.getObjectByName("prop");
      if (p) p.rotation.z += 0.5;
      r.render(scene, cam);
    };
    loop();
    return () => { cancelAnimationFrame(raf); r.dispose(); };
  }, [planeId]);
  return <canvas ref={ref} className={className} />;
}
