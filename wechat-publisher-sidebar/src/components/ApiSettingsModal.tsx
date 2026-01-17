import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Form, Button, Toast, Typography, Input, Divider } from '@douyinfe/semi-ui';
import { useAppStore } from '../store/useAppStore';
import { verifyApiConfig } from '../services/api';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';

interface Props {
    visible: boolean;
    onCancel: () => void;
}

const ApiSettingsModal: React.FC<Props> = ({ visible, onCancel }) => {
    const { apiConfig, setApiConfig, clearApiConfig, shortcutKey, setShortcutKey } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [tempKey, setTempKey] = useState('');
    const formApiRef = useRef<any>(null);

    useEffect(() => {
        if (visible) {
            formApiRef.current?.setValues({
                appId: apiConfig.appId,
                appSecret: apiConfig.appSecret
            });
            setTempKey(shortcutKey);
        }
    }, [visible, apiConfig.appId, apiConfig.appSecret, shortcutKey]);

    const handleSubmit = async (values: { appId?: string; appSecret?: string }) => {
        const appId = values.appId?.trim() || '';
        const appSecret = values.appSecret?.trim() || '';

        if (!appId || !appSecret) {
            Toast.warning('请填写 AppID 和 AppSecret');
            return;
        }

        try {
            setLoading(true);
            const result = await verifyApiConfig(appId, appSecret);
            setApiConfig({
                appId,
                appSecret,
                accountName: result.accountName || ''
            });
            Toast.success('验证成功，已保存配置');
            onCancel();
        } catch (error) {
            const message = error instanceof Error ? error.message : '验证失败';
            Toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        clearApiConfig();
        formApiRef.current?.setValues({ appId: '', appSecret: '' });
        Toast.success('已清除配置');
    };

    // 快捷键录制
    const handleKeyRecord = useCallback((e: React.KeyboardEvent) => {
        if (!isRecording) return;

        e.preventDefault();
        e.stopPropagation();

        // 忽略修饰键本身
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            return;
        }

        // 只接受字母键
        const key = e.key.toLowerCase();
        if (/^[a-z]$/.test(key)) {
            setTempKey(key);
            setShortcutKey(key);
            setIsRecording(false);
            Toast.success(`快捷键已设置为 ${modKey}+${key.toUpperCase()}`);
        } else {
            Toast.warning('请按一个字母键（A-Z）');
        }
    }, [isRecording, setShortcutKey]);

    const startRecording = () => {
        setIsRecording(true);
    };

    const cancelRecording = () => {
        setIsRecording(false);
        setTempKey(shortcutKey);
    };

    return (
        <Modal
            title="设置"
            visible={visible}
            onCancel={onCancel}
            footer={null}
            style={{ maxWidth: 400 }}
        >
            {/* 快捷键设置 */}
            <div style={{ marginBottom: 16 }}>
                <Typography.Title heading={6} style={{ marginBottom: 8 }}>快捷键</Typography.Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Typography.Text type="tertiary">编辑/预览切换：</Typography.Text>
                    {isRecording ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Input
                                size="small"
                                style={{ width: 120 }}
                                value="按下键盘..."
                                onKeyDown={handleKeyRecord}
                                autoFocus
                                readOnly
                            />
                            <Button size="small" type="tertiary" onClick={cancelRecording}>
                                取消
                            </Button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Typography.Text strong>
                                {modKey}+{tempKey.toUpperCase()}
                            </Typography.Text>
                            <Button size="small" type="tertiary" onClick={startRecording}>
                                修改
                            </Button>
                        </div>
                    )}
                </div>
                <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                    按下 {modKey}+S 可保存内容到表格
                </Typography.Text>
            </div>

            <Divider margin={16} />

            {/* API 配置 */}
            <Typography.Title heading={6} style={{ marginBottom: 8 }}>公众号 API</Typography.Title>
            <div style={{ marginBottom: 12 }}>
                <Typography.Text type="tertiary" size="small">
                    AppSecret 仅保存在本设备，不会上传到服务器。
                </Typography.Text>
                <br />
                <Typography.Text type="tertiary" size="small">
                    如果验证失败，请先检查 IP 白名单是否已配置。
                </Typography.Text>
            </div>
            <Form
                labelPosition="top"
                getFormApi={(api) => {
                    formApiRef.current = api;
                }}
                onSubmit={handleSubmit}
            >
                <Form.Input field="appId" label="AppID" placeholder="请输入公众号 AppID" />
                <Form.Input field="appSecret" label="AppSecret" mode="password" placeholder="请输入 AppSecret (仅保存在本地)" />
                <Button theme="solid" type="primary" block loading={loading} htmlType="submit" style={{ marginTop: 16 }}>
                    验证并保存
                </Button>
                <Button type="tertiary" block style={{ marginTop: 8 }} onClick={handleClear}>
                    清除配置
                </Button>
            </Form>
        </Modal>
    );
};

export default ApiSettingsModal;
