import { workspaceApi } from "../../../../utils/getApiEndpoint";
import { AxiosResponse } from "axios";
import fetch from "../../../../services/fetch";

/** Fetches related items for project tasks. */
export const getRelatedItemsAsync = async (projectId: string, taskId: string): Promise<IRelatedItems> => {
    const url = workspaceApi(`/projects/${projectId}/tasks/${taskId}/relatedItems`);

    try {
        const { data }: AxiosResponse<IRelatedItems> = await fetch({ url });
        return data;
    } catch (e) {
        return e;
    }
};

export interface IRelatedItems {
    total: number;
    items: IRelatedItem[];
}

export interface IRelatedItem {
    id: string;
    label: string;
    type: string;
    itemLinks: IItemLink[];
}

export interface IItemLink {
    label: string;
    path: string;
}
