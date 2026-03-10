import { create } from 'zustand';

export interface Record {
    recordId: string;
    fields: {
        [key: string]: any;
    };
}

export interface FieldMeta {
    id: string;
    name: string;
    type: number;
}

// 公众号账号信息
export interface WechatAccount {
    recordId: string;
    name: string;
    appId: string;
    appSecret: string;
    accountType?: string;
}

interface AppState {
    // --- Data Source ---
    baseInfo: {
        baseId: string;
        tableId: string;
        viewId: string;
        isReady: boolean;
        isMock: boolean;
    };
    fields: FieldMeta[];
    records: Record[];
    recordIdList: string[];
    currentIndex: number;
    currentRecord: Record | null;
    totalCount: number;
    isLoading: boolean;

    // --- Configuration ---
    fieldMapping: {
        // 输入字段
        titleFieldId: string;       // 标题
        contentFieldId: string;     // 正文（markdown格式）
        coverFieldId: string;       // 封面
        authorFieldId: string;      // 作者
        digestFieldId: string;      // 摘要
        sourceUrlFieldId: string;   // 原文链接
        accountFieldId: string;     // 发布账号
        // 输出字段
        statusFieldId: string;      // 发布状态
        syncTimeFieldId: string;    // 同步时间
        draftIdFieldId: string;     // 草稿ID
        errorFieldId: string;       // 错误信息
    };

    // --- Styling ---
    themeId: string;

    // --- Editor ---
    viewMode: 'edit' | 'preview';
    splitMode: boolean;
    markdownContent: string;

    // --- Shortcut ---
    shortcutKey: string;  // e.g. 'g' for Cmd/Ctrl+G

    // --- API Config ---
    apiConfig: {
        appId: string;
        appSecret: string;
        accountName: string;
        hasConfigured: boolean;
    };

    // --- 账号列表 ---
    accountList: WechatAccount[];
    selectedAccountId: string | null;  // 选中的账号 recordId

    ui: {
        isApiModalOpen: boolean;
    };

    // --- Actions ---
    setBaseInfo: (info: Partial<AppState['baseInfo']>) => void;
    setFields: (fields: FieldMeta[]) => void;
    setRecords: (records: Record[]) => void;
    setRecordIdList: (recordIdList: string[]) => void;
    setLoading: (loading: boolean) => void;
    setCurrentIndex: (index: number) => void;
    setCurrentRecordById: (recordId: string) => void;
    nextRecord: () => void;
    prevRecord: () => void;
    setViewMode: (mode: 'edit' | 'preview') => void;
    toggleViewMode: () => void;
    setSplitMode: (enabled: boolean) => void;
    setShortcutKey: (key: string) => void;
    updateMarkdown: (content: string) => void;
    setFieldMapping: (mapping: Partial<AppState['fieldMapping']>) => void;
    setTheme: (themeId: string) => void;
    setApiConfig: (config: Partial<AppState['apiConfig']>) => void;
    clearApiConfig: () => void;
    setApiModalOpen: (open: boolean) => void;
    updateRecord: (record: Record) => void;
    updateRecordFields: (recordId: string, fields: Record['fields']) => void;
    setAccountList: (accounts: WechatAccount[]) => void;
    selectAccount: (accountId: string | null) => void;
}

const API_STORAGE_KEY = 'wechat-publisher-api-config';

const loadApiConfig = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return {
            appId: '',
            appSecret: '',
            accountName: '',
            hasConfigured: false
        };
    }
    try {
        const raw = window.localStorage.getItem(API_STORAGE_KEY);
        if (!raw) {
            return {
                appId: '',
                appSecret: '',
                accountName: '',
                hasConfigured: false
            };
        }
        const parsed = JSON.parse(raw) as {
            appId?: string;
            appSecret?: string;
            accountName?: string;
        };
        const appId = parsed.appId || '';
        const appSecret = parsed.appSecret || '';
        return {
            appId,
            appSecret,
            accountName: parsed.accountName || '',
            hasConfigured: Boolean(appId && appSecret)
        };
    } catch {
        return {
            appId: '',
            appSecret: '',
            accountName: '',
            hasConfigured: false
        };
    }
};

const persistApiConfig = (config: { appId: string; appSecret: string; accountName: string }) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    window.localStorage.setItem(API_STORAGE_KEY, JSON.stringify(config));
};

const clearApiConfigStorage = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    window.localStorage.removeItem(API_STORAGE_KEY);
};

const SHORTCUT_STORAGE_KEY = 'wechat-publisher-shortcut';

const loadShortcutKey = (): string => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return 'g';
    }
    try {
        const saved = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
        return saved || 'g';
    } catch {
        return 'g';
    }
};

const persistShortcutKey = (key: string) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    window.localStorage.setItem(SHORTCUT_STORAGE_KEY, key);
};

const FIELD_MAPPING_STORAGE_PREFIX = 'wechat-publisher-field-mapping-';

type FieldMappingConfig = {
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

const loadFieldMapping = (tableId: string): FieldMappingConfig | null => {
    if (!tableId || typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    try {
        const saved = window.localStorage.getItem(FIELD_MAPPING_STORAGE_PREFIX + tableId);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch {
        // ignore
    }
    return null;
};

const persistFieldMapping = (tableId: string, mapping: FieldMappingConfig) => {
    if (!tableId || typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(FIELD_MAPPING_STORAGE_PREFIX + tableId, JSON.stringify(mapping));
    } catch {
        // ignore
    }
};

const extractText = (value: any) => {
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
                if (!item) {
                    return '';
                }
                if (typeof item === 'string') {
                    return item;
                }
                if (typeof item === 'object' && 'text' in item) {
                    return String((item as { text?: string }).text || '');
                }
                return '';
            })
            .join('');
    }
    if (typeof value === 'object' && 'text' in value) {
        return String((value as { text?: string }).text || '');
    }
    return '';
};

export const useAppStore = create<AppState>((set, get) => ({
    baseInfo: {
        baseId: '',
        tableId: '',
        viewId: '',
        isReady: false,
        isMock: false,
    },
    fields: [],
    records: [],
    recordIdList: [],
    currentIndex: 0,
    currentRecord: null,
    totalCount: 0,
    isLoading: false,

    fieldMapping: {
        titleFieldId: '',
        contentFieldId: '',
        coverFieldId: '',
        authorFieldId: '',
        digestFieldId: '',
        sourceUrlFieldId: '',
        accountFieldId: '',
        statusFieldId: '',
        syncTimeFieldId: '',
        draftIdFieldId: '',
        errorFieldId: '',
    },

    themeId: 'wechat-default',

    viewMode: 'preview',
    splitMode: false,
    markdownContent: '',

    shortcutKey: loadShortcutKey(),

    apiConfig: {
        ...loadApiConfig(),
    },

    accountList: [],
    selectedAccountId: null,

    ui: {
        isApiModalOpen: false,
    },

    setBaseInfo: (info) => set((state) => {
        const newBaseInfo = { ...state.baseInfo, ...info };
        // 如果表格 ID 变化，尝试加载保存的字段映射
        if (info.tableId && info.tableId !== state.baseInfo.tableId) {
            const savedMapping = loadFieldMapping(info.tableId);
            if (savedMapping) {
                const normalizedMapping = {
                    ...savedMapping,
                    accountFieldId: savedMapping.accountFieldId || ''
                };
                const content = extractText(state.currentRecord?.fields[normalizedMapping.contentFieldId]);
                return {
                    baseInfo: newBaseInfo,
                    fieldMapping: normalizedMapping,
                    markdownContent: content
                };
            }
        }
        return { baseInfo: newBaseInfo };
    }),
    setFields: (fields) => set({ fields }),
    setRecords: (records) => {
        const { fieldMapping, currentRecord } = get();
        const recordIdList = records.map((record) => record.recordId);
        let nextIndex = 0;
        let nextRecord = records[0] || null;
        if (currentRecord) {
            const foundIndex = recordIdList.indexOf(currentRecord.recordId);
            if (foundIndex >= 0) {
                nextIndex = foundIndex;
                nextRecord = records[foundIndex];
            }
        }
        const content = extractText(nextRecord?.fields[fieldMapping.contentFieldId]);
        set({
            records,
            recordIdList,
            totalCount: records.length,
            currentRecord: nextRecord,
            currentIndex: nextIndex,
            markdownContent: content
        });
    },
    setRecordIdList: (recordIdList) => set({ recordIdList }),
    setLoading: (loading) => set({ isLoading: loading }),

    setCurrentIndex: (index) => {
        const { totalCount, records, fieldMapping } = get();
        if (index >= 0 && index < totalCount) {
            const record = records[index];
            const content = extractText(record.fields[fieldMapping.contentFieldId]);
            set({
                currentIndex: index,
                currentRecord: record,
                markdownContent: content
            });
        }
    },
    setCurrentRecordById: (recordId) => {
        const { recordIdList, records } = get();
        const index = recordIdList.indexOf(recordId);
        if (index >= 0 && records[index]) {
            get().setCurrentIndex(index);
        }
    },

    nextRecord: () => {
        const { currentIndex, totalCount } = get();
        if (currentIndex < totalCount - 1) {
            get().setCurrentIndex(currentIndex + 1);
        }
    },

    prevRecord: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
            get().setCurrentIndex(currentIndex - 1);
        }
    },

    setViewMode: (mode) => set({ viewMode: mode }),
    toggleViewMode: () => set((state) => ({ viewMode: state.viewMode === 'edit' ? 'preview' : 'edit' })),
    setSplitMode: (enabled) => set({ splitMode: enabled }),
    setShortcutKey: (key) => {
        persistShortcutKey(key);
        set({ shortcutKey: key });
    },
    updateMarkdown: (content) => set({ markdownContent: content }),

    setFieldMapping: (mapping) => set((state) => {
        const newMapping = { ...state.fieldMapping, ...mapping };
        const content = extractText(state.currentRecord?.fields[newMapping.contentFieldId]);
        // 保存到 localStorage
        if (state.baseInfo.tableId) {
            persistFieldMapping(state.baseInfo.tableId, newMapping);
        }
        return { fieldMapping: newMapping, markdownContent: content };
    }),
    setTheme: (themeId) => set({ themeId }),
    setApiConfig: (config) => set((state) => {
        const updated = {
            ...state.apiConfig,
            ...config,
        };
        const normalized = {
            appId: updated.appId || '',
            appSecret: updated.appSecret || '',
            accountName: updated.accountName || '',
        };
        const hasConfigured = Boolean(normalized.appId && normalized.appSecret);
        persistApiConfig(normalized);
        return {
            apiConfig: {
                ...normalized,
                hasConfigured
            }
        };
    }),
    clearApiConfig: () => {
        clearApiConfigStorage();
        set({
            apiConfig: {
                appId: '',
                appSecret: '',
                accountName: '',
                hasConfigured: false
            }
        });
    },
    setApiModalOpen: (open) => set((state) => ({ ui: { ...state.ui, isApiModalOpen: open } })),
    updateRecord: (record) => set((state) => {
        const index = state.recordIdList.indexOf(record.recordId);
        if (index === -1) {
            return state;
        }
        const updatedRecords = [...state.records];
        updatedRecords[index] = record;
        const isCurrent = state.currentRecord?.recordId === record.recordId;
        return {
            records: updatedRecords,
            currentRecord: isCurrent ? record : state.currentRecord,
            markdownContent: isCurrent
                ? extractText(record.fields[state.fieldMapping.contentFieldId])
                : state.markdownContent
        };
    }),
    updateRecordFields: (recordId, fields) => set((state) => {
        const index = state.recordIdList.indexOf(recordId);
        if (index === -1) {
            return state;
        }
        const record = state.records[index];
        const updatedRecord = {
            ...record,
            fields: {
                ...record.fields,
                ...fields
            }
        };
        const updatedRecords = [...state.records];
        updatedRecords[index] = updatedRecord;
        const isCurrent = state.currentRecord?.recordId === recordId;
        return {
            records: updatedRecords,
            currentRecord: isCurrent ? updatedRecord : state.currentRecord,
            markdownContent: isCurrent
                ? extractText(updatedRecord.fields[state.fieldMapping.contentFieldId])
                : state.markdownContent
        };
    }),
    setAccountList: (accounts) => set({ accountList: accounts }),
    selectAccount: (accountId) => set((state) => {
        if (!accountId) {
            return { selectedAccountId: null };
        }
        const account = state.accountList.find(a => a.recordId === accountId);
        if (account) {
            // 同时更新 apiConfig
            return {
                selectedAccountId: accountId,
                apiConfig: {
                    appId: account.appId,
                    appSecret: account.appSecret,
                    accountName: account.name,
                    hasConfigured: true
                }
            };
        }
        return { selectedAccountId: accountId };
    }),
}));
