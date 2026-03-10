import React, { useMemo } from 'react';
import { Select, Typography, Tag, Tooltip } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';
import { FieldType } from '@lark-base-open/js-sdk';
import { useAppStore } from '../store/useAppStore';
import { STYLES } from '../styles/huashengThemes';

const ConfigPanel: React.FC = () => {
    const {
        fieldMapping,
        setFieldMapping,
        themeId,
        setTheme,
        baseInfo,
        fields,
        accountList
    } = useAppStore();

    const themes = Object.entries(STYLES).map(([id, value]) => ({
        id,
        name: value.name
    }));

    const handleMappingChange = (key: keyof typeof fieldMapping) => (value: string | number | any[] | Record<string, any> | undefined) => {
        const nextValue = Array.isArray(value) ? value[0] : value;
        setFieldMapping({ [key]: nextValue ? String(nextValue) : '' } as Partial<typeof fieldMapping>);
    };

    const buildOptions = (types: FieldType[]) => {
        return fields
            .filter((field) => types.includes(field.type as FieldType))
            .map((field) => ({
                label: field.name,
                value: field.id
            }));
    };

    const textOptions = useMemo(() => buildOptions([FieldType.Text]), [fields]);

    const accountFieldOptions = useMemo(
        () => buildOptions([FieldType.Text, FieldType.SingleSelect]),
        [fields]
    );

    const isReady = baseInfo.isReady;
    const hasAccounts = accountList.length > 0;

    const helpContent = (
        <div style={{ maxWidth: 240, lineHeight: 1.6, fontSize: 12 }}>
            <div>• 标题取正文第一行</div>
            <div>• 封面取正文第一张图</div>
            <div>• 发布账号取“发布账号”字段</div>
            <div style={{ marginTop: 6 }}>以下字段如存在会自动写回：</div>
            <div>• 发布状态、发布时间、草稿ID</div>
        </div>
    );

    return (
        <div className="config-panel">
            {/* Field Mapping Card */}
            <div className="field-mapping-card">
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Typography.Text>字段映射</Typography.Text>
                        <Tooltip content={helpContent} position="bottomLeft">
                            <IconInfoCircle style={{ color: 'var(--semi-color-text-2)', cursor: 'help' }} />
                        </Tooltip>
                        <Tag size="small" color={hasAccounts ? 'green' : 'grey'}>
                            {hasAccounts ? '账号表已加载' : '未找到账号表'}
                        </Tag>
                        <Tag size="small" color={isReady ? 'blue' : 'grey'}>
                            {baseInfo.isMock ? '本地演示' : (isReady ? '已连接表格' : '未连接表格')}
                        </Tag>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography.Text type="tertiary">Markdown 正文</Typography.Text>
                    <Select
                        size="small"
                        style={{ width: 160 }}
                        optionList={textOptions}
                        value={fieldMapping.contentFieldId}
                        onChange={handleMappingChange('contentFieldId')}
                        placeholder="选择正文字段"
                        disabled={!isReady}
                        showClear
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Typography.Text type="tertiary">发布账号</Typography.Text>
                    <Select
                        size="small"
                        style={{ width: 160 }}
                        optionList={accountFieldOptions}
                        value={fieldMapping.accountFieldId}
                        onChange={handleMappingChange('accountFieldId')}
                        placeholder="选择发布账号字段"
                        disabled={!isReady}
                        showClear
                    />
                </div>
            </div>

            {/* Style Config Card */}
            <div className="style-config-card">
                <div className="card-header">
                    <Typography.Text>排版样式</Typography.Text>
                </div>
                <div className="theme-selector">
                    {themes.map(t => (
                        <Tag
                            key={t.id}
                            type={themeId === t.id ? 'solid' : 'ghost'}
                            color={themeId === t.id ? 'blue' : 'grey'}
                            onClick={() => setTheme(t.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            {t.name}
                        </Tag>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default ConfigPanel;
