import React, { useEffect, useState } from "react";
import Pagination from "../../../components/pagination/Pagination";
import { useDispatch, useSelector } from "react-redux";
import { dashboardOp, dashboardSel } from "@ducks/dashboard";
import ActionsTopBar from "./ActionsTopBar";
import AppliedFacets from "./AppliedFacets";
import DataList from "../../../components/datalist/DataList";
import DeleteModal from "../../../components/modals/DeleteModal";
import ProjectRow from "./ProjectRow";
import Loading from "../../../components/loading/Loading";

export default function ProjectsList() {

    const dispatch = useDispatch();

    const [deleteModalOptions, setDeleteModalOptions] = useState({});

    const data = useSelector(dashboardSel.resultsSelector);

    const sorters = useSelector(dashboardSel.sortersSelector);

    const pagination = useSelector(dashboardSel.paginationSelector);
    const appliedFilters = useSelector(dashboardSel.appliedFiltersSelector);

    const [selectedItem, setSelectedItem] = useState();
    const [showDeleteModal, setShowDeleteModal] = useState();

    useEffect(() => {
        dispatch(dashboardOp.fetchListAsync());
    }, [appliedFilters, sorters.applied, pagination.current]);

    const onDiscardDeleteModal = () => {
        setShowDeleteModal(false);
        setSelectedItem(null)
    };

    const onOpenDeleteModal = async (item?: any) => {
        setShowDeleteModal(true);
        setSelectedItem(item);

        setDeleteModalOptions({
            render: () => <Loading/>
        });

        const data = await dashboardOp.getTaskMetadataAsync(item.id, item.projectId);
        const {dependentTasksDirect} = data.relations;

        if (dependentTasksDirect.length) {
            setDeleteModalOptions({
                confirmationRequired: true,
                render: () =>
                    <div>
                        <p>There are tasks depending on task {item.label || item.id}. </p>
                        <p>Are you sure you want to delete all tasks below?</p>
                        <ul>
                            {
                                dependentTasksDirect.map(rel => <li key={rel}>{rel}</li>)
                            }
                        </ul>
                    </div>
            });
        } else {
            setDeleteModalOptions({
                confirmationRequired: false,
                render: () => <p>
                    Are you sure you want to permanently remove this item?
                </p>
            });
        }
    };

    const handleConfirmRemove = () => {
        onDiscardDeleteModal();
        dispatch(dashboardOp.fetchRemoveTaskAsync(selectedItem.id, selectedItem.projectId));
    };

    const handlePageChange = (n: number) => {
        dispatch(dashboardOp.changePage(n))
    };

    const {Header, Body, Footer} = DataList;
    return (
        <>
            <ActionsTopBar/>
            {
                !data.length ? <p>No resources found</p> :
                    <DataList>
                        <Header>
                            <AppliedFacets/>
                        </Header>
                        <Body>
                        {
                            data.map(item => <ProjectRow
                                key={item.id}
                                item={item}
                                onOpenDeleteModal={() => onOpenDeleteModal(item)}
                                searchValue={appliedFilters.textQuery}
                            />)
                        }
                        </Body>
                        <Footer>
                            <Pagination
                                pagination={pagination}
                                onPageChange={handlePageChange}
                            />
                        </Footer>
                    </DataList>
            }
            <DeleteModal
                isOpen={showDeleteModal}
                onDiscard={onDiscardDeleteModal}
                onConfirm={handleConfirmRemove}
                {...deleteModalOptions}
            />
        </>
    )
}
