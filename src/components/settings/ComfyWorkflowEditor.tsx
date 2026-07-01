// ComfyUI 自定义工作流编辑器 — 导入、验证、映射、管理
import { useState, useCallback } from 'react';
import { useImageStore } from '@/stores/imageStore';
import { useImageGen } from '@/hooks/useImageGen';
import {
  validateWorkflow,
  detectWorkflowNodes,
  injectParamsIntoWorkflow,
} from '@/api/imageGen';
import type {
  ComfyWorkflowPreset,
  WorkflowParamMapping,
  WorkflowValidation,
  DetectedNode,
  ParamInjectPoint,
} from '@/api/imageGenTypes';
import {
  Section,
  Collapsible,
  Field,
  Button,
  TextArea,
  Toggle,
} from './SettingsUIComponents';
import { CheckCircle, XCircle, AlertTriangle, Trash2, RefreshCw, Wand2 } from 'lucide-react';

// ─── 映射角色标签 ───

const ROLE_LABELS: Record<string, string> = {
  positive_prompt: '正提示词',
  negative_prompt: '负提示词',
  seed: '种子',
  steps: '步数',
  cfg: 'CFG',
  sampler: '采样器',
  scheduler: '调度器',
  width: '宽度',
  height: '高度',
  batch_size: '批量',
  denoise: '降噪',
};

const ROLE_ORDER = ['positive_prompt', 'negative_prompt', 'seed', 'steps', 'cfg', 'sampler', 'scheduler', 'width', 'height', 'batch_size', 'denoise'];

// ─── 组件 ───

export default function ComfyWorkflowEditor() {
  const config = useImageStore((s) => s.config);
  const updateConfig = useImageStore((s) => s.updateConfig);
  const comfyData = useImageStore((s) => s.comfyData);
  const { loadComfyUIData } = useImageGen();

  const [draftJson, setDraftJson] = useState('');
  const [draftName, setDraftName] = useState('');
  const [importError, setImportError] = useState('');
  const [validation, setValidation] = useState<WorkflowValidation | null>(null);
  const [detectedNodes, setDetectedNodes] = useState<DetectedNode[]>([]);
  const [mapping, setMapping] = useState<WorkflowParamMapping>({ custom: {} });
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const presets = config.comfyWorkflowPresets || [];
  const activeId = config.comfyActiveWorkflowId;

  // ─── 导入+验证 ───

  const handleImportAndValidate = useCallback(async () => {
    setImportError('');
    setValidation(null);

    // 解析 JSON
    let workflow: Record<string, Record<string, unknown>>;
    try {
      const parsed = JSON.parse(draftJson);
      // 兼容 ComfyUI 导出的两种格式：顶层有 nodes 数组 或 直接是 API format
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        // 标准导出格式 → 转为 API format
        workflow = {};
        for (const n of parsed.nodes) {
          if (n.id != null) workflow[String(n.id)] = n;
        }
      } else {
        workflow = parsed;
      }
    } catch {
      setImportError('JSON 解析失败，请检查格式');
      return;
    }

    // 验证每个 entry 是否是合法节点
    let hasNodes = false;
    for (const [_id, node] of Object.entries(workflow)) {
      if (node && typeof node === 'object' && node.class_type) {
        hasNodes = true;
        break;
      }
    }
    if (!hasNodes) {
      setImportError('未找到有效的 ComfyUI 节点（缺少 class_type 字段）');
      return;
    }

    // 验证节点
    if (comfyData.objectInfo && Object.keys(comfyData.objectInfo).length > 0) {
      const v = validateWorkflow(workflow, comfyData.objectInfo);
      setValidation(v);
    } else {
      // 未连接 ComfyUI 时，只做基本检查
      setValidation({
        nodeTypes: Object.values(workflow).filter((n) => n?.class_type).map((n) => String(n.class_type)),
        available: [],
        missing: [],
        modelWarnings: [],
        fatalErrors: [],
        valid: true,
      });
    }

    // 自动检测映射节点
    const nodes = detectWorkflowNodes(workflow);
    setDetectedNodes(nodes);

    // 自动分配映射
    const autoMapping: WorkflowParamMapping = { custom: {} };
    const usedRoles = new Set<string>();

    for (const node of nodes) {
      if (!node.suggestedRole) continue;

      const hints = getRoleHints(node.classType);
      for (const role of hints) {
        if (usedRoles.has(role)) continue;
        const inputKey = findInputKey(node, role);
        if (inputKey) {
          setMappingParam(autoMapping, role as keyof WorkflowParamMapping, { nodeId: node.nodeId, inputKey });
          usedRoles.add(role);
          break;
        }
      }
    }

    setMapping(autoMapping);
  }, [draftJson, comfyData.objectInfo]);

  // ─── 保存预设 ───

  const handleSavePreset = useCallback(() => {
    if (!draftName.trim()) return;

    let workflow: Record<string, Record<string, unknown>>;
    try {
      const parsed = JSON.parse(draftJson);
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        workflow = {};
        for (const n of parsed.nodes) {
          if (n.id != null) workflow[String(n.id)] = n;
        }
      } else {
        workflow = parsed;
      }
    } catch {
      return;
    }

    const now = Date.now();
    const id = editingPreset || `wf_${now}_${Math.random().toString(36).substr(2, 6)}`;
    const name = draftName.trim();

    const preset: ComfyWorkflowPreset = {
      id,
      name,
      workflow,
      paramMapping: mapping,
      validation: validation || {
        nodeTypes: [],
        available: [],
        missing: [],
        modelWarnings: [],
        fatalErrors: [],
        valid: true,
      },
      createdAt: editingPreset
        ? (presets.find((p) => p.id === id)?.createdAt || now)
        : now,
      updatedAt: now,
    };

    let newPresets: ComfyWorkflowPreset[];
    if (editingPreset) {
      newPresets = presets.map((p) => (p.id === id ? preset : p));
    } else {
      newPresets = [...presets, preset];
    }

    updateConfig('comfyWorkflowPresets', newPresets);

    if (!editingPreset) {
      updateConfig('comfyActiveWorkflowId', id);
      updateConfig('comfyUseCustomWorkflow', true);
    }

    // 重置编辑状态
    setDraftJson('');
    setDraftName('');
    setImportError('');
    setValidation(null);
    setDetectedNodes([]);
    setMapping({ custom: {} });
    setEditingPreset(null);
  }, [draftJson, draftName, mapping, validation, editingPreset, presets, updateConfig]);

  // ─── 编辑已有预设 ───

  const handleEditPreset = useCallback((preset: ComfyWorkflowPreset) => {
    setEditingPreset(preset.id);
    setDraftName(preset.name);
    setDraftJson(JSON.stringify(preset.workflow, null, 2));
    setMapping(preset.paramMapping);
    setValidation(preset.validation);
    setDetectedNodes(detectWorkflowNodes(preset.workflow));
    setImportError('');
  }, []);

  // ─── 删除预设 ───

  const handleDeletePreset = useCallback((id: string) => {
    const newPresets = presets.filter((p) => p.id !== id);
    updateConfig('comfyWorkflowPresets', newPresets);
    if (activeId === id) {
      updateConfig('comfyActiveWorkflowId', newPresets.length > 0 ? newPresets[0].id : '');
      if (newPresets.length === 0) {
        updateConfig('comfyUseCustomWorkflow', false);
      }
    }
    if (editingPreset === id) {
      setEditingPreset(null);
      setDraftJson('');
      setDraftName('');
      setMapping({ custom: {} });
      setValidation(null);
      setDetectedNodes([]);
    }
  }, [presets, activeId, editingPreset, updateConfig]);

  // ─── 重新连接验证 ───

  const handleRevalidate = useCallback(async () => {
    setConnecting(true);
    try {
      await loadComfyUIData(config.comfyUrl);
    } catch {
      // error logged in hook
    }
    setConnecting(false);

    if (draftJson) {
      handleImportAndValidate();
    }
  }, [config.comfyUrl, draftJson, loadComfyUIData, handleImportAndValidate]);

  // ─── 手动覆盖映射 ───

  const handleOverrideMapping = useCallback((role: string, nodeId: string, inputKey: string) => {
    setMapping((prev) => {
      const next = { ...prev, custom: { ...prev.custom } } as WorkflowParamMapping;
      if (nodeId && inputKey) {
        setMappingParam(next, role as keyof WorkflowParamMapping, { nodeId, inputKey });
      } else {
        setMappingParam(next, role as keyof WorkflowParamMapping, undefined);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ─── 预设管理 ─── */}
      <Section icon={<Wand2 size={16} />} title="自定义工作流">
        {/* 启用开关 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: '2px' }}>使用自定义工作流</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                关闭则使用内置默认流程（Checkpoint → KSampler → VAE Decode）
              </div>
            </div>
            <Toggle
              value={config.comfyUseCustomWorkflow}
              onChange={(v) => updateConfig('comfyUseCustomWorkflow', v)}
            />
          </div>
        </div>

        {/* 已有预设列表 */}
        {presets.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 500, marginBottom: '8px', fontSize: '13px' }}>已保存的工作流</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {presets.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  isActive={activeId === p.id}
                  onActivate={() => updateConfig('comfyActiveWorkflowId', p.id)}
                  onEdit={() => handleEditPreset(p)}
                  onDelete={() => handleDeletePreset(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 导入/编辑面板 */}
        <Collapsible
          title={editingPreset ? `编辑: ${draftName || '未命名'}` : '导入新工作流'}
          desc="粘贴 ComfyUI 导出的 workflow JSON，自动识别参数注入位"
          defaultOpen={presets.length === 0}
        >
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Field label="工作流名称" hint="给这个工作流起个名字">
              <input
                className="input-field"
                style={{ width: '100%', padding: '6px 10px' }}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="例如：Hires Fix + ControlNet"
              />
            </Field>

            <Field label="Workflow JSON" hint="在 ComfyUI 中点击 Workflow → Export (API) 复制 JSON">
              <TextArea
                value={draftJson}
                onChange={setDraftJson}
                placeholder={`{ "3": { "class_type": "CheckpointLoaderSimple", ... }, ... }`}
                rows={8}
                mono
              />
            </Field>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button onClick={handleImportAndValidate} primary disabled={!draftJson.trim()}>
                验证并识别节点
              </Button>
              <Button onClick={handleRevalidate} disabled={connecting}>
                <RefreshCw size={14} style={{ marginRight: '4px' }} />
                {connecting ? '连接中...' : '重新连接验证'}
              </Button>
              {importError && (
                <span style={{ color: 'var(--danger)', fontSize: '12px' }}>
                  <XCircle size={12} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                  {importError}
                </span>
              )}
            </div>

            {/* 验证结果 */}
            {validation && (
              <ValidationPanel validation={validation} />
            )}

            {/* 映射配置 */}
            {detectedNodes.length > 0 && (
              <MappingPanel
                detectedNodes={detectedNodes}
                mapping={mapping}
                onOverride={handleOverrideMapping}
              />
            )}

            {/* 保存 */}
            {validation && detectedNodes.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <Button onClick={handleSavePreset} primary disabled={!draftName.trim()}>
                  {editingPreset ? '更新工作流' : '保存工作流'}
                </Button>
                {editingPreset && (
                  <Button onClick={() => {
                    setEditingPreset(null);
                    setDraftJson('');
                    setDraftName('');
                    setValidation(null);
                    setDetectedNodes([]);
                    setMapping({ custom: {} });
                  }}>
                    取消
                  </Button>
                )}
              </div>
            )}
          </div>
        </Collapsible>
      </Section>
    </div>
  );
}

// ─── 预设卡片 ───

function PresetCard({
  preset,
  isActive,
  onActivate,
  onEdit,
  onDelete,
}: {
  preset: ComfyWorkflowPreset;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const nodeCount = Object.values(preset.workflow).filter((n) => n?.class_type).length;
  const hasMissing = preset.validation.missing.length > 0;
  const hasFatal = preset.validation.fatalErrors.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: '6px',
        background: isActive ? 'var(--accent-dim)' : 'var(--bg-secondary)',
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
        cursor: 'pointer',
      }}
      onClick={onActivate}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <span style={{
          fontWeight: 500,
          fontSize: '13px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {preset.name}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {nodeCount} 节点
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {hasFatal ? (
          <XCircle size={14} color="var(--danger)" />
        ) : hasMissing ? (
          <AlertTriangle size={14} color="var(--warning, #f59e0b)" />
        ) : (
          <CheckCircle size={14} color="var(--success, #10b981)" />
        )}
        {isActive && (
          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>使用中</span>
        )}
        <div onClick={(e) => e.stopPropagation()}>
          <Button onClick={onEdit}>编辑</Button>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Button onClick={onDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 验证面板 ───

function ValidationPanel({ validation }: { validation: WorkflowValidation }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '6px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      fontSize: '12px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '6px' }}>
        {validation.valid ? (
          <span style={{ color: 'var(--success, #10b981)' }}>
            <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            验证通过
          </span>
        ) : (
          <span style={{ color: 'var(--danger)' }}>
            <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            发现问题
          </span>
        )}
      </div>

      {validation.fatalErrors.length > 0 && (
        <div style={{ marginBottom: '4px' }}>
          {validation.fatalErrors.map((e, i) => (
            <div key={i} style={{ color: 'var(--danger)', marginBottom: '2px' }}>
              <XCircle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {e}
            </div>
          ))}
        </div>
      )}

      {validation.missing.length > 0 && (
        <div>
          <div style={{ color: 'var(--warning, #f59e0b)', fontWeight: 500, marginBottom: '2px' }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            缺失节点（本地 ComfyUI 中未安装）:
          </div>
          {validation.missing.map((m, i) => (
            <div key={i} style={{ color: 'var(--warning, #f59e0b)', paddingLeft: '16px' }}>
              {m}
            </div>
          ))}
        </div>
      )}

      {validation.fatalErrors.length === 0 && validation.missing.length === 0 && (
        <div style={{ color: 'var(--text-secondary)' }}>
          已识别 {validation.nodeTypes.length} 种节点类型，全部可用
        </div>
      )}
    </div>
  );
}

// ─── 映射配置面板 ───

function MappingPanel({
  detectedNodes,
  mapping,
  onOverride,
}: {
  detectedNodes: DetectedNode[];
  mapping: WorkflowParamMapping;
  onOverride: (role: string, nodeId: string, inputKey: string) => void;
}) {
  // 按 class_type 分组
  const nodeGroups = new Map<string, DetectedNode[]>();
  for (const n of detectedNodes) {
    const key = n.classType;
    if (!nodeGroups.has(key)) nodeGroups.set(key, []);
    nodeGroups.get(key)!.push(n);
  }

  // 构建所有可选注入点
  const allInjectPoints: { label: string; nodeId: string; inputKey: string }[] = [];
  for (const n of detectedNodes) {
    for (const ik of n.inputs) {
      allInjectPoints.push({
        label: `[${n.classType}] #${n.nodeId} → ${ik}`,
        nodeId: n.nodeId,
        inputKey: ik,
      });
    }
  }

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '6px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      fontSize: '12px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>参数映射配置</div>

      {/* 按角色顺序显示映射 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {ROLE_ORDER.map((role) => {
          const current = getMappingParam(mapping, role as keyof WorkflowParamMapping);
          return (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '80px', fontWeight: 500, flexShrink: 0, color: current ? 'var(--success, #10b981)' : 'var(--text-secondary)' }}>
                {current ? <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> : null}
                {ROLE_LABELS[role] || role}
              </span>
              <select
                className="input-field"
                style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                value={current ? `${current.nodeId}.${current.inputKey}` : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    onOverride(role, '', '');
                  } else {
                    const dotIdx = val.indexOf('.');
                    const nid = val.slice(0, dotIdx);
                    const ik = val.slice(dotIdx + 1);
                    onOverride(role, nid, ik);
                  }
                }}
              >
                <option value="">（未映射）</option>
                {allInjectPoints.map((p) => (
                  <option key={`${p.nodeId}.${p.inputKey}`} value={`${p.nodeId}.${p.inputKey}`}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 工具 ───

function setMappingParam(
  mapping: WorkflowParamMapping,
  role: keyof WorkflowParamMapping,
  value: ParamInjectPoint | undefined,
): void {
  if (role === 'custom') return;
  // WorkflowParamMapping 的字段名就是 role 名称，可以直接索引
  const m = mapping as unknown as Record<string, ParamInjectPoint | undefined>;
  m[role] = value;
}

function getMappingParam(
  mapping: WorkflowParamMapping,
  role: keyof WorkflowParamMapping,
): ParamInjectPoint | undefined {
  if (role === 'custom') return undefined;
  const m = mapping as unknown as Record<string, ParamInjectPoint | undefined>;
  return m[role];
}

function getRoleHints(classType: string): string[] {
  const hints: Record<string, string[]> = {
    'CLIPTextEncode': ['positive_prompt', 'negative_prompt'],
    'CLIPTextEncodeSDXL': ['positive_prompt', 'negative_prompt'],
    'CLIPTextEncodeFlux': ['positive_prompt'],
    'KSampler': ['seed', 'steps', 'cfg', 'sampler', 'scheduler', 'denoise'],
    'KSamplerAdvanced': ['seed', 'steps', 'cfg', 'sampler', 'scheduler', 'denoise'],
    'KSamplerSelect': ['sampler'],
    'EmptyLatentImage': ['width', 'height', 'batch_size'],
    'EmptySD3LatentImage': ['width', 'height', 'batch_size'],
    'EmptyFluxLatentImage': ['width', 'height', 'batch_size'],
    'RandomNoise': ['seed'],
  };
  return hints[classType] || [];
}

function findInputKey(node: DetectedNode, role: string): string | null {
  const roleKeyMap: Record<string, string[]> = {
    positive_prompt: ['text'],
    negative_prompt: ['text'],
    seed: ['seed', 'noise_seed'],
    steps: ['steps'],
    cfg: ['cfg'],
    sampler: ['sampler_name'],
    scheduler: ['scheduler'],
    width: ['width'],
    height: ['height'],
    batch_size: ['batch_size'],
    denoise: ['denoise'],
  };
  const candidates = roleKeyMap[role] || [];
  for (const c of candidates) {
    if (node.inputs.includes(c)) return c;
  }
  return null;
}
