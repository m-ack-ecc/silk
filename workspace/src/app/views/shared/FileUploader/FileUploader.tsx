import React from "react";
import Uppy from "@uppy/core";
import "@uppy/core/dist/style.css";
import "@uppy/drag-drop/dist/style.css";
import "@uppy/progress-bar/dist/style.css";

import { Button, Divider, FieldItem, Icon, TextField } from "@gui-elements/index";
import { IAutocompleteProps } from "../Autocomplete/Autocomplete";
import { UploadNewFile } from "./cases/UploadNewFile";
import { FileMenu, FileMenuItems } from "./FileMenu";
import { SelectFileFromExisting } from "./cases/SelectFileFromExisting";
import { CreateNewFile } from "./cases/CreateNewFile";
import i18next from "../../../../language";
import { requestIfResourceExists } from "@ducks/workspace/requests";
import { legacyApiEndpoint } from "../../../utils/getApiEndpoint";
import { FileRemoveModal } from "../modals/FileRemoveModal";
import XHR from "@uppy/xhr-upload";

interface IUploaderInstance {
    /**
     * Reset file uploader
     * @see uppy.reset
     */
    reset();

    upload();

    cancelAll();
}

export interface IUploaderOptions {
    /**
     * @required
     */
    projectId: string;

    /**
     * @default undefined
     * holds the currently set file name
     */
    defaultValue?: string;

    /**
     * return uploader API
     * @see IUploaderInstance
     * @param instance
     */
    getInstance?(instance: IUploaderInstance);

    /**
     * Fired when file added
     * @see this.uppy.on('file-added', this.onFileAdded);
     * @param file
     */
    onFileAdded?(file: File);

    /**
     * Fired when upload successfully completed
     * @see this.uppy.on('upload-success', this.onUploadSuccess);
     */
    onUploadSuccess?(file: File);

    /**
     * Fired file uploading progress
     * @param progress
     * @see this.uppy.on('upload-progress', this.onProgress)
     */
    onProgress?(progress: number);

    allowMultiple?: boolean;

    /**
     * @default false
     * The indicator show simple file input or drop zone
     */
    simpleInput?: boolean;

    /**
     * @default false
     * if advanced is true, then show file uploader with multiple options
     */
    advanced?: boolean;

    /**
     * autocomplete option useful when advanced is true
     */
    autocomplete?: IAutocompleteProps;

    /**
     * Called when:
     * - New file added
     * - Select resource from autocomplete
     * - Write new file name
     */
    onChange?(value: File | string);
}

interface IState {
    // Selected File menu item
    selectedFileMenu: FileMenuItems;

    //Show upload process
    isUploading: boolean;

    //Update default value in case that file is already given
    showActionsMenu: boolean;

    //Filename which shows in input for update action
    inputFilename: string;

    //Toggle File delete dialog, contains filename or empty string
    visibleFileDelete: string;
}

const noop = () => {
    // @see https://gph.is/1Lddqze
};

/**
 * File Uploader widget
 * with advanced = true, provides full FileUploader with 2 extra options
 * otherwise provides simple drag and drop uploader
 */
export class FileUploader extends React.Component<IUploaderOptions, IState> {
    private uppy = Uppy({
        // @ts-ignore
        logger: Uppy.debugLogger,
    });

    /**
     * @see Uppy.upload
     */
    upload = this.uppy.upload;

    /**
     * @see Uppy.reset
     */
    reset = this.uppy.reset;

    /**
     * @see Uppy.cancelAll
     */
    cancelAll = this.uppy.cancelAll;

    constructor(props) {
        super(props);

        this.state = {
            selectedFileMenu: props.advanced ? "SELECT" : "NEW",
            isUploading: false,
            showActionsMenu: false,
            inputFilename: props.defaultValue || "",
            visibleFileDelete: "",
        };

        this.uppy.use(XHR, {
            method: "PUT",
            fieldName: "file",
            allowMultipleUploads: props.allowMultiple,
            restrictions: {
                maxNumberOfFiles: 3,
            },
        });
    }

    componentDidMount(): void {
        if (this.props.getInstance) {
            this.props.getInstance({
                reset: this.reset,
                upload: this.upload,
                cancelAll: this.cancelAll,
            });
        }
    }

    handleUploadSuccess = (file: any) => {
        if (this.props.onUploadSuccess) {
            this.props.onUploadSuccess(file);
        }
        this.setState({
            inputFilename: file.name,
        });
        this.toggleFileResourceChange();
    };

    handleFileMenuChange = (value: FileMenuItems) => {
        this.setState({
            selectedFileMenu: value,
        });
        this.reset();
    };

    /**
     * "Abort and Keep File" Handler
     * revert value back
     */
    handleDiscardChanges = () => {
        const isVisible = !this.state.showActionsMenu;
        if (!isVisible) {
            this.handleFileNameChange(this.state.inputFilename);
        } else {
            // just open
            this.toggleFileResourceChange();
        }
    };

    /**
     * Open/close file uploader options
     */
    toggleFileResourceChange = () => {
        this.setState({
            showActionsMenu: !this.state.showActionsMenu,
        });
    };

    /**
     * Change readonly input value
     * @param value
     */
    handleFileNameChange = (value: string) => {
        this.setState({
            inputFilename: value,
        });
        this.props.onChange(value);
        this.toggleFileResourceChange();
    };

    handleConfirmDelete = (fileName: string) => {
        const file = this.uppy.getFiles().find((f) => f.name === fileName);
        if (file) {
            this.uppy.removeFile(file.id);
        }
        this.toggleFileRemoveDialog();
    };

    toggleFileRemoveDialog = (fileName: string = "") => {
        this.setState({
            visibleFileDelete: fileName,
        });
    };

    validateBeforeFileAdded = async (fileName: string): Promise<boolean> => {
        return await requestIfResourceExists(this.props.projectId, fileName);
    };

    render() {
        const { selectedFileMenu, showActionsMenu, inputFilename } = this.state;
        const { allowMultiple, advanced, autocomplete, defaultValue, onProgress, projectId } = this.props;

        return (
            <>
                {defaultValue && !showActionsMenu && (
                    <FieldItem>
                        <TextField
                            readOnly
                            value={inputFilename}
                            onChange={noop}
                            rightElement={
                                <Button
                                    minimal
                                    text={i18next.t("FileUploader.changeFile", "Change file")}
                                    icon={<Icon name="item-edit" />}
                                    onClick={this.toggleFileResourceChange}
                                />
                            }
                        />
                    </FieldItem>
                )}
                {defaultValue && showActionsMenu && (
                    <>
                        <Button
                            outlined
                            small
                            text={i18next.t("FileUploader.abort", "Abort and keep file")}
                            icon={<Icon name="operation-undo" />}
                            onClick={this.handleDiscardChanges}
                        />
                        <Divider addSpacing="large" />
                    </>
                )}
                {(!defaultValue || showActionsMenu) && (
                    <>
                        {advanced && (
                            <FileMenu onChange={this.handleFileMenuChange} selectedFileMenu={selectedFileMenu} />
                        )}

                        <div>
                            {selectedFileMenu === "SELECT" && (
                                <SelectFileFromExisting
                                    autocomplete={autocomplete}
                                    onChange={this.handleFileNameChange}
                                />
                            )}
                            {selectedFileMenu === "NEW" && (
                                <>
                                    <UploadNewFile
                                        uppy={this.uppy}
                                        allowMultiple={allowMultiple}
                                        onProgress={onProgress}
                                        onRemoveFile={this.toggleFileRemoveDialog}
                                        onUploadSuccess={this.handleUploadSuccess}
                                        validateBeforeAdd={this.validateBeforeFileAdded}
                                        uploadEndpoint={`${legacyApiEndpoint(`/projects/${projectId}/resources`)}`}
                                    />
                                </>
                            )}
                            {selectedFileMenu === "EMPTY" && (
                                <CreateNewFile onChange={this.props.onChange} confirmationButton={!!defaultValue} />
                            )}
                        </div>

                        <FileRemoveModal
                            projectId={projectId}
                            isOpen={!!this.state.visibleFileDelete}
                            onConfirm={this.handleConfirmDelete}
                            fileName={this.state.visibleFileDelete}
                        />
                    </>
                )}
            </>
        );
    }
}
