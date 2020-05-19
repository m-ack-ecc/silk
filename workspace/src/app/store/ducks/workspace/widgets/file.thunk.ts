import { widgetsSlice } from "@ducks/workspace/widgetsSlice";
import { commonSel } from "@ducks/common";
import { requestResourcesList } from "@ducks/shared/requests";

const { setFiles, setWidgetError, toggleWidgetLoading } = widgetsSlice.actions;

const WIDGET_NAME = "files";

const toggleLoading = () => (dispatch) => dispatch(toggleWidgetLoading(WIDGET_NAME));

const setError = (e) => (dispatch) =>
    dispatch(
        setWidgetError({
            widgetName: WIDGET_NAME,
            error: e,
        })
    );

export const fetchResourcesListAsync = (filters: any = {}) => {
    return async (dispatch, getState) => {
        const projectId = commonSel.currentProjectIdSelector(getState());
        try {
            dispatch(toggleLoading());
            const data = await requestResourcesList(projectId, filters);
            dispatch(setFiles(data));
        } catch (e) {
            dispatch(setError(e));
        } finally {
            dispatch(toggleLoading());
        }
    };
};
