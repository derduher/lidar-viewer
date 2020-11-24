import React, { RefObject, useEffect, useRef } from "react";
import * as THREE from "three";
import { Color } from "three";
// import "./styles.css";
import { points as lidarpts } from "./points";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const usePointCloud = (ref: RefObject<HTMLDivElement>) =>
  useEffect(() => {
    const pos = {
      x: 1009.3588517405979,
      y: 615.0332854295309,
      z: 1.8537769669114899,
    };
    let container: HTMLElement;

    let camera: THREE.PerspectiveCamera,
      scene: THREE.Scene,
      renderer: THREE.WebGLRenderer,
      controls: OrbitControls;

    let points: THREE.Object3D;

    if (ref.current) {
      init(ref);
      animate();
    }

    function init(ref: RefObject<HTMLDivElement>) {
      if (!ref.current) return;
      container = ref.current;

      //

      camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.5,
        3500
      );
      camera.position.z = 5;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0);
      // scene.fog = new THREE.Fog(0x050505, 2000, 3500);

      //

      const particles = 500000;

      const geometry = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];

      // const color = new THREE.Color();

      const n = 1000,
        n2 = n / 2; // particles spread in the cube

      let maxHSL = 0;
      let minHSL = 255;
      for (let i = 0; i < lidarpts.length; i++) {
        const { x, y, z, i: intensity } = lidarpts[i];
        positions.push(x - pos.x, y - pos.y, z - pos.z);
        if (intensity > maxHSL) {
          maxHSL = intensity;
        }
        if (intensity < minHSL) {
          minHSL = intensity;
        }
        // color.setRGB(1, 1, 1);
        const color = new Color(
          `hsl(200, 100%, ${((100 * intensity) / 255) | 0}%)`
        );
        // color.setHSL(1, 1, intensity / 255);

        colors.push(color.r, color.g, color.b);
      }
      console.log(maxHSL, minHSL);

      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3)
      );

      geometry.computeBoundingSphere();

      //

      const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
      });

      points = new THREE.Points(geometry, material);

      points.rotation.x = -Math.PI / 2;
      scene.add(points);

      //

      renderer = new THREE.WebGLRenderer();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);

      container.appendChild(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);

      //controls.update() must be called after any manual changes to the camera's transform
      // camera.position.set(

      // );
      // controls.update();

      //

      //

      window.addEventListener("resize", onWindowResize, false);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    //

    function animate() {
      requestAnimationFrame(animate);
      controls.update();

      render();
    }

    function render() {
      renderer.render(scene, camera);
    }
  }, [ref]);
export default function App() {
  const viewPort = useRef<HTMLDivElement>(null);
  // useSmiley();
  // useBasic();
  usePointCloud(viewPort);
  return (
    <div className="App">
      <div ref={viewPort} id="hi" />
    </div>
  );
}
