// Génère les icônes PWA à partir de public/favicon.svg (npm run icons)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg');
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E7A4C"/><g transform="translate(6.4 6.4) scale(.6)"><path d="M16 6v20M6 16a10 10 0 0 0 20 0" stroke="#fff" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="3.2" fill="#F0B23A"/></g></svg>`,
);
await sharp(svg, { density: 1200 }).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(svg, { density: 1200 }).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(maskable, { density: 1200 }).resize(512, 512).png().toFile('public/pwa-maskable-512.png');
await sharp(maskable, { density: 1200 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Icônes générées');
