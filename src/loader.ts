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
  }, [frameNo]);
  return frame;
};
