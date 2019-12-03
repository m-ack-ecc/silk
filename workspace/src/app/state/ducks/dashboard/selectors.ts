import { createSelector } from "@reduxjs/toolkit";
import { IFiltersState } from "./filters/dtos/Filter.dto";
import { IPreviewState } from "./preview/dtos";
import { IStore } from "../../store.dto";

const filtersSelector = (state: IStore): IFiltersState => state.dashboard.filters;
const previewSelector = (state: IStore): IPreviewState => state.dashboard.preview;

const resultsSelector = createSelector(
    [previewSelector],
    preview => preview.searchResults
);

const modifiersSelector = createSelector(
    [filtersSelector],
    filters => filters.modifiers
);

const facetsSelector = createSelector(
    [filtersSelector],
    filters => filters.facets
);

const appliedFiltersSelector = createSelector(
    [filtersSelector],
    filters => filters.appliedFilters
);

const paginationSelector = createSelector(
    [filtersSelector],
    filters => filters.pagination
);

export default {
    appliedFiltersSelector,
    resultsSelector,
    paginationSelector,
    modifiersSelector,
    facetsSelector
}
