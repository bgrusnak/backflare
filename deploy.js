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
  .option('-f, --file <path>', 'Path to OpenAPI file', 'openapi.yaml')
  .option('--sql <path>', 'Path to SQL file for DB initialization', 'init.sql')
  .action(async (options) => {
    console.log('Generating code for local development...');
    const config = parseInput(options.file);
    await generate(config);
    console.log('Code generated successfully.');

    // Initialize D1 databases
    const sqlFilePath = path.resolve(process.cwd(), options.sql);
    if (fs.existsSync(sqlFilePath)) {
      if (config.wrangler.d1_databases && config.wrangler.d1_databases.length > 0) {
        console.log(`Initializing local D1 databases with ${options.sql}...`);
        for (const db of config.wrangler.d1_databases) {
          console.log(`- Initializing ${db.binding}...`);
          execSync(`npx wrangler d1 execute ${db.binding} --local --file ${sqlFilePath}`, { stdio: 'inherit' });
        }
      }
    } else {
      if (options.sql !== 'init.sql') { // Only warn if the user specified a file that doesn't exist
        console.warn(`SQL file not found at ${sqlFilePath}, skipping DB initialization.`);
      }
    }

    console.log('Starting local server with wrangler...');
    execSync('npx wrangler dev build/index.js', { stdio: 'inherit' });
  });

program
  .command('deploy')
  .description('Generate and deploy the worker to Cloudflare')
  .option('-f, --file <path>', 'Path to OpenAPI file', 'api.yaml')
  .option('--sql <path>', 'Path to SQL file for DB initialization', 'init.sql')
  .action(async (options) => {
    console.log('Generating code for deployment...');
    const config = parseInput(options.file);
    await generate(config);
    console.log('Code generated successfully.');

    // Initialize D1 databases
    const sqlFilePath = path.resolve(process.cwd(), options.sql);
    if (fs.existsSync(sqlFilePath)) {
      if (config.wrangler.d1_databases && config.wrangler.d1_databases.length > 0) {
        console.log(`Initializing D1 databases with ${options.sql}...`);
        for (const db of config.wrangler.d1_databases) {
          console.log(`- Initializing ${db.binding}...`);
          execSync(`npx wrangler d1 execute ${db.binding} --file ${sqlFilePath}`, { stdio: 'inherit' });
        }
      }
    } else {
      if (options.sql !== 'init.sql') { // Only warn if the user specified a file that doesn't exist
        console.warn(`SQL file not found at ${sqlFilePath}, skipping DB initialization.`);
      }
    }

    console.log('Deploying to Cloudflare...');
    execSync('npx wrangler deploy build/index.js', { stdio: 'inherit' });
  });

program.parse(process.argv);