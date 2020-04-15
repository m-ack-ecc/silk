import { createSelector } from "@reduxjs/toolkit";
import { IFiltersState, IPreviewState, IWidgetsState } from "./typings";
import { IStore } from "../../typings/IStore";
import { IGlobalState } from "@ducks/global/typings";

const globalSelector = (state: IStore): IGlobalState => state.global;
const filtersSelector = (state: IStore): IFiltersState => state.workspace.filters;
const previewSelector = (state: IStore): IPreviewState => state.workspace.preview;
const widgetsSelector = (state: IStore): IWidgetsState => state.workspace.widgets;

const isLoadingSelector = createSelector(
    [previewSelector],
    preview => preview.isLoading
);

const errorSelector = createSelector(
    [previewSelector],
    preview => preview.error
);

const resultsSelector = createSelector(
    [previewSelector],
    preview => preview.searchResults
);

const sortersSelector = createSelector(
    [filtersSelector],
    filters => filters.sorters
);

const facetsSelector = createSelector(
    [filtersSelector],
    filters => filters.facets
);

const appliedFiltersSelector = createSelector(
    [filtersSelector],
    filters => filters.appliedFilters
);

const appliedFacetsSelector = createSelector(
    [filtersSelector],
    filters => filters.appliedFacets
);

const paginationSelector = createSelector(
    [filtersSelector],
    filters => filters.pagination
);

const prefixListSelector = createSelector(
    [widgetsSelector],
    widgets => widgets.configuration.prefixes
);

const warningListSelector = createSelector(
    [widgetsSelector],
    widgets => widgets.warnings.results
);

const filesListSelector = createSelector(
    [widgetsSelector],
    widgets => widgets.files.results.map(item => ({
        id: item.name,
        formattedDate: (new Date(item.lastModified)).toLocaleString(),
        ...item
    }))
);

const newPrefixSelector = createSelector(
    [widgetsSelector],
    widgets => widgets.configuration.newPrefix
);

const isEmptyPageSelector = createSelector(
    [isLoadingSelector, resultsSelector, globalSelector],
    (isLoading, results, globalStore) =>
        !isLoading && !results.length && globalStore.initialSettings.emptyWorkspace
);

export default {
    appliedFiltersSelector,
    appliedFacetsSelector,
    resultsSelector,
    sortersSelector,
    paginationSelector,
    facetsSelector,
    errorSelector,
    isLoadingSelector,
    prefixListSelector,
    newPrefixSelector,
    warningListSelector,
    filesListSelector,
    isEmptyPageSelector,
    widgetsSelector
}
