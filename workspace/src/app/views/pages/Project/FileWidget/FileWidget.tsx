import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, DataTable } from "carbon-components-react";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import { Card, CardContent, CardHeader, CardTitle, Divider } from "@wrappers/index";
import Loading from "../../../shared/Loading";
import FileUploadModal from "../../../shared/modals/FileUploadModal";
import { EmptyFileWidget } from "./EmptyFileWidget";

const {
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableHeader,
    TableToolbar,
    TableToolbarSearch,
    TableToolbarContent,
} = DataTable;

export const FileWidget = () => {
    const dispatch = useDispatch();

    const filesList = useSelector(workspaceSel.filesListSelector);
    const fileWidget = useSelector(workspaceSel.widgetsSelector).files;

    const [isOpenDialog, setIsOpenDialog] = useState<boolean>(false);
    const { isLoading } = fileWidget;

    const headers = [
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "formattedDate", header: "Date" },
        { key: "state", header: "State" },
    ];

    useEffect(() => {
        dispatch(workspaceOp.fetchResourcesListAsync());
    }, []);

    const toggleFileUploader = () => {
        setIsOpenDialog(!isOpenDialog);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h3>Files</h3>
                    </CardTitle>
                </CardHeader>
                <Divider />
                <CardContent>
                    {isLoading ? (
                        <Loading />
                    ) : filesList.length ? (
                        <DataTable
                            rows={filesList}
                            headers={headers}
                            render={({ rows, headers, getHeaderProps }) => (
                                <TableContainer>
                                    <TableToolbar>
                                        <TableToolbarContent>
                                            <TableToolbarSearch />
                                            <Button kind={"primary"} onClick={toggleFileUploader}>
                                                + Add File
                                            </Button>
                                        </TableToolbarContent>
                                    </TableToolbar>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                {headers.map((header) => (
                                                    <TableHeader {...getHeaderProps({ header })}>
                                                        {header.header}
                                                    </TableHeader>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rows.map((row) => (
                                                <TableRow key={row.id}>
                                                    {row.cells.map((cell) => (
                                                        <TableCell key={cell.id}>{cell.value}</TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        />
                    ) : (
                        <EmptyFileWidget onFileAdd={toggleFileUploader} />
                    )}
                </CardContent>
            </Card>
            <FileUploadModal isOpen={isOpenDialog} onDiscard={toggleFileUploader} />
        </>
    );
};
