import { publishArticle } from './api';
import { getAttachmentUrls, updateRecordFields, isBitableAvailable } from './bitable';
import { buildWeChatHtmlForPublish } from '../utils/markdown';
import { resolveAccountByValue, type WechatAccount } from './accountService';

const DEBUG_PUBLISH = import.meta.env.VITE_DEBUG_PUBLISH === '1';

const logSyncDebug = (label: string, info: Record<string, unknown>) => {
    if (!DEBUG_PUBLISH) {
        return;
    }
    console.info(`[sync-debug] ${label}`, info);
};

// 发布状态枚举
export const PublishStatus = {
    PENDING: '待发布',
    SYNCING: '同步中',
    SYNCED: '已同步',
    FAILED: '失败'
} as const;

// 从记录中提取文本值
const extractText = (value: any): string => {
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
            .map((item) => {
                if (!item) return '';
                if (typeof item === 'string') return item;
                if (typeof item === 'object' && 'text' in item) {
                    return String(item.text || '');
                }
                if (typeof item === 'object' && 'link' in item) {
                    return String(item.link || '');
                }
                return '';
            })
            .join('');
    }
    if (typeof value === 'object') {
        if ('text' in value) return String(value.text || '');
        if ('link' in value) return String(value.link || '');
    }
    return '';
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

// 同步单条记录的参数
export interface SyncRecordParams {
    tableId: string;
    recordId: string;
    recordFields: Record<string, any>;
    fieldMapping: {
        titleFieldId: string;
        contentFieldId: string;
        coverFieldId: string;
        authorFieldId: string;
        digestFieldId: string;
        sourceUrlFieldId: string;
        accountFieldId: string;
        statusFieldId: string;
        syncTimeFieldId: string;
        draftIdFieldId: string;
        errorFieldId: string;
    };
    accountList: WechatAccount[];
    themeId?: string;
}

// 同步结果
export interface SyncResult {
    success: boolean;
    recordId: string;
    draftMediaId?: string;
    publishTime?: string;
    error?: string;
}

// 同步单条记录到草稿箱
export const syncRecordToDraft = async (params: SyncRecordParams): Promise<SyncResult> => {
    const { tableId, recordId, recordFields, fieldMapping, accountList, themeId } = params;

    try {
        // 1. 提取字段值
        const title = extractText(recordFields[fieldMapping.titleFieldId]);
        const content = extractText(recordFields[fieldMapping.contentFieldId]);
        const author = extractText(recordFields[fieldMapping.authorFieldId]);
        const digest = extractText(recordFields[fieldMapping.digestFieldId]);
        const sourceUrl = extractText(recordFields[fieldMapping.sourceUrlFieldId]);

        if (!title) {
            throw new Error('标题不能为空');
        }
        if (!content) {
            throw new Error('正文不能为空');
        }

        if (!fieldMapping.accountFieldId) {
            throw new Error('请先在字段映射中选择发布账号字段');
        }
        if (!accountList.length) {
            throw new Error('未找到账号设置表，请先创建账号设置表并填写 AppID/AppSecret');
        }
        const accountResult = resolveAccountByValue(accountList, recordFields[fieldMapping.accountFieldId]);
        if (!accountResult.account) {
            if (!accountResult.key) {
                throw new Error('请在发布账号字段填写要发布的账号');
            }
            throw new Error(`发布账号“${accountResult.key}”未在账号设置表找到`);
        }
        const { appId, appSecret } = accountResult.account;

        // 2. 更新状态为"同步中"
        if (isBitableAvailable() && fieldMapping.statusFieldId) {
            await updateRecordFields(tableId, recordId, {
                [fieldMapping.statusFieldId]: PublishStatus.SYNCING
            });
        }

        // 3. 转换 Markdown 为 HTML，并将本地图片转为 base64
        const { html: htmlContent, missingImageIds } = await buildWeChatHtmlForPublish(content, themeId || 'wechat-default');
        logSyncDebug('prepared', {
            recordId,
            titleLength: title.length,
            markdownLength: content.length,
            htmlLength: htmlContent.length,
            missingImageCount: missingImageIds.length
        });
        if (missingImageIds.length > 0) {
            throw new Error(`有 ${missingImageIds.length} 张图片找不到（图片只保存在本机），请重新插入图片后再发布`);
        }

        // 4. 获取封面图片（如果有）
        let coverImage: string | undefined;
        if (fieldMapping.coverFieldId) {
            try {
                const attachments = await getAttachmentUrls(tableId, fieldMapping.coverFieldId, recordId);
                if (attachments.length > 0) {
                    coverImage = await fetchImageAsBase64(attachments[0].url);
                }
            } catch (e) {
                console.warn('获取封面图片失败:', e);
            }
        }

        // 5. 调用发布 API
        const result = await publishArticle({
            appId,
            appSecret,
            publishMode: 'draft',
            article: {
                title,
                content: htmlContent,
                author: author || undefined,
                digest: digest || undefined,
                contentSourceUrl: sourceUrl || undefined,
                coverImage
            }
        });

        // 6. 回写成功结果
        const updateFields: Record<string, any> = {};
        if (fieldMapping.statusFieldId) {
            updateFields[fieldMapping.statusFieldId] = PublishStatus.SYNCED;
        }
        if (fieldMapping.syncTimeFieldId) {
            updateFields[fieldMapping.syncTimeFieldId] = Date.now();
        }
        if (fieldMapping.draftIdFieldId && result.draftMediaId) {
            updateFields[fieldMapping.draftIdFieldId] = result.draftMediaId;
        }
        if (fieldMapping.errorFieldId) {
            updateFields[fieldMapping.errorFieldId] = '';
        }

        if (isBitableAvailable() && Object.keys(updateFields).length > 0) {
            await updateRecordFields(tableId, recordId, updateFields);
        }

        return {
            success: true,
            recordId,
            draftMediaId: result.draftMediaId,
            publishTime: result.publishTime
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '同步失败';
        logSyncDebug('error', {
            recordId,
            message: errorMessage,
            details: (error as { details?: unknown }).details
        });

        // 回写失败结果
        const updateFields: Record<string, any> = {};
        if (fieldMapping.statusFieldId) {
            updateFields[fieldMapping.statusFieldId] = PublishStatus.FAILED;
        }
        if (fieldMapping.errorFieldId) {
            updateFields[fieldMapping.errorFieldId] = errorMessage;
        }

        if (isBitableAvailable() && Object.keys(updateFields).length > 0) {
            try {
                await updateRecordFields(tableId, recordId, updateFields);
            } catch (e) {
                console.error('回写错误信息失败:', e);
            }
        }

        return {
            success: false,
            recordId,
            error: errorMessage
        };
    }
};

// 批量同步多条记录
export const syncMultipleRecords = async (
    records: Array<{ recordId: string; fields: Record<string, any> }>,
    params: Omit<SyncRecordParams, 'recordId' | 'recordFields'>,
    onProgress?: (completed: number, total: number, result: SyncResult) => void
): Promise<SyncResult[]> => {
    const results: SyncResult[] = [];
    const total = records.length;

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const result = await syncRecordToDraft({
            ...params,
            recordId: record.recordId,
            recordFields: record.fields
        });
        results.push(result);

        if (onProgress) {
            onProgress(i + 1, total, result);
        }

        // 添加小延迟避免请求过快
        if (i < records.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
};
