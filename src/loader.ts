import { useEffect, useState } from "react";

export interface BasicVector3 {
  x: number;
  y: number;
  z: number;
}
export interface BasicVector4 extends BasicVector3 {
  w: number;
}
export interface LidarImage {
  cx: number;
  cy: number;
  fx: number;
  fy: number;
  heading: BasicVector4;
  image_url: string;
  k1: number;
  k2: number;
  k3: number;
  p1: number;
  p2: number;
  position: BasicVector3;
  scale_factor: number;
  skew: number;
  timestamp: number;
}
export interface LidarPoint extends BasicVector3 {
  i: number;
}
export interface Frame {
  device_heading: BasicVector4;
  device_position: BasicVector3;
  images: LidarImage[];
  points: LidarPoint[];
  radar_points: LidarPoint[]; // pure guess
  timestamp: number;
}

export const useFrame = (sceneId: string, frameNo: string) => {
  const [frame, setFrame] = useState<Frame | null>(null);
  useEffect(() => {
    window
      .fetch(`https://www.nuscenes.org/frames/${sceneId}/${frameNo}.json`, {
        mode: "cors",
        credentials: "omit",
      })
      .then(async (resp) => [await resp.json(), resp])
      .then(([body, resp]) => {
        setFrame(body as Frame);
      });
  }, [frameNo, sceneId]);
  return frame;
};

export interface Cuboid {
  uuid: string;
  label: string; // traffic_cone
  position: BasicVector3;
  dimensions: BasicVector3;
  yaw: number;
  stationary: boolean;
  camera_used: null;
  attributes: {
    visibility: "81%-100%";
  };
}

interface AnnotationFrame {
  cuboids: Cuboid[];
}

export const useAnnotations = (sceneId: string) => {
  // https://www.nuscenes.org/frames/afd73f70ff7d46d6b772d341c08e31a5/annotation.json

  const [frame, setFrame] = useState<AnnotationFrame[]>([]);
  useEffect(() => {
    window
      .fetch(`https://www.nuscenes.org/frames/${sceneId}/annotation.json`, {
        mode: "cors",
        credentials: "omit",
      })
      .then(async (resp) => [await resp.json(), resp])
      .then(([body, resp]) => {
        setFrame(body as AnnotationFrame[]);
      });
  }, [sceneId]);
  return frame;
};
