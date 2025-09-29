const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

// A helper function to render a template and write it to the build directory
async function renderAndWrite(buildDir, templateName, data, outputName) {
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
    const outputPath = path.join(buildDir, outputName || templateName);

    const template = await fs.promises.readFile(templatePath, 'utf-8');
    const renderedContent = ejs.render(template, data);

    await fs.promises.writeFile(outputPath, renderedContent);
}

async function generate(config) {
    // Resolve BUILD_DIR inside the function to respect mocked process.cwd() in tests
    const BUILD_DIR = path.resolve(process.cwd(), 'build');

    // 1. Ensure the build directory exists and is clean
    if (fs.existsSync(BUILD_DIR)) {
        await fs.promises.rm(BUILD_DIR, { recursive: true, force: true });
    }
    await fs.promises.mkdir(BUILD_DIR);
    await fs.promises.mkdir(path.join(BUILD_DIR, 'handlers'));

    console.log('Generating worker files...');

    const globalTemplateData = {
        openapi: config.openapi,
        wrangler: config.wrangler,
        env: config.env
    };

    // Generate main files
    await renderAndWrite(BUILD_DIR, 'index.js', globalTemplateData);
    await renderAndWrite(BUILD_DIR, 'router.js', globalTemplateData);
    await renderAndWrite(BUILD_DIR, 'db.js', globalTemplateData);
    await renderAndWrite(BUILD_DIR, 'files.js', globalTemplateData);
    await renderAndWrite(BUILD_DIR, 'keys.js', globalTemplateData);
    await renderAndWrite(BUILD_DIR, 'utils.js', globalTemplateData);

    console.log('Generating route handlers...');

    const { paths, 'x-defaults': defaults } = config.openapi;
    const handlerTemplatePath = path.join(TEMPLATES_DIR, 'handler.js.ejs');
    const handlerTemplate = await fs.promises.readFile(handlerTemplatePath, 'utf-8');

    for (const pathKey in paths) {
        for (const method in paths[pathKey]) {
            const op = paths[pathKey][method];

            if (op.hasOwnProperty('x-operations')) {
                const operationId = op.operationId || `${method.toLowerCase()}_${pathKey.replace(/[\/{}]/g, '_')}`;

                const handlerData = {
                    operations: op['x-operations'],
                    xResponse: op['x-response'],
                    defaults: {
                        d1: defaults?.d1,
                        r2: defaults?.r2,
                        kv: defaults?.kv
                    }
                }; 
                const handlerContent = ejs.render(handlerTemplate, handlerData);
                const handlerOutputPath = path.join(BUILD_DIR, 'handlers', `${operationId}.js`);
                await fs.promises.writeFile(handlerOutputPath, handlerContent);
                console.log(`- Generated handler for ${operationId}`);
            }
        }
    }

    console.log('Worker files generated in build/');
}

module.exports = { generate };