import { useState, useCallback } from 'react';
import { X, ExternalLink, Copy, Check, ChevronRight, ChevronDown, Shield, Zap, Globe, Server, Rocket, Target, HelpCircle, Lightbulb, Link, Clipboard, Save, GitBranch, BarChart, Sparkles, AlertTriangle, Info, CheckCircle, XCircle, BookOpen } from 'lucide-react';

interface Props {
  onClose: () => void;
  onApplyProxy: (url: string) => void;
}

interface StepItem {
  text: string;
  link?: string;
  tip?: string;
  example?: string;
  code?: boolean;
}

interface TutorialStep {
  id: string;
  title: string;
  icon: any;
  content: {
    problem?: string;
    solution?: string;
    diagram?: string;
    safety?: string;
    steps?: StepItem[];
  };
}

// 教程步骤数据
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'intro',
    title: '什么是代理？为什么需要它？',
    icon: Globe,
    content: {
      problem: '浏览器有安全限制（CORS），不允许网页直接调用某些 API 服务。',
      solution: '代理就像一个"快递员"，帮你在浏览器和 API 之间传话。',
      diagram: `
┌──────────┐      ┌──────────┐      ┌──────────┐
│  浏览器   │ ──→  │  代理    │ ──→  │  API     │
│ (你的网页) │ ←──  │ (中转站) │ ←──  │ (OpenAI) │
└──────────┘      └──────────┘      └──────────┘
      `,
      safety: '代理只做转发，不存储任何数据\n你自己部署，完全可控\nAPI Key 不会被任何人看到',
    },
  },
  {
    id: 'register',
    title: '第一步：注册 Cloudflare 账号',
    icon: Shield,
    content: {
      steps: [
        {
          text: '打开浏览器，访问 cloudflare.com',
          link: 'https://cloudflare.com',
        },
        {
          text: '点击右上角的 "Sign Up"（注册）按钮',
        },
        {
          text: '输入你的邮箱和密码',
          tip: '建议使用常用邮箱，方便找回密码',
        },
        {
          text: '验证邮箱：去邮箱收验证邮件，点击链接完成验证',
          tip: '如果没收到，检查垃圾邮件文件夹',
        },
        {
          text: '注册完成！建议切换到中文界面（右上角语言设置）',
          tip: '中文界面更容易找到对应功能',
        },
      ] as StepItem[],
    },
  },
  {
    id: 'create-worker',
    title: '第二步：创建 Worker',
    icon: Server,
    content: {
      steps: [
        {
          text: '登录 Cloudflare Dashboard',
          link: 'https://dash.cloudflare.com',
        },
        {
          text: '在左侧菜单找到「计算」，点击展开',
          tip: 'Workers 和 Pages 都在「计算」菜单下面',
        },
        {
          text: '点击「Workers & Pages」进入',
        },
        {
          text: '点击右上角蓝色的「创建」按钮',
        },
        {
          text: '选择「从 Hello World 开始」',
          tip: '不要选 Pages！Pages 是用来托管网站的',
        },
        {
          text: '给你的 Worker 起个名字',
          tip: '比如：api-proxy、my-proxy、cors-helper 等\n名字会成为 URL 的一部分',
          example: 'https://api-proxy.你的用户名.workers.dev',
        },
        {
          text: '点击「部署」按钮，先创建一个默认的 Worker',
          tip: '别担心，我们马上会替换里面的代码',
        },
        {
          text: '如果看到红色报错，不用管！直接刷新页面',
          tip: '这是正常现象，刷新后就能正常操作了',
        },
      ] as StepItem[],
    },
  },
  {
    id: 'paste-code',
    title: '第三步：粘贴代理代码',
    icon: Zap,
    content: {
      steps: [
        {
          text: '刷新页面后，点击「编辑代码」按钮',
        },
        {
          text: '你会看到一个代码编辑器，里面有一些默认代码',
        },
        {
          text: '全选所有代码（Ctrl+A），然后删除',
        },
        {
          text: '复制下面的代理代码，粘贴进去',
          code: true,
        },
        {
          text: '点击右上角的「部署」按钮',
          tip: '代码会自动保存并部署',
        },
        {
          text: '部署成功后，回到「Workers & Pages」页面',
        },
      ] as StepItem[],
    },
  },
  {
    id: 'get-url',
    title: '第四步：获取你的代理地址',
    icon: ExternalLink,
    content: {
      steps: [
        {
          text: '回到「Workers & Pages」页面',
        },
        {
          text: '找到你刚才创建的 Worker',
        },
        {
          text: '在详情页找到「URL」或「路由」',
          tip: '格式类似：https://api-proxy.xxx.workers.dev',
        },
        {
          text: '点击复制按钮，复制这个 URL',
          tip: '这就是你的专属代理地址！',
        },
      ] as StepItem[],
    },
  },
  {
    id: 'use',
    title: '第五步：在应用中使用',
    icon: Check,
    content: {
      steps: [
        {
          text: '回到这个应用的设置页面',
        },
        {
          text: '找到「代理地址」输入框',
        },
        {
          text: '粘贴你刚才复制的 Worker URL',
        },
        {
          text: '点击「测试连接」验证是否正常工作',
          tip: '如果显示「连接成功」就说明代理工作正常！',
        },
        {
          text: '保存设置，大功告成！',
          tip: '以后遇到 CORS 错误，应用会自动使用代理',
        },
      ] as StepItem[],
    },
  },
];

// 代理代码
const PROXY_CODE = `export default {
  async fetch(request) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 从请求头获取目标 URL
    const targetUrl = request.headers.get('X-Target-URL');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({
          error: 'Missing X-Target-URL header',
          usage: 'Set X-Target-URL header to the target API endpoint',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 构建转发请求
    const headers = new Headers();
    for (const [key, value] of request.headers) {
      // 跳过 Worker 相关的头
      if (key.startsWith('cf-') || key === 'x-target-url' || key === 'host') {
        continue;
      }
      headers.set(key, value);
    }

    try {
      // 转发请求到目标 API
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // 构建响应，添加 CORS 头
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Proxy request failed',
          message: error.message,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};`;

export default function ProxyTutorialOverlay({ onClose, onApplyProxy }: Props) {
  const [expandedStep, setExpandedStep] = useState<string | null>('intro');
  const [copiedCode, setCopiedCode] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(PROXY_CODE).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  }, []);

  const handleApply = useCallback(() => {
    if (proxyUrl.trim()) {
      onApplyProxy(proxyUrl.trim());
      onClose();
    }
  }, [proxyUrl, onApplyProxy, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary, #0f0f1a)',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          borderRadius: '16px',
          width: '95%',
          maxWidth: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'dialogSlideIn 0.3s ease',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Rocket size={20} />
              代理部署教程
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              解决网页端 CORS 问题，5 分钟搞定！
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px 24px',
          }}
        >
          {/* 概述卡片 */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Shield size={20} color="var(--accent)" />
              <span style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>为什么推荐自己部署？</span>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckCircle size={14} color="var(--success)" />
                <span><strong>完全免费</strong> — Cloudflare 提供每天 10 万次请求的免费额度</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckCircle size={14} color="var(--success)" />
                <span><strong>绝对安全</strong> — 代码开源，你自己部署，API Key 不经过任何人</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckCircle size={14} color="var(--success)" />
                <span><strong>永久有效</strong> — 部署后就不用管了，不会过期</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={14} color="var(--success)" />
                <span><strong>零维护</strong> — 不需要服务器，不需要域名，Cloudflare 全托管</span>
              </div>
            </div>
          </div>

          {/* 教程步骤 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {TUTORIAL_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isExpanded = expandedStep === step.id;

              return (
                <div
                  key={step.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* 步骤标题 */}
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isExpanded ? 'var(--accent)' : 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }}
                    >
                      <Icon size={16} color={isExpanded ? '#fff' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        步骤 {index + 1}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '500' }}>
                        {step.title}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>

                  {/* 步骤内容 */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 16px 16px',
                        animation: 'fadeIn 0.2s ease',
                      }}
                    >
                      {/* 步骤列表 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* 特殊处理 intro 步骤 */}
                        {step.id === 'intro' && step.content && (
                          <>
                            {/* 问题 */}
                            <div
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '8px',
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ fontWeight: '500', marginBottom: '6px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <XCircle size={14} />
                                问题
                              </div>
                              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                {step.content.problem}
                              </div>
                            </div>

                            {/* 解决方案 */}
                            <div
                              style={{
                                background: 'rgba(34, 197, 94, 0.1)',
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                                borderRadius: '8px',
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ fontWeight: '500', marginBottom: '6px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={14} />
                                解决方案
                              </div>
                              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                {step.content.solution}
                              </div>
                            </div>

                            {/* 流程图 */}
                            <div
                              style={{
                                background: 'var(--bg-tertiary)',
                                borderRadius: '8px',
                                padding: '12px',
                                fontFamily: 'monospace',
                                fontSize: 'var(--font-size-sm)',
                                overflow: 'auto',
                                whiteSpace: 'pre',
                                lineHeight: 1.4,
                              }}
                            >
                              {step.content.diagram}
                            </div>

                            {/* 安全说明 */}
                            <div
                              style={{
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                borderRadius: '8px',
                                padding: '12px 14px',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {step.content.safety?.split('\n').map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: i < 2 ? '6px' : 0 }}>
                                  <CheckCircle size={14} color="var(--success)" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* 普通步骤 */}
                        {step.content.steps && step.content.steps.map((s, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: '600',
                                flexShrink: 0,
                                marginTop: '2px',
                              }}
                            >
                              {i + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
                                {s.text}
                                {s.link && (
                                  <>
                                    {' '}
                                    <a
                                      href={s.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: 'var(--accent)',
                                        textDecoration: 'underline',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      打开链接 <ExternalLink size={12} />
                                    </a>
                                  </>
                                )}
                              </div>

                              {/* 提示 */}
                              {s.tip && (
                                <div
                                  style={{
                                    marginTop: '6px',
                                    padding: '8px 10px',
                                    background: 'rgba(234, 179, 8, 0.1)',
                                    border: '1px solid rgba(234, 179, 8, 0.2)',
                                    borderRadius: '6px',
                                    fontSize: 'var(--font-size-xs)',
                                    color: '#eab308',
                                    whiteSpace: 'pre-line',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                  }}
                                >
                                  <Lightbulb size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                                  <span>{s.tip}</span>
                                </div>
                              )}

                              {/* 示例 URL */}
                              {s.example && (
                                <div
                                  style={{
                                    marginTop: '6px',
                                    padding: '8px 10px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '6px',
                                    fontSize: 'var(--font-size-xs)',
                                    fontFamily: 'monospace',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {s.example}
                                </div>
                              )}

                              {/* 代码块 */}
                              {s.code && (
                                <div style={{ marginTop: '10px' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 12px',
                                      background: 'var(--bg-tertiary)',
                                      borderRadius: '8px 8px 0 0',
                                      border: '1px solid var(--border)',
                                      borderBottom: 'none',
                                    }}
                                  >
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                      代理代码（点击复制）
                                    </span>
                                    <button
                                      onClick={handleCopyCode}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        background: copiedCode ? 'rgba(34, 197, 94, 0.2)' : 'var(--accent)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: copiedCode ? '#22c55e' : '#fff',
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {copiedCode ? (
                                        <>
                                          <Check size={14} /> 已复制！
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={14} /> 复制代码
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre
                                    style={{
                                      margin: 0,
                                      padding: '12px',
                                      background: '#1a1a2e',
                                      border: '1px solid var(--border)',
                                      borderRadius: '0 0 8px 8px',
                                      fontSize: 'var(--font-size-xs)',
                                      fontFamily: 'monospace',
                                      overflow: 'auto',
                                      maxHeight: '300px',
                                      lineHeight: 1.5,
                                      color: '#e8e6e3',
                                    }}
                                  >
                                    <code>{PROXY_CODE}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 快速应用区域 */}
          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={16} />
              已经部署好了？直接填入代理地址
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={proxyUrl}
                onChange={e => setProxyUrl(e.target.value)}
                placeholder="https://你的worker名字.workers.dev"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <button
                onClick={handleApply}
                disabled={!proxyUrl.trim()}
                style={{
                  padding: '10px 20px',
                  background: proxyUrl.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: proxyUrl.trim() ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: '600',
                  cursor: proxyUrl.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                应用
              </button>
            </div>
          </div>

          {/* 常见问题 */}
          <div
            style={{
              marginTop: '20px',
              padding: '16px 20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={16} />
              常见问题
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <FAQItem
                question="部署后多久生效？"
                answer="立即生效！保存并部署后就可以使用了。"
              />
              <FAQItem
                question="免费额度够用吗？"
                answer="完全够用！免费额度是每天 10 万次请求，就算每秒发 1 条消息，也只能用 2.7 万次。"
              />
              <FAQItem
                question="API Key 会被泄露吗？"
                answer="不会！代码只做透明转发，不会存储任何数据。而且是你自己部署的，完全可控。"
              />
              <FAQItem
                question="需要维护吗？"
                answer="基本不需要！Worker 是无服务器架构，Cloudflare 负责运维。如果代码需要更新，应用会提示你。"
              />
              <FAQItem
                question="手机能部署吗？"
                answer="可以！Cloudflare Dashboard 是网页版的，手机浏览器也能操作。"
              />
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            borderRadius: '0 0 16px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            关闭教程
          </button>
        </div>
      </div>
    </div>
  );
}

// FAQ 组件
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--bg-tertiary)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: '500',
          textAlign: 'left',
        }}
      >
        <span>{question}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <div
          style={{
            padding: '10px 14px',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {answer}
        </div>
      )}
    </div>
  );
}
