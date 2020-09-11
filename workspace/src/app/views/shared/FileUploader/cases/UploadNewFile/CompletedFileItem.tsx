import React from "react";
import { Button, Notification, Spacing } from "@gui-elements/index";
import { UppyFile } from "@uppy/core";
import { useTranslation } from "react-i18next";
import { Intent } from "@gui-elements/blueprint/constants";
import ProgressBar from "@gui-elements/blueprint/progressbar";

interface IProps {
    file: UppyFile;

    onRemoveFile(file: UppyFile);
}

export function CompletedFileItem({ file, onRemoveFile }: IProps) {
    const [t] = useTranslation();

    return (
        <div key={file.id}>
            <Notification
                success={true}
                actions={
                    <Button outlined onClick={() => onRemoveFile(file)}>
                        {t("common.action.DeleteSmth", { smth: " " })}
                    </Button>
                }
            >
                <p>{t("FileUploader.successfullyUploaded", { uploadedName: file.name })}</p>
                <Spacing />
                <ProgressBar value={1} stripes={false} intent={Intent.SUCCESS} />
            </Notification>
            <Spacing />
        </div>
    );
}
