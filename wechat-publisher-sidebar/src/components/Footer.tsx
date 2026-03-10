import React, { useMemo, useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import PublishConfirmModal from './PublishConfirmModal';
import ManualCopyModal from './ManualCopyModal';
import { useAppStore } from '../store/useAppStore';
import { buildWeChatHtmlAsync, buildWeChatHtmlForPublish } from '../utils/markdown';
import { copyHtmlToClipboard } from '../utils/clipboard';
import { publishArticle } from '../services/api';
import { getCellString, selectRecordIdList, setRecords, getAttachmentUrls, isBitableAvailable } from '../services/bitable';
import { PublishStatus } from '../services/syncService';
import BatchPublishModal from './BatchPublishModal';
import { resolveAccountByValue } from '../services/accountService';

const DEBUG_PUBLISH = import.meta.env.VITE_DEBUG_PUBLISH === '1';

const logPublishDebug = (label: string, info: Record<string, unknown>) => {
    if (!DEBUG_PUBLISH) {
        return;
    }
    console.info(`[publish-debug] ${label}`, info);
};

const countImagesInHtml = (html: string) => {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.querySelectorAll('img').length;
    } catch {
        return 0;
    }
};

// 从 URL 获取图片的 base64
const fetchImageAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const Footer: React.FC = () => {
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchMode, setBatchMode] = useState<'draft' | 'publish'>('draft');
    const [batchStage, setBatchStage] = useState<'confirm' | 'running' | 'done'>('confirm');
    const [batchItems, setBatchItems] = useState<Array<{ recordId: string; title: string; status: 'pending' | 'running' | 'success' | 'failed'; message?: string }>>([]);
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    const [manualCopyHtml, setManualCopyHtml] = useState('');
    const [isManualCopyModalOpen, setIsManualCopyModalOpen] = useState(false);
    const { currentRecord, fieldMapping, markdownContent, themeId, baseInfo, records, updateRecordFields, accountList } = useAppStore();

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

    const resolvePublishAccount = (record: typeof records[number] | null) => {
        if (!fieldMapping.accountFieldId) {
            return { ok: false, error: '请先在字段映射中选择发布账号字段' } as const;
        }
        if (!record) {
            return { ok: false, error: '当前没有选中记录' } as const;
        }
        if (!accountList.length) {
            return { ok: false, error: '未找到账号设置表，请先创建账号设置表并填写 AppID/AppSecret' } as const;
        }
        const accountResult = resolveAccountByValue(accountList, record.fields[fieldMapping.accountFieldId]);
        if (!accountResult.account) {
            if (!accountResult.key) {
                return { ok: false, error: '请在发布账号字段填写要发布的账号' } as const;
            }
            return { ok: false, error: `发布账号“${accountResult.key}”未在账号设置表找到` } as const;
        }
        return { ok: true, account: accountResult.account } as const;
    };

    const writeBackResult = async (recordId: string, status: string, draftId?: string, errorMsg?: string) => {
        if (!baseInfo.tableId) {
            return { success: false, message: '未连接表格' };
        }
        const fields: Record<string, any> = {};
        if (fieldMapping.statusFieldId) {
            fields[fieldMapping.statusFieldId] = status;
        }
        if (fieldMapping.draftIdFieldId && draftId) {
            fields[fieldMapping.draftIdFieldId] = draftId;
        }
        if (fieldMapping.syncTimeFieldId && status !== PublishStatus.FAILED) {
            fields[fieldMapping.syncTimeFieldId] = Date.now();
        }
        if (fieldMapping.errorFieldId) {
            fields[fieldMapping.errorFieldId] = errorMsg || '';
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

        // 从 recordMap 获取记录字段
        const record = recordMap.get(recordId);

        // 获取标题：优先从 titleFieldId 获取，否则从 markdown 提取
        let title = '';
        if (fieldMapping.titleFieldId && record?.fields[fieldMapping.titleFieldId]) {
            title = toText(record.fields[fieldMapping.titleFieldId]);
        }
        if (!title) {
            // 回退：从 markdown 内容提取标题
            const content = await getCellString(baseInfo.tableId, fieldMapping.contentFieldId, recordId);
            title = extractTitleFromMarkdown(content);
        }
        title = title.length > 64 ? title.slice(0, 64) : title;

        // 获取正文
        const content = await getCellString(baseInfo.tableId, fieldMapping.contentFieldId, recordId);

        // 获取其他字段
        let author: string | undefined;
        let digest: string | undefined;
        let contentSourceUrl: string | undefined;
        let coverImage: string | undefined;

        if (record) {
            const fields = record.fields;
            if (fieldMapping.authorFieldId && fields[fieldMapping.authorFieldId]) {
                author = toText(fields[fieldMapping.authorFieldId]) || undefined;
            }
            if (fieldMapping.digestFieldId && fields[fieldMapping.digestFieldId]) {
                digest = toText(fields[fieldMapping.digestFieldId]) || undefined;
            }
            if (fieldMapping.sourceUrlFieldId && fields[fieldMapping.sourceUrlFieldId]) {
                contentSourceUrl = toText(fields[fieldMapping.sourceUrlFieldId]) || undefined;
            }
        }

        // 获取封面图片
        if (fieldMapping.coverFieldId && isBitableAvailable()) {
            try {
                const attachments = await getAttachmentUrls(baseInfo.tableId, fieldMapping.coverFieldId, recordId);
                if (attachments.length > 0) {
                    coverImage = await fetchImageAsBase64(attachments[0].url);
                }
            } catch (e) {
                console.warn('获取封面图片失败:', e);
            }
        }

        return { title, content, author, digest, contentSourceUrl, coverImage };
    };

    const handleCopy = async () => {
        if (!markdownContent.trim()) {
            Toast.warning('正文为空，无法复制');
            return;
        }
        try {
            // 使用异步版本处理 img:// 协议
            const html = await buildWeChatHtmlAsync(markdownContent, themeId);
            const result = await copyHtmlToClipboard(html, themeId);

            if (result.needManualCopy) {
                // 自动复制失败，打开手动复制弹窗
                setManualCopyHtml(result.html);
                setIsManualCopyModalOpen(true);
                return;
            }

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
        if (!fieldMapping.contentFieldId) {
            Toast.warning('请先在字段映射中选择正文字段');
            return;
        }
        if (!fieldMapping.accountFieldId) {
            Toast.warning('请先在字段映射中选择发布账号字段');
            return;
        }
        setIsPublishModalOpen(true);
    };

    const handleBatchClick = async () => {
        if (!fieldMapping.contentFieldId) {
            Toast.warning('请先在字段映射中选择正文字段');
            return;
        }
        if (!fieldMapping.accountFieldId) {
            Toast.warning('请先在字段映射中选择发布账号字段');
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
                const record = recordMap.get(item.recordId) || null;
                const accountResult = resolvePublishAccount(record);
                if (!accountResult.ok) {
                    throw new Error(accountResult.error);
                }
                const article = await loadArticleFromRecord(item.recordId);
                if (!article.title.trim()) {
                    throw new Error('标题为空');
                }
                if (!article.content.trim()) {
                    throw new Error('正文为空');
                }
                const { html, missingImageIds } = await buildWeChatHtmlForPublish(article.content, themeId);
                logPublishDebug('batch-prepared', {
                    recordId: item.recordId,
                    titleLength: article.title.length,
                    markdownLength: article.content.length,
                    htmlLength: html.length,
                    imageCount: countImagesInHtml(html),
                    missingImageCount: missingImageIds.length,
                    hasAuthor: Boolean(article.author),
                    hasDigest: Boolean(article.digest),
                    hasSourceUrl: Boolean(article.contentSourceUrl),
                    hasCoverImage: Boolean(article.coverImage)
                });
                if (missingImageIds.length > 0) {
                    throw new Error(`有 ${missingImageIds.length} 张图片找不到（图片只保存在本机），请重新插入图片后再发布`);
                }
                const result = await publishArticle({
                    appId: accountResult.account.appId,
                    appSecret: accountResult.account.appSecret,
                    publishMode: batchMode,
                    article: {
                        title: article.title,
                        content: html,
                        author: article.author,
                        digest: article.digest,
                        contentSourceUrl: article.contentSourceUrl,
                        coverImage: article.coverImage
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
                logPublishDebug('batch-error', {
                    recordId: item.recordId,
                    message,
                    details: (error as { details?: unknown }).details
                });
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
                <Button type="secondary" onClick={handleCopy}>📋 复制到公众号</Button>
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
                    const accountResult = resolvePublishAccount(currentRecord);
                    if (!accountResult.ok) {
                        Toast.error(accountResult.error);
                        return;
                    }
                    try {
                        setIsPublishing(true);
                        const { html, missingImageIds } = await buildWeChatHtmlForPublish(markdownContent, themeId);

                        // 从当前记录中获取所有字段
                        let title = '';
                        let author: string | undefined;
                        let digest: string | undefined;
                        let contentSourceUrl: string | undefined;
                        let coverImage: string | undefined;

                        if (currentRecord) {
                            const fields = currentRecord.fields;
                            // 获取标题：优先从 titleFieldId 获取
                            if (fieldMapping.titleFieldId && fields[fieldMapping.titleFieldId]) {
                                title = toText(fields[fieldMapping.titleFieldId]);
                            }
                            // 获取作者
                            if (fieldMapping.authorFieldId && fields[fieldMapping.authorFieldId]) {
                                author = toText(fields[fieldMapping.authorFieldId]) || undefined;
                            }
                            // 获取摘要
                            if (fieldMapping.digestFieldId && fields[fieldMapping.digestFieldId]) {
                                digest = toText(fields[fieldMapping.digestFieldId]) || undefined;
                            }
                            // 获取原文链接
                            if (fieldMapping.sourceUrlFieldId && fields[fieldMapping.sourceUrlFieldId]) {
                                contentSourceUrl = toText(fields[fieldMapping.sourceUrlFieldId]) || undefined;
                            }
                            // 获取封面图片
                            if (fieldMapping.coverFieldId && baseInfo.tableId && isBitableAvailable()) {
                                try {
                                    const attachments = await getAttachmentUrls(baseInfo.tableId, fieldMapping.coverFieldId, currentRecord.recordId);
                                    if (attachments.length > 0) {
                                        coverImage = await fetchImageAsBase64(attachments[0].url);
                                    }
                                } catch (e) {
                                    console.warn('获取封面图片失败:', e);
                                }
                            }
                        }

                        // 回退：如果没有从字段获取到标题，从 markdown 提取
                        if (!title) {
                            title = getTitle();
                        }
                        title = title.trim();
                        if (title.length > 64) {
                            title = title.slice(0, 64);
                        }

                        logPublishDebug('single-prepared', {
                            titleLength: title.length,
                            markdownLength: markdownContent.length,
                            htmlLength: html.length,
                            imageCount: countImagesInHtml(html),
                            missingImageCount: missingImageIds.length,
                            hasAuthor: Boolean(author),
                            hasDigest: Boolean(digest),
                            hasSourceUrl: Boolean(contentSourceUrl),
                            hasCoverImage: Boolean(coverImage)
                        });
                        if (missingImageIds.length > 0) {
                            Toast.error(`有 ${missingImageIds.length} 张图片找不到（图片只保存在本机），请重新插入图片后再发布`);
                            return;
                        }
                        const result = await publishArticle({
                            appId: accountResult.account.appId,
                            appSecret: accountResult.account.appSecret,
                            publishMode: mode,
                            article: {
                                title,
                                content: html,
                                author,
                                digest,
                                contentSourceUrl,
                                coverImage
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
                        logPublishDebug('single-error', {
                            message,
                            details: (error as { details?: unknown }).details
                        });
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
            <ManualCopyModal
                visible={isManualCopyModalOpen}
                html={manualCopyHtml}
                onClose={() => setIsManualCopyModalOpen(false)}
            />
        </>
    );
};

export default Footer;
