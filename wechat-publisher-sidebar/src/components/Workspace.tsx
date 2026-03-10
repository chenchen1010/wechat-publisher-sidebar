import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Toast, Tooltip, Typography, Switch } from '@douyinfe/semi-ui';
import { IconEdit, IconEyeOpened, IconInfoCircle } from '@douyinfe/semi-icons';
import { useAppStore } from '../store/useAppStore';
import { buildWeChatHtmlAsync } from '../utils/markdown';
import { setCellValue } from '../services/bitable';
import { ImageCompressor } from '../utils/imageCompressor';
import imageStore from '../utils/imageStore';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';

const imageCompressor = new ImageCompressor();

const generateImageId = () => {
    return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const Workspace: React.FC = () => {
    const {
        viewMode,
        setViewMode,
        toggleViewMode,
        splitMode,
        setSplitMode,
        shortcutKey,
        markdownContent,
        updateMarkdown,
        themeId,
        baseInfo,
        fieldMapping,
        currentRecord,
        updateRecordFields
    } = useAppStore();
    const [saving, setSaving] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 异步生成预览 HTML（支持 img:// 协议）
    useEffect(() => {
        let cancelled = false;
        buildWeChatHtmlAsync(markdownContent, themeId).then((html) => {
            if (!cancelled) {
                setPreviewHtml(html);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [markdownContent, themeId]);

    const canSave = Boolean(baseInfo.tableId && currentRecord && fieldMapping.contentFieldId);

    const handleSave = useCallback(async () => {
        if (!baseInfo.tableId || !fieldMapping.contentFieldId) {
            Toast.warning('请先选择表格和正文字段');
            return;
        }
        const recordId = currentRecord?.recordId;
        if (!recordId) {
            Toast.warning('当前没有选中记录');
            return;
        }
        if (!markdownContent.trim()) {
            Toast.warning('正文为空，无法保存');
            return;
        }
        try {
            setSaving(true);
            await setCellValue(baseInfo.tableId, fieldMapping.contentFieldId, recordId, markdownContent);
            updateRecordFields(recordId, { [fieldMapping.contentFieldId]: markdownContent });
            Toast.success('已保存到表格');
        } catch (error) {
            const message = error instanceof Error ? error.message : '保存失败';
            Toast.error(message);
        } finally {
            setSaving(false);
        }
    }, [baseInfo.tableId, fieldMapping.contentFieldId, currentRecord, markdownContent, updateRecordFields]);

    // 快捷键处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isModKey = isMac ? e.metaKey : e.ctrlKey;
            if (!isModKey) return;

            const key = e.key.toLowerCase();

            // 切换编辑/预览模式
            if (key === shortcutKey.toLowerCase()) {
                e.preventDefault();
                toggleViewMode();
                return;
            }

            // 保存快捷键
            if (key === 's') {
                e.preventDefault();
                if (canSave && !saving) {
                    handleSave();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcutKey, toggleViewMode, canSave, saving, handleSave]);

    // 编辑模式或双栏模式下自动聚焦编辑器
    useEffect(() => {
        if (viewMode === 'edit' || splitMode) {
            textareaRef.current?.focus();
        }
    }, [viewMode, splitMode]);

    // 处理粘贴图片
    const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageItems: DataTransferItem[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                imageItems.push(items[i]);
            }
        }

        if (imageItems.length === 0) return;

        e.preventDefault();

        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBefore = markdownContent.slice(0, cursorPos);
        const textAfter = markdownContent.slice(textarea.selectionEnd);

        const imageMarkdowns: string[] = [];

        for (const item of imageItems) {
            const file = item.getAsFile();
            if (!file) continue;

            try {
                const originalSize = file.size;
                const compressed = await imageCompressor.compress(file);
                const imageId = generateImageId();

                await imageStore.saveImage(imageId, compressed, {
                    name: file.name || 'pasted-image',
                    originalSize,
                    type: file.type
                });

                const sizeInfo = compressed.size < originalSize
                    ? `(${ImageCompressor.formatSize(originalSize)} → ${ImageCompressor.formatSize(compressed.size)})`
                    : `(${ImageCompressor.formatSize(originalSize)})`;
                console.log(`图片已保存: ${imageId} ${sizeInfo}`);

                imageMarkdowns.push(`![](img://${imageId})`);
            } catch (error) {
                console.error('图片处理失败:', error);
                Toast.error('图片处理失败');
            }
        }

        if (imageMarkdowns.length > 0) {
            const insertText = imageMarkdowns.join('\n');
            const newContent = textBefore + insertText + textAfter;
            updateMarkdown(newContent);

            // 设置光标位置到插入内容之后
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    const newPos = cursorPos + insertText.length;
                    textareaRef.current.selectionStart = newPos;
                    textareaRef.current.selectionEnd = newPos;
                    textareaRef.current.focus();
                }
            });

            Toast.success(`已粘贴 ${imageMarkdowns.length} 张图片`);
        }
    }, [markdownContent, updateMarkdown]);

    const renderEditor = () => (
        <div className="editor-container">
            <textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={(e) => updateMarkdown(e.target.value)}
                onPaste={handlePaste}
                placeholder="# 开始编辑..."
            />
        </div>
    );

    const renderPreview = () => (
        <div
            className="preview-container"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
    );

    const showEditor = viewMode === 'edit' || splitMode;
    const showPreview = viewMode === 'preview' || splitMode;

    return (
        <div className="workspace">
            <div className="toolbar">
                <div className="toolbar-left">
                    <Tooltip content={`${modKey}+${shortcutKey.toUpperCase()} 切换`}>
                        <Button
                            theme={viewMode === 'edit' ? 'solid' : 'light'}
                            type={viewMode === 'edit' ? 'primary' : 'tertiary'}
                            size="small"
                            icon={<IconEdit />}
                            onClick={() => setViewMode('edit')}
                        >
                            编辑
                        </Button>
                    </Tooltip>
                    <Tooltip content={`${modKey}+${shortcutKey.toUpperCase()} 切换`}>
                        <Button
                            theme={viewMode === 'preview' ? 'solid' : 'light'}
                            type={viewMode === 'preview' ? 'primary' : 'tertiary'}
                            size="small"
                            icon={<IconEyeOpened />}
                            onClick={() => setViewMode('preview')}
                        >
                            预览
                        </Button>
                    </Tooltip>
                    <div className="split-toggle">
                        <Switch
                            size="small"
                            checked={splitMode}
                            onChange={setSplitMode}
                        />
                        <Typography.Text type="tertiary" size="small">双栏</Typography.Text>
                    </div>
                </div>
                <div className="toolbar-right">
                    <Tooltip
                        content={
                            <div style={{ lineHeight: 1.6, fontSize: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>⌨️ 快捷键</div>
                                <div>• {modKey}+{shortcutKey.toUpperCase()} 切换编辑/预览</div>
                                <div>• {modKey}+S 保存到表格</div>
                            </div>
                        }
                        position="bottomRight"
                    >
                        <IconInfoCircle style={{ color: 'var(--semi-color-text-2)', cursor: 'help', marginRight: 8 }} />
                    </Tooltip>
                    <Button
                        type="tertiary"
                        size="small"
                        loading={saving}
                        onClick={handleSave}
                        disabled={!canSave}
                    >
                        保存到表格
                    </Button>
                </div>
            </div>

            <div className={`content-area ${splitMode ? 'split-mode' : ''}`}>
                {showEditor && renderEditor()}
                {showPreview && renderPreview()}
            </div>
        </div>
    );
};

export default Workspace;
