import React, { useMemo, useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import PublishConfirmModal from './PublishConfirmModal';
import { useAppStore } from '../store/useAppStore';
import { buildWeChatHtml } from '../utils/markdown';
import { copyHtmlToClipboard } from '../utils/clipboard';
import { publishArticle } from '../services/api';
import { getCellString, selectRecordIdList, setRecords } from '../services/bitable';
import BatchPublishModal from './BatchPublishModal';

const Footer: React.FC = () => {
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchMode, setBatchMode] = useState<'draft' | 'publish'>('draft');
    const [batchStage, setBatchStage] = useState<'confirm' | 'running' | 'done'>('confirm');
    const [batchItems, setBatchItems] = useState<Array<{ recordId: string; title: string; status: 'pending' | 'running' | 'success' | 'failed'; message?: string }>>([]);
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    const { apiConfig, setApiModalOpen, currentRecord, fieldMapping, markdownContent, themeId, baseInfo, records, updateRecordFields } = useAppStore();

    const recordMap = useMemo(() => {
        const map = new Map<string, typeof records[number]>();
        records.forEach((record) => {
            map.set(record.recordId, record);
        });
        return map;
    }, [records]);

    const toText = (value: any) => {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value
                .map((item) => (typeof item === 'object' && item && 'text' in item ? String(item.text || '') : ''))
                .join('');
        }
        if (typeof value === 'object' && 'text' in value) {
            return String((value as { text?: string }).text || '');
        }
        return String(value);
    };

    const extractTitleFromMarkdown = (markdown: string) => {
        const lines = markdown.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            if (trimmed.startsWith('#')) {
                const title = trimmed.replace(/^#+\s*/, '').trim();
                if (title) {
                    return title;
                }
            }
        }
        const firstText = lines.map((line) => line.trim()).find((line) => line);
        return firstText || '未命名文章';
    };

    const getTitle = () => {
        if (!markdownContent.trim()) {
            return '';
        }
        const rawTitle = extractTitleFromMarkdown(markdownContent);
        return rawTitle.length > 64 ? rawTitle.slice(0, 64) : rawTitle;
    };

    const writeBackResult = async (recordId: string, status: string, publishId?: string) => {
        if (!baseInfo.tableId) {
            return { success: false, message: '未连接表格' };
        }
        const fields: Record<string, any> = {};
        if (fieldMapping.statusFieldId) {
            fields[fieldMapping.statusFieldId] = status;
        }
        if (fieldMapping.publishIdFieldId && publishId) {
            fields[fieldMapping.publishIdFieldId] = publishId;
        }
        if (fieldMapping.publishTimeFieldId && status !== '发布失败') {
            fields[fieldMapping.publishTimeFieldId] = Date.now();
        }
        if (Object.keys(fields).length === 0) {
            return { success: true };
        }
        try {
            await setRecords(baseInfo.tableId, [{ recordId, fields }]);
            updateRecordFields(recordId, fields);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : '回写失败';
            return { success: false, message };
        }
    };

    const loadArticleFromRecord = async (recordId: string) => {
        if (!baseInfo.tableId) {
            throw new Error('当前没有选中表格');
        }
        if (!fieldMapping.contentFieldId) {
            throw new Error('请先配置正文字段');
        }
        const content = await getCellString(baseInfo.tableId, fieldMapping.contentFieldId, recordId);
        const rawTitle = extractTitleFromMarkdown(content);
        const title = rawTitle.length > 64 ? rawTitle.slice(0, 64) : rawTitle;
        return { title, content };
    };

    const handleCopy = async () => {
        if (!markdownContent.trim()) {
            Toast.warning('正文为空，无法复制');
            return;
        }
        try {
            const html = buildWeChatHtml(markdownContent, themeId);
            const result = await copyHtmlToClipboard(html, themeId);
            if (result.imageTotal > 0 && result.failCount > 0) {
                Toast.warning(`已复制，${result.failCount} 张图片未能处理，可能需要手动检查`);
                return;
            }
            Toast.success('已复制到剪贴板，请前往公众号后台粘贴');
        } catch (error) {
            const message = error instanceof Error ? error.message : '复制失败';
            Toast.error(message);
        }
    };

    const handlePublishClick = () => {
        if (!apiConfig.hasConfigured) {
            Toast.warning('请先配置公众号 AppID 和 AppSecret');
            setApiModalOpen(true);
            return;
        }
        if (!fieldMapping.contentFieldId) {
            Toast.warning('请先在字段映射中选择正文字段');
            return;
        }
        setIsPublishModalOpen(true);
    };

    const handleBatchClick = async () => {
        if (!apiConfig.hasConfigured) {
            Toast.warning('请先配置公众号 AppID 和 AppSecret');
            setApiModalOpen(true);
            return;
        }
        if (!fieldMapping.contentFieldId) {
            Toast.warning('请先在字段映射中选择正文字段');
            return;
        }
        if (!baseInfo.tableId || !baseInfo.viewId) {
            Toast.warning('请先选择表格视图');
            return;
        }
        try {
            const recordIds = await selectRecordIdList(baseInfo.tableId, baseInfo.viewId);
            if (!recordIds || recordIds.length === 0) {
                Toast.info('未选择任何记录');
                return;
            }
            const items = recordIds.map((recordId) => ({
                recordId,
                title: extractTitleFromMarkdown(toText(recordMap.get(recordId)?.fields[fieldMapping.contentFieldId])) || recordId,
                status: 'pending' as const
            }));
            setBatchItems(items);
            setBatchStage('confirm');
            setBatchMode('draft');
            setIsBatchModalOpen(true);
        } catch (error) {
            const message = error instanceof Error ? error.message : '选择记录失败';
            Toast.error(message);
        }
    };

    const runBatchPublish = async () => {
        setBatchStage('running');
        setIsBatchRunning(true);
        let successCount = 0;
        let failedCount = 0;

        const nextItems = [...batchItems];
        for (let index = 0; index < nextItems.length; index += 1) {
            const item = nextItems[index];
            nextItems[index] = { ...item, status: 'running' };
            setBatchItems([...nextItems]);
            try {
                const article = await loadArticleFromRecord(item.recordId);
                if (!article.title.trim()) {
                    throw new Error('标题为空');
                }
                if (!article.content.trim()) {
                    throw new Error('正文为空');
                }
                const html = buildWeChatHtml(article.content, themeId);
                const result = await publishArticle({
                    appId: apiConfig.appId,
                    appSecret: apiConfig.appSecret,
                    publishMode: batchMode,
                    article: {
                        title: article.title,
                        content: html,
                    }
                });
                const publishId = result.mode === 'publish' ? result.publishId : result.draftMediaId;
                const writeBack = await writeBackResult(item.recordId, result.mode === 'publish' ? '已发布' : '草稿箱', publishId);
                nextItems[index] = {
                    ...item,
                    status: 'success',
                    message: writeBack.success ? undefined : (writeBack.message || '回写失败')
                };
                successCount += 1;
            } catch (error) {
                const message = error instanceof Error ? error.message : '发布失败';
                await writeBackResult(item.recordId, '发布失败');
                nextItems[index] = { ...item, status: 'failed', message };
                failedCount += 1;
            }
            setBatchItems([...nextItems]);
        }

        setBatchStage('done');
        setIsBatchRunning(false);
        Toast.success(`批量发布完成：成功 ${successCount} 篇，失败 ${failedCount} 篇`);
    };

    return (
        <>
            <div className="footer">
                <Button type="secondary" onClick={handleCopy}>📋 复制到剪贴板</Button>
                <div className="footer-actions">
                    <Button theme="solid" type="primary" onClick={handlePublishClick}>☁️ 发布到草稿箱</Button>
                    <Button type="tertiary" onClick={handleBatchClick}>📦 批量发布</Button>
                </div>
            </div>
            <PublishConfirmModal
                visible={isPublishModalOpen}
                onCancel={() => setIsPublishModalOpen(false)}
                confirmLoading={isPublishing}
                onConfirm={async (mode) => {
                    if (!markdownContent.trim()) {
                        Toast.error('正文不能为空');
                        return;
                    }
                    const title = getTitle().trim();
                    try {
                        setIsPublishing(true);
                        const html = buildWeChatHtml(markdownContent, themeId);
                        const result = await publishArticle({
                            appId: apiConfig.appId,
                            appSecret: apiConfig.appSecret,
                            publishMode: mode,
                            article: {
                                title,
                                content: html,
                            }
                        });
                        const publishId = result.mode === 'publish' ? result.publishId : result.draftMediaId;
                        if (currentRecord) {
                            const writeBack = await writeBackResult(currentRecord.recordId, result.mode === 'publish' ? '已发布' : '草稿箱', publishId);
                            if (!writeBack.success) {
                                Toast.warning(`发布成功，但回写失败：${writeBack.message || '请检查字段映射'}`);
                            }
                        }
                        setIsPublishModalOpen(false);
                        if (result.mode === 'publish') {
                            Toast.success('已提交发布，请稍后在公众号后台查看');
                        } else {
                            Toast.success('已发布到草稿箱');
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : '发布失败';
                        Toast.error(message);
                    } finally {
                        setIsPublishing(false);
                    }
                }}
            />
            <BatchPublishModal
                visible={isBatchModalOpen}
                mode={batchMode}
                stage={batchStage}
                items={batchItems}
                running={isBatchRunning}
                onModeChange={setBatchMode}
                onCancel={() => {
                    if (isBatchRunning) {
                        return;
                    }
                    setIsBatchModalOpen(false);
                }}
                onConfirm={runBatchPublish}
                onClose={() => setIsBatchModalOpen(false)}
            />
        </>
    );
};

export default Footer;
