import { Points, Quaternion, Vector3 } from "three";
import { LidarImage } from "./loader";

export interface Frame {
  device_heading: Quaternion;
  device_position: Vector3;
  images: LidarImage[];
  points: Points;
  radar_points: unknown;
  timestamp: number;
}
