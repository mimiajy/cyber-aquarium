// Explicit publication boundary: live aquarium only, no QA images or credentials.
export const reefDirectory = 'prototypes/fantasy-reef';
export const artAssets = ['fish','tetra','angelfish','jellyfish','coral','depth'];
export const runtimeFiles = [
  'index.html', `${reefDirectory}/index.html`, 'assets/favicon.svg', 'js/core.js', 'js/creatures.js',
  ...['style.css','warp.js','fish-school.js','scene.js','timing.js','performance.js','audio.js','app.js'].map(file => `${reefDirectory}/${file}`),
  ...artAssets.map(name => `${reefDirectory}/assets/${name}.png`),
];
