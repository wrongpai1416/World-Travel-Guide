import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Pencil, Copy, RefreshCw, ArrowLeftToLine, Trash2 } from 'lucide-react';
import { useUISettings } from '../../../context/UISettingsContext';
import { useIsMobile } from '../../../hooks/useIsMobile';
import type { ChatMessage } from '../../../engine/types';
import type { WorldSystemData, DiceRoll } from '../../../modules/schema';
import ReasoningBlock from './ReasoningBlock';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import InlineDiceCard from './InlineDiceCard';
import { parseContent, createIframeSrcDoc } from '../../../utils/markdown';
import { getEnabledTextColorizationRules } from '../../../utils/text-colorization';
import { processRegexScripts } from '../../../utils/regexScripts';
import { getBuiltinDisplayScripts } from '../../../data/builtinPresets';

interface Props {
  message: ChatMessage;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onResend: (id: string) => void;
  onResendFromHere: (id: string) => void;
  onCopy: (text: string) => void;
  onOptionClick?: (optionText: string) => void;
  /** 世界系统数据（用于内联骰子卡片） */
  worldSystem?: WorldSystemData | null;
  /** 骰子掷骰结果回调 */
  onDiceRoll?: (roll: DiceRoll) => void;
}

export default function MessageBubble({ message, onDelete, onEdit, onResend, onResendFromHere, onCopy, onOptionClick, worldSystem, onDiceRoll }: Props) {
  const [showThinking, setShowThinking] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === 'user';
  const { t } = useUISettings();
  const isMobile = useIsMobile(640);

  // ─── 渲染管线 ────────────────────────────────────────
  const colorizationRules = useMemo(() => getEnabledTextColorizationRules(), []);
  const displayScripts = useMemo(() => getBuiltinDisplayScripts(), []);

  const renderedContent = useMemo(() => {
    if (isUser) return null; // 用户消息不走渲染管线
    const text = message.content ?? '';
    if (!text) return { type: 'html' as const, content: '' };
    // 渲染前用正则脚本清理 AI 元数据标签（思维链/摘要/安全声明等）
    const cleaned = processRegexScripts(text, displayScripts);
    if (!cleaned.trim()) return { type: 'html' as const, content: '' };
    return parseContent(cleaned, {
      isStreaming: !!message.streaming,
      textColorizationRules: colorizationRules,
    });
  }, [isUser, message.content, message.streaming, colorizationRules, displayScripts]);

  // iframe 高度自适应
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (renderedContent?.type !== 'iframe') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'iframe-resize' && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [renderedContent?.type]);

  // ─── 内联骰子卡片 Portal 挂载 ────────────────────────
  const messageHtmlRef = useRef<HTMLDivElement>(null);
  const diceRootsRef = useRef<Root[]>([]);

  useEffect(() => {
    // 清理旧的 React roots
    diceRootsRef.current.forEach(root => {
      try { root.unmount(); } catch { /* ignore */ }
    });
    diceRootsRef.current = [];

    if (!messageHtmlRef.current || isUser || !worldSystem?.骰子检定 || message.streaming) return;

    const placeholders = messageHtmlRef.current.querySelectorAll('.dice-roll-placeholder');
    if (placeholders.length === 0) return;

    // 动态导入 React 组件（避免循环依赖）
    const mountDiceCards = async () => {
      const { default: InlineDiceCardComponent } = await import('./InlineDiceCard');

      placeholders.forEach(el => {
        const attr = el.getAttribute('data-attr') || '';
        const dc = Number(el.getAttribute('data-dc')) || 10;
        const container = document.createElement('div');
        el.replaceWith(container);
        const root = createRoot(container);
        root.render(
          <InlineDiceCardComponent
            attr={attr}
            dc={dc}
            statData={worldSystem.数值属性}
            onRoll={onDiceRoll}
          />
        );
        diceRootsRef.current.push(root);
      });
    };

    mountDiceCards();

    return () => {
      diceRootsRef.current.forEach(root => {
        try { root.unmount(); } catch { /* ignore */ }
      });
      diceRootsRef.current = [];
    };
  }, [renderedContent, worldSystem, onDiceRoll, isUser, message.streaming]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleEdit = useCallback(() => {
    // 编辑时显示原始全文（含 thinking/summary 等标签），方便查看和修改
    setEditText(message.content);
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [message.content]);

  const handleEditConfirm = useCallback(() => {
    if (editText.trim() !== message.content) {
      onEdit(message.id, editText.trim());
    }
    setEditing(false);
  }, [editText, message.id, message.content, onEdit]);

  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditConfirm();
    }
    if (e.key === 'Escape') {
      handleEditCancel();
    }
  }, [handleEditConfirm, handleEditCancel]);

  const menuItems: ContextMenuItem[] = [
    {
      label: '编辑消息',
      icon: <Pencil size={14} />,
      action: handleEdit,
    },
    {
      label: '复制内容',
      icon: <Copy size={14} />,
      action: () => onCopy(isUser ? message.content : processRegexScripts(message.content, displayScripts)),
    },
    ...(isUser ? [{
      label: '重新发送',
      icon: <RefreshCw size={14} />,
      action: () => onResend(message.id),
    }] : []),
    ...(!isUser && !message.streaming ? [{
      label: '从此处重新开始',
      icon: <ArrowLeftToLine size={14} />,
      action: () => onResendFromHere(message.id),
    }] : []),
    ...(isUser ? [{
      label: '删除消息',
      icon: <Trash2 size={14} />,
      action: () => onDelete(message.id),
      danger: true,
    }] : []),
  ];

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div
        style={{
          width: isUser ? undefined : (isMobile ? '92%' : '75%'),
          maxWidth: isUser ? (isMobile ? '95%' : '80%') : undefined,
          padding: isMobile ? '0.625rem 0.875rem' : '0.75rem 1rem',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? 'var(--accent)' : 'var(--bg-secondary)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border)',
          position: 'relative',
          wordBreak: 'break-word',
          lineHeight: 'var(--body-line-height, 1.8)',
          fontSize: 'var(--body-font-size)',
          fontFamily: 'var(--font-family)',
        }}
        onContextMenu={handleContextMenu}
      >
        {/* 思维链 */}
        {message.thinking && !editing && (
          <ReasoningBlock
            reasoning={message.thinking}
            expanded={showThinking}
            onToggle={() => setShowThinking(!showThinking)}
          />
        )}

        {/* 编辑模式 */}
        {editing ? (
          <div style={{ width: '100%' }}>
            <textarea
              ref={editRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              style={{
                width: '100%',
                minHeight: '200px',
                maxHeight: '60vh',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--body-font-size)',
                fontFamily: 'var(--font-family)',
                lineHeight: 'var(--body-line-height, 1.8)',
                resize: 'vertical',
                outline: 'none',
                whiteSpace: 'pre-wrap',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '6px',
              marginTop: '6px',
            }}>
              <button
                onClick={handleEditCancel}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >{t('common.cancel')}</button>
              <button
                onClick={handleEditConfirm}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >{t('common.save')}</button>
            </div>
          </div>
        ) : (
          <>
            {/* 正文 —— Markdown 渲染管线 */}
            {isUser ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>
            ) : renderedContent?.type === 'iframe' ? (
              <iframe
                ref={iframeRef}
                className="message-renderer-iframe"
                srcDoc={createIframeSrcDoc(renderedContent.content)}
                sandbox="allow-same-origin allow-scripts"
                loading="lazy"
                style={{
                  width: '100%',
                  minHeight: '360px',
                  border: 'none',
                  background: 'transparent',
                }}
              />
            ) : (
              <>
                {renderedContent?.content ? (
                  <div
                    ref={messageHtmlRef}
                    className="message-html-content"
                    dangerouslySetInnerHTML={{ __html: renderedContent.content }}
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement

                      // 代码块复制按钮（事件委托，替代 inline onclick 防止 XSS）
                      const copyBtn = target.closest('[data-action="copy-code"]') as HTMLButtonElement | null
                      if (copyBtn) {
                        e.preventDefault()
                        e.stopPropagation()
                        const wrapper = copyBtn.closest('.code-block-wrapper')
                        const code = wrapper?.querySelector('code')
                        if (code) {
                          navigator.clipboard.writeText(code.textContent || '').then(() => {
                            copyBtn.textContent = '已复制!'
                            setTimeout(() => { copyBtn.textContent = '复制' }, 2000)
                          }).catch(() => {
                            copyBtn.textContent = '失败'
                            setTimeout(() => { copyBtn.textContent = '复制' }, 2000)
                          })
                        }
                        return
                      }

                      // 行动选项点击
                      const optionEl = target.closest('.action-option-card') as HTMLElement
                      if (optionEl && onOptionClick) {
                        const optionText = optionEl.getAttribute('data-option-text')
                        if (optionText) {
                          onOptionClick(optionText)
                        }
                      }
                    }}
                  />
                ) : message.streaming && !message.content ? (
                  <span style={{ opacity: 0.5 }}>{t('chat.thinking')}</span>
                ) : null}
                {message.streaming && (
                  <span style={{ animation: 'blink 1s infinite', marginLeft: '2px' }}>▋</span>
                )}
              </>
            )}

          </>
        )}

        {/* 悬停操作按钮 */}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
