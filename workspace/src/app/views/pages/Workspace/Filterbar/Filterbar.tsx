import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import { commonSel } from "@ducks/common";
import { RadioButton, Spacing, TitleSubsection } from "@wrappers/index";
import FacetsList from "./FacetsList";
import { useTranslation } from "react-i18next";

export function Filterbar() {
    const dispatch = useDispatch();
    const [t] = useTranslation();

    const appliedFilters = useSelector(workspaceSel.appliedFiltersSelector);
    const modifiers = useSelector(commonSel.availableDTypesSelector);

    const typeModifier = modifiers.type;

    const handleFilterSelect = (field: string, val: string) => {
        let value = val !== appliedFilters[field] ? val : "";
        dispatch(
            workspaceOp.applyFiltersOp({
                [field]: value,
            })
        );
    };

    return (
        <nav>
            {typeModifier && (
                <>
                    <TitleSubsection>{typeModifier.label}</TitleSubsection>
                    <Spacing size="tiny" />
                    <ul>
                        <li key={"alltypes"}>
                            <RadioButton
                                checked={!appliedFilters[typeModifier.field]}
                                label={t("common.messages.allTypes", "All types")}
                                onChange={() => handleFilterSelect(typeModifier.field, "")}
                                value={""}
                            />
                        </li>
                        {typeModifier.options.map((opt) => (
                            <li key={opt.id}>
                                <RadioButton
                                    checked={appliedFilters[typeModifier.field] === opt.id}
                                    label={opt.label}
                                    onChange={() => handleFilterSelect(typeModifier.field, opt.id)}
                                    value={opt.id}
                                />
                            </li>
                        ))}
                    </ul>
                    <Spacing />
                    <FacetsList />
                </>
            )}
        </nav>
    );
}
