// 生产构建脚本 - 打包 + 复制静态资源
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DIST = './dist';

console.log('🔨 开始生产构建...');

// 1. 确保 dist 目录存在
if (!existsSync(DIST)) {
  mkdirSync(DIST, { recursive: true });
}

// 2. 打包 JS
console.log('📦 打包 JavaScript...');
const jsResult = await Bun.build({
  entrypoints: ['./src/main.tsx'],
  target: 'browser',
  format: 'esm',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});

if (!jsResult.success) {
  console.error('❌ JS 打包失败:');
  for (const log of jsResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

// 写入 JS 文件
const jsOutput = jsResult.outputs[0];
const jsContent = await jsOutput.text();
writeFileSync(join(DIST, 'main.js'), jsContent);
console.log(`   ✅ main.js (${(jsContent.length / 1024 / 1024).toFixed(2)} MB)`);

// 3. 打包 CSS（从 index.css 作为入口）
console.log('🎨 打包 CSS...');
const cssResult = await Bun.build({
  entrypoints: ['./src/index.css'],
  target: 'browser',
  minify: true,
});

if (!cssResult.success) {
  console.error('❌ CSS 打包失败:');
  for (const log of cssResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

// 写入 CSS 文件
const cssOutput = cssResult.outputs[0];
const cssContent = await cssOutput.text();
writeFileSync(join(DIST, 'main.css'), cssContent);
console.log(`   ✅ main.css (${(cssContent.length / 1024).toFixed(1)} KB)`);

// 4. 生成生产用 index.html
console.log('📝 生成 index.html...');
const htmlTemplate = readFileSync('./index.html', 'utf-8');
const prodHtml = htmlTemplate
  .replace('/src/index.css', '/main.css')
  .replace('/app.js', '/main.js');
writeFileSync(join(DIST, 'index.html'), prodHtml);
console.log('   ✅ index.html');

// 5. 复制角色卡 JSON
console.log('📋 复制角色卡数据...');
const cardFile = './世界漫游指南.json';
if (existsSync(cardFile)) {
  copyFileSync(cardFile, join(DIST, 'card.json'));
  console.log('   ✅ card.json');
} else {
  console.warn('   ⚠️  未找到 世界漫游指南.json，跳过');
}

console.log('\n✨ 构建完成！dist/ 目录结构：');
console.log('   dist/');
console.log('   ├── index.html');
console.log('   ├── main.js');
console.log('   ├── main.css');
console.log('   └── card.json (角色卡)');
