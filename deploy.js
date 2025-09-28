#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { parseInput } = require('./src/parser');
const { generate } = require('./src/generator');

program
  .version('1.0.0')
  .description('A simple backend generator for Cloudflare Workers');

program
  .command('local')
  .description('Generate the worker and run it locally')
  .option('-f, --file <path>', 'Path to OpenAPI file', 'api.yaml')
  .action(async (options) => {
    console.log('Generating code for local development...');
    const config = parseInput(options.file);
    await generate(config);
    console.log('Code generated successfully.');
    console.log('Starting local server with wrangler...');
    execSync('npx wrangler dev build/index.js', { stdio: 'inherit' });
  });

program
  .command('deploy')
  .description('Generate and deploy the worker to Cloudflare')
  .option('-f, --file <path>', 'Path to OpenAPI file', 'api.yaml')
  .action(async (options) => {
    console.log('Generating code for deployment...');
    const config = parseInput(options.file);
    await generate(config);
    console.log('Code generated successfully.');
    console.log('Deploying to Cloudflare...');
    execSync('npx wrangler deploy build/index.js', { stdio: 'inherit' });
  });

program.parse(process.argv);