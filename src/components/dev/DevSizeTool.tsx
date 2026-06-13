import { useState, useEffect, useRef, useCallback } from 'react';
import { Ruler, X, Download, MousePointer, Check, Undo2, ChevronDown, ChevronUp, Eye, RotateCcw } from 'lucide-react';

// ─── 类型 ───

interface SizeChange {
  id: number;
  selector: string;
  property: string;
  oldValue: string;
  newValue: string;
  element: string;
}

interface ElementInfo {
  el: HTMLElement;
  rect: DOMRect;
  computed: CSSStyleDeclaration;
  selector: string;
  description: string;
}

// ─── 全局：追踪被工具修改过的元素 ───
// key = HTMLElement, value = 修改前的 inline style 值
const modifiedElements = new WeakMap<HTMLElement, Record<string, string>>();

// ─── 工具函数 ───

function getSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(c => !c.startsWith('dev-'));
    if (classes.length > 0) return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
  }
  const path: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    const parent = cur.parentElement;
    if (parent) {
      const idx = Array.from(parent.children).indexOf(cur) + 1;
      path.unshift(`${cur.tagName.toLowerCase()}:nth-child(${idx})`);
    }
    cur = parent;
  }
  return path.join(' > ');
}

function getDescription(el: HTMLElement): string {
  const text = el.textContent?.trim().slice(0, 25) || '';
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? `.${el.className.trim().split(/\s+/)[0]}` : '';
  return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}..."` : ''}`;
}

/** 获取元素在工具修改前的"真实"原始值 */
function getOriginalValue(el: HTMLElement, prop: string): string {
  // 先检查是否有记录的原始 inline 值
  const saved = modifiedElements.get(el);
  if (saved && prop in saved) {
    // 临时移除当前 inline 值，读取 CSS 计算值，再恢复
    const currentInline = el.style.getPropertyValue(prop);
    el.style.removeProperty(prop);
    const computed = window.getComputedStyle(el).getPropertyValue(prop);
    if (currentInline) el.style.setProperty(prop, currentInline);
    return computed || '';
  }
  // 没被工具修改过，直接返回 computed
  return window.getComputedStyle(el).getPropertyValue(prop) || '';
}

const EDITABLE_PROPS = [
  { key: 'width', label: '宽度' },
  { key: 'height', label: '高度' },
  { key: 'minWidth', label: '最小宽度' },
  { key: 'maxWidth', label: '最大宽度' },
  { key: 'minHeight', label: '最小高度' },
  { key: 'maxHeight', label: '最大高度' },
  { key: 'padding', label: '内距' },
  { key: 'paddingTop', label: '上内距' },
  { key: 'paddingRight', label: '右内距' },
  { key: 'paddingBottom', label: '下内距' },
  { key: 'paddingLeft', label: '左内距' },
  { key: 'margin', label: '外距' },
  { key: 'marginTop', label: '上外距' },
  { key: 'marginRight', label: '右外距' },
  { key: 'marginBottom', label: '下外距' },
  { key: 'marginLeft', label: '左外距' },
  { key: 'fontSize', label: '字号' },
  { key: 'lineHeight', label: '行高' },
  { key: 'gap', label: '间距(gap)' },
  { key: 'borderRadius', label: '圆角' },
  { key: 'overflow', label: '溢出' },
  { key: 'overflowY', label: '纵向溢出' },
];

// ─── 主组件 ───

export default function DevSizeTool() {
  const [active, setActive] = useState(false);
  const [hoveredEl, setHoveredEl] = useState<ElementInfo | null>(null);
  const [selectedEl, setSelectedEl] = useState<ElementInfo | null>(null);
  const [changes, setChanges] = useState<SizeChange[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  // 编辑值（用户在输入框里打的字）
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  // 原始值（工具修改前的真实 CSS 值）
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  // 当前正在预览的属性
  const [previewingProp, setPreviewingProp] = useState<string | null>(null);
  // 已确认的属性（这些属性的 inline style 是工具设置的）
  const [confirmedProps, setConfirmedProps] = useState<Set<string>>(new Set());

  const [showChangesList, setShowChangesList] = useState(false);
  const changeIdRef = useRef(0);

  // 切换激活
  const toggleActive = useCallback(() => {
    if (active) {
      // 退出时撤销当前预览（但保留已确认的）
      if (selectedEl && previewingProp && !confirmedProps.has(previewingProp)) {
        selectedEl.el.style.removeProperty(previewingProp);
      }
      setActive(false);
      setHoveredEl(null);
      setSelectedEl(null);
      setShowPanel(false);
      setPreviewingProp(null);
    } else {
      setActive(true);
    }
  }, [active, selectedEl, previewingProp, confirmedProps]);

  const getElementInfo = useCallback((el: HTMLElement): ElementInfo => {
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    return { el, rect, computed, selector: getSelector(el), description: getDescription(el) };
  }, []);

  // 选中元素时，读取"真实"原始值
  const readOriginalValues = useCallback((el: HTMLElement): Record<string, string> => {
    const result: Record<string, string> = {};
    EDITABLE_PROPS.forEach(prop => {
      result[prop.key] = getOriginalValue(el, prop.key);
    });
    return result;
  }, []);

  // 鼠标事件
  useEffect(() => {
    if (!active) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.dev-size-tool')) return;
      setHoveredEl(getElementInfo(target));
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.dev-size-tool')) return;
      e.preventDefault();
      e.stopPropagation();

      // 撤销上一个元素的未确认预览
      if (selectedEl && previewingProp && !confirmedProps.has(previewingProp)) {
        selectedEl.el.style.removeProperty(previewingProp);
      }

      const info = getElementInfo(target);
      setSelectedEl(info);
      setShowPanel(true);
      setPreviewingProp(null);

      // 读取真实原始值
      const originals = readOriginalValues(target);
      setOriginalValues(originals);

      // 读取当前显示值（含 inline style）
      const current: Record<string, string> = {};
      EDITABLE_PROPS.forEach(prop => {
        current[prop.key] = info.computed.getPropertyValue(prop.key) || '';
      });
      setEditValues(current);

      // 检测哪些属性是工具之前确认过的
      const confirmed = new Set<string>();
      EDITABLE_PROPS.forEach(prop => {
        const saved = modifiedElements.get(target);
        if (saved && prop.key in saved) confirmed.add(prop.key);
      });
      setConfirmedProps(confirmed);
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [active, getElementInfo, selectedEl, previewingProp, confirmedProps, readOriginalValues]);

  // 预览：临时应用样式
  const handlePreview = useCallback((prop: string) => {
    if (!selectedEl) return;
    const value = editValues[prop];

    // 如果有上一个未确认的预览，先撤销
    if (previewingProp && previewingProp !== prop && !confirmedProps.has(previewingProp)) {
      selectedEl.el.style.removeProperty(previewingProp);
    }

    // 记录原始 inline 值（只在第一次修改时记录）
    if (!modifiedElements.has(selectedEl.el)) {
      const origInline: Record<string, string> = {};
      EDITABLE_PROPS.forEach(p => {
        const v = selectedEl.el.style.getPropertyValue(p.key);
        if (v) origInline[p.key] = v;
      });
      modifiedElements.set(selectedEl.el, origInline);
    }

    // 应用预览
    selectedEl.el.style.setProperty(prop, value);
    setPreviewingProp(prop);

    // 刷新选中框
    requestAnimationFrame(() => {
      const rect = selectedEl.el.getBoundingClientRect();
      setSelectedEl(prev => prev ? { ...prev, rect } : null);
    });
  }, [selectedEl, editValues, previewingProp, confirmedProps]);

  // 确认改动
  const handleConfirm = useCallback((prop: string) => {
    if (!selectedEl) return;
    const newVal = editValues[prop];
    const oldVal = originalValues[prop];
    if (newVal === oldVal && !confirmedProps.has(prop)) return;

    const id = ++changeIdRef.current;
    setChanges(prev => [...prev, {
      id,
      selector: selectedEl.selector,
      property: prop,
      oldValue: oldVal || '(computed)',
      newValue: newVal,
      element: selectedEl.description,
    }]);
    setConfirmedProps(prev => new Set(prev).add(prop));
    setPreviewingProp(null);
  }, [selectedEl, editValues, originalValues, confirmedProps]);

  // 撤销单个属性
  const handleCancel = useCallback((prop: string) => {
    if (!selectedEl) return;
    // 恢复到原始 inline 值
    const saved = modifiedElements.get(selectedEl.el);
    const origInline = saved?.[prop];
    if (origInline) {
      selectedEl.el.style.setProperty(prop, origInline);
    } else {
      selectedEl.el.style.removeProperty(prop);
    }
    // 重新读取
    const computed = window.getComputedStyle(selectedEl.el);
    setEditValues(prev => ({ ...prev, [prop]: computed.getPropertyValue(prop) || '' }));
    if (previewingProp === prop) setPreviewingProp(null);
    setConfirmedProps(prev => {
      const next = new Set(prev);
      next.delete(prop);
      return next;
    });
    // 刷新选中框
    requestAnimationFrame(() => {
      const rect = selectedEl.el.getBoundingClientRect();
      setSelectedEl(prev => prev ? { ...prev, rect } : null);
    });
    // 从改动记录中移除
    setChanges(prev => prev.filter(c => !(c.selector === selectedEl.selector && c.property === prop)));
  }, [selectedEl, previewingProp]);

  // 重置选中元素的所有工具修改
  const handleResetSelected = useCallback(() => {
    if (!selectedEl) return;
    const saved = modifiedElements.get(selectedEl.el);
    // 移除所有工具设置的 inline style
    EDITABLE_PROPS.forEach(prop => {
      selectedEl.el.style.removeProperty(prop.key);
      // 恢复原始 inline 值
      if (saved?.[prop.key]) {
        selectedEl.el.style.setProperty(prop.key, saved[prop.key]);
      }
    });
    modifiedElements.delete(selectedEl.el);
    // 重新读取
    const computed = window.getComputedStyle(selectedEl.el);
    const values: Record<string, string> = {};
    EDITABLE_PROPS.forEach(prop => {
      values[prop.key] = computed.getPropertyValue(prop.key) || '';
    });
    setEditValues(values);
    setOriginalValues(readOriginalValues(selectedEl.el));
    setConfirmedProps(new Set());
    setPreviewingProp(null);
    // 从改动记录中移除
    setChanges(prev => prev.filter(c => c.selector !== selectedEl.selector));
    // 刷新选中框
    requestAnimationFrame(() => {
      const rect = selectedEl.el.getBoundingClientRect();
      setSelectedEl(prev => prev ? { ...prev, rect } : null);
    });
  }, [selectedEl, readOriginalValues]);

  // 删除单条改动记录
  const deleteChange = useCallback((id: number) => {
    setChanges(prev => prev.filter(c => c.id !== id));
  }, []);

  // 导出
  const exportChanges = useCallback(() => {
    if (changes.length === 0) return;
    const grouped: Record<string, SizeChange[]> = {};
    changes.forEach(c => {
      if (!grouped[c.selector]) grouped[c.selector] = [];
      grouped[c.selector].push(c);
    });

    let output = '/* ═══ DevSizeTool 导出 ═══\n';
    output += `   共 ${changes.length} 处改动\n`;
    output += `   时间: ${new Date().toLocaleString()}\n`;
    output += '   ═══ */\n\n';

    for (const [selector, items] of Object.entries(grouped)) {
      output += `/* ${items[0].element} */\n`;
      output += `${selector} {\n`;
      items.forEach(c => { output += `  ${c.property}: ${c.newValue};  /* was: ${c.oldValue} */\n`; });
      output += '}\n\n';
    }

    output += '\n/* ═══ TSX 内联 style 格式 ═══ */\n\n';
    for (const [selector, items] of Object.entries(grouped)) {
      output += `// ${items[0].element}\nstyle={{ `;
      output += items.map(c => {
        const camel = c.property.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        return `${camel}: '${c.newValue}'`;
      }).join(', ');
      output += ' }}\n\n';
    }

    navigator.clipboard.writeText(output).then(() => {
      alert(`已复制 ${changes.length} 处改动到剪贴板！\n粘贴给女儿~`);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('已复制到剪贴板！');
    });
  }, [changes]);

  return (
    <>
      {/* ── 浮动按钮 ── */}
      <button className="dev-size-tool" onClick={toggleActive}
        title="尺寸调试 (Ctrl+Shift+D)" style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999,
          width: '44px', height: '44px', borderRadius: '50%',
          border: '2px solid ' + (active ? '#ef4444' : 'var(--accent)'),
          background: active ? '#ef4444' : 'var(--bg-secondary)',
          color: active ? '#fff' : 'var(--accent)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'all 0.2s',
        }}>
        {active ? <X size={20} /> : <Ruler size={20} />}
      </button>

      {/* ── 状态栏 ── */}
      {active && (
        <div className="dev-size-tool" style={{
          position: 'fixed', bottom: '72px', right: '20px', zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', color: '#fff',
          padding: '8px 14px', borderRadius: '8px',
          fontSize: '12px', fontFamily: 'monospace', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <MousePointer size={14} />
          <span>点击选中 · Esc 退出</span>
          {changes.length > 0 && <span style={{ color: '#f59e0b' }}>({changes.length})</span>}
        </div>
      )}

      {/* ── 悬停高亮 ── */}
      {active && hoveredEl && !selectedEl && (
        <div className="dev-size-tool" style={{
          position: 'fixed', top: hoveredEl.rect.top, left: hoveredEl.rect.left,
          width: hoveredEl.rect.width, height: hoveredEl.rect.height,
          border: '2px dashed #3b82f6', background: 'rgba(59,130,246,0.08)',
          pointerEvents: 'none', zIndex: 99998,
        }}>
          <div style={{
            position: 'absolute', top: '-22px', left: 0,
            background: '#3b82f6', color: '#fff', padding: '2px 6px',
            borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap',
          }}>
            {Math.round(hoveredEl.rect.width)} × {Math.round(hoveredEl.rect.height)}
          </div>
        </div>
      )}

      {/* ── 选中高亮 ── */}
      {active && selectedEl && (
        <div className="dev-size-tool" style={{
          position: 'fixed',
          top: selectedEl.rect.top, left: selectedEl.rect.left,
          width: selectedEl.rect.width, height: selectedEl.rect.height,
          border: '2px solid #ef4444', background: 'rgba(239,68,68,0.05)',
          pointerEvents: 'none', zIndex: 99998,
        }}>
          <div style={{
            position: 'absolute', top: '-22px', left: 0,
            background: '#ef4444', color: '#fff', padding: '2px 6px',
            borderRadius: '3px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap',
          }}>
            {Math.round(selectedEl.rect.width)} × {Math.round(selectedEl.rect.height)}
          </div>
        </div>
      )}

      {/* ── 编辑面板 ── */}
      {showPanel && selectedEl && (
        <div className="dev-size-tool" style={{
          position: 'fixed', top: '50%', right: '20px', transform: 'translateY(-50%)',
          width: '400px', maxHeight: '85vh',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 100000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* 头部 */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>📐 尺寸编辑器</div>
              <div style={{
                fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px',
                maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{selectedEl.description}</div>
            </div>
            <button onClick={handleResetSelected} title="重置此元素所有修改" style={{
              width: '30px', height: '30px', border: '1px solid var(--border)',
              borderRadius: '6px', background: 'var(--bg-primary)', color: '#ef4444',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><RotateCcw size={14} /></button>
            <button onClick={() => {
              if (previewingProp && !confirmedProps.has(previewingProp)) selectedEl.el.style.removeProperty(previewingProp);
              setShowPanel(false); setSelectedEl(null); setPreviewingProp(null);
            }} style={{
              width: '30px', height: '30px', border: '1px solid var(--border)',
              borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={14} /></button>
          </div>

          {/* 实时尺寸 */}
          <div style={{
            padding: '8px 16px', background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)',
            display: 'flex', gap: '16px', flexShrink: 0,
          }}>
            <span>w: <b>{Math.round(selectedEl.rect.width)}</b>px</span>
            <span>h: <b>{Math.round(selectedEl.rect.height)}</b>px</span>
            <span>fs: <b>{selectedEl.computed.fontSize}</b></span>
          </div>

          {/* 说明 */}
          <div style={{
            padding: '6px 16px', background: 'var(--accent-dim)',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px', color: 'var(--accent)', flexShrink: 0,
          }}>
            💡 改值 → 👁预览 → ✓确认记录 · ↩撤销恢复 · 🔄重置全部
          </div>

          {/* 属性列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {EDITABLE_PROPS.map(prop => {
              const val = editValues[prop.key] || '';
              const orig = originalValues[prop.key] || '';
              const isChanged = val !== orig;
              const isPreviewing = previewingProp === prop.key;
              const isConfirmed = confirmedProps.has(prop.key);

              return (
                <div key={prop.key} style={{
                  display: 'flex', alignItems: 'center', padding: '3px 10px', gap: '4px',
                  background: isPreviewing ? 'var(--accent-dim)' : 'transparent',
                  borderLeft: isConfirmed ? '3px solid #22c55e' : '3px solid transparent',
                }}>
                  <label style={{
                    width: '68px', fontSize: '11px', flexShrink: 0,
                    color: isConfirmed ? '#22c55e' : isChanged ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: isConfirmed || isChanged ? '600' : '400',
                  }}>
                    {prop.label}
                  </label>
                  <input type="text" value={val}
                    onChange={e => setEditValues(prev => ({ ...prev, [prop.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handlePreview(prop.key); }}
                    placeholder={orig || '-'}
                    style={{
                      flex: 1, padding: '3px 6px',
                      border: `1px solid ${isChanged ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '4px', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '11px',
                      fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  {/* 👁 预览 */}
                  <button onClick={() => handlePreview(prop.key)} title="预览" style={{
                    width: '26px', height: '26px', border: 'none', borderRadius: '4px',
                    background: isPreviewing ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: isPreviewing ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}><Eye size={12} /></button>
                  {/* ✓ 确认 */}
                  <button onClick={() => handleConfirm(prop.key)} title="确认记录" style={{
                    width: '26px', height: '26px', border: 'none', borderRadius: '4px',
                    background: isConfirmed ? '#22c55e' : 'var(--bg-tertiary)',
                    color: isConfirmed ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}><Check size={12} /></button>
                  {/* ↩ 撤销 */}
                  <button onClick={() => handleCancel(prop.key)} title="撤销此属性" style={{
                    width: '26px', height: '26px', border: 'none', borderRadius: '4px',
                    background: 'var(--bg-tertiary)',
                    color: isChanged ? 'var(--text-secondary)' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, opacity: isChanged ? 1 : 0.4,
                  }}><Undo2 size={12} /></button>
                </div>
              );
            })}
          </div>

          {/* 已记录改动 */}
          <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => setShowChangesList(!showChangesList)} style={{
              width: '100%', padding: '8px 16px', border: 'none',
              background: 'var(--bg-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '12px', color: 'var(--text-secondary)',
            }}>
              <span>📋 已记录 {changes.length} 处改动</span>
              {showChangesList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showChangesList && changes.length > 0 && (
              <div style={{ maxHeight: '120px', overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                {changes.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '3px 16px', fontSize: '11px', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{c.property}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 3px' }}>:</span>
                      <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '3px' }}>{c.oldValue}</span>
                      <span style={{ color: '#22c55e' }}>→ {c.newValue}</span>
                    </div>
                    <button onClick={() => deleteChange(c.id)} style={{
                      width: '18px', height: '18px', border: 'none', borderRadius: '3px',
                      background: 'transparent', color: 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}><X size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0,
          }}>
            <button onClick={() => setChanges([])} disabled={changes.length === 0} style={{
              padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '6px',
              background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '12px',
              cursor: changes.length > 0 ? 'pointer' : 'not-allowed',
              opacity: changes.length > 0 ? 1 : 0.5,
            }}>清除全部</button>
            <button onClick={exportChanges} disabled={changes.length === 0} style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px',
              background: changes.length > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: changes.length > 0 ? '#fff' : 'var(--text-muted)',
              fontSize: '12px', fontWeight: '600',
              cursor: changes.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}><Download size={13} />导出改动</button>
          </div>
        </div>
      )}

      <style>{`.dev-size-tool * { box-sizing: border-box; }`}</style>
      <KeyboardHandler active={active} onToggle={toggleActive} onEscape={() => {
        if (selectedEl && previewingProp && !confirmedProps.has(previewingProp))
          selectedEl.el.style.removeProperty(previewingProp);
        setActive(false); setShowPanel(false); setSelectedEl(null); setPreviewingProp(null);
      }} />
    </>
  );
}

function KeyboardHandler({ active, onToggle, onEscape }: {
  active: boolean; onToggle: () => void; onEscape: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); onToggle(); }
      if (e.key === 'Escape' && active) onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onToggle, onEscape]);
  return null;
}
