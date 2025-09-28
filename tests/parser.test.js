const { parseInput } = require('../src/parser');
const path = require('path');
const fs = require('fs');

describe('parser', () => {
    const originalCwd = process.cwd;
    const fixturesDir = path.resolve(__dirname, '__fixtures__');
    let consoleWarnSpy, consoleLogSpy;

    beforeAll(() => {
        // Mock process.cwd() to point to our test fixtures directory
        process.cwd = () => fixturesDir;
        // Suppress console output
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll(() => {
        // Restore original process.cwd() and console spies
        process.cwd = originalCwd;
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should correctly parse wrangler.toml and openapi.yaml', () => {
        // The path to the openapi file is relative to the mocked cwd
        const config = parseInput('openapi.yaml');

        // Check wrangler.toml parsing
        expect(config.wrangler).toBeDefined();
        expect(config.wrangler.name).toBe('test-worker');
        expect(config.wrangler.d1_databases[0].binding).toBe('TEST_DB');

        // Check openapi.yaml parsing
        expect(config.openapi).toBeDefined();
        expect(config.openapi.info.title).toBe('Test API');
        expect(config.openapi.paths['/register']).toBeDefined();
    });

    it('should throw an error if openapi file does not exist', () => {
        expect(() => {
            parseInput('non-existent-file.yaml');
        }).toThrow('OpenAPI file not found');
    });

    it('should warn if wrangler.toml does not exist but still parse openapi', () => {
        // Temporarily change cwd to a directory without wrangler.toml
        process.cwd = () => __dirname;

        const config = parseInput('__fixtures__/openapi.yaml');

        expect(consoleWarnSpy).toHaveBeenCalledWith('wrangler.toml not found. Bindings will be unavailable.');
        expect(config.openapi.info.title).toBe('Test API');

        // Restore
        process.cwd = () => fixturesDir;
    });
});