import React, { useEffect, useState } from "react";
import { Button, FieldItem, SimpleDialog, TextField } from "@eccenca/gui-elements";
import { useTranslation } from "react-i18next";
import { LinkageRuleConfigItem } from "./LinkageRuleConfig";

interface IProps {
    onClose: () => any;
    parameters: LinkageRuleConfigItem[];
    submit: (parameters: [string, string | undefined][]) => any;
}

/** Config modal to change linkage rule config parameters like link type and link limit. */
export const LinkageRuleConfigModal = ({ onClose, parameters, submit }: IProps) => {
    const [t] = useTranslation();
    const [parameterDiff] = useState<Map<string, string>>(new Map());
    const [changed, setChanged] = useState(false);
    const [errorCount, setErrorCount] = useState(0);
    const initialParameters = new Map(parameters.map((p) => [p.id, p]));
    const [errors] = useState(new Map<string, string>());
    const [saving, setSaving] = useState(false);

    // Always change error count to correct count when it is off. This mechanism is sometimes used to re-render.
    useEffect(() => {
        if (errorCount !== errors.size) {
            setErrorCount(errors.size);
        }
    }, [errorCount]);

    const changeParameter = (parameterId: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        const hasChanges = parameterDiff.size > 0;
        const validation = initialParameters.get(parameterId)?.validation(value);
        // Validation
        if (typeof validation === "string") {
            const newError = !errors.has(parameterId);
            const currentError = errors.get(parameterId);
            errors.set(parameterId, validation);
            if (newError) {
                setErrorCount(errors.size);
            } else {
                if (currentError !== validation) {
                    setErrorCount(errors.size + 1);
                }
            }
        } else {
            const errorResolved = errors.has(parameterId);
            if (errorResolved) {
                errors.delete(parameterId);
                setErrorCount(errors.size);
            }
        }
        // Add to parameter diff
        if (initialParameters.get(parameterId)?.value === value) {
            parameterDiff.delete(parameterId);
        } else {
            parameterDiff.set(parameterId, value);
        }
        if (parameterDiff.size && !hasChanges) {
            setChanged(true);
        } else if (parameterDiff.size === 0 && hasChanges) {
            setChanged(false);
        }
    };

    const onSubmit = async () => {
        const updatedParameters: [string, string | undefined][] = parameters.map((p) => {
            const updatedValue = parameterDiff.get(p.id) ?? p.value;
            return [p.id, updatedValue];
        });
        setSaving(true);
        await submit(updatedParameters);
        setSaving(false);
    };

    return (
        <SimpleDialog
            data-test-id={"clone-item-to-modal"}
            size="small"
            title={t("widget.LinkingRuleConfigWidget.modal.title")}
            isOpen={true}
            onClose={onClose}
            actions={[
                <Button
                    key="submit"
                    affirmative
                    onClick={onSubmit}
                    loading={saving}
                    disabled={!changed || errorCount > 0}
                    data-test-id={"linkage-rule-config-modal-submit-btn"}
                >
                    {t("common.action.update")}
                </Button>,
                <Button key="cancel" onClick={onClose}>
                    {t("common.action.cancel")}
                </Button>,
            ]}
        >
            {parameters.map((p) => {
                const errorMessage = errors.get(p.id);
                return (
                    <FieldItem
                        key={p.id}
                        labelAttributes={{
                            htmlFor: p.id,
                            text: p.label,
                        }}
                        hasStateDanger={!!errorMessage}
                        messageText={errorMessage ? errorMessage : undefined}
                        helperText={p.description}
                    >
                        <TextField
                            onChange={changeParameter(p.id)}
                            defaultValue={p.value}
                            placeholder={p.placeholder}
                        />
                    </FieldItem>
                );
            })}
        </SimpleDialog>
    );
};
