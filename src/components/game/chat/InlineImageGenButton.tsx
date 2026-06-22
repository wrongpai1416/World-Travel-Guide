// 正文生图内联按钮 — 点击触发图片生成，完成后内联展示
import { useState, useCallback } from 'react';
import { useImageGen } from '../../../hooks/useImageGen';
import { getGenerationConfigError } from '../../../api/imageGen';
import { ImageIcon, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  prompt: string;
}

export default function InlineImageGenButton({ prompt }: Props) {
  const { config, generateAndSave, getImageUrl } = useImageGen();
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [imageUrl, setImageUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClick = useCallback(async () => {
    if (status === 'generating' || status === 'done') return;

    // 验证配置
    const configError = getGenerationConfigError(config);
    if (configError) {
      setStatus('error');
      setErrorMsg(configError);
      return;
    }

    setStatus('generating');
    setErrorMsg('');

    try {
      const result = await generateAndSave(
        prompt,
        { category: 'story' },
        (s) => {
          if (s === 'generating') setStatus('generating');
        },
      );

      if (result?.imageBlobKey) {
        const url = await getImageUrl(result);
        if (url) {
          setImageUrl(url);
          setStatus('done');
        } else {
          setStatus('error');
          setErrorMsg('获取图片地址失败');
        }
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg((e as Error).message || '生图失败');
    }
  }, [status, config, prompt, generateAndSave, getImageUrl]);

  if (status === 'done' && imageUrl) {
    return (
      <div style={{ margin: '8px 0' }}>
        <img
          src={imageUrl}
          alt={prompt}
          style={{
            maxWidth: '100%',
            maxHeight: '400px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            display: 'block',
          }}
          loading="lazy"
        />
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
          {prompt}
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: '8px 0' }}>
      <button
        onClick={handleClick}
        disabled={status === 'generating'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px dashed var(--accent)',
          background: status === 'generating' ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
          color: status === 'generating' ? 'var(--accent)' : 'var(--text-primary)',
          cursor: status === 'generating' ? 'wait' : 'pointer',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          transition: 'all 0.2s',
        }}
      >
        {status === 'generating' ? (
          <>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            生成中...
          </>
        ) : (
          <>
            <ImageIcon size={14} />
            点击生图
          </>
        )}
      </button>
      {status === 'error' && errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: '4px',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--danger)',
        }}>
          <AlertCircle size={12} />
          {errorMsg}
        </div>
      )}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
        {prompt}
      </div>
    </div>
  );
}
