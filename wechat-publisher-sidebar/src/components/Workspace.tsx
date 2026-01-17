import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Toast, Tooltip, Typography, Switch } from '@douyinfe/semi-ui';
import { IconEdit, IconEyeOpened } from '@douyinfe/semi-icons';
import { useAppStore } from '../store/useAppStore';
import { buildWeChatHtml } from '../utils/markdown';
import { setCellValue } from '../services/bitable';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';

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
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const previewHtml = useMemo(
        () => buildWeChatHtml(markdownContent, themeId),
        [markdownContent, themeId]
    );

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

    const renderEditor = () => (
        <div className="editor-container">
            <textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={(e) => updateMarkdown(e.target.value)}
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
                    <Typography.Text type="tertiary" size="small" style={{ marginRight: 8 }}>
                        {modKey}+S 保存
                    </Typography.Text>
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
