import React, { useEffect, useState } from 'react';
import { Modal, RadioGroup, Radio, Typography } from '@douyinfe/semi-ui';

interface Props {
    visible: boolean;
    onCancel: () => void;
    onConfirm: (mode: 'draft' | 'publish') => void;
    confirmLoading?: boolean;
}

const PublishConfirmModal: React.FC<Props> = ({ visible, onCancel, onConfirm, confirmLoading }) => {
    const [mode, setMode] = useState<'draft' | 'publish'>('draft');

    useEffect(() => {
        if (!visible) {
            setMode('draft');
        }
    }, [visible]);

    return (
        <Modal
            title="发布到公众号"
            visible={visible}
            onCancel={onCancel}
            onOk={() => onConfirm(mode)}
            okText="确认发布"
            okButtonProps={{ loading: confirmLoading }}
        >
            <div style={{ marginBottom: 16 }}>
                <p>发布模式</p>
                <RadioGroup
                    type="button"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'draft' | 'publish')}
                >
                    <Radio value="draft">存为草稿</Radio>
                    <Radio value="publish">直接发布</Radio>
                </RadioGroup>
            </div>
            <Typography.Text type="tertiary">
                封面将自动使用正文第一张图片
            </Typography.Text>
        </Modal>
    );
};

export default PublishConfirmModal;
