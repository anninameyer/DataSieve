import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await copyFile('offline/DataSieve.html', 'dist/DataSieve.html');
await writeFile('dist/.nojekyll', '');
// Ship researcher guides; maintainer records stay in docs/maintainers/ in the source repository.
for (const file of ['README.md', 'METHODS.md', 'CITING.md', 'CITATION.cff', 'LICENSE'])
  await copyFile(file, `dist/${file}`);
const licenses = await Promise.all(
  [
    ['React', 'node_modules/react/LICENSE'],
    ['React DOM', 'node_modules/react-dom/LICENSE'],
    ['Scheduler', 'node_modules/scheduler/LICENSE'],
    ['fflate', 'node_modules/fflate/LICENSE'],
    ['Plotly.js Cartesian distribution', 'node_modules/plotly.js-cartesian-dist-min/LICENSE'],
  ].map(async ([name, path]) => `${name}\n${await readFile(path, 'utf8')}\n`),
);
const plotlySource = await readFile(
  'node_modules/plotly.js-cartesian-dist-min/plotly-cartesian.min.js',
  'utf8',
);
const bundledNotices = plotlySource.match(/\/\*! Bundled license information:[\s\S]*?\*\//)?.[0];
if (!bundledNotices) throw new Error('Missing bundled Plotly component attribution');
licenses.push(bundledNotices);
await writeFile('dist/THIRD_PARTY_LICENSES.txt', licenses.join('\n----------------\n\n'));
await writeFile('offline/THIRD_PARTY_LICENSES.txt', licenses.join('\n----------------\n\n'));
// Preserve license texts inside the single-file distribution as well.
const notices = `\n<!-- DataSieve (MIT) and bundled dependency notices\n${((await readFile('LICENSE', 'utf8')) + licenses.join('\n')).replaceAll('--', '—')}\n-->\n`;
for (const path of ['offline/DataSieve.html', 'dist/DataSieve.html']) {
  const html = (await readFile(path, 'utf8')).split(
    '\n<!-- DataSieve (MIT) and bundled dependency notices',
  )[0];
  if (/<(?:script|link)[^>]+(?:src|href)=/i.test(html))
    throw new Error('Offline HTML has external assets');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) throw new Error('Expected one standalone inline executable');
  const digest = createHash('sha256').update(scripts[0][1]).digest('base64');
  if (!html.includes(`'sha256-${digest}'`))
    throw new Error('Offline script does not match its CSP hash');
  if (html.indexOf('<script>') < html.indexOf('<div id="root">'))
    throw new Error('Offline script must run after its mount element');
  await writeFile(path, html + notices);
}
console.log('Packaged dist/ and offline/DataSieve.html from the same application source.');
