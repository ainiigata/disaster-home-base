// 災害・段階の語彙のみを定義する(データなし・ロジックなし)。

export const HAZARDS = [
  "earthquake",
  "tsunami",
  "typhoon",
  "heavyRain",
  "flood",
  "landslide",
  "heavySnow",
  "powerOutage",
  "waterOutage",
  "fire",
  "heatwave",
];

export const HAZARD_LABELS = {
  earthquake: "地震",
  tsunami: "津波",
  typhoon: "台風",
  heavyRain: "豪雨",
  flood: "洪水",
  landslide: "土砂災害",
  heavySnow: "大雪",
  powerOutage: "停電",
  waterOutage: "断水",
  fire: "火災",
  heatwave: "猛暑",
};

export const HAZARD_GLYPHS = {
  earthquake: "揺",
  tsunami: "波",
  typhoon: "風",
  heavyRain: "雨",
  flood: "洪",
  landslide: "崖",
  heavySnow: "雪",
  powerOutage: "暗",
  waterOutage: "水",
  fire: "火",
  heatwave: "暑",
};

export const PHASES = ["prepare", "alert", "now", "after", "recover"];

export const PHASE_LABELS = {
  prepare: "ふだんの備え",
  alert: "警報・直前",
  now: "発生時",
  after: "直後",
  recover: "生活再建",
};
