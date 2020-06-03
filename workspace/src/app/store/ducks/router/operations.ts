import qs from "qs";
import { getLocation, push, replace } from "connected-react-router";
import { SERVE_PATH } from "../../../constants/path";
import { IMetadata } from "@ducks/shared/typings";
import { ISearchResultsServer } from "@ducks/workspace/typings";

interface IQueryParams {
    [key: string]: any;
}

export interface IPageLabels {
    pageTitle?: string;
    projectLabel?: string;
    taskLabel?: string;
}

const itemTypeToPathMap = {
    Transform: "transform",
    Linking: "linking",
    Workflow: "workflow",
    CustomTask: "task",
    Dataset: "dataset",
};

const itemTypeToPath = (itemType: string) => {
    const str = itemType[0].toUpperCase() + itemType.slice(1);
    if (itemTypeToPathMap[str]) {
        return itemTypeToPathMap[str];
    } else {
        return "task";
    }
};

const setQueryString = (queryParams: IQueryParams) => {
    return (dispatch, getState) => {
        const location = getLocation(getState());
        const currentQuery = {};

        Object.keys(queryParams).forEach((paramName) => {
            const values = queryParams[paramName];
            const validValue = Array.isArray(values) ? values : values.toString();

            if (validValue && validValue.length) {
                currentQuery[paramName] = validValue;
            } else {
                delete currentQuery[paramName];
            }
        });

        const qsStr = `${location.pathname}?${qs.stringify(currentQuery, {
            arrayFormat: "comma",
        })}`;
        dispatch(push(qsStr));
    };
};

/**
 * Navigates to a specific page of the application.
 * @param path       The path of the page. This may be an absolute or relative path. If it starts with a '/' it will
 *                   be considered an absolute path, else it will be considered as relative to the '/workspace' path.
 * @param pageLabels The labels of the target page, e.g. page title and labels for parts of the breadcrumb.
 */
const goToPage = (path: string, pageLabels: IPageLabels = {} as IPageLabels) => {
    const isAbsolute = path.startsWith("/");
    return (dispatch) => {
        dispatch(
            push(isAbsolute ? path : path ? SERVE_PATH + "/" + path : SERVE_PATH, {
                pageLabels: pageLabels,
            })
        );
    };
};

const goToTaskPage = (task: ISearchResultsServer) => {
    const { projectId, type, id, label } = task;
    return (dispatch) => {
        dispatch(
            goToPage(`projects/${projectId}/${itemTypeToPath(type)}/${id}`, {
                taskLabel: label,
            })
        );
    };
};

const replacePage = (path: string, pageLabels: IPageLabels) => {
    const isAbsolute = path.startsWith("/");
    return (dispatch) => {
        dispatch(replace(isAbsolute ? path : SERVE_PATH + "/" + path, { pageLabels: pageLabels }));
    };
};

const updateLocationState = (forPath: string, projectId: string, metaData: IMetadata) => {
    const newLabels: IPageLabels = {};
    if (projectId) {
        // Project ID exists, this must be a task
        newLabels.taskLabel = metaData.label;
    } else {
        newLabels.projectLabel = metaData.label;
    }

    return (dispatch, getState) => {
        const location = getLocation(getState());
        if (location.pathname.endsWith(forPath)) {
            // Only replace page if still on the same page
            dispatch(replacePage(forPath, newLabels));
        }
    };
};

export default {
    setQueryString,
    goToPage,
    replacePage,
    updateLocationState,
    goToTaskPage,
    itemTypeToPath,
};
