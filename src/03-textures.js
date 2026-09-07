// ============================================================================
// TILE TEXTURES (procedural, smooth shapes, no pixel look)
// ============================================================================
const tex = {};
function makeTex(key, draw) {
  const c = document.createElement('canvas');
  c.width = TILE * 2; c.height = TILE * 2;
  const g = c.getContext('2d'); g.scale(2, 2); draw(g); tex[key] = c;
}
function buildTextures() {
  const rnd = mulberry32(777);
  for (let v = 0; v < 3; v++) {
    makeTex('grass' + v, g => {
      const grad = g.createLinearGradient(0, 0, TILE, TILE); grad.addColorStop(0, '#5aa33e'); grad.addColorStop(1, '#4c9134');
      g.fillStyle = grad; g.fillRect(0, 0, TILE, TILE); g.lineCap = 'round';
      for (let i = 0; i < 34; i++) { const x = rnd() * TILE, y = rnd() * TILE, h = 5 + rnd() * 6, bend = (rnd() - 0.5) * 6; g.strokeStyle = rnd() < 0.5 ? '#6fc24a' : '#3f7d2b'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + bend, y - h * 0.6, x + bend * 1.4, y - h); g.stroke(); }
      if (v === 2) for (let i = 0; i < 3; i++) { g.fillStyle = '#e8e26b'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 1.6, 0, 7); g.fill(); }
    });
    makeTex('dirt' + v, g => {
      const grad = g.createLinearGradient(0, 0, TILE, TILE); grad.addColorStop(0, '#9a7448'); grad.addColorStop(1, '#8a6740');
      g.fillStyle = grad; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 40; i++) { g.fillStyle = rnd() < 0.5 ? '#7a5a36' : '#a8875a'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 0.8 + rnd() * 1.4, 0, 7); g.fill(); }
      for (let i = 0; i < 3; i++) { g.fillStyle = '#6e5232'; g.beginPath(); g.ellipse(rnd() * TILE, rnd() * TILE, 3 + rnd() * 2, 2 + rnd(), rnd() * 3, 0, 7); g.fill(); }
    });
    makeTex('soil' + v, g => {
      g.fillStyle = '#5a3d26'; g.fillRect(0, 0, TILE, TILE);
      for (let r = 0; r < 4; r++) { g.fillStyle = r % 2 ? '#4a3220' : '#6a4a2e'; g.fillRect(0, r * 12, TILE, 6); }
      for (let i = 0; i < 20; i++) { g.fillStyle = '#3f2a18'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 0.8 + rnd(), 0, 7); g.fill(); }
    });
    makeTex('cave' + v, g => {
      g.fillStyle = '#5d5f66'; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 6; i++) { g.fillStyle = rnd() < 0.5 ? '#54565d' : '#66686f'; g.beginPath(); g.ellipse(rnd() * TILE, rnd() * TILE, 6 + rnd() * 8, 4 + rnd() * 5, rnd() * 3, 0, 7); g.fill(); }
      g.strokeStyle = '#46484e'; g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const x = rnd() * TILE, y = rnd() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18); g.lineTo(x + (rnd() - 0.5) * 24, y + (rnd() - 0.5) * 24); g.stroke(); }
    });
    makeTex('wall' + v, g => {
      g.fillStyle = '#2f3138'; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 5; i++) { const cx = rnd() * TILE, cy = rnd() * TILE, r = 9 + rnd() * 9; g.fillStyle = ['#3d3f47', '#45474f', '#383a41'][i % 3]; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.7 + rnd() * 0.4); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1.5; g.stroke(); }
    });
    makeTex('water' + v, g => {
      const grad = g.createLinearGradient(0, 0, TILE, TILE); grad.addColorStop(0, '#3d86c6'); grad.addColorStop(1, '#2f6faa');
      g.fillStyle = grad; g.fillRect(0, 0, TILE, TILE); g.strokeStyle = 'rgba(210,235,255,0.55)'; g.lineWidth = 1.5; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const x = rnd() * TILE, y = rnd() * TILE, w = 6 + rnd() * 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke(); }
    });
    makeTex('sand' + v, g => {
      g.fillStyle = '#d9c88a'; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 30; i++) { g.fillStyle = rnd() < 0.5 ? '#c9b676' : '#e6d79d'; g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 0.8 + rnd(), 0, 7); g.fill(); }
    });
    makeTex('plank' + v, g => {
      g.fillStyle = '#a5763f'; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#b5844a' : '#9c6d38'; g.fillRect(0, i * 12, TILE, 12); g.strokeStyle = '#6d4a24'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, i * 12 + 0.5); g.lineTo(TILE, i * 12 + 0.5); g.stroke(); g.strokeStyle = 'rgba(80,50,20,0.35)'; g.beginPath(); g.moveTo(3, i * 12 + 6); g.quadraticCurveTo(TILE / 2, i * 12 + 4 + rnd() * 4, TILE - 3, i * 12 + 6); g.stroke(); }
      g.fillStyle = '#4a3218'; for (const [x, y] of [[6, 6], [42, 6], [6, 42], [42, 42]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    });
    makeTex('floor' + v, g => {
      g.fillStyle = '#c9a56b'; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#d4b078' : '#bf9a60'; g.fillRect(0, i * 16, TILE, 16); g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, i * 16 + 0.5); g.lineTo(TILE, i * 16 + 0.5); g.stroke(); g.beginPath(); g.moveTo((i * 17 + v * 9) % TILE, i * 16); g.lineTo((i * 17 + v * 9) % TILE, i * 16 + 16); g.stroke(); }
    });
    makeTex('cobble' + v, g => {
      g.fillStyle = '#7d8088'; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 9; i++) { const cx = (i % 3) * 16 + 8 + (rnd() - 0.5) * 4, cy = Math.floor(i / 3) * 16 + 8 + (rnd() - 0.5) * 4; g.fillStyle = ['#8f929a', '#9a9da5', '#858890', '#a3a6ad'][Math.floor(rnd() * 4)]; g.beginPath(); g.ellipse(cx, cy, 7 + rnd() * 2, 5.5 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke(); }
    });
    makeTex('hwall' + v, g => {
      g.fillStyle = '#b9a98a'; g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 5, TILE); g.fillRect(TILE - 5, 0, 5, TILE); g.fillRect(0, 0, TILE, 4); g.fillRect(0, TILE - 4, TILE, 4);
      g.strokeStyle = 'rgba(90,58,30,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, 4); g.lineTo(TILE - 5, TILE - 4); g.stroke();
      for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(120,100,70,0.25)'; g.beginPath(); g.arc(6 + rnd() * 36, 5 + rnd() * 38, 1 + rnd(), 0, 7); g.fill(); }
    });
    makeTex('cwall' + v, g => {
      g.fillStyle = '#6e7178'; g.fillRect(0, 0, TILE, TILE);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const off = r % 2 ? 12 : 0; const x = c * 24 + off - 12, y = r * 16; g.fillStyle = ['#7c7f87', '#84878f', '#71747b'][(r + c + v) % 3]; g.fillRect(x + 1, y + 1, 22, 14); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(x + 1, y + 1, 22, 14); }
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, TILE, 2);
    });
  }
}
buildTextures();
const TEX_NAME = {};
{
  const map2 = { grass: [T.GRASS, T.TREE, T.OAK, T.STUMP, T.ROCK, T.IRON, T.COAL, T.RUBBLE, T.FENCE, T.GATE, T.GRAVE, T.STONECIRCLE, T.FLOWERS, T.MUSHROOM, T.LODESTONE, T.TRAP, T.WRECK, T.MECH], dirt: [T.DIRT, T.SIGN, T.FIRE, T.ASHES, T.DUMMY, T.CART, T.AXESTUMP, T.STALL],
    cave: [T.CAVE], wall: [T.WALL], water: [T.WATER], sand: [T.SAND], plank: [T.PLANK, T.DOOR, T.COFFINDOOR], cobble: [T.COBBLE, T.PORTCULLIS], soil: [T.SOIL, T.CROP],
    floor: [T.FLOOR, T.COUNTER, T.TABLE, T.BED, T.SHELF, T.ANVIL, T.FORGE, T.WORKBENCH, T.ALCHEMY, T.WORKSHOP, T.THRONE, T.CHEST, T.RUG, T.GOLDPILE, T.OVEN], hwall: [T.HWALL], cwall: [T.CWALL] };
  for (const k in map2) for (const t of map2[k]) TEX_NAME[t] = k;
}
// minimap colours
const MINI = {};
{
  const m = { '#4c9134': [T.GRASS, T.FLOWERS, T.MUSHROOM, T.TRAP], '#8a6740': [T.DIRT, T.SIGN, T.DUMMY, T.CART, T.AXESTUMP, T.ASHES], '#5d5f66': [T.CAVE], '#2f3138': [T.WALL], '#3d86c6': [T.WATER], '#2f6a2a': [T.TREE, T.OAK], '#6b4a2a': [T.STUMP], '#8d9098': [T.ROCK, T.RUBBLE, T.STONECIRCLE], '#7d6e62': [T.IRON], '#2f2f35': [T.COAL],
    '#a5763f': [T.PLANK, T.DOOR, T.COFFINDOOR], '#d9c88a': [T.SAND], '#8f929a': [T.COBBLE, T.PORTCULLIS], '#b9a98a': [T.HWALL], '#c9a56b': [T.FLOOR, T.COUNTER, T.TABLE, T.BED, T.SHELF, T.ANVIL, T.FORGE, T.WORKBENCH, T.ALCHEMY, T.WORKSHOP, T.THRONE, T.CHEST, T.RUG, T.GOLDPILE, T.OVEN], '#6e7178': [T.CWALL], '#8a6a3a': [T.FENCE, T.GATE, T.STALL], '#ff8a1a': [T.FIRE], '#5a5d64': [T.GRAVE], '#5a3d26': [T.SOIL, T.CROP], '#7ec8ff': [T.LODESTONE], '#6b6b7a': [T.WRECK, T.MECH] };
  for (const c in m) for (const t of m[c]) MINI[t] = c;
}
