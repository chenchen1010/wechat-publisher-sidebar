import React, { useMemo } from 'react';
import { Select, Button, Typography, Tag } from '@douyinfe/semi-ui';
import { IconSetting } from '@douyinfe/semi-icons';
import { FieldType } from '@lark-base-open/js-sdk';
import { useAppStore } from '../store/useAppStore';
import ApiSettingsModal from './ApiSettingsModal';
import { STYLES } from '../styles/huashengThemes';

const ConfigPanel: React.FC = () => {
    const {
        fieldMapping,
        setFieldMapping,
        themeId,
        setTheme,
        apiConfig,
        baseInfo,
        fields,
        ui,
        setApiModalOpen
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

    const isReady = baseInfo.isReady;

    return (
        <div className="config-panel">
            {/* Field Mapping Card */}
            <div className="field-mapping-card">
                <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Typography.Text>字段映射</Typography.Text>
                        <Tag
                            size="small"
                            color={apiConfig.hasConfigured ? 'green' : 'grey'}
                        >
                            {apiConfig.hasConfigured ? 'API 已配置' : 'API 未配置'}
                        </Tag>
                        <Tag size="small" color={isReady ? 'blue' : 'grey'}>
                            {baseInfo.isMock ? '本地演示' : (isReady ? '已连接表格' : '未连接表格')}
                        </Tag>
                    </div>
                    <Button
                        icon={<IconSetting />}
                        theme="borderless"
                        size="small"
                        type="tertiary"
                        onClick={() => setApiModalOpen(true)}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    <Typography.Text type="tertiary">
                        标题将自动取正文第一行，封面取正文第一张图
                    </Typography.Text>
                    <Typography.Text type="tertiary">
                        发布状态、发布时间、草稿/发布ID 会自动写回到同名字段（如果存在）
                    </Typography.Text>
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

            <ApiSettingsModal visible={ui.isApiModalOpen} onCancel={() => setApiModalOpen(false)} />
        </div>
    );
};

export default ConfigPanel;
