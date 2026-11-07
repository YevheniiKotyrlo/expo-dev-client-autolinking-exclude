import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const devClientPlugins = ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu'];

function installedVersion(packageName) {
  try {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, 'node_modules', packageName, 'package.json'), 'utf8')
    );
    return manifest.version;
  } catch {
    return 'not installed';
  }
}

function readExpoConfig(type) {
  const cli = createRequire(import.meta.url).resolve('expo/bin/cli');
  const output = execFileSync(process.execPath, [cli, 'config', '--type', type, '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function main() {
  const appConfig = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8'));
  const scheme = `exp+${appConfig.expo.slug}`;

  console.log(
    `node ${process.version}, expo ${installedVersion('expo')}, @expo/prebuild-config ${installedVersion('@expo/prebuild-config')}, expo-dev-client ${installedVersion('expo-dev-client')}, ${process.platform} ${process.arch}`
  );

  const prebuild = readExpoConfig('prebuild');
  const introspect = readExpoConfig('introspect');

  const autolinkedModules = prebuild._internal?.autolinkedModules;
  if (!Array.isArray(autolinkedModules)) {
    console.log('step failed: expo config --type prebuild returned no _internal.autolinkedModules');
    process.exit(2);
  }
  const stillLinked = devClientPlugins.filter((name) => autolinkedModules.includes(name));
  if (stillLinked.length > 0) {
    console.log(
      `step failed: autolinking still reports ${stillLinked.join(', ')}; the expo.autolinking.exclude entry in package.json was not read`
    );
    process.exit(2);
  }
  console.log(
    `autolinkedModules: ${devClientPlugins.join(', ')} excluded from autolinking, as package.json configures`
  );

  const pluginHistory = Object.keys(prebuild._internal?.pluginHistory ?? {});
  const appliedDevClientPlugins = devClientPlugins.filter((name) => pluginHistory.includes(name));
  console.log(
    `pluginHistory dev-client plugins: ${appliedDevClientPlugins.length ? appliedDevClientPlugins.join(', ') : 'none'}`
  );

  const infoPlist = JSON.stringify(introspect._internal?.modResults?.ios?.infoPlist ?? {});
  const manifest = JSON.stringify(introspect._internal?.modResults?.android?.manifest ?? {});
  const infoPlistHasScheme = infoPlist.includes(scheme);
  const manifestHasScheme = manifest.includes(scheme);
  console.log(`Info.plist ${scheme}: ${infoPlistHasScheme ? 'yes' : 'no'}`);
  console.log(`AndroidManifest ${scheme}: ${manifestHasScheme ? 'yes' : 'no'}`);

  const defectShows = appliedDevClientPlugins.length > 0 || infoPlistHasScheme || manifestHasScheme;
  console.log(
    `summary: ${
      defectShows
        ? "prebuild applied expo-dev-client's config plugin although autolinking excludes it (exit 1)"
        : 'prebuild skipped expo-dev-client, as autolinking excludes it (exit 0)'
    }`
  );
  process.exit(defectShows ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.log(`step failed: ${error.message}`);
  process.exit(2);
}
