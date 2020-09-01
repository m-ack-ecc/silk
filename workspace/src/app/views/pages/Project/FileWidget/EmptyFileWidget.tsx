import React from "react";
import { Button } from "@gui-elements/index";
import { useTranslation } from "react-i18next";

export function EmptyFileWidget({ onFileAdd }) {
    const [t] = useTranslation();

    return (
        <div>
            <p>{t("widget.FileWidget.empty", "No files are found, add them here to use it later")}</p>
            <Button kind={"primary"} onClick={onFileAdd}>
                + {t("common.action.AddSmth", { smth: t("widget.FileWidget.file", "File") })}
            </Button>
        </div>
    );
}
