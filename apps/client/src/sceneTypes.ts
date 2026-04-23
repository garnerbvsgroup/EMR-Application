export type CameraRigState = {
  yaw: number;
  pitch: number;
  locked: boolean;
};

export type SceneProfile = {
  label: string;
  background: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sunPosition: [number, number, number];
  sunIntensity: number;
  sunColor: string;
  fillColor: string;
  fillIntensity: number;
  ambientIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  skyTurbidity: number;
  skyRayleigh: number;
  skyMieCoefficient: number;
  skyMieDirectionalG: number;
  wetness: number;
  cloudDensity: number;
  waterColor: string;
  waterHighlight: string;
  grassColor: string;
};