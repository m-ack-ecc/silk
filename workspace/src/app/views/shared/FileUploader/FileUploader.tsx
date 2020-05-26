import React from "react";
import XHR from "@uppy/xhr-upload";
import Uppy from "@uppy/core";
import "@uppy/core/dist/style.css";
import "@uppy/drag-drop/dist/style.css";
import "@uppy/progress-bar/dist/style.css";
import { requestIfResourceExists } from "@ducks/workspace/requests";
import { Button, Icon, FieldItem, TextField, Divider } from "@wrappers/index";

import { legacyApiEndpoint } from "../../../utils/getApiEndpoint";
import Loading from "../Loading";
import { IAutocompleteProps } from "../Autocomplete/Autocomplete";
import AbortAlert from "../modals/FileUploadModal/AbortAlert";
import OverrideAlert from "../modals/FileUploadModal/OverrideAlert";
import { UploadNewFile } from "./cases/UploadNewFile";
import { FileMenu, FileMenuItems } from "./FileMenu";
import { SelectFileFromExisting } from "./cases/SelectFileFromExisting";
import { CreateNewFile } from "./cases/CreateNewFile";

interface IUploaderInstance {
    /**
     * Reset file uploader
     * @see uppy.reset
     */
    reset();

    upload();

    cancelAll();

    /**
     * Update upload endpoint
     * @param endpoint
     */
    setEndpoint(endpoint: string);
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

    // Loading state
    loading: boolean;

    // Override dialog
    overrideDialog: File | null;

    //Show upload process
    isUploading: boolean;

    //Update default value in case that file is already given
    showActionsMenu: boolean;

    //Filename which shows in input for update action
    inputFilename: string;
}

const noop = () => {
    // @see https://gph.is/1Lddqze
};

/**
 * File Uploader widget
 * with advanced = true, provides full FileUploader with 2 extra options
 * otherwise provides simple drang and drop uploader
 */
export class FileUploader extends React.Component<IUploaderOptions, IState> {
    private uppy = Uppy();

    constructor(props) {
        super(props);

        this.state = {
            loading: false,
            selectedFileMenu: props.advanced ? "SELECT" : "NEW",
            isUploading: false,
            overrideDialog: null,
            showActionsMenu: false,
            inputFilename: props.defaultValue || "",
        };

        this.uppy.use(XHR, {
            method: "PUT",
            fieldName: "file",
            metaFields: [],
        });
    }

    componentDidMount(): void {
        if (this.props.getInstance) {
            this.props.getInstance({
                reset: this.reset,
                upload: this.upload,
                cancelAll: this.cancelAll,
                setEndpoint: this.setEndpoint,
            });
        }
    }

    /**
     * @see Uppy.upload
     */
    upload = this.uppy.upload;

    /**
     * @see Uppy.cancelAll
     */
    cancelAll = this.uppy.cancelAll;

    /**
     * Set upload endpoint
     * @param endpoint
     */
    setEndpoint = (endpoint: string) => {
        this.uppy.getPlugin("XHRUpload").setOptions({
            endpoint,
        });
    };

    handleUploadSuccess = (file: File) => {
        if (this.props.onUploadSuccess) {
            this.props.onUploadSuccess(file);
        }
        this.setState({
            inputFilename: file.name,
        });
        this.toggleFileResourceChange();

        this.reset();
    };

    handleFileMenuChange = (value: FileMenuItems) => {
        this.setState({
            selectedFileMenu: value,
        });
        this.reset();
    };

    isResourceExists = async (fileName: string) => {
        try {
            const res = await requestIfResourceExists(this.props.projectId, fileName);
            return !!res.size;
        } catch {
            return false;
        }
    };

    handleFileAdded = async (result: any) => {
        try {
            this.setState({ loading: true });
            const isExists = await this.isResourceExists(result.name);

            isExists ? this.setState({ overrideDialog: result }) : this.handleUpload(result);
        } finally {
            this.setState({ loading: false });
        }
    };

    handleUpload = async (file: any) => {
        const { projectId } = this.props;

        const uploadUrl = legacyApiEndpoint(`/projects/${projectId}/resources`);
        this.setEndpoint(`${uploadUrl}/${file.name}`);

        this.setState({ isUploading: true });
        try {
            await this.uppy.upload();
            this.props.onChange(file.name);
            this.reset();
        } catch (e) {
            console.log(e);
        } finally {
            this.setState({
                isUploading: false,
            });
        }
    };

    handleOverride = () => {
        this.handleUpload(this.state.overrideDialog);
        this.setState({
            overrideDialog: null,
        });
    };

    reset = () => {
        this.setState({
            overrideDialog: null,
            loading: false,
        });
        this.uppy.cancelAll();
        this.uppy.reset();
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

    render() {
        const { selectedFileMenu, loading, overrideDialog, showActionsMenu, inputFilename } = this.state;
        const { simpleInput, allowMultiple, advanced, autocomplete, defaultValue } = this.props;

        return loading ? (
            <Loading />
        ) : (
            <>
                {defaultValue && !updateDefaultValue && (
                    <FieldItem>
                        <TextField
                            readOnly
                            value={inputFilename}
                            onChange={noop}
                            rightElement={
                                <Button
                                    minimal
                                    text={showActionsMenu ? "Abort and keep file" : "Change file"}
                                    icon={showActionsMenu ? <Icon name="navigation-back" /> : <Icon name="item-edit" />}
                                    onClick={this.handleDiscardChanges}
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
                            text={showActionsMenu ? "Abort and keep file" : "Change file"}
                            icon={showActionsMenu ? <Icon name="operation-undo" /> : <Icon name="item-edit" />}
                            onClick={this.toggleFileResourceChange}
                        />
                        <Divider addSpacing="large" />
                    </>
                )}
                {(!defaultValue || showActionsMenu) && (
                    <>
                        {advanced && (
                            <FileMenu onChange={this.handleFileMenuChange} selectedFileMenu={selectedFileMenu} />
                        )}

                        {selectedFileMenu === "SELECT" && (
                            <>
                                <SelectFileFromExisting
                                    autocomplete={autocomplete}
                                    onChange={this.handleFileNameChange}
                                    confirmationButton={!!defaultValue}
                                />
                            </>
                        )}
                        {selectedFileMenu === "NEW" && (
                            <UploadNewFile
                                uppy={this.uppy}
                                simpleInput={simpleInput}
                                allowMultiple={allowMultiple}
                                onAdded={this.handleFileAdded}
                                onProgress={this.props.onProgress}
                                onUploadSuccess={this.handleUploadSuccess}
                            />
                        )}
                        {selectedFileMenu === "EMPTY" && (
                            <CreateNewFile onChange={this.props.onChange} confirmationButton={!!defaultValue} />
                        )}

                        <OverrideAlert
                            fileName={overrideDialog ? overrideDialog.name : ""}
                            isOpen={!!overrideDialog}
                            onCancel={this.reset}
                            onConfirm={this.handleOverride}
                        />
                    </>
                )}
            </>
        );
    }
}
