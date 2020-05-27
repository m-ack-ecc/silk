import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Divider,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableHeader,
    Toolbar,
    ToolbarSection,
    Button,
    Spacing,
    IconButton,
} from "@wrappers/index";
import Loading from "../../../shared/Loading";
import FileUploadModal from "../../../shared/modals/FileUploadModal";
import { EmptyFileWidget } from "./EmptyFileWidget";
import { SearchBar } from "../../../shared/SearchBar/SearchBar";
import { Highlighter } from "../../../shared/Highlighter/Highlighter";
import { usePagination } from "@wrappers/src/components/Pagination/Pagination";
import DeleteModal from "../../../shared/modals/DeleteModal";
import { commonSel } from "@ducks/common";
import { removeProjectFileResource } from "@ducks/workspace/requests";

interface IFileDeleteModalOptions {
    isOpen: boolean;
    fileName: string | null;
}

/** Project file management widget. */
export const FileWidget = () => {
    const dispatch = useDispatch();

    const filesList = useSelector(workspaceSel.filesListSelector);
    const fileWidget = useSelector(workspaceSel.widgetsSelector).files;
    const [textQuery, setTextQuery] = useState("");
    const projectId = useSelector(commonSel.currentProjectIdSelector);

    const [isOpenDialog, setIsOpenDialog] = useState<boolean>(false);
    const [deleteModalOpts, setDeleteModalOpts] = useState<IFileDeleteModalOptions>({ isOpen: false, fileName: null });
    const { isLoading } = fileWidget;
    const { pagination, paginationElement, onTotalChange } = usePagination({
        pageSizes: [5, 10, 20],
        presentation: { hideInfoText: true },
    });

    const deleteFile = async (fileName: string) => {
        try {
            await removeProjectFileResource(projectId, fileName);
        } finally {
            closeDeleteModal();
        }
    };
    if (filesList !== undefined && filesList !== null && filesList.length !== pagination.total) {
        onTotalChange(filesList.length);
    }

    const headers = [
        { key: "name", header: "Name", highlighted: true },
        { key: "formattedDate", header: "Date", highlighted: false },
        { key: "formattedSize", header: "Size (bytes)", highlighted: true },
    ];

    const onSearch = (textQuery) => {
        setTextQuery(textQuery);
    };

    useEffect(() => {
        // Only trigger if file upload dialog is closed, since a file may have been uploaded.
        if (!isOpenDialog && !deleteModalOpts.isOpen) {
            dispatch(workspaceOp.fetchResourcesListAsync({ searchText: textQuery, limit: 1000 }));
        }
    }, [textQuery, isOpenDialog, deleteModalOpts.isOpen]);

    const toggleFileUploader = () => {
        setIsOpenDialog(!isOpenDialog);
    };

    const closeDeleteModal = () => {
        setDeleteModalOpts({ fileName: null, isOpen: false });
    };

    const openDeleteModal = (fileName: string) => {
        setDeleteModalOpts({ fileName: fileName, isOpen: true });
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>Files</h2>
                    </CardTitle>
                </CardHeader>
                <Divider />
                <CardContent>
                    {isLoading ? (
                        <Loading description="Loading file list." />
                    ) : filesList.length ? (
                        <>
                            <Toolbar>
                                <ToolbarSection canGrow>
                                    <SearchBar textQuery={textQuery} onSearch={onSearch} />
                                </ToolbarSection>
                                <ToolbarSection>
                                    <Spacing size="tiny" vertical />
                                    <Button elevated text="Add file" onClick={toggleFileUploader} />
                                </ToolbarSection>
                            </Toolbar>
                            <Spacing size="tiny" />
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            {headers.map((property) => (
                                                <TableHeader key={property.key}>{property.header}</TableHeader>
                                            ))}
                                            <TableHeader key={"fileActions"}>{""}</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filesList
                                            .slice(
                                                (pagination.current - 1) * pagination.limit,
                                                pagination.current * pagination.limit
                                            )
                                            .map((file) => (
                                                <TableRow key={file.id}>
                                                    {headers.map((property) => (
                                                        <TableCell key={property.key}>
                                                            {property.highlighted ? (
                                                                <Highlighter
                                                                    label={file[property.key]}
                                                                    searchValue={textQuery}
                                                                />
                                                            ) : (
                                                                file[property.key]
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell key={"fileActions"}>
                                                        <IconButton
                                                            name="item-remove"
                                                            text="Remove file"
                                                            small
                                                            disruptive
                                                            onClick={() => openDeleteModal(file.id)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {filesList.length > Math.min(pagination.total, pagination.minPageSize) ? ( // Don't show if no pagination is needed
                                <>{paginationElement}</>
                            ) : null}
                        </>
                    ) : (
                        <EmptyFileWidget onFileAdd={toggleFileUploader} />
                    )}
                </CardContent>
            </Card>
            <FileUploadModal
                isOpen={isOpenDialog}
                onDiscard={toggleFileUploader}
                uploaderOptions={{ allowMultiple: false }}
            />
            <DeleteModal
                isOpen={deleteModalOpts.isOpen}
                onDiscard={closeDeleteModal}
                onConfirm={() => deleteFile(deleteModalOpts.fileName)}
            >
                <p>Are you sure you want to delete file '{deleteModalOpts.fileName}'?</p>
            </DeleteModal>
        </>
    );
};
