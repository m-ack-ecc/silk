import React, { memo } from "react";
import Spinner from "@wrappers/blueprint/spinner";
import { Classes, Intent } from "@wrappers/blueprint/constants";

interface IProps {
    size?: string;
    tip?: string;
    exposed?: boolean;
    children?: React.Component;
}

const SIZES = {
    large: "LARGE",
    medium: "MEDIUM",
    small: "SMALL",
};

export const Loading = memo<IProps>(function LoadingIndicator({
    size = "medium",
    tip = "Loading...",
    exposed = false,
    children,
}) {
    const correctSize = SIZES[size];
    return (
        // @ts-ignore
        <Spinner className={correctSize ? Classes[correctSize] : ""} intent={exposed ? Intent.PRIMARY : Intent.NONE}>
            {children}
        </Spinner>
    );
});
