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
