// Bun开发服务器 - 整体打包 + 静态文件 + 测试控制API
const PORT = 3456;

async function buildApp() {
  const result = await Bun.build({
    entrypoints: ['./src/main.tsx'],
    target: 'browser',
    format: 'esm',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  return result.outputs[0];
}

// 缓存构建结果
let cachedOutput: BuildOutput | null = null;
let lastBuild = 0;

async function getBundle() {
  const now = Date.now();
  // 每次请求都重新构建（开发模式）
  cachedOutput = await buildApp();
  lastBuild = now;
  return cachedOutput;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname === '/') pathname = '/index.html';

    // 角色卡JSON（世界书数据源）
    if (pathname === '/card.json') {
      const cardFile = Bun.file('./世界漫游指南.json');
      if (await cardFile.exists()) {
        return new Response(cardFile, {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 应用入口 - 返回打包后的JS
    if (pathname === '/app.js' || pathname === '/src/main.tsx') {
      try {
        const output = await getBundle();
        if (output) {
          return new Response(output, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }
      } catch (err: any) {
        return new Response(`console.error(${JSON.stringify(err.message)})`, {
          headers: { 'Content-Type': 'application/javascript' },
        });
      }
    }

    // 静态文件
    const file = Bun.file(`.${pathname}`);
    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback
    return new Response(Bun.file('./index.html'));
  },
});

console.log(`🚀 世界漫游指南运行在 http://localhost:${PORT}`);
