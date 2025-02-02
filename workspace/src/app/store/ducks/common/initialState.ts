import { IArtefactModal, ICommonState } from "./typings";
import { fetchStoredLang } from "../../../../language";

export function initialArtefactModalState(): IArtefactModal {
    return {
        isOpen: false,
        error: {},
        artefactsList: [],
        selectedArtefact: undefined,
        cachedArtefactProperties: {},
        selectedDType: "all",
        loading: false,
        categories: [],
    };
}

export function initialCommonState(): ICommonState {
    return {
        locale: fetchStoredLang(),
        currentProjectId: undefined,
        currentTaskId: undefined,
        authenticated: true,
        searchQuery: "",
        error: {},
        availableDataTypes: {},
        initialSettings: { emptyWorkspace: true, initialLanguage: "en", hotKeys: {} },
        exportTypes: [],
        artefactModal: initialArtefactModalState(),
    };
}
