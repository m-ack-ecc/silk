import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { commonSel } from "@ducks/common";
import { Menu, MenuItem, TitleSubsection } from "@wrappers/index";

function ArtefactTypesList({ onSelect }) {
    const { selectedDType } = useSelector(commonSel.artefactModalSelector);
    const typeModifier = useSelector(commonSel.availableDTypesSelector).type;

    return (
        <>
            <TitleSubsection>Item type</TitleSubsection>
            <Menu>
                <MenuItem text={"All"} key="all" onClick={() => onSelect("all")} active={selectedDType === "all"} />
                {typeModifier &&
                    typeModifier.options.map((type) => (
                        <MenuItem
                            text={type.label}
                            key={type.id}
                            onClick={() => onSelect(type.id)}
                            active={selectedDType === type.id}
                        />
                    ))}
            </Menu>
        </>
    );
}

export default ArtefactTypesList;
