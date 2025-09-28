const { generate } = require('../src/generator');
const { parseInput } = require('../src/parser');
const path = require('path');
const fs = require('fs');

describe('generator', () => {
    const originalCwd = process.cwd;
    const fixturesDir = path.resolve(__dirname, '__fixtures__');
    const buildDir = path.join(fixturesDir, 'build');
    let consoleWarnSpy, consoleLogSpy;

    beforeAll(async () => {
        // Mock process.cwd() to point to our test fixtures directory
        process.cwd = () => fixturesDir;
        // Suppress console output
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // Run generator once for all tests in this suite
        const config = parseInput('openapi.yaml');
        await generate(config);
    });

    afterAll(() => {
        // Restore original process.cwd() and console spies
        process.cwd = originalCwd;
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        // Clean up the generated build directory
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
    });

    it('should generate main files that match their snapshots', () => {
        const generatedFiles = ['index.js', 'router.js', 'db.js', 'files.js', 'keys.js'];
        for (const file of generatedFiles) {
            const filePath = path.join(buildDir, file);
            expect(fs.existsSync(filePath)).toBe(true);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).toMatchSnapshot(file);
        }
    });

    it('should generate handler files that match their snapshots', () => {
        const handlersDir = path.join(buildDir, 'handlers');
        const handlerFiles = fs.readdirSync(handlersDir);

        // Ensure at least one handler was created
        expect(handlerFiles.length).toBeGreaterThan(0);

        for (const file of handlerFiles) {
            const filePath = path.join(handlersDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).toMatchSnapshot(file);
        }
    });
});