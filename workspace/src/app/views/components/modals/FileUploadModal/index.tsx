import React, { useState } from "react";
import { Classes, Intent } from "@wrappers/blueprint/constants";
import Button from "../../../../wrappers/blueprint/button";
import Dialog from "../../../../wrappers/blueprint/dialog";
import AbortAlert from "./AbortAlert";
import OverrideAlert from "./OverrideAlert";

import FileUploader from "../../FileUploader";

export interface IFileUploadModalProps {
    isOpen: boolean;

    uploadUrl: string;

    onDiscard(): void;

    onCheckFileExists?(fileName: string);
}

export default function FileUploadModal({isOpen, onDiscard, onCheckFileExists, uploadUrl}: IFileUploadModalProps) {
    const [fileUploaderInstance, setFileUploaderInstance] = useState<any>(null);
    const [isCheckingFile, setIsCheckingFile] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [openAbortDialog, setOpenAbortDialog] = useState<boolean>(false);
    const [overrideDialog, setOverrideDialog] = useState<File>(null);

    const getUploaderInstance = (instance) => {
        setFileUploaderInstance(instance);
    };

    const resetFileDialog = () => {
        setIsCheckingFile(false);
        setIsUploading(false);
        setOpenAbortDialog(false);
        setOverrideDialog(null);
        fileUploaderInstance.cancelAll();
        fileUploaderInstance.reset();
    };

    const upload = async (file: File) => {
        fileUploaderInstance.setEndpoint(`${uploadUrl}/${file.name}`);
        setIsUploading(true);
        await fileUploaderInstance.upload();
        setIsUploading(false);
        resetFileDialog();
    };

    const onFileAdded = async (result: File) => {
        if (onCheckFileExists) {
            setIsCheckingFile(true);
            const isExists = await onCheckFileExists(result.name);
            setIsCheckingFile(false);

            isExists
                ? setOverrideDialog(result)
                : upload(result)
        } else {
            upload(result);
        }
    };

    const handleDiscard = () => {
        if (isUploading) {
            setOpenAbortDialog(true);
            return false;
        }
        resetFileDialog();
        onDiscard();
    };

    const handleOverrideCancel = () => {
        fileUploaderInstance.reset();
        setOverrideDialog(null);
    };

    return <>
        <Dialog
            onClose={handleDiscard}
            title="Upload New File"
            isOpen={isOpen}
        >
            <div className={Classes.DIALOG_BODY}>
                <FileUploader
                    getInstance={getUploaderInstance}
                    onFileAdded={onFileAdded}
                    disabled={isCheckingFile}
                />
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    {
                        isUploading && <Button
                            intent={Intent.PRIMARY}
                            onClick={handleDiscard}
                        >
                            Abort Upload
                        </Button>
                    }
                    {
                        !isUploading && <Button onClick={onDiscard}>Close</Button>
                    }
                </div>
            </div>

        </Dialog>
        <AbortAlert
            isOpen={openAbortDialog}
            onCancel={() => setOpenAbortDialog(false)}
            onConfirm={resetFileDialog}
        />
        <OverrideAlert
            isOpen={overrideDialog}
            onCancel={handleOverrideCancel}
            onConfirm={() => upload(overrideDialog)}
        />
    </>
}
