const { generate } = require('../src/generator');
const { parseInput } = require('../src/parser');
const path = require('path');
const fs = require('fs');

describe('generator', () => {
    const originalCwd = process.cwd;
    const fixturesDir = path.resolve(__dirname, '__fixtures__');
    const buildDir = path.join(fixturesDir, 'build');
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
        // Clean up the generated build directory
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
    });

    it('should generate files that match the snapshots', async () => {
        const config = parseInput('openapi.yaml');
        await generate(config);

        // Check that the main files were generated and match their snapshots
        const generatedFiles = ['index.js', 'router.js', 'db.js', 'files.js', 'keys.js'];
        for (const file of generatedFiles) {
            const filePath = path.join(buildDir, file);
            expect(fs.existsSync(filePath)).toBe(true);
            const content = fs.readFileSync(filePath, 'utf-8');
            expect(content).toMatchSnapshot(file);
        }

        // Check that the handler was generated and matches its snapshot
        const handlerPath = path.join(buildDir, 'handlers', 'getTest.js');
        expect(fs.existsSync(handlerPath)).toBe(true);
        const handlerContent = fs.readFileSync(handlerPath, 'utf-8');
        expect(handlerContent).toMatchSnapshot('getTest.js');
    });
});