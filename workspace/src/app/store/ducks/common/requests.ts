import fetch from "../../../services/fetch";
import { coreApi, legacyApiEndpoint, workspaceApi } from "../../../utils/getApiEndpoint";
import { IDetailedArtefactItem, IOverviewArtefactItemList, IExportTypes } from "@ducks/common/typings";

const handleError = (error) => {
    return error.errorResponse;
};

/**
 * Get initial configs for whole application
 */
export const requestInitFrontend = async (): Promise<any | never> => {
    try {
        const { data } = await fetch({
            url: workspaceApi("/initFrontend"),
        });
        return data;
    } catch (e) {
        throw handleError(e);
    }
};

/**
 * get common data types or for specific project
 * @param projectId
 */
export const requestSearchConfig = async (projectId?: string): Promise<any | never> => {
    try {
        const url = projectId ? `/searchConfig/types?projectId=${projectId}` : `/searchConfig/types`;
        const { data } = await fetch({
            url: workspaceApi(url),
        });
        return data;
    } catch (e) {
        throw handleError(e);
    }
};

/**
 * Get plugins list
 * @param payload
 */
export const requestArtefactList = async (payload: any): Promise<IOverviewArtefactItemList | never> => {
    try {
        const { data } = await fetch({
            url: coreApi("/taskPlugins"),
            body: payload,
        });
        return data;
    } catch (e) {
        throw handleError(e);
    }
};

/**
 * Get properties(form) for specific plugin
 * @param artefactKey
 */
export const requestArtefactProperties = async (artefactKey: string): Promise<IDetailedArtefactItem> => {
    try {
        const { data } = await fetch({
            url: coreApi(`/plugins/${artefactKey}`),
        });
        return data;
    } catch (e) {
        throw handleError(e);
    }
};

/**
 * Get all available import/export types
 */
export const requestExportTypes = async (): Promise<IExportTypes> => {
    try {
        const { data } = await fetch({
            url: legacyApiEndpoint(`/marshallingPlugins`),
        });
        return data;
    } catch (e) {
        throw handleError(e);
    }
};
