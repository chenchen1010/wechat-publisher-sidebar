import React, { useMemo } from 'react';
import { Modal, RadioGroup, Radio, Typography } from '@douyinfe/semi-ui';

interface BatchItem {
    recordId: string;
    title: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    message?: string;
}

interface Props {
    visible: boolean;
    mode: 'draft' | 'publish';
    stage: 'confirm' | 'running' | 'done';
    items: BatchItem[];
    running: boolean;
    onModeChange: (mode: 'draft' | 'publish') => void;
    onCancel: () => void;
    onConfirm: () => void;
    onClose: () => void;
}

const statusLabelMap: Record<BatchItem['status'], string> = {
    pending: '等待中',
    running: '发布中',
    success: '成功',
    failed: '失败'
};

const BatchPublishModal: React.FC<Props> = ({ visible, mode, stage, items, running, onModeChange, onCancel, onConfirm, onClose }) => {
    const summary = useMemo(() => {
        const success = items.filter((item) => item.status === 'success').length;
        const failed = items.filter((item) => item.status === 'failed').length;
        return { success, failed };
    }, [items]);

    const failedItems = items.filter((item) => item.status === 'failed');

    return (
        <Modal
            title="批量发布"
            visible={visible}
            onCancel={onCancel}
            onOk={stage === 'confirm' ? onConfirm : onClose}
            okText={stage === 'confirm' ? '开始发布' : '完成'}
            okButtonProps={{ loading: running, disabled: stage === 'running' }}
            cancelText="取消"
            cancelButtonProps={{ disabled: running }}
            maskClosable={!running}
            closable={!running}
        >
            {stage === 'confirm' && (
                <>
                    <Typography.Text>已选择 {items.length} 篇文章。</Typography.Text>
                    <div style={{ marginTop: 16 }}>
                        <Typography.Text>发布模式</Typography.Text>
                        <RadioGroup
                            type="button"
                            value={mode}
                            onChange={(e) => onModeChange(e.target.value as 'draft' | 'publish')}
                        >
                            <Radio value="draft">存为草稿</Radio>
                            <Radio value="publish">直接发布</Radio>
                        </RadioGroup>
                    </div>
                    <Typography.Text type="tertiary" style={{ display: 'block', marginTop: 12 }}>
                        封面将自动使用正文第一张图片
                    </Typography.Text>
                </>
            )}

            {stage === 'running' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Typography.Text>
                        正在发布 ({summary.success + summary.failed}/{items.length})...
                    </Typography.Text>
                    <div className="batch-progress-list">
                        {items.map((item) => (
                            <div key={item.recordId} className={`batch-progress-item status-${item.status}`}>
                                <span>{item.title || item.recordId}</span>
                                <span>{statusLabelMap[item.status]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {stage === 'done' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Typography.Text>✅ 成功：{summary.success} 篇</Typography.Text>
                    <Typography.Text>❌ 失败：{summary.failed} 篇</Typography.Text>
                    {failedItems.length > 0 && (
                        <div className="batch-failed-list">
                            {failedItems.map((item) => (
                                <Typography.Text type="tertiary" key={item.recordId}>
                                    {item.title || item.recordId}：{item.message || '发布失败'}
                                </Typography.Text>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default BatchPublishModal;
