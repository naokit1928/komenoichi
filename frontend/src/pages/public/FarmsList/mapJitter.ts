// mapJitter.ts
function seededRandom01(seed: number) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 100000) / 100000;
}

function metersToLatLngDelta(lat: number, dxMeters: number, dyMeters: number) {
  const oneDegLatMeters = 111_320;
  const oneDegLngMeters = 111_320 * Math.cos((lat * Math.PI) / 180);
  const dLat = dyMeters / oneDegLatMeters;
  const dLng = dxMeters / oneDegLngMeters;
  return { dLat, dLng };
}

export function jitterLatLng(lat: number, lng: number, id: number) {
  const r = 20 + seededRandom01(id * 97 + 13) * 10;
  const ang = seededRandom01(id * 131 + 7) * Math.PI * 2;
  const dx = Math.cos(ang) * r;
  const dy = Math.sin(ang) * r;
  const { dLat, dLng } = metersToLatLngDelta(lat, dx, dy);
  return { lat: lat + dLat, lng: lng + dLng };
}
