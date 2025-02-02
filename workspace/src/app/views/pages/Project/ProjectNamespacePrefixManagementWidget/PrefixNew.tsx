import React, { useEffect, useState } from "react";
import { AlertDialog, Button, FieldItem, FieldItemRow, FieldSet, Icon, TextField } from "@eccenca/gui-elements";
import { useTranslation } from "react-i18next";
import { IPrefixDefinition } from "@ducks/workspace/typings";

interface IProps {
    onAdd: (prefixDefinition: IPrefixDefinition) => any;
    existingPrefixes: Set<string>;
}

/** From https://www.w3.org/TR/turtle/#grammar-production-PN_PREFIX */
export const createPrefixNameRegex = (): RegExp => {
    const charsBase =
        "(?:[A-Z]|[a-z]|[\\u00C0-\\u00D6]|[\\u00D8-\\u00F6]|[\\u00F8-\\u02FF]|[\\u0370-\\u037D]|[\\u037F-\\u1FFF]|[\\u200C-\\u200D]|[\\u2070-\\u218F]|[\\u2C00-\\u2FEF]|[\\u3001-\\uD7FF]|[\\uF900-\\uFDCF]|[\\uFDF0-\\uFFFD])";
    const chars = `(?:${charsBase}|_|-|[0-9]|\\u00B7|[\\u0300-\\u036F]|[\\u203F-\\u2040])`;
    return new RegExp(`^${charsBase}(?:(?:${chars}|\\.)*${chars})?$`);
};

// eslint-disable-next-line no-control-regex
export const invalidUriChars = new RegExp('[\\u0000-\\u0020<>"{}|^`\\\\]');

export const prefixNameRegex = createPrefixNameRegex();

export const validatePrefixName = (prefixName: string): boolean => prefixNameRegex.test(prefixName);

/** Returns either a boolean with true being a valid value or a number that specifies the first index with an invalid character. */
export const validatePrefixValue = (prefixValue: string): boolean | number => {
    try {
        const invalidCharMatches = prefixValue.match(invalidUriChars);
        if (invalidCharMatches && invalidCharMatches.index != null) {
            return invalidCharMatches.index;
        } else {
            const uri = new URL(prefixValue);
            return !!(uri.host || uri.pathname);
        }
    } catch (ex) {
        return false;
    }
};

/** Component for entering a new prefix. */
const PrefixNew = ({ onAdd, existingPrefixes }: IProps) => {
    const [t] = useTranslation();
    const [prefixDefinition, setPrefixDefinition] = useState<IPrefixDefinition>({ prefixName: "", prefixUri: "" });
    const [isValidPrefixName, setIsValidPrefixName] = useState<boolean>(false);
    // The prefix value is invalid when the value is false or a number, which specifies the character index of the first invalid char.
    const [isValidPrefixValue, setIsValidPrefixValue] = useState<boolean | number>(false);
    const [overwriteDialogOpen, setOverwriteDialogOpen] = useState<boolean>(false);

    useEffect(() => {}, [prefixDefinition.prefixName + prefixDefinition.prefixUri]);

    const isUpdatePrefix = existingPrefixes.has(prefixDefinition.prefixName);

    const onPrefixNameChange = (e) => {
        const value = e?.target?.value;
        if (value != null) {
            setPrefixDefinition((currentDefinition) => {
                return { ...currentDefinition, prefixName: value };
            });
            setIsValidPrefixName(validatePrefixName(value));
        }
    };
    const onPrefixUriChange = (e) => {
        const value = e?.target?.value;
        if (value != null) {
            setPrefixDefinition((currentDefinition) => {
                return { ...currentDefinition, prefixUri: value };
            });
            setIsValidPrefixValue(validatePrefixValue(value));
        }
    };

    let prefixNameErrorIcon: JSX.Element | undefined = undefined;
    let prefixValueErrorIcon: JSX.Element | undefined = undefined;

    if (!isValidPrefixName && prefixDefinition.prefixName) {
        prefixNameErrorIcon = <Icon name={"state-warning"} tooltipText={t("PrefixDialog.prefixNameInvalid")} />;
    }
    const highlightInvalidPrefixValue: boolean =
        (typeof isValidPrefixValue == "number" || !isValidPrefixValue) && !!prefixDefinition.prefixUri;
    if (highlightInvalidPrefixValue) {
        let tooltipText = t("PrefixDialog.prefixUriInvalid");
        if (typeof isValidPrefixValue == "number" && isValidPrefixValue < prefixDefinition.prefixUri.length) {
            tooltipText = t("PrefixDialog.prefixUriInvalidChar", {
                idx: isValidPrefixValue,
                char: prefixDefinition.prefixUri.substr(isValidPrefixValue, 1),
            });
        }
        prefixValueErrorIcon = <Icon name={"state-warning"} tooltipText={tooltipText} />;
    }

    return (
        <>
            <FieldSet title={t("common.action.AddSmth", { smth: t("widget.ConfigWidget.prefix") })} boxed>
                <FieldItemRow>
                    <FieldItem
                        key={"prefix-name"}
                        labelAttributes={{
                            htmlFor: "prefix-name",
                            text: t("widget.ConfigWidget.prefix", "Prefix"),
                        }}
                    >
                        <TextField
                            id={"prefix-name"}
                            value={prefixDefinition.prefixName}
                            onChange={onPrefixNameChange}
                            leftIcon={prefixNameErrorIcon}
                            hasStateDanger={!isValidPrefixName && !!prefixDefinition.prefixName}
                        />
                    </FieldItem>
                    <FieldItem
                        key={"prefix-uri"}
                        labelAttributes={{
                            htmlFor: "prefix-uri",
                            text: "URI",
                        }}
                    >
                        <TextField
                            id={"prefix-uri"}
                            value={prefixDefinition.prefixUri}
                            onChange={onPrefixUriChange}
                            leftIcon={prefixValueErrorIcon}
                            hasStateDanger={highlightInvalidPrefixValue}
                        />
                    </FieldItem>
                    <FieldItem key={"prefix-submit"}>
                        <Button
                            data-test-id={isUpdatePrefix ? "update-prefix-definition-btn" : "add-prefix-definition-btn"}
                            onClick={() => (isUpdatePrefix ? setOverwriteDialogOpen(true) : onAdd(prefixDefinition))}
                            elevated
                            disabled={
                                !isValidPrefixName || !isValidPrefixValue || typeof isValidPrefixValue == "number"
                            }
                        >
                            {isUpdatePrefix ? t("common.action.update") : t("common.action.add")}
                        </Button>
                    </FieldItem>
                </FieldItemRow>
            </FieldSet>
            <AlertDialog
                warning
                isOpen={overwriteDialogOpen}
                data-test-id={"update-prefix-dialog"}
                actions={[
                    <Button
                        key="overwrite"
                        data-test-id={"prefix-update-dialog-submit-btn"}
                        onClick={() => {
                            setOverwriteDialogOpen(false);
                            onAdd(prefixDefinition);
                        }}
                    >
                        {t("common.action.update", "Abort")}
                    </Button>,
                    <Button key="cancel" onClick={() => setOverwriteDialogOpen(false)}>
                        {t("common.action.cancel")}
                    </Button>,
                ]}
            >
                <p> {t("PrefixDialog.overwritePrefix", { prefixName: prefixDefinition.prefixName })}</p>
            </AlertDialog>
        </>
    );
};

export default PrefixNew;
