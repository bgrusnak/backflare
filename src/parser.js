const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const toml = require('toml');
const yaml = require('yaml');

function parseInput(openapiFilePath) {
    // 1. Load .env file
    dotenv.config();

    // 2. Load and parse wrangler.toml
    const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
    let wranglerConfig = {};
    if (fs.existsSync(wranglerPath)) {
        const wranglerToml = fs.readFileSync(wranglerPath, 'utf-8');
        wranglerConfig = toml.parse(wranglerToml);
    } else {
        console.warn('wrangler.toml not found. Bindings will be unavailable.');
    }

    // 3. Load and parse OpenAPI file
    const openapiResolvedPath = path.resolve(process.cwd(), openapiFilePath);
    if (!fs.existsSync(openapiResolvedPath)) {
        throw new Error(`OpenAPI file not found at: ${openapiResolvedPath}`);
    }
    const openapiFile = fs.readFileSync(openapiResolvedPath, 'utf-8');
    const openapiSpec = yaml.parse(openapiFile);

    // 4. Combine and return configuration
    return {
        wrangler: wranglerConfig,
        openapi: openapiSpec,
        // We can add environment variables if needed later
        // env: process.env
    };
}

module.exports = { parseInput };