import React from 'react';
import {
    Card,
    OverviewItem,
    OverviewItemDepiction,
    OverviewItemDescription,
    OverviewItemLine,
    OverviewItemActions,
    HelperClasses,
} from '@wrappers/index';

function EmptyList({
    depiction, // use large icon here
    textInfo,
    textCallout,
    actionButtons
}) {
    return (
        <Card
            isOnlyLayout
            className={HelperClasses.Intent.INFO}
        >
            <OverviewItem hasSpacing>
                {
                    depiction && <OverviewItemDepiction>{depiction}</OverviewItemDepiction>
                }
                <OverviewItemDescription>
                    {
                        textInfo && <OverviewItemLine>{textInfo}</OverviewItemLine>
                    }
                    {
                        textCallout && <OverviewItemLine>{textCallout}</OverviewItemLine>
                    }
                </OverviewItemDescription>
                {
                    actionButtons && <OverviewItemActions>{actionButtons}</OverviewItemActions>
                }
            </OverviewItem>
        </Card>
    );
}

export default EmptyList;
