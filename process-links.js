'use strict';

const fs = require('fs');
const path = require('path');

const RAW_LINKS_FILE = path.join(__dirname, 'raw-links.txt');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Read raw-links.txt
let rawContent;
try {
  rawContent = fs.readFileSync(RAW_LINKS_FILE, 'utf8');
} catch (err) {
  console.error('Error reading raw-links.txt:', err.message);
  process.exit(1);
}

// Extract full embed objects: { id, sig, items }
// Pattern matches: gie.widgets.load({id:'xxx',sig:'xxx',...,items:'xxx',...})
const EMBED_PATTERN = /gie\.widgets\.load\(\{([^}]+)\}\)/g;

const allEmbeds = [];
const seenItems = new Set();

let match;
while ((match = EMBED_PATTERN.exec(rawContent)) !== null) {
  const block = match[1];

  // Extract id
  const idMatch = block.match(/id:\s*'([^']+)'/);
  // Extract sig
  const sigMatch = block.match(/sig:\s*'([^']+)'/);
  // Extract items (the numeric image ID)
  const itemsMatch = block.match(/items:\s*'([^']+)'/);

  if (idMatch && sigMatch && itemsMatch) {
    const items = itemsMatch[1];
    // Skip duplicates based on the image ID
    if (!seenItems.has(items)) {
      seenItems.add(items);
      allEmbeds.push({
        id: idMatch[1],
        sig: sigMatch[1],
        items: items
      });
    }
  }
}

// Read existing config.json to preserve settings and playlist
let existingConfig = {};
try {
  const existing = fs.readFileSync(CONFIG_FILE, 'utf8');
  existingConfig = JSON.parse(existing);
} catch (err) {
  existingConfig = {};
}

const existingSettings = existingConfig.settings || {
  beatSensitivity: 0.65,
  flashDuration: 0.3,
  maxConcurrent: 2
};
const existingPlaylist = Array.isArray(existingConfig.playlist) ? existingConfig.playlist : [];

// Check for duplicates against existing images
const existingImages = Array.isArray(existingConfig.images) ? existingConfig.images : [];
const existingItemsSet = new Set(existingImages.map(function (img) {
  return typeof img === 'object' ? img.items : img;
}));

const newEmbeds = allEmbeds.filter(function (e) {
  return !existingItemsSet.has(e.items);
});

const mergedImages = [...existingImages, ...newEmbeds];

const updatedConfig = {
  images: mergedImages,
  settings: existingSettings,
  playlist: existingPlaylist
};

try {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));
} catch (err) {
  console.error('Error writing config.json:', err.message);
  process.exit(1);
}

console.log('Embeds found:       ' + allEmbeds.length);
console.log('New embeds added:   ' + newEmbeds.length);
console.log('Duplicates skipped: ' + (allEmbeds.length - newEmbeds.length));
console.log('Total images in config: ' + mergedImages.length);
console.log('config.json updated successfully.');