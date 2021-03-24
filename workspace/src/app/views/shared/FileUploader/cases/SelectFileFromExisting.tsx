import { FieldItem } from "@gui-elements/index";
import {
    AutoCompleteField,
    IAutoCompleteFieldProps,
} from "@gui-elements/src/components/AutocompleteField/AutoCompleteField";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { IProjectResource } from "@ducks/shared/typings";

interface IProps {
    autocomplete: IAutoCompleteFieldProps<IProjectResource, string>;

    /**
     * Fire when autocomplete value selected
     * @param value
     */
    onChange(value: string);

    /**
     * Default value
     */
    defaultValue?: string;
}

/**
 * The widget for "select from existing" option
 * @constructor
 */
export function SelectFileFromExisting(props: IProps) {
    const { autocomplete, onChange, defaultValue } = props;

    const selectedValueState = useState(defaultValue);
    const setSelectedValue = selectedValueState[1];
    const [error, setError] = useState(false);
    const [t] = useTranslation();

    const handleChange = (value: string) => {
        setError(!value);
        setSelectedValue(value);

        onChange(value);
    };
    const itemStringValue = (item: IProjectResource) => item.name;

    return (
        <FieldItem
            labelAttributes={{
                text: t("FileUploader.selectFromProject", "Select file from projects"),
                info: t("common.words.required"),
                htmlFor: "autocompleteInput",
            }}
            messageText={error ? t("FileUploader.fileNotSpecified") : ""}
        >
            <AutoCompleteField<IProjectResource, string>
                {...autocomplete}
                onChange={handleChange}
                itemValueSelector={itemStringValue}
                itemValueRenderer={itemStringValue}
            />
        </FieldItem>
    );
}
