import { computeAnimationFrames } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/logic/gameUtils.js';
import { PER_PLAYER_PATHS as PATHS } from 'file:///C:/Users/gulshan/Desktop/temp/LUDO%20Game/src/data/boardData.js';

console.log('Path lengths:', Object.fromEntries(Object.entries(PATHS).map(([c, p]) => [c, p.length])));

// Find any (from, to) pair that yields <= 1 frame (would render as a jump)
let badCases = [];
for (const color of ['red', 'green', 'yellow', 'blue']) {
  for (let from = 0; from < 56; from++) {
    for (let to = from + 1; to <= Math.min(from + 6, 56); to++) {
      const frames = computeAnimationFrames(from, to, color);
      if (frames.length <= 1) {
        badCases.push({ color, from, to, frames: frames.length, coords: frames });
      }
    }
  }
}
console.log('\nBad cases (<=1 frame, causes jump):', badCases.length);
if (badCases.length > 0) console.log(JSON.stringify(badCases.slice(0, 20), null, 2));

// Specifically: the reported case, piece moves and lands exactly on finish
console.log('\n50 -> 56 frames:', JSON.stringify(computeAnimationFrames(50, 56, 'green')));
console.log('44 -> 50 frames:', computeAnimationFrames(44, 50, 'green').length);
console.log('48 -> 54 (home stretch entry) frames:', computeAnimationFrames(48, 54, 'green').length);
console.log('0 -> 6 frames:', computeAnimationFrames(0, 6, 'red').length);
