import React from "react";
import { Icon } from "@wrappers/index";

interface IProps {
    itemType?: string;
}
const ItemDepiction = ({ itemType }: IProps) => {
    const iconName = itemType ? "artefact-" + itemType : "application-homepage";
    return <Icon name={iconName} large />;
};

export default ItemDepiction;
