import React, { useEffect, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import TopNav from './components/TopNav';
import ConfigPanel from './components/ConfigPanel';
import Workspace from './components/Workspace';
import Footer from './components/Footer';
import { FieldType } from '@lark-base-open/js-sdk';
import { isBitableAvailable, getSelection, getTable, getView, getFieldMetaList, toFieldList, getVisibleRecordIdList, getAllRecords, loadFieldMapping, saveFieldMapping, onSelectionChange, onRecordModify } from './services/bitable';

const createMockData = () => {
    const mockRecords = Array.from({ length: 20 }).map((_, i) => ({
        recordId: `rec_mock_${i}`,
        fields: {
            fldContent: `# 文章 ${i + 1}\n\n这是文章内容...`
        }
    }));
    const mockFields = [
        { id: 'fldContent', name: 'Markdown内容', type: FieldType.Text },
        { id: 'fldStatus', name: '发布状态', type: FieldType.SingleSelect },
        { id: 'fldPublishId', name: '草稿/发布ID', type: FieldType.Text },
        { id: 'fldPublishTime', name: '发布时间', type: FieldType.DateTime },
    ];
    return { mockRecords, mockFields };
};

const matchFieldIdByName = (fields: { id: string; name: string }[], candidates: string[]) => {
    const exact = fields.find((field) => candidates.includes(field.name));
    if (exact) {
        return exact.id;
    }
    const lowerCandidates = candidates.map((name) => name.toLowerCase());
    const fuzzy = fields.find((field) => lowerCandidates.some((name) => field.name.toLowerCase().includes(name)));
    return fuzzy?.id || '';
};

const App: React.FC = () => {
  const {
      setRecords,
      setFields,
      setBaseInfo,
      setLoading,
      setFieldMapping,
      setCurrentRecordById,
      updateRecord,
      fieldMapping,
      baseInfo
  } = useAppStore();
  const tableRef = useRef<Awaited<ReturnType<typeof getTable>> | null>(null);
  const offRecordModifyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let offSelection: (() => void) | null = null;

    const initMock = () => {
        const { mockRecords, mockFields } = createMockData();
        setBaseInfo({ isReady: true, isMock: true });
        setFields(mockFields);
        setRecords(mockRecords);
        setFieldMapping({
            contentFieldId: 'fldContent',
            statusFieldId: 'fldStatus',
            publishIdFieldId: 'fldPublishId',
            publishTimeFieldId: 'fldPublishTime',
        });
    };

    const refreshData = async () => {
        setLoading(true);
        try {
            const selection = await getSelection();
            const baseId = selection.baseId || '';
            const tableId = selection.tableId || '';
            const viewId = selection.viewId || '';
            const recordId = selection.recordId || '';

            if (!tableId) {
                setBaseInfo({ baseId, tableId, viewId, isReady: false, isMock: false });
                setLoading(false);
                return;
            }

            const table = await getTable(tableId);
            const view = await getView(table, viewId);
            const fieldMetaList = await getFieldMetaList(table, view);
            const fieldList = toFieldList(fieldMetaList);

            const visibleRecordIds = await getVisibleRecordIdList(view);
            const records = await getAllRecords(table, view?.id || viewId);
            const recordMap = new Map(records.map((record) => [record.recordId, record]));
            const orderedRecords = visibleRecordIds.length
                ? visibleRecordIds.map((id) => recordMap.get(id)).filter(Boolean) as typeof records
                : records;

            setBaseInfo({ baseId, tableId, viewId: view?.id || viewId, isReady: true, isMock: false });
            setFields(fieldList);
            setRecords(orderedRecords);

            if (recordId) {
                setCurrentRecordById(recordId);
            }

            if (!tableRef.current || tableRef.current.id !== table.id) {
                if (offRecordModifyRef.current) {
                    offRecordModifyRef.current();
                }
                offRecordModifyRef.current = onRecordModify(table, async (event) => {
                    const modifiedRecordId = event?.data?.recordId;
                    if (!modifiedRecordId) {
                        return;
                    }
                    try {
                        const recordValue = await table.getRecordById(modifiedRecordId);
                        updateRecord({
                            recordId: modifiedRecordId,
                            fields: recordValue.fields || {}
                        });
                    } catch {
                        // ignore
                    }
                });
                tableRef.current = table;
            }

            const storedMapping = await loadFieldMapping(tableId);
            if (storedMapping && typeof storedMapping === 'object') {
                const nextMapping = storedMapping as Record<string, string>;
                setFieldMapping({
                    contentFieldId: nextMapping.contentFieldId || '',
                    statusFieldId: nextMapping.statusFieldId || '',
                    publishIdFieldId: nextMapping.publishIdFieldId || '',
                    publishTimeFieldId: nextMapping.publishTimeFieldId || ''
                });
            }

            const currentMapping = useAppStore.getState().fieldMapping;
            const nextMapping: Partial<typeof currentMapping> = {};
            if (!currentMapping.contentFieldId) {
                const textField = fieldList.find((field) => field.type === FieldType.Text);
                if (textField) {
                    nextMapping.contentFieldId = textField.id;
                }
            }
            if (!currentMapping.statusFieldId) {
                nextMapping.statusFieldId = matchFieldIdByName(fieldList, ['发布状态', '状态', '发布结果']);
            }
            if (!currentMapping.publishIdFieldId) {
                nextMapping.publishIdFieldId = matchFieldIdByName(fieldList, ['草稿/发布ID', '草稿ID/发布ID', '草稿ID', '发布ID']);
            }
            if (!currentMapping.publishTimeFieldId) {
                nextMapping.publishTimeFieldId = matchFieldIdByName(fieldList, ['发布时间', '发布日']);
            }
            if (Object.keys(nextMapping).length > 0) {
                setFieldMapping(nextMapping);
            }
        } catch {
            initMock();
        } finally {
            setLoading(false);
        }
    };

    if (!isBitableAvailable()) {
        initMock();
        return undefined;
    }

    refreshData();
    offSelection = onSelectionChange(() => {
        refreshData();
    });

    return () => {
        if (offSelection) {
            offSelection();
        }
        if (offRecordModifyRef.current) {
            offRecordModifyRef.current();
        }
    };
  }, [setRecords, setFields, setBaseInfo, setLoading, setFieldMapping, setCurrentRecordById, updateRecord]);

  useEffect(() => {
      const save = async () => {
          if (!baseInfo.tableId || baseInfo.isMock || !isBitableAvailable()) {
              return;
          }
          await saveFieldMapping(baseInfo.tableId, fieldMapping as Record<string, string>);
      };
      save();
  }, [baseInfo.tableId, baseInfo.isMock, fieldMapping]);

  return (
    <div className="app-container">
      <TopNav />
      <ConfigPanel />
      <Workspace />
      <Footer />
    </div>
  );
};

export default App;
