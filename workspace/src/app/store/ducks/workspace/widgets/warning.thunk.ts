import { workspaceSel } from "@ducks/workspace";
import { getApiEndpoint } from "../../../../utils/getApiEndpoint";
import fetch from "../../../../services/fetch";
import { widgetsSlice } from "@ducks/workspace/widgetsSlice";
import { globalSel } from "@ducks/global";

const {setWarnings, setWidgetError, toggleWidgetLoading} = widgetsSlice.actions;

const WIDGET_NAME = 'warnings';

const toggleLoading = () => dispatch => dispatch(toggleWidgetLoading(WIDGET_NAME));

const setError = e => dispatch => dispatch(setWidgetError({
    widgetName: WIDGET_NAME,
    error: e
}));

export const fetchWarningListAsync = () => {
    return async (dispatch, getState) => {
        const projectId = globalSel.currentProjectIdSelector(getState());
        const url = getApiEndpoint(`/projects/${projectId}/failedTasksReport`);
        dispatch(toggleLoading());
        try {
            const {data} = await fetch({url});
            dispatch(toggleLoading());
            dispatch(setWarnings(data));
        } catch (e) {
            dispatch(toggleLoading());
            dispatch(setError(e));
        }
    };
};

export const fetchWarningMarkdownAsync = async (projectId: string, taskId: string) => {
    const url = getApiEndpoint(`/projects/${projectId}/failedTasksReport/${taskId}`);
    try {
        const {data} = await fetch({
            url,
            headers: {
                "Accept": "text/markdown",
                'Content-Type': "text/markdown"
            }
        });
        return data;
    } catch {
    }
};
