import React from "react";
import { FieldItem, TextField } from "@gui-elements/index";
import { errorMessage } from "./ParameterWidget";
import { Intent } from "@gui-elements/blueprint/constants";
import { debounce } from "../../../../../utils/debounce";
import { requestProjectIdValidation, requestTaskIdValidation } from "@ducks/common/requests";
import useCopyButton from "../../../../../hooks/useCopyButton";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";

const IDENTIFIER = "id";

interface IProps {
    form: any;
    /** handles input change */
    onValueChange: (val: string) => (event: any) => Promise<void>;

    /** existing task with preset id **/
    taskId?: string;

    /** existing project with preset id **/
    projectId?: string;
}

/**
 * validate the custom ids checking for uniqueness and sanity
 * @param form
 * @param projectId
 * @returns
 */
export const handleCustomIdValidation = debounce(
    async (t: TFunction, form: any, customId: string, projectId?: string) => {
        if (!customId) return form.clearError(IDENTIFIER);
        try {
            const res = !projectId
                ? await requestProjectIdValidation(customId)
                : await requestTaskIdValidation(customId, projectId);
            if (res.axiosResponse.status === 200) {
                form.clearError(IDENTIFIER);
            }
        } catch (err) {
            if (err.errorResponse.status === 409) {
                form.setError("id", "pattern", t("CustomIdentifierInput.validations.unique"));
            } else {
                form.setError("id", "pattern", err.errorResponse.detail);
            }
        }
    },
    200
);

const CustomIdentifierInput = ({ form, onValueChange, taskId, projectId }: IProps) => {
    const { errors } = form;
    const [copyButton] = useCopyButton([{ text: taskId ?? "" }]);
    const [t] = useTranslation();
    const otherProps = taskId ? { value: taskId } : {};

    return (
        <FieldItem
            disabled={!!taskId}
            labelAttributes={{
                text: t("CustomIdentifierInput.IdentifierTitle", { item: projectId ? "Task" : "Project" }),
                htmlFor: IDENTIFIER,
            }}
            helperText={t("CustomIdentifierInput.itemIdentifier")}
            hasStateDanger={!!errorMessage(IDENTIFIER, errors.id)}
            messageText={errorMessage(IDENTIFIER, errors.id)}
        >
            <TextField
                id={IDENTIFIER}
                name={IDENTIFIER}
                onChange={onValueChange(IDENTIFIER)}
                intent={errors.id ? Intent.DANGER : Intent.NONE}
                onKeyDown={(e) => {
                    if (e.keyCode === 13) {
                        e.preventDefault();
                        return false;
                    }
                }}
                disabled={!!taskId}
                rightElement={taskId ? copyButton : undefined}
                {...otherProps}
            />
        </FieldItem>
    );
};

export default CustomIdentifierInput;
