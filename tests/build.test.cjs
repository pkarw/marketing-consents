const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const ts = require('typescript');
const { build } = require('../build.cjs');

test('packed entity source remains discoverable by the host entity-id generator', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'marketing-consents-build-'));
    try {
        fs.copyFileSync(path.join(__dirname, '../package.json'), path.join(root, 'package.json'));
        fs.cpSync(path.join(__dirname, '../src'), path.join(root, 'src'), { recursive: true });
        build(root);

        // The host resolves convention files in dist before scanning exported
        // class declarations. Compiled decorator helpers are not declarations.
        const entityFile = path.join(root, 'dist/modules/marketing_consents/data/entities.ts');
        assert.ok(fs.existsSync(entityFile), 'dist must include the TypeScript entity convention file');
        const source = ts.createSourceFile(entityFile, fs.readFileSync(entityFile, 'utf8'), ts.ScriptTarget.Latest, true);
        const names = source.statements
            .filter(node => ts.isClassDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
            .map(node => node.name.text);
        assert.deepEqual(names, ['ConsentRecord', 'WithdrawalEvidence']);
        assert.match(fs.readFileSync(entityFile, 'utf8'), /tableName: 'marketing_consent_records'/);
        assert.ok(fs.existsSync(path.join(root, 'dist/modules/marketing_consents/data/entities.js')));

        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        assert.equal(manifest.exports['./*.ts'].default, './dist/*.js', 'runtime imports must still use compiled JavaScript');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

let hostGenerator;
try {
    hostGenerator = require.resolve('@open-mercato/cli/lib/generators/entity-ids');
} catch {
    // Release CI only installs the compiler; a host app can additionally verify
    // the packed module using its exact installed Open Mercato generator.
}

test('host discovers both entities and Query Engine resolves the migrated table', { skip: !hostGenerator }, async () => {
    const root = fs.mkdtempSync(path.join(__dirname, '../.host-test-'));
    try {
        fs.copyFileSync(path.join(__dirname, '../package.json'), path.join(root, 'package.json'));
        fs.cpSync(path.join(__dirname, '../src'), path.join(root, 'src'), { recursive: true });
        build(root);
        const { generateEntityIds } = await import(pathToFileURL(hostGenerator).href);
        const outputDir = path.join(root, 'generated');
        const moduleId = 'marketing_consents';
        const packageName = '@piotrkarwatka/marketing-consents';
        await generateEntityIds({
            quiet: true,
            resolver: {
                isMonorepo: () => false,
                getPackageRoot: () => root,
                getOutputDir: () => outputDir,
                loadEnabledModules: () => [{ id: moduleId, from: packageName }],
                getModulePaths: () => ({ appBase: path.join(root, 'app/modules', moduleId), pkgBase: path.join(root, 'dist/modules', moduleId) }),
                getModuleImportBase: () => ({ appBase: `@/modules/${moduleId}`, pkgBase: `${packageName}/modules/${moduleId}` }),
            },
        });
        const ids = fs.readFileSync(path.join(outputDir, 'entities.ids.generated.ts'), 'utf8');
        assert.match(ids, /marketing_consents:consent_record/);
        assert.match(ids, /marketing_consents:withdrawal_evidence/);
        const fields = fs.readFileSync(path.join(outputDir, 'entity-fields-registry.ts'), 'utf8');
        assert.match(fields, /"granted_at"/);
        assert.match(fields, /"consent_code"/);

        const { MikroORM } = await import(pathToFileURL(require.resolve('@mikro-orm/postgresql')).href);
        const { resolveRegisteredEntityTableName } = await import(pathToFileURL(require.resolve('@open-mercato/shared/lib/query/engine')).href);
        const { ConsentRecord, WithdrawalEvidence } = await import(pathToFileURL(path.join(root, 'dist/modules', moduleId, 'data/entities.js')).href);
        const orm = await MikroORM.init({ entities: [ConsentRecord, WithdrawalEvidence], dbName: 'metadata_only', connect: false });
        try {
            assert.equal(resolveRegisteredEntityTableName(orm.em, 'marketing_consents:consent_record'), 'marketing_consent_records');
            assert.equal(resolveRegisteredEntityTableName(orm.em, 'marketing_consents:withdrawal_evidence'), 'marketing_consent_withdrawal_evidence');
        } finally {
            await orm.close();
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
