export interface IAvailableDataTypes {
    [key: string]: IAvailableDataType
}

export interface IAvailableDataTypeOption {
    id: string;
    label: string;
}

export interface IAvailableDataType {
    label: string;
    field: string;
    options: IAvailableDataTypeOption[];
}

export interface IPropertyAutocomplete {
    allowOnlyAutoCompletedValues: boolean;
    autoCompleteValueWithLabels: boolean;
    autoCompletionDependsOnParameters: string[];
}

export interface IArtefactItemProperty {
    title: string;
    description: string;
    type: string;
    value: string;
    advanced: boolean;
    autoCompletion?: IPropertyAutocomplete;
}

export interface IArtefactItem {
    key: string;
    title: string;
    description: string;
    type: string;
    categories: string[];
    properties: {
        [key: string]: IArtefactItemProperty
    };
    required: string[];
}

export interface IArtefactModal {
    isOpen: boolean;
    artefactsList: IArtefactItem[];
    selectedArtefact: IArtefactItem;
    selectedDType: string;
}

export interface IGlobalState {
    /**
     * Used in Project details page only and store the current selected project id
     * Received from router
     */
    currentProjectId: string;
    locale: string;
    initialSettings: any;
    authenticated: boolean;
    searchQuery: string;
    error?: any;
    availableDataTypes: IAvailableDataTypes;
    artefactModal: IArtefactModal;
}
