# expo-dev-client-autolinking-exclude

A blank Expo app that installs `expo-dev-client` and names it, with the rest of the dev-client family, in `expo.autolinking.exclude` in `package.json`.

`node repro.mjs` runs `expo config --type prebuild` and `expo config --type introspect` and prints the dev-client plugins in `_internal.pluginHistory` and whether the introspected iOS Info.plist and Android manifest carry the `exp+<slug>` scheme. It exits 1 while prebuild applies the plugin although autolinking excludes it, 0 when it skips it, and 2 when a step fails.

```
npm install
node repro.mjs
```
