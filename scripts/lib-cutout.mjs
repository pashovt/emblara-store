// Runs scripts/cutout.swift (Apple Vision, on this Mac) over many images in one
// go. pairs: [[input, outputPng], ...]. Throws if any image fails.
import { execFileSync } from 'node:child_process';

export function cutoutMany(pairs, batch = 40) {
  for (let i = 0; i < pairs.length; i += batch) {
    const args = pairs.slice(i, i + batch).flat();
    execFileSync('swift', ['scripts/cutout.swift', ...args], { stdio: 'inherit' });
  }
}
