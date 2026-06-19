// Bun开发服务器 - 整体打包 + 静态文件 + 测试控制API
const PORT = 3456;

async function buildApp() {
  const result = await Bun.build({
    entrypoints: ['./src/main.tsx'],
    target: 'browser',
    format: 'esm',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  if (!result.success || result.outputs.length === 0) {
    const errors = result.logs?.filter(l => l.level === 'error').map(l => l.message).join('\n') || '未知构建错误';
    throw new Error(`构建失败:\n${errors}`);
  }
  return result.outputs[0];
}

// 缓存构建结果
let cachedOutput: any = null;
let lastBuild = 0;
let building = false;
let buildPromise: Promise<any> | null = null;

async function getBundle() {
  const now = Date.now();
  // 5秒内的请求复用缓存
  if (cachedOutput && now - lastBuild < 5000) {
    return cachedOutput;
  }
  // 如果正在构建中，等待同一次构建完成
  if (building && buildPromise) {
    return buildPromise;
  }
  building = true;
  buildPromise = buildApp().then(output => {
    cachedOutput = output;
    lastBuild = Date.now();
    building = false;
    buildPromise = null;
    return output;
  }).catch(err => {
    building = false;
    buildPromise = null;
    // 有旧缓存就用旧的，没有就抛错
    if (cachedOutput) {
      console.error('[构建出错，使用缓存]', err.message);
      return cachedOutput;
    }
    throw err;
  });
  return buildPromise;
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

    // 应用入口 - 返回打包后的JS（禁止缓存）
    if (pathname === '/app.js' || pathname === '/src/main.tsx') {
      try {
        const output = await getBundle();
        if (output) {
          return new Response(output, {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          });
        }
        return new Response(`console.error("构建输出为空")`, {
          headers: { 'Content-Type': 'application/javascript' },
        });
      } catch (err: any) {
        console.error('[app.js 构建错误]', err.message);
        return new Response(`document.body.innerHTML='<pre style="color:red">构建失败: ${err.message.replace(/'/g, "\\'")}</pre>'`, {
          headers: { 'Content-Type': 'application/javascript' },
        });
      }
    }

    // 静态文件（禁止缓存，避免旧代码）
    const file = Bun.file(`.${pathname}`);
    if (await file.exists()) {
      return new Response(file, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // SPA fallback
    return new Response(Bun.file('./index.html'));
  },
});

console.log(`🚀 世界漫游指南运行在 http://localhost:${PORT}`);
