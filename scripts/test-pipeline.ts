#!/usr/bin/env bun
// 后端控制CLI - 通过HTTP控制前端游戏引擎，监测管线状态
// 用法:
//   bun run scripts/test-pipeline.ts send "你好，我是勇者"
//   bun run scripts/test-pipeline.ts status
//   bun run scripts/test-pipeline.ts loop "你好" "我想去冒险" "看看周围"

const BASE = 'http://localhost:3456/api/test';
const TIMEOUT = 60_000;

async function sendCommand(payload: any): Promise<any> {
  const res = await fetch(`${BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function waitResult(commandId: string, timeout = TIMEOUT): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(`${BASE}/result?commandId=${commandId}`);
    const data = await res.json();
    if (data.status === 'done') return data.result;
    if (data.status === 'error') return { error: data.error };
    await Bun.sleep(1000);
  }
  return { error: 'timeout' };
}

function printResult(result: any) {
  if (result.error) {
    console.log(`\n❌ 错误: ${result.error}\n`);
    return;
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📨 消息数: ${result.messageCount}`);

  if (result.assistantMessage) {
    const msg = result.assistantMessage;
    console.log(`\n📖 原始响应 (${msg.rawText?.length || 0}字):`);
    console.log(msg.rawText?.slice(0, 500) || '(空)');
  }

  if (result.pipelineStatus) {
    const ps = result.pipelineStatus;
    console.log(`\n📊 管线状态 (round ${ps.round}, ${ps.endTime - ps.startTime}ms):`);
    for (const [id, stage] of Object.entries(ps.stages) as any[]) {
      const icon = { pending: '○', running: '◉', success: '✅', error: '❌', skipped: '◌' }[stage.status] || '?';
      const elapsed = stage.startTime && stage.endTime ? `${stage.endTime - stage.startTime}ms` : '';
      console.log(`  ${icon} ${stage.label}: ${stage.status} ${elapsed} ${stage.error || ''}`);
    }
  }
  console.log(`${'═'.repeat(50)}\n`);
}

async function main() {
  const [,, cmd, ...args] = process.argv;

  if (cmd === 'send') {
    const msg = args.join(' ');
    if (!msg) { console.log('用法: bun run scripts/test-pipeline.ts send "消息内容"'); return; }
    console.log(`📤 发送: "${msg}"`);
    const { commandId } = await sendCommand({ command: 'send', payload: { message: msg } });
    console.log(`⏳ 等待响应 (ID: ${commandId})...`);
    const result = await waitResult(commandId);
    printResult(result);
  }
  else if (cmd === 'loop') {
    for (const msg of args) {
      console.log(`📤 发送: "${msg}"`);
      const { commandId } = await sendCommand({ command: 'send', payload: { message: msg } });
      console.log(`⏳ 等待响应...`);
      const result = await waitResult(commandId);
      printResult(result);
    }
  }
  else if (cmd === 'status') {
    const res = await fetch(`${BASE}/status`);
    const data = await res.json();
    console.log('📊 当前状态:', JSON.stringify(data, null, 2));
  }
  else if (cmd === 'test') {
    console.log('🧪 触发全流程测试...');
    const { commandId } = await sendCommand({ command: 'test', payload: {} });
    console.log(`⏳ 等待测试完成 (ID: ${commandId})...`);
    const result = await waitResult(commandId, 120_000);
    if (result.error) {
      console.log(`\n❌ 测试失败: ${result.error}\n`);
    } else if (result.testResults) {
      console.log(`\n${'═'.repeat(50)}`);
      const results = result.testResults;
      const passed = results.filter((r: any) => r.pass).length;
      const failed = results.filter((r: any) => !r.pass).length;
      for (const r of results) {
        const icon = r.pass ? '✅' : '❌';
        console.log(`${icon} ${r.step}: ${r.detail}`);
      }
      console.log(`${'═'.repeat(50)}`);
      console.log(`📊 总计: ${passed} 通过, ${failed} 失败, 共 ${results.length} 项`);
    }
  }
  else {
    console.log(`世界漫游指南 - 管线测试CLI

用法:
  bun run scripts/test-pipeline.ts send "消息"    发送单条测试消息
  bun run scripts/test-pipeline.ts loop "m1" "m2"  连续发送多条消息
  bun run scripts/test-pipeline.ts test            运行全流程E2E测试
  bun run scripts/test-pipeline.ts status          查看当前状态

示例:
  bun run scripts/test-pipeline.ts send "你好，我想开始冒险"
  bun run scripts/test-pipeline.ts send "我选择成为一名勇者"
  bun run scripts/test-pipeline.ts loop "你好" "我是勇者" "看看周围"`);
  }
}

main().catch(console.error);
