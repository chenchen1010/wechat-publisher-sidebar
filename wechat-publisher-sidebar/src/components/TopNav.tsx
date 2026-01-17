import React from 'react';
import { Button, Typography } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconArrowRight } from '@douyinfe/semi-icons';
import { useAppStore } from '../store/useAppStore';

const TopNav: React.FC = () => {
    const { currentIndex, totalCount, prevRecord, nextRecord } = useAppStore();

    return (
        <div className="top-nav">
            <Button
                icon={<IconArrowLeft />}
                theme="borderless"
                type="tertiary"
                onClick={prevRecord}
                disabled={currentIndex <= 0}
            >
                上一个
            </Button>
            <Typography.Text strong>
                {totalCount > 0 ? currentIndex + 1 : 0} / {totalCount}
            </Typography.Text>
            <Button
                icon={<IconArrowRight />}
                theme="borderless"
                type="tertiary"
                onClick={nextRecord}
                disabled={currentIndex >= totalCount - 1}
            >
                下一个
            </Button>
        </div>
    );
};

export default TopNav;
