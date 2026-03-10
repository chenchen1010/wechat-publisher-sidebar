import { bitable } from '@lark-base-open/js-sdk';
import { isBitableAvailable } from './bitable';

// 公众号账号信息
export interface WechatAccount {
    recordId: string;
    name: string;        // 公众号账号名称
    appId: string;
    appSecret: string;
    accountType?: string; // 个人号/服务号
}

// 账号设置表的字段名称候选
const ACCOUNT_TABLE_NAMES = ['账号设置', '公众号账号', '账号配置', 'Account Settings'];
const NAME_FIELD_NAMES = ['公众号账号', '账号名称', '名称', 'name', '账号'];
const APPID_FIELD_NAMES = ['AppID', 'appId', 'app_id', 'APPID'];
const APPSECRET_FIELD_NAMES = ['AppSecret', 'appSecret', 'app_secret', 'APPSECRET'];
const ACCOUNT_TYPE_FIELD_NAMES = ['个人号', '账号类型', 'type', '类型'];

// 查找匹配的字段
const findFieldByNames = (fields: { id: string; name: string }[], candidates: string[]): string | null => {
    const lowerCandidates = candidates.map(c => c.toLowerCase());
    for (const field of fields) {
        if (candidates.includes(field.name)) {
            return field.id;
        }
        if (lowerCandidates.includes(field.name.toLowerCase())) {
            return field.id;
        }
    }
    return null;
};

// 提取文本值
const extractText = (value: unknown): string => {
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
                if (typeof item === 'object') {
                    if ('text' in item) {
                        return String((item as { text?: string }).text || '');
                    }
                    if ('name' in item) {
                        return String((item as { name?: string }).name || '');
                    }
                    if ('value' in item) {
                        return String((item as { value?: string }).value || '');
                    }
                    if ('recordId' in item) {
                        return String((item as { recordId?: string }).recordId || '');
                    }
                }
                if (typeof item === 'object' && 'link' in item) {
                    return String((item as { link?: string }).link || '');
                }
                return '';
            })
            .join('');
    }
    if (typeof value === 'object') {
        if ('text' in value) {
            return String((value as { text?: string }).text || '');
        }
        if ('name' in value) {
            return String((value as { name?: string }).name || '');
        }
        if ('value' in value) {
            return String((value as { value?: string }).value || '');
        }
        if ('recordId' in value) {
            return String((value as { recordId?: string }).recordId || '');
        }
        if ('id' in value) {
            return String((value as { id?: string }).id || '');
        }
    }
    return '';
};

const normalizeAccountKey = (value: string) => {
    return value.replace(/\s+/g, '').trim().toLowerCase();
};

const extractAccountKey = (value: unknown): string => {
    if (Array.isArray(value)) {
        for (const item of value) {
            const text = extractText(item).trim();
            if (text) {
                return text;
            }
        }
        return '';
    }
    return extractText(value).trim();
};

export const resolveAccountByValue = (accounts: WechatAccount[], value: unknown) => {
    const key = extractAccountKey(value);
    if (!key) {
        return { account: null, key: '' };
    }
    const normalized = normalizeAccountKey(key);
    let account = accounts.find(a => a.recordId === key || a.appId === key);
    if (!account) {
        account = accounts.find(a => normalizeAccountKey(a.name) === normalized);
    }
    if (!account) {
        account = accounts.find(a => normalizeAccountKey(a.appId) === normalized);
    }
    return { account: account || null, key };
};

// 获取账号设置表
const findAccountTable = async (): Promise<{ tableId: string; table: Awaited<ReturnType<typeof bitable.base.getTableById>> } | null> => {
    if (!isBitableAvailable()) {
        return null;
    }

    try {
        const tableList = await bitable.base.getTableList();

        for (const table of tableList) {
            const meta = await table.getMeta();
            const tableName = meta.name;

            // 检查表名是否匹配
            if (ACCOUNT_TABLE_NAMES.some(name => tableName.includes(name) || name.includes(tableName))) {
                return { tableId: table.id, table };
            }
        }

        return null;
    } catch (error) {
        console.error('查找账号设置表失败:', error);
        return null;
    }
};

// 从账号设置表获取所有账号
export const getAccountList = async (): Promise<WechatAccount[]> => {
    if (!isBitableAvailable()) {
        return [];
    }

    try {
        const accountTableInfo = await findAccountTable();
        if (!accountTableInfo) {
            console.warn('未找到账号设置表');
            return [];
        }

        const { table } = accountTableInfo;

        // 获取字段列表
        const fieldMetaList = await table.getFieldMetaList();
        const fields = fieldMetaList.map(f => ({ id: f.id, name: f.name }));

        // 查找字段映射
        const nameFieldId = findFieldByNames(fields, NAME_FIELD_NAMES);
        const appIdFieldId = findFieldByNames(fields, APPID_FIELD_NAMES);
        const appSecretFieldId = findFieldByNames(fields, APPSECRET_FIELD_NAMES);
        const accountTypeFieldId = findFieldByNames(fields, ACCOUNT_TYPE_FIELD_NAMES);

        if (!appIdFieldId || !appSecretFieldId) {
            console.warn('账号设置表缺少 AppID 或 AppSecret 字段');
            return [];
        }

        // 获取所有记录
        const records: WechatAccount[] = [];
        let pageToken: string | undefined;
        let hasMore = true;

        while (hasMore) {
            const response = await table.getRecords({
                pageSize: 100,
                pageToken
            });

            for (const record of response.records) {
                const appId = extractText(record.fields[appIdFieldId]).trim();
                const appSecret = extractText(record.fields[appSecretFieldId]).trim();

                // 只添加有效的账号（必须有 AppID 和 AppSecret）
                if (appId && appSecret) {
                    const name = nameFieldId ? extractText(record.fields[nameFieldId]).trim() : '';
                    records.push({
                        recordId: record.recordId,
                        name: name || appId,
                        appId,
                        appSecret,
                        accountType: accountTypeFieldId ? extractText(record.fields[accountTypeFieldId]).trim() : undefined
                    });
                }
            }

            hasMore = response.hasMore;
            pageToken = response.pageToken;
        }

        return records;
    } catch (error) {
        console.error('获取账号列表失败:', error);
        return [];
    }
};

// 根据 recordId 获取单个账号
export const getAccountById = async (recordId: string): Promise<WechatAccount | null> => {
    const accounts = await getAccountList();
    return accounts.find(a => a.recordId === recordId) || null;
};
