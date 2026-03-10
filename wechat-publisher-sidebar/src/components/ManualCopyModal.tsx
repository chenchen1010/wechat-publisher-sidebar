import React, { useRef, useEffect } from 'react';
import { Modal, Button, Toast } from '@douyinfe/semi-ui';

interface ManualCopyModalProps {
    visible: boolean;
    html: string;
    onClose: () => void;
}

const ManualCopyModal: React.FC<ManualCopyModalProps> = ({ visible, html, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible && containerRef.current) {
            // 自动选中内容
            const range = document.createRange();
            range.selectNodeContents(containerRef.current);
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }, [visible, html]);

    const handleSelectAll = () => {
        if (containerRef.current) {
            const range = document.createRange();
            range.selectNodeContents(containerRef.current);
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            Toast.info('已全选，请按 Ctrl+C / ⌘+C 复制');
        }
    };

    return (
        <Modal
            title="手动复制"
            visible={visible}
            onCancel={onClose}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={handleSelectAll}>全选内容</Button>
                    <Button theme="solid" onClick={onClose}>关闭</Button>
                </div>
            }
            width={700}
            style={{ maxHeight: '80vh' }}
            bodyStyle={{ maxHeight: '60vh', overflow: 'auto' }}
        >
            <div style={{ marginBottom: 12, color: 'var(--semi-color-text-2)', fontSize: 13 }}>
                由于浏览器限制，无法自动复制富文本。请手动全选下方内容后按 <strong>Ctrl+C</strong>（Mac: <strong>⌘+C</strong>）复制，然后粘贴到公众号后台。
            </div>
            <div
                ref={containerRef}
                dangerouslySetInnerHTML={{ __html: html }}
                style={{
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 6,
                    padding: 16,
                    background: '#fff',
                    minHeight: 200,
                    cursor: 'text',
                    userSelect: 'text'
                }}
            />
        </Modal>
    );
};

export default ManualCopyModal;
