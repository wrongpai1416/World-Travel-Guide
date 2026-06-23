// ============================================================
// Mermaid 图谱面板 — 完全照搬 yijiekkk 项目实现
// 支持平移、缩放、节点交互
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ============================================================
//  类型定义
// ============================================================

export interface NodeDetail {
  title: string;
  typeLabel?: string;
  summary?: string;
  fields?: Array<{ label: string; value: string }>;
  rawLabel?: string;
}

interface MermaidGraphPanelProps {
  graphDefinition: string;
  nodeDetails?: Record<string, NodeDetail>;
  title?: string;
  subtitle?: string;
  highlightNodeId?: string;
  onNodeClick?: (nodeId: string, detail: NodeDetail | undefined) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ============================================================
//  常量
// ============================================================

const MIN_SCALE = 0.3;
const MAX_SCALE = 8.0;
const STEP_SCALE = 1.15;
const SURFACE_PADDING = 40;
const DRAG_THRESHOLD = 4;

// ============================================================
//  Mermaid 初始化（完全照搬 yijiekkk 项目）
// ============================================================

let mermaidInitialized = false;

function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    deterministicIds: false,
    fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
    flowchart: {
      htmlLabels: false,
      curve: 'basis',
    },
    themeVariables: {
      background: 'transparent',
      primaryColor: '#3b82f6',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#93c5fd',
      lineColor: '#94a3b8',
      tertiaryColor: '#f0f4f8',
      clusterBkg: '#ffffff',
      clusterBorder: '#e5e7eb',
      fontSize: 'var(--font-size-md)',
    },
  } as any);
  mermaidInitialized = true;
}

// ============================================================
//  工具函数
// ============================================================

function getNodeKeyFromDomId(domId: string, nodeDetails: Record<string, NodeDetail>): string {
  const safeDomId = String(domId || '').trim();
  if (!safeDomId) return '';

  // 先检查原始 ID
  if (nodeDetails[safeDomId]) return safeDomId;

  // 再检查处理后的 ID（移除 flowchart- 前缀和数字后缀）
  const dataId = safeDomId.replace(/^flowchart-/, '').replace(/-\d+$/, '');
  if (nodeDetails[dataId]) return dataId;

  return '';
}

// ============================================================
//  主组件
// ============================================================

export function MermaidGraphPanel({
  graphDefinition,
  nodeDetails = {},
  title,
  subtitle,
  highlightNodeId,
  onNodeClick,
  className,
  style,
}: MermaidGraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // ─── 平移缩放状态 ───
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  // ─── 渲染状态 ───
  const [renderedSvg, setRenderedSvg] = useState('');
  const [renderError, setRenderError] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });

  // ─── 交互状态 ───
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDetailPopup, setNodeDetailPopup] = useState<{
    nodeId: string;
    detail: NodeDetail;
    x: number;
    y: number;
  } | null>(null);

  // ─── 指针拖拽状态（用 ref 避免 re-render） ───
  const pointerState = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    moved: false,
  });

  // ─── 捏合缩放状态 ───
  const pinchState = useRef({
    active: false,
    startDistance: 0,
    startScale: 1,
  });

  const activePointers = useRef(new Map<number, { x: number; y: number }>());

  // ─── 获取 SVG 实际尺寸（照搬 yijiekkk） ───
  const getGraphMetrics = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (!svgEl) return { width: 0, height: 0 };

    const widthAttr = Number(svgEl.getAttribute('width'));
    const heightAttr = Number(svgEl.getAttribute('height'));
    if (Number.isFinite(widthAttr) && widthAttr > 0 && Number.isFinite(heightAttr) && heightAttr > 0) {
      return { width: widthAttr, height: heightAttr };
    }

    const viewBox = svgEl.viewBox?.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      return { width: viewBox.width, height: viewBox.height };
    }

    const rect = svgEl.getBBox?.();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }

    const domRect = svgEl.getBoundingClientRect();
    return {
      width: domRect.width || 0,
      height: domRect.height || 0,
    };
  }, []);

  // ─── 自动适配视口 ───
  const fitGraphToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const size = graphSize;

    if (!viewportRect.width || !viewportRect.height || !size.width || !size.height) {
      setScale(1.5);
      setTranslateX(SURFACE_PADDING);
      setTranslateY(SURFACE_PADDING);
      return;
    }

    // 计算让图谱填满视口的缩放比例
    const widthRatio = (viewportRect.width - SURFACE_PADDING * 2) / size.width;
    const heightRatio = (viewportRect.height - SURFACE_PADDING * 2) / size.height;
    // 使用较大的比例，确保图谱填满视口
    const fitScale = Math.max(widthRatio, heightRatio);
    // 直接使用计算出的比例，不限制上限
    const nextScale = Math.max(1.0, Math.min(MAX_SCALE, fitScale));

    const totalWidth = size.width * nextScale + SURFACE_PADDING * 2;
    const totalHeight = size.height * nextScale + SURFACE_PADDING * 2;
    const nextX = (viewportRect.width - totalWidth) / 2;
    const nextY = (viewportRect.height - totalHeight) / 2;

    setScale(nextScale);
    setTranslateX(nextX);
    setTranslateY(nextY);
  }, [graphSize]);

  // ─── Mermaid 渲染（照搬 yijiekkk） ───
  const renderId = useRef(0);

  useEffect(() => {
    if (!graphDefinition?.trim()) {
      setRenderedSvg('');
      setRenderError('');
      setGraphSize({ width: 0, height: 0 });
      return;
    }

    let cancelled = false;
    const currentId = ++renderId.current;

    async function render() {
      setIsRendering(true);
      setRenderError('');
      try {
        ensureMermaidInit();
        const id = `mermaid-graph-${currentId}-${Date.now()}`;
        const { svg } = await mermaid.render(id, graphDefinition);

        if (!cancelled) {
          // 净化 SVG 防止 XSS（移除事件处理器和脚本，保留文本和图表元素）
          const cleanSvg = DOMPurify.sanitize(svg || '', {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ['style', 'foreignObject', 'text', 'tspan', 'a', 'label'],
            ADD_ATTR: ['xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width', 'text-anchor',
              'font-size', 'font-family', 'font-weight', 'font-style', 'font-variant',
              'text-decoration', 'textLength', 'lengthAdjust', 'baseline-shift',
              'transform', 'x', 'y', 'dx', 'dy', 'rotate', 'xml:space',
              'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'd', 'points',
              'x1', 'y1', 'x2', 'y2', 'pathLength',
              'marker-end', 'marker-start', 'orient', 'refX', 'refY',
              'markerWidth', 'markerHeight', 'patternUnits', 'gradientUnits', 'spreadMethod',
              'offset', 'stop-color', 'stop-opacity', 'opacity', 'clip-path',
              'dominant-baseline', 'alignment-baseline', 'visibility', 'pointer-events',
              'style', 'class', 'data-id', 'data-source', 'href', 'target'],
          });
          setRenderedSvg(cleanSvg);

          // 等待 DOM 更新后处理 SVG
          await new Promise(resolve => requestAnimationFrame(resolve));

          if (!cancelled && svgContainerRef.current) {
            const svgEl = svgContainerRef.current.querySelector('svg');
            if (svgEl) {
              // 照搬 yijiekkk 的 SVG 后处理
              svgEl.removeAttribute('width');
              svgEl.removeAttribute('height');
              svgEl.style.maxWidth = 'none';
              svgEl.style.maxHeight = 'none';
              svgEl.style.overflow = 'visible';
              svgEl.style.display = 'block';
              svgEl.setAttribute('preserveAspectRatio', 'xMinYMin meet');

              const metrics = getGraphMetrics();
              setGraphSize(metrics);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MermaidGraphPanel] 渲染失败:', err);
          setRenderError(err instanceof Error ? err.message : String(err));
          setRenderedSvg('');
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [graphDefinition, getGraphMetrics]);

  // ─── 图谱尺寸变化后自动适配视口 ───
  useEffect(() => {
    if (graphSize.width > 0 && graphSize.height > 0) {
      fitGraphToViewport();
    }
  }, [graphSize, fitGraphToViewport]);

  // ─── 扫描交互节点 ───
  useEffect(() => {
    if (!svgContainerRef.current || !renderedSvg) return;

    const timer = requestAnimationFrame(() => {
      if (!svgContainerRef.current) return;
      const nodeElements = svgContainerRef.current.querySelectorAll('g.node');
      nodeElements.forEach(el => {
        const domId = el.id || el.getAttribute('data-id') || '';
        const key = getNodeKeyFromDomId(domId, nodeDetails);
        if (nodeDetails[key]) {
          (el as HTMLElement).style.cursor = 'pointer';
          el.classList.add('interactive-node');
        }
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [renderedSvg, nodeDetails]);

  // ─── 缩放 ───
  const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
    if (!viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = originX ?? (rect.width / 2);
    const centerY = originY ?? (rect.height / 2);
    const previousScale = scale;
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, previousScale * factor));

    if (Math.abs(nextScale - previousScale) < 0.0001) return;

    const worldX = (centerX - translateX - SURFACE_PADDING) / previousScale;
    const worldY = (centerY - translateY - SURFACE_PADDING) / previousScale;
    const nextX = centerX - SURFACE_PADDING - worldX * nextScale;
    const nextY = centerY - SURFACE_PADDING - worldY * nextScale;

    setScale(nextScale);
    setTranslateX(nextX);
    setTranslateY(nextY);
  }, [scale, translateX, translateY]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? STEP_SCALE : 1 / STEP_SCALE;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (rect) {
      zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
    }
  }, [zoomBy]);

  // ─── 指针拖拽 ───
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchState.current = { active: true, startDistance: dist, startScale: scale };
      return;
    }

    pointerState.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startTranslateX: translateX,
      startTranslateY: translateY,
      moved: false,
    };
  }, [scale, translateX, translateY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchState.current.active && activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / pinchState.current.startDistance;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchState.current.startScale * ratio));
      setScale(newScale);
      return;
    }

    if (!pointerState.current.isDragging) return;

    const dx = e.clientX - pointerState.current.startX;
    const dy = e.clientY - pointerState.current.startY;

    if (!pointerState.current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    pointerState.current.moved = true;

    setTranslateX(pointerState.current.startTranslateX + dx);
    setTranslateY(pointerState.current.startTranslateY + dy);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);

    if (pinchState.current.active && activePointers.current.size < 2) {
      pinchState.current.active = false;
    }

    if (!pointerState.current.isDragging) return;
    const wasMoved = pointerState.current.moved;
    pointerState.current.isDragging = false;

    if (!wasMoved) {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest('g.node') as HTMLElement;
      if (nodeEl) {
        const domId = nodeEl.id || nodeEl.getAttribute('data-id') || '';
        const key = getNodeKeyFromDomId(domId, nodeDetails);
        if (nodeDetails[key]) {
          setSelectedNodeId(key);
          setNodeDetailPopup({
            nodeId: key,
            detail: nodeDetails[key],
            x: e.clientX,
            y: e.clientY,
          });
          onNodeClick?.(key, nodeDetails[key]);
        }
      }
    }
  }, [nodeDetails, onNodeClick]);

  // ─── 重置视图 ───
  const resetView = useCallback(() => {
    fitGraphToViewport();
  }, [fitGraphToViewport]);

  const zoomIn = useCallback(() => zoomBy(STEP_SCALE), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / STEP_SCALE), [zoomBy]);

  // ─── 关闭弹窗 ───
  const closePopup = useCallback(() => {
    setNodeDetailPopup(null);
    setSelectedNodeId(null);
  }, []);

  // ─── 选中的节点详情 ───
  const selectedDetail = selectedNodeId ? nodeDetails[selectedNodeId] : null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary, #ffffff)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        minHeight: 300,
        ...style,
      }}
    >
      {/* 头部 */}
      {(title || subtitle) && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-tertiary, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            {title && (
              <div style={{
                fontSize: 'var(--font-size-sm)', fontWeight: '700',
                color: 'var(--accent, #58a6ff)',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #8b949e)', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <ZoomButton onClick={zoomOut} title="缩小"><ZoomOut size={14} /></ZoomButton>
            <span style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
              padding: '0 6px', lineHeight: '24px', minWidth: 36, textAlign: 'center',
            }}>
              {Math.round(scale * 100)}%
            </span>
            <ZoomButton onClick={zoomIn} title="放大"><ZoomIn size={14} /></ZoomButton>
            <ZoomButton onClick={resetView} title="重置视图"><Maximize2 size={14} /></ZoomButton>
          </div>
        </div>
      )}

      {/* 视口 */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: pointerState.current.isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          minHeight: 260,
          background: 'var(--bg-primary, #f0f4f8)',
        }}
      >
        {/* 变换舞台 */}
        <div
          ref={stageRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            padding: SURFACE_PADDING,
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
            width: graphSize.width > 0 ? graphSize.width : undefined,
            height: graphSize.height > 0 ? graphSize.height : undefined,
          }}
        >
          {/* SVG 容器 */}
          <div
            ref={svgContainerRef}
            data-mermaid-container
            dangerouslySetInnerHTML={{ __html: renderedSvg }}
            style={{
              lineHeight: 0,
              width: graphSize.width > 0 ? graphSize.width : undefined,
              height: graphSize.height > 0 ? graphSize.height : undefined,
            }}
          />
        </div>

        {/* 渲染中 */}
        {isRendering && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(13,17,23,0.7)',
            fontSize: 'var(--font-size-base)', color: 'var(--text-muted)',
          }}>
            图谱渲染中...
          </div>
        )}

        {/* 渲染错误 */}
        {renderError && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
            fontSize: 'var(--font-size-sm)', color: '#f85149',
            textAlign: 'center',
          }}>
            图谱渲染失败：{renderError}
          </div>
        )}

        {/* 空状态 */}
        {!graphDefinition?.trim() && !isRendering && !renderError && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--font-size-base)', color: 'var(--text-muted)',
          }}>
            暂无图谱数据
          </div>
        )}
      </div>

      {/* 节点详情弹窗 */}
      {nodeDetailPopup && selectedDetail && (
        <NodeDetailPopup
          detail={selectedDetail}
          onClose={closePopup}
        />
      )}

      {/* 全局样式 */}
      <style>{`
        @keyframes mermaid-pulse {
          0%, 100% { transform: translate(-50%, -100%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -100%) scale(1.3); opacity: 0.7; }
        }

        /* SVG 渲染质量（照搬 yijiekkk） */
        [data-mermaid-container] svg {
          display: block;
          width: 100%;
          height: 100%;
          max-width: none !important;
          max-height: none !important;
          overflow: visible;
          shape-rendering: geometricPrecision;
          text-rendering: geometricPrecision;
          image-rendering: optimizeQuality;
        }

        /* 字体强制覆盖（照搬 yijiekkk） */
        [data-mermaid-container] .edgeLabel,
        [data-mermaid-container] .label,
        [data-mermaid-container] foreignObject,
        [data-mermaid-container] text,
        [data-mermaid-container] tspan {
          font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif !important;
        }

        /* 可交互节点悬停效果（照搬 yijiekkk） */
        [data-mermaid-container] g.node.interactive-node {
          cursor: pointer;
          pointer-events: auto;
          transition: filter 0.18s ease;
        }

        [data-mermaid-container] g.node.interactive-node:hover rect,
        [data-mermaid-container] g.node.interactive-node:hover circle,
        [data-mermaid-container] g.node.interactive-node:hover polygon,
        [data-mermaid-container] g.node.interactive-node:hover path {
          filter: drop-shadow(0 0 14px rgba(255, 220, 150, 0.2)) drop-shadow(0 0 22px rgba(212, 168, 83, 0.16));
          stroke: #ffe2a0 !important;
          stroke-width: 2px !important;
        }
      `}</style>
    </div>
  );
}

// ============================================================
//  缩放按钮
// ============================================================

function ZoomButton({ onClick, title, children }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm, 4px)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.color = 'var(--accent)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
//  节点详情弹窗
// ============================================================

function NodeDetailPopup({ detail, onClose }: {
  detail: NodeDetail;
  onClose: () => void;
}) {
  const fields = detail.fields?.filter(f => f.value) || [];

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 340,
        maxHeight: 'calc(100% - 16px)',
        background: 'var(--bg-secondary, #ffffff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.16))',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        background: 'var(--bg-tertiary, #e2e8f0)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {detail.typeLabel && (
            <span style={{
              display: 'inline-block',
              padding: '1px 8px',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: 'var(--font-size-xs)', fontWeight: '600',
              background: 'var(--accent-dim, rgba(59,130,246,0.1))',
              color: 'var(--accent, #3b82f6)',
              marginBottom: 4,
            }}>
              {detail.typeLabel}
            </span>
          )}
          <div style={{
            fontSize: 'var(--font-size-md)', fontWeight: '700',
            color: 'var(--text-primary, #1e293b)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {detail.title}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 'var(--radius-sm, 4px)',
            background: 'transparent',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* 内容 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {detail.summary && (
          <p style={{
            margin: 0, padding: '8px 10px',
            fontSize: 'var(--font-size-sm)', lineHeight: 1.6,
            color: 'var(--text-secondary, #475569)',
            background: 'var(--bg-primary, #f0f4f8)',
            borderRadius: 'var(--radius-sm, 4px)',
            border: '1px solid var(--border, #e5e7eb)',
          }}>
            {detail.summary}
          </p>
        )}

        {fields.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 'var(--radius-sm, 4px)',
            overflow: 'hidden',
          }}>
            {fields.map((field, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  padding: '6px 10px',
                  fontSize: 'var(--font-size-sm)',
                  borderBottom: i < fields.length - 1 ? '1px dashed var(--border, #e5e7eb)' : 'none',
                  background: i % 2 === 0 ? 'var(--bg-primary, #f0f4f8)' : 'transparent',
                }}
              >
                <span style={{
                  color: 'var(--text-muted, #94a3b8)',
                  flexShrink: 0,
                  width: 80,
                  fontWeight: '500',
                }}>
                  {field.label}
                </span>
                <span style={{
                  color: 'var(--text-primary, #1e293b)',
                  flex: 1,
                  wordBreak: 'break-word',
                }}>
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {fields.length === 0 && !detail.summary && (
          <div style={{
            textAlign: 'center', padding: 16,
            fontSize: 'var(--font-size-sm)', color: 'var(--text-muted, #94a3b8)',
          }}>
            暂无详细信息
          </div>
        )}
      </div>
    </div>
  );
}
