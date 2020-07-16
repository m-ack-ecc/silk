import React, { ReactElement, useState } from "react";
import { AlertDialog, Button, Checkbox, FieldItem, HtmlContentBlock, Notification, Spacing } from "@wrappers/index";
import { Loading } from "../Loading/Loading";
import { useTranslation } from "react-i18next";

export interface IDeleteModalOptions {
    isOpen: boolean;
    confirmationRequired?: boolean;

    onDiscard(): void;
    onConfirm(): void;

    render?(): ReactElement;
    children?: ReactElement;
    title?: string;
    // Loading status during the remove request
    removeLoading?: boolean;
    errorMessage?: string;
}

export default function DeleteModal({
    isOpen,
    confirmationRequired,
    onDiscard,
    render,
    onConfirm,
    children,
    title = "Delete",
    removeLoading = false,
    errorMessage,
}: IDeleteModalOptions) {
    const [isConfirmed, setIsConfirmed] = useState(false);

    const toggleConfirmChange = () => {
        setIsConfirmed(!isConfirmed);
    };

    const otherContent = !!render ? render() : null;
    const [t] = useTranslation();

    return (
        <AlertDialog
            danger
            title={title}
            isOpen={isOpen}
            onClose={onDiscard}
            actions={
                removeLoading ? (
                    <Loading />
                ) : (
                    [
                        <Button
                            key="remove"
                            disruptive
                            onClick={onConfirm}
                            disabled={confirmationRequired && !isConfirmed}
                        >
                            {t("DeleteSmth")}
                        </Button>,
                        <Button key="cancel" onClick={onDiscard}>
                            {t("form.field.cancel")}
                        </Button>,
                    ]
                )
            }
        >
            {otherContent && (
                <>
                    <HtmlContentBlock>{otherContent}</HtmlContentBlock>
                    <Spacing />
                </>
            )}
            {children && (
                <>
                    {children}
                    <Spacing />
                </>
            )}
            {errorMessage && (
                <>
                    <Spacing />
                    <Notification message={errorMessage} danger />
                </>
            )}
            {confirmationRequired && (
                <FieldItem>
                    <Checkbox onChange={toggleConfirmChange} label={"Confirm"} />
                </FieldItem>
            )}
        </AlertDialog>
    );
}
