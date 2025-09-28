const { Miniflare, createFetchMock } = require('miniflare');
const { generate } = require('../src/generator');
const { parseInput } = require('../src/parser');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

describe('E2E tests for the generated worker', () => {
    let mf;
    const originalCwd = process.cwd;
    const fixturesDir = path.resolve(__dirname, '__fixtures__');
    const buildDir = path.join(fixturesDir, 'build');
    let sessionCookie = '';

    beforeAll(async () => {
        process.cwd = () => fixturesDir;

        const config = parseInput('openapi.yaml');
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await generate(config);
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        await esbuild.build({
            entryPoints: [path.join(buildDir, 'index.js')],
            bundle: true,
            outfile: path.join(buildDir, 'bundled.js'),
            format: 'esm',
        });

        const fetchMock = createFetchMock();
        fetchMock.disableNetConnect();
        fetchMock.get('https://jsonplaceholder.typicode.com').intercept({
            path: '/posts/1'
        }).reply(200, { id: 1, title: 'Mocked Post' });

        mf = new Miniflare({
            scriptPath: path.join(buildDir, 'bundled.js'),
            modules: true,
            d1Databases: { "TEST_DB": "test-d1-db" },
            kvNamespaces: { "TEST_KV": "test-kv-ns" },
            r2Buckets: { "TEST_BUCKET": "test-r2-bucket" },
            bindings: { JWT_SECRET: config.env.JWT_SECRET },
            d1Persist: true,
            fetchMock,
        });

        // Initialize DB
        const db = await mf.getD1Database('TEST_DB');
        await db.exec(`DROP TABLE IF EXISTS users`);
        await db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL)`);

        // Create a user and log in to get a valid session cookie for other tests
        await db.exec(`INSERT INTO users (id, email, password) VALUES (1, 'test@example.com', 'password123')`);
        const loginRes = await mf.dispatchFetch('http://localhost/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        });
        sessionCookie = loginRes.headers.get('Set-Cookie');
    });

    afterAll(async () => {
        process.cwd = originalCwd;
        if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true });
        if (mf) await mf.dispose();
    });

    test('POST /register should create a new user', async () => {
        const res = await mf.dispatchFetch('http://localhost/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test2@example.com', password: 'password456' }),
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.userId).toBe(2);
        const db = await mf.getD1Database('TEST_DB');
        const { results } = await db.prepare('SELECT id FROM users WHERE email = ?').bind('test2@example.com').all();
        expect(results).toHaveLength(1);
    });

    test('GET /users/me should return authenticated user data', async () => {
        const res = await mf.dispatchFetch('http://localhost/users/me', { headers: { Cookie: sessionCookie } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe(1);
        expect(body.email).toBe('test@example.com');
    });

    test('GET /kv/{key} should retrieve a value from KV', async () => {
        const kv = await mf.getKVNamespace('TEST_KV');
        await kv.put('user-setting:theme', 'dark');
        const res = await mf.dispatchFetch('http://localhost/kv/theme');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.value).toBe('dark');
    });

    test('POST /files/upload should upload a file to R2', async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['test content']), 'test.txt');

        // Create a temporary request to generate the multipart/form-data header with boundary
        const tempReq = new Request('http://localhost', { method: 'POST', body: formData });

        const res = await mf.dispatchFetch('http://localhost/files/upload', {
            method: 'POST',
            headers: {
                'Content-Type': tempReq.headers.get('Content-Type'),
                'Cookie': sessionCookie,
            },
            body: formData,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        const r2 = await mf.getR2Bucket('TEST_BUCKET');
        const file = await r2.get(body.key);
        expect(await file.text()).toBe('test content');
    });

    test('GET /external/posts/{id} should return mocked data', async () => {
        const res = await mf.dispatchFetch('http://localhost/external/posts/1');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.title).toBe('Mocked Post');
    });
});