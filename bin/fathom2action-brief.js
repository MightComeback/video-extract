#!/usr/bin/env node
import { generateBrief } from '../src/brief.js';

const args = process.argv.slice(2);

try {
  const output = await generateBrief(args);
  console.log(output);
} catch (err) {
  console.error(err);
  process.exit(1);
}
