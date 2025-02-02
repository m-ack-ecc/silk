import { FieldItem } from "@eccenca/gui-elements";
import {
    AutoCompleteField,
    IAutoCompleteFieldProps,
} from "@eccenca/gui-elements/src/components/AutocompleteField/AutoCompleteField";
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

    labelAttributes?: {
        text: string;
        info: string;
        htmlFor: string;
    };

    /** Indicator that there needs to be a value set/selected, else the file selection (from existing files) can e.g. be reset. */
    required: boolean;
}

/**
 * The widget for "select from existing" option
 * @constructor
 */
export function SelectFileFromExisting({ autocomplete, onChange, defaultValue, labelAttributes, required }: IProps) {
    const selectedValueState = useState(defaultValue);
    const setSelectedValue = selectedValueState[1];
    const [error, setError] = useState(false);
    const [t] = useTranslation();

    const handleChange = (value: string) => {
        setError(!value);
        setSelectedValue(value);

        onChange(value);
    };

    return labelAttributes ? (
        <FieldItem labelAttributes={labelAttributes} messageText={error ? t("FileUploader.fileNotSpecified") : ""}>
            <ProjectResourceAutoComplete
                autocomplete={autocomplete}
                handleChange={handleChange}
                initialValue={defaultValue}
                resettable={!required}
            />
        </FieldItem>
    ) : (
        <ProjectResourceAutoComplete
            autocomplete={autocomplete}
            handleChange={handleChange}
            initialValue={defaultValue}
            resettable={!required}
        />
    );
}

const itemStringValue = (item: IProjectResource) => item.name;

interface ProjectResourceAutoCompleteProps {
    initialValue?: string;
    autocomplete: IAutoCompleteFieldProps<IProjectResource, string>;
    handleChange: (value: string) => void;
    /** If true allows to clear the selection. */
    resettable: boolean;
}

const ProjectResourceAutoComplete = ({
    autocomplete,
    handleChange,
    initialValue,
    resettable,
}: ProjectResourceAutoCompleteProps) => {
    const [t] = useTranslation();

    return (
        <AutoCompleteField<IProjectResource, string>
            {...autocomplete}
            initialValue={initialValue ? { name: initialValue, modified: "2000-01-01", size: 1 } : undefined}
            onChange={handleChange}
            itemValueSelector={itemStringValue}
            itemValueRenderer={itemStringValue}
            itemValueString={itemStringValue}
            reset={
                resettable
                    ? {
                          resetValue: "",
                          resetButtonText: t("common.action.resetSelection"),
                          resettableValue: () => true,
                      }
                    : undefined
            }
        />
    );
};
