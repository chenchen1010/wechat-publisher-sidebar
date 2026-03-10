import { bitable, FieldType } from '@lark-base-open/js-sdk';
import type { IFieldMeta, IRecord, ITable, IView } from '@lark-base-open/js-sdk';

export type BitableField = {
    id: string;
    name: string;
    type: FieldType;
};

export const isBitableAvailable = () => {
    try {
        return Boolean(bitable?.base?.getSelection);
    } catch {
        return false;
    }
};

export const getSelection = async () => {
    return bitable.base.getSelection();
};

export const getTable = async (tableId?: string) => {
    if (tableId) {
        return bitable.base.getTableById(tableId);
    }
    return bitable.base.getActiveTable();
};

export const getView = async (table: ITable, viewId?: string | null) => {
    if (viewId) {
        try {
            return await table.getViewById(viewId);
        } catch {
            return null;
        }
    }
    const views = await table.getViewList();
    return views[0] || null;
};

export const getFieldMetaList = async (table: ITable, view: IView | null) => {
    if (view && view.getFieldMetaList) {
        return (await view.getFieldMetaList()) as IFieldMeta[];
    }
    return (await table.getFieldMetaList()) as IFieldMeta[];
};

export const toFieldList = (metaList: IFieldMeta[]): BitableField[] => {
    return metaList.map((meta) => ({
        id: meta.id,
        name: meta.name,
        type: meta.type as FieldType
    }));
};

export const getVisibleRecordIdList = async (view: IView | null) => {
    if (!view || !view.getVisibleRecordIdList) {
        return [] as string[];
    }
    const list = await view.getVisibleRecordIdList();
    return list.filter(Boolean) as string[];
};

export const getAllRecords = async (table: ITable, viewId?: string | null) => {
    const records: IRecord[] = [];
    let pageToken: string | undefined = undefined;
    let hasMore = true;

    const fetchPage = async (useViewId: boolean) => {
        return table.getRecords({
            pageSize: 5000,
            pageToken,
            viewId: useViewId && viewId ? viewId : undefined
        });
    };

    while (hasMore) {
        let response: Awaited<ReturnType<typeof table.getRecords>>;
        try {
            response = await fetchPage(true);
        } catch {
            response = await fetchPage(false);
        }
        records.push(...response.records);
        hasMore = response.hasMore;
        pageToken = response.pageToken;
    }

    return records;
};

export const selectRecordIdList = async (tableId: string, viewId: string) => {
    return bitable.ui.selectRecordIdList(tableId, viewId);
};

export const setRecords = async (tableId: string, records: IRecord[]) => {
    const table = await bitable.base.getTableById(tableId);
    return table.setRecords(records);
};

export const getCellString = async (tableId: string, fieldId: string, recordId: string) => {
    const table = await bitable.base.getTableById(tableId);
    return table.getCellString(fieldId, recordId);
};

export const setCellValue = async (tableId: string, fieldId: string, recordId: string, value: string) => {
    const table = await bitable.base.getTableById(tableId);
    return table.setCellValue(fieldId, recordId, value);
};

export const onSelectionChange = (callback: () => void) => {
    return bitable.base.onSelectionChange(callback);
};

export const onRecordModify = (table: ITable, callback: (ev: { data: { recordId: string; fieldIds: string[] } }) => void) => {
    return table.onRecordModify(callback);
};

const FIELD_MAPPING_KEY = 'wechat-publisher-field-mapping';

export const loadFieldMapping = async (tableId: string) => {
    try {
        return await bitable.bridge.getData(`${FIELD_MAPPING_KEY}:${tableId}`);
    } catch {
        return null;
    }
};

export const saveFieldMapping = async (tableId: string, mapping: Record<string, string>) => {
    try {
        await bitable.bridge.setData(`${FIELD_MAPPING_KEY}:${tableId}`, mapping);
    } catch {
        // ignore
    }
};

// 附件类型定义
export interface AttachmentInfo {
    name: string;
    url: string;
    size: number;
    type: string;
    token?: string;
}

// 从附件字段获取附件信息
export const getAttachmentUrls = async (tableId: string, fieldId: string, recordId: string): Promise<AttachmentInfo[]> => {
    if (!fieldId) {
        return [];
    }
    const table = await bitable.base.getTableById(tableId);
    const attachmentField = await table.getFieldById(fieldId);

    // 获取附件 URL
    const urls = await (attachmentField as any).getAttachmentUrls(recordId);
    if (!urls || !Array.isArray(urls)) {
        return [];
    }

    // 获取单元格值以获取文件名等信息
    const cellValue = await table.getCellValue(fieldId, recordId);
    const attachments = Array.isArray(cellValue) ? cellValue : [];

    return urls.map((url: string, index: number) => {
        const attachment = (attachments[index] || {}) as { name?: string; size?: number; type?: string; token?: string };
        return {
            name: attachment.name || `attachment_${index}`,
            url,
            size: attachment.size || 0,
            type: attachment.type || 'image/jpeg',
            token: attachment.token
        };
    });
};

// 批量更新记录字段
export interface UpdateRecordData {
    recordId: string;
    fields: Record<string, any>;
}

export const updateRecordFields = async (tableId: string, recordId: string, fields: Record<string, any>) => {
    const table = await bitable.base.getTableById(tableId);
    return table.setRecord(recordId, { fields });
};

// 批量更新多条记录
export const batchUpdateRecords = async (tableId: string, updates: UpdateRecordData[]) => {
    const table = await bitable.base.getTableById(tableId);
    const records = updates.map(u => ({
        recordId: u.recordId,
        fields: u.fields
    }));
    return table.setRecords(records);
};

// 获取单选字段的选项
export const getSingleSelectOptions = async (tableId: string, fieldId: string) => {
    if (!fieldId) {
        return [];
    }
    const table = await bitable.base.getTableById(tableId);
    const field = await table.getFieldById(fieldId);
    const meta = await field.getMeta();
    return (meta as any).property?.options || [];
};
