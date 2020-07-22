import { IArtefactItem, IArtefactModal, ICommonState } from "./typings";
import { getLocale } from "./thunks/locale.thunk";

export function initialArtefactModalState(): IArtefactModal {
    return {
        isOpen: false,
        error: {},
        artefactsList: [],
        selectedArtefact: {} as IArtefactItem,
        cachedArtefactProperties: {},
        selectedDType: "all",
        loading: false,
        categories: [],
    };
}

export function initialCommonState(): ICommonState {
    return {
        locale: getLocale(),
        currentProjectId: null,
        currentTaskId: null,
        authenticated: true,
        searchQuery: "",
        error: {},
        availableDataTypes: {},
        initialSettings: {},
        exportTypes: [],
        artefactModal: initialArtefactModalState(),
    };
}
