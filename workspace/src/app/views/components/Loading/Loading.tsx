import React, { memo } from "react";
import { Spinner, Intent, Classes } from "@blueprintjs/core";

interface IProps {
    size?: string;
    tip?: string;
    children?: React.Component
}

const SIZES = {
    'large': 'LARGE',
    'medium': 'MEDIUM',
    'small': 'SMALL',
};

const Loading = memo<IProps>(function LoadingIndicator({
    size = "large",
    tip = 'Loading...',
    children
}) {
    const correctSize = SIZES[size];
    return (
        // @ts-ignore
        <Spinner className={correctSize ? Classes[correctSize] : ''} intent={Intent.PRIMARY}>
            {children}
        </Spinner>
    )
});


export default Loading;
