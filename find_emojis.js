import fs from 'fs';
const content = fs.readFileSync('src/SlowedReverbTool.jsx', 'utf-8');
const lines = content.split('\n');
const emojiRegex = /[\p{Extended_Pictographic}]/u;
const results = [];
lines.forEach((line, i) => {
  if (emojiRegex.test(line)) {
    results.push(`${i + 1}: ${line.trim()}`);
  }
});
fs.writeFileSync('emojis_found.txt', results.join('\n'), 'utf-8');
console.log(`Found ${results.length} lines with emojis.`);
