import React from 'react';
import {
    Button as BlueprintButton,
    AnchorButton as BlueprintAnchorButton,
    Intent as BlueprintIntent,
 } from "@blueprintjs/core";
import Icon from '../Icon/Icon';

function Button({
    children,
    className='',
    affirmative=false,
    disruptive=false,
    elevated=false,
    icon=false,
    rightIcon=false,
    ...restProps
}: any) {

    let intention;
    if (affirmative || elevated) intention = BlueprintIntent.PRIMARY;
    if (disruptive) intention = BlueprintIntent.DANGER;

    let ButtonType = (restProps.href) ? BlueprintAnchorButton : BlueprintButton;

    return (
        <ButtonType
            {...restProps}
            className={'ecc-button '+className}
            intent={intention}
            icon={
                typeof icon === 'string' ? <Icon name={icon} /> : icon
            }
            rightIcon={
                typeof rightIcon === 'string' ? <Icon name={rightIcon} /> : rightIcon
            }
        >
            {children}
        </ButtonType>
    );
};

export default Button;
