import React, { useContext, useEffect, useState } from 'react';
import { AlertDialog, Button, Pagination, Spinner, Table } from '@gui-elements/index';
import {
    IAddedSuggestion,
    IPageSuggestion,
    IPlainObject,
    ISortDirection,
    ITableHeader,
    ITargetWithSelected,
    ITransformedSuggestion
} from "./suggestion.typings";
import _ from 'lodash';
import paginate from "../../utils/paginate";
import STableBody from "./SuggestionTable/STableBody";
import STableHeader from "./SuggestionTable/STableHeader";
import { SuggestionListContext } from "./SuggestionContainer";
import { PrefixDialog } from "./PrefixDialog";
import { filterRowsByColumnModifier, sortRows } from "./utils";

interface IPagination {
    // store current page number
    page: number;
    // store page size
    pageSize: number;
}

interface IProps {
    // received native data from backend
    rows: ITransformedSuggestion[];

    prefixList: ITransformedSuggestion[];

    loading: boolean;

    // call parent action during column (source->target) swap
    onSwapAction();

    // call parent discard(cancel) action
    onAskDiscardChanges();

    // call parent add action
    onAdd(selected: IAddedSuggestion[], selectedPrefix: string);
}

export default function SuggestionList({rows, prefixList, loading, onSwapAction, onAskDiscardChanges, onAdd}: IProps) {
    const context = useContext(SuggestionListContext);

    const [headers, setHeaders] = useState<ITableHeader[]>(
        [
            {header: 'Source data', key: 'source'},
            {header: null, key: 'SWAP_BUTTON'},
            {header: 'Target data', key: 'target',},
            {header: 'Mapping type', key: 'type'}
        ]
    );

    // store all result, because without pagination
    const [allRows, setAllRows] = useState<IPageSuggestion[]>([]);

    // store rows for current page
    const [pageRows, setPageRows] = useState<IPageSuggestion[]>([]);

    // store all filtered rows by column
    const [filteredRows, setFilteredRows] = useState<IPageSuggestion[]>([]);

    // pagination info
    const [pagination, setPagination] = useState<IPagination>({
        page: 1,
        pageSize: 25
    });

    // stored selected source labels or uris
    const [selectedSources, setSelectedSources] = useState<string[]>([]);

    // store hashmap for source->target, invert values on header swap action
    const [sourceToTargetMap, setSourceToTargetMap] = useState<IPlainObject>({});

    // store hashmap for target->type, replace target with source on header swap action
    const [targetToTypeMap, setTargetToTypeMap] = useState<any>({});

    // keep sort directions for columns
    const [sortDirections, setSortDirections] = useState<ISortDirection>({
        column: '',
        modifier: ''
    });

    // contain filtered columns filters
    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});

    // show the waring dialog when user try to swap the columns,for autogenerated targets selected
    const [warningDialog, setWarningDialog] = useState<boolean>(false);

    // show the prefix modal
    const [prefixModal, setPrefixModal] = useState(false);

    useEffect(() => {
        const arr = [];

        rows.forEach((row) => {
            const {candidates} = row;

            // add _selected field for each target
            const modifiedTarget = candidates.map(targetItem => ({
                ...targetItem,
                _selected: false
            }));

            // store modified source,target
            const modifiedRow: IPageSuggestion = {
                ...row,
                candidates: modifiedTarget,
            };

            // keep changes for selected items only after swap action
            if (selectedSources.includes(row.source)) {
                modifiedRow.candidates = modifiedRow.candidates.map(targetItem => {
                    const {label, description, uri, type, confidence, link} = targetItem;
                    return {
                        uri,
                        confidence,
                        label,
                        description,
                        link,
                        type: targetToTypeMap[uri] || type,
                        _selected: sourceToTargetMap[row.source] === uri
                    }
                });
            }

            if (context.isFromDataset) {
                modifiedRow.candidates.push({
                    uri: '',
                    label: 'Auto-generated property',
                    description: 'Property will generated after submit',
                    type: 'value',
                    link: 'https://dummy.url',
                    _selected: !modifiedRow.candidates.length,
                    _autogenerated: true,
                    confidence: 1
                });
            }

            // in case nothing selected, then select first item
            const someSelected = modifiedRow.candidates.some(t => t._selected);
            if (!someSelected) {
                modifiedRow.candidates[0]._selected = true;
            }

            arr.push(modifiedRow);
        });

        setAllRows(arr);
        const filteredRows = filterRowsByColumnModifier(columnFilters, selectedSources, arr);
        setFilteredRows(filteredRows);

        const ordered = sortRows(filteredRows, sortDirections);
        setPageRows(
            paginate(ordered, pagination)
        );

    }, [rows]);

    const updateRelations = (source, targets: ITargetWithSelected[]) => {
        const {uri, type} = targets.find(t => t._selected);

        setSourceToTargetMap(prevState => ({
            ...prevState,
            [source]: uri
        }));

        setTargetToTypeMap(prevState => ({
            ...prevState,
            [uri]: type
        }));
    };

    const toggleRowSelect = ({source, candidates}: IPageSuggestion) => {
        const selectedRow = selectedSources.find(selected => selected === source);
        if (selectedRow) {
            setSelectedSources(
                selectedSources.filter(selected => selected !== source)
            );
        } else {
            setSelectedSources(prevState => ([
                ...prevState,
                source,
            ]));
            updateRelations(source, candidates);
        }
    };

    const toggleSelectAll = () => {
        if (isAllSelected()) {
            setSelectedSources([]);
        } else if (!selectedSources.length) {
            pageRows.forEach(toggleRowSelect);
        } else {
            setSelectedSources(
                pageRows.map(row => {
                    updateRelations(row.source, row.candidates);
                    return row.source;
                })
            );
        }
    };

    const handlePageChange = (pagination: IPagination) => {
        setPagination(pagination);
        setPageRows(
            paginate(filteredRows, pagination)
        );
    };

    const handleAdd = (e, prefix?: string) => {
        const addedRows = selectedSources.map(source => {
            const found = allRows.find(row => row.source === source);
            if (found) {
                const target = found.candidates.find(t => t._selected);
                return {
                    source,
                    targetUri: target.uri,
                    type: target.type
                }
            }
        });

        const isAutogeneratedPresents = addedRows.some(
            // autogenerated values contains empty uri
            row => row.targetUri === ''
        );

        if (isAutogeneratedPresents && !prefix) {
            setPrefixModal(true);
            return;
        }

        if (prefix) {
            localStorage.setItem('prefix', prefix);
        }

        onAdd(addedRows, prefix);
    }

    const handleSort = (headerKey: string) => {
        const isAsc = sortDirections.modifier === 'asc';
        const direction = isAsc ? 'desc' : 'asc';

        const sortDirection: ISortDirection = {
            column: headerKey,
            modifier: direction
        };

        setSortDirections(sortDirection);

        const sortedArray = sortRows(filteredRows, sortDirection);

        setPageRows(
            paginate(sortedArray, pagination)
        );
    };

    const handleFilterColumn = (columnName: string, action: string) => {
        let colFilters = {...columnFilters};
        if (colFilters[columnName] === action) {
            delete colFilters[columnName]
        } else {
            colFilters[columnName] = action;
        }

        setColumnFilters(colFilters);

        const filteredRows = filterRowsByColumnModifier(colFilters, selectedSources, allRows);
        setPageRows(
            paginate(filteredRows, pagination)
        );
        setFilteredRows(filteredRows);
    };

    const handleSwap = () => {
        const isAutogeneratedSelected = selectedSources.some(source => {
            const found = allRows.find(row => row.source === source);
            if (found) {
                const {_autogenerated} = found.candidates.find(t => t._selected);
                return _autogenerated;
            }
        });

        if (isAutogeneratedSelected) {
            setWarningDialog(true);
            return;
        }

        handleConfirmSwap();
    };

    const handleConfirmSwap = () => {
        const targetsAsSelected = selectedSources.map(source => {
            const found = allRows.find(row => row.source === source);
            if (found) {
                const {uri} = found.candidates.find(t => t._selected);
                return uri;
            }
        });

        setSelectedSources(targetsAsSelected);

        // reset preview rows
        setPageRows([]);

        const sourceToType = {};
        const targetToSource = _.invert(sourceToTargetMap);

        _.forEach(targetToTypeMap, (value, key) => {
            const source = targetToSource[key];
            sourceToType[source] = value;
        });

        setSourceToTargetMap(targetToSource);
        setTargetToTypeMap(sourceToType);

        // swap header columns
        const temp = headers[0];
        headers[0] = headers[2];
        headers[2] = temp;

        setHeaders(headers);

        setWarningDialog(false);

        onSwapAction();
    };

    const handleModifyTarget = (row: IPageSuggestion, targets: ITargetWithSelected[]) => {
        const _allRows = [...allRows];
        const ind = _allRows.findIndex(r => r.source === row.source);

        if (ind > -1) {
            updateRelations(row.source, targets);

            _allRows[ind].candidates = targets;

            setAllRows(_allRows);
        }
    }

    const isAllSelected = () => filteredRows.length && pageRows.length === selectedSources.length;

    return loading ? <Spinner/> :
        <>
            {
                !pageRows.length
                    ? <p>No results found.</p>
                    : <>
                        <Table>
                            <STableHeader
                                headers={headers}
                                isAllSelected={isAllSelected()}
                                toggleSelectAll={toggleSelectAll}
                                onSwap={handleSwap}
                                onSort={handleSort}
                                onApplyFilter={handleFilterColumn}
                                sortDirections={sortDirections}
                            />
                            <STableBody
                                pageRows={pageRows}
                                selectedSources={selectedSources}
                                toggleRowSelect={toggleRowSelect}
                                onModifyTarget={handleModifyTarget}
                            />
                        </Table>
                        <Pagination
                            onChange={handlePageChange}
                            totalItems={allRows.length}
                            pageSizes={[5, 10, 25, 50, 100]}
                            page={pagination.page}
                            pageSize={pagination.pageSize}
                            backwardText={"Previous page"}
                            forwardText={"Next page"}
                            itemsPerPageText={"Items per page:"}
                            itemRangeText={(min, max, total) => `${min}–${max} of ${total} items`}
                            pageRangeText={(current, total) => `of ${total} pages`}
                        />
                    </>
            }
            <Button affirmative={true} onClick={handleAdd} data-test-id='add_button'>Add
                ({selectedSources.length})</Button>
            <Button disruptive={true} onClick={onAskDiscardChanges}>Cancel</Button>
            <AlertDialog
                warning={true}
                isOpen={warningDialog}
                portalContainer={context.portalContainer}
                onClose={() => setWarningDialog(false)}
                actions={[
                    <Button key="confirm" onClick={handleConfirmSwap}>
                        Swap
                    </Button>,
                    <Button key="cancel" onClick={() => setWarningDialog(false)}>
                        Cancel
                    </Button>,
                ]}
            >
                <p>The selected auto-generated properties lost after swap.</p>
                <p>Are you sure?</p>
            </AlertDialog>
            <PrefixDialog
                isOpen={prefixModal}
                onAdd={handleAdd}
                onDismiss={() => setPrefixModal(false)}
                prefixList={prefixList}
                selectedPrefix={localStorage.getItem('prefix') || ''}
            />
        </>
}
