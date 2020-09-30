import React from "react";
import { createMemoryHistory, History } from "history";
import { EnzymePropSelector, mount, ReactWrapper } from "enzyme";
import { Provider } from "react-redux";
import { AppLayout } from "../../src/app/views/layout/AppLayout/AppLayout";
import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import rootReducer from "../../src/app/store/reducers";
import { ConnectedRouter, routerMiddleware } from "connected-react-router";
import {
    AxiosMockQueueItem,
    AxiosMockRequestCriteria,
    AxiosMockType,
    HttpResponse,
} from "jest-mock-axios/dist/lib/mock-axios-types";
import mockAxios from "../__mocks__/axios";
import { CONTEXT_PATH, SERVE_PATH } from "../../src/app/constants/path";
import { mergeDeepRight } from "ramda";
import { IStore } from "../../src/app/store/typings/IStore";
import { render } from "@testing-library/react";
import {
    responseInterceptorOnError,
    responseInterceptorOnSuccess,
} from "../../src/app/services/fetch/responseInterceptor";
import { AxiosError } from "axios";

interface IMockValues {
    history: History;
    useParams: Record<string, string>;
}

const mockValues: IMockValues = {
    history: createMemoryHistory(),
    useParams: {
        projectId: "Set me via TestHelper.setUseParams!",
        taskId: "Set me via TestHelper.setUseParams!",
    },
};
const host = process.env.HOST;

// Mock global history object
jest.mock("../../src/app/store/configureStore", () => {
    return {
        getHistory: jest.fn().mockImplementation(() => {
            return mockValues.history;
        }),
    };
});

// Mock useParams hook
jest.mock("react-router", () => ({
    ...jest.requireActual("react-router"), // use actual for all non-hook parts
    useParams: () => ({
        projectId: mockValues.useParams.projectId,
        taskId: mockValues.useParams.taskId,
    }),
}));

/** Creates the Redux store.
 *
 * @param history      The initial history.
 * @param initialState
 */
export const createStore = (history: History<{}>, initialState: RecursivePartial<IStore>) => {
    const root = rootReducer(history);
    const middleware = [
        ...getDefaultMiddleware({
            serializableCheck: false,
        }),
        routerMiddleware(history),
    ];

    // Get the initial state (defaults) of the store
    // FIXME: Is there a better way to get the initial state of the store?
    const tempStore = configureStore({
        reducer: root,
        middleware,
    });

    const rootState = tempStore.getState();
    // Patch the state with user supplied state
    const state = mergeDeepRight(rootState, initialState) as IStore;
    // Create store with merged state
    return configureStore({
        reducer: root,
        middleware,
        preloadedState: state,
    });
};

/** Similar to Partial, but applies recursively. */
export type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends object
        ? RecursivePartial<T[P]>
        : T[P];
};

export const withMount = (component) => mount(component);

export const withRender = (component, rerender?: Function) => (rerender ? rerender(component) : render(component));

/** Returns a wrapper for the application. */
export const testWrapper = (
    component: React.ReactNode,
    history: History<{}>,
    initialState: RecursivePartial<IStore> = {}
) => {
    const store = createStore(history, initialState);
    // Set path name of global mock
    mockValues.history = history;

    return (
        <Provider store={store}>
            <ConnectedRouter history={history}>
                <AppLayout>{component}</AppLayout>
            </ConnectedRouter>
        </Provider>
    );
};

/** Sets what should be returned from the useParams hook. */
export const setUseParams = (projectId: string, taskId: string): void => {
    mockValues.useParams = {
        projectId: projectId,
        taskId: taskId,
    };
};

/** Logs all requests to the console. */
export const logRequests = (axiosMock?: AxiosMockType) => {
    const mock = axiosMock ? axiosMock : mockAxios;
    mock.queue().forEach((request) => {
        console.log(request);
    });
};

/** Clicks an element specified by a selector. */
export const clickElement = (wrapper: ReactWrapper<any, any>, cssSelector: string | EnzymePropSelector) => {
    const element = findSingleElement(wrapper, cssSelector);
    clickWrapperElement(element);
    // console.log(`Clicked element with selector '${cssSelector}'.`);
};

/** Click the element represented by the given wrapper.
 *
 * @param wrapper The element to click on.
 * @param times How many times to click.
 */
export const clickWrapperElement = (wrapper: ReactWrapper<any, any>, times: number = 1) => {
    // There should only be one element, if there are more, the selector needs to be more selective
    expect(wrapper).toHaveLength(1);
    for (let i = 0; i < times; i++) {
        wrapper.simulate("click");
    }
};

/** Simulates a keyboard key press on an element. */
export const pressKey = (wrapper: ReactWrapper<any, any>, key: string = "Enter") => {
    wrapper.simulate("keypress", { key: key });
};

/** Simulates a key down event on the element. */
export const keyDown = (wrapper: ReactWrapper<any, any>, key: string = "Enter") => {
    wrapper.simulate("keydown", { key: key });
};

/** Triggers a change event on an element. */
export const changeValue = (wrapper: ReactWrapper<any, any>, value: string) => {
    wrapper.simulate("change", { target: { value: value } });
};

/** Finds a single element corresponding to the selector or fails. */
export const findSingleElement = (
    wrapper: ReactWrapper<any, any>,
    cssSelector: string | EnzymePropSelector
): ReactWrapper<any, any> => {
    wrapper.update();
    const element = findAll(wrapper, cssSelector);
    expect(element).toHaveLength(1);
    return element[0];
};

/** Returns a data test id selector. */
export const byTestId = (testId: string): EnzymePropSelector => {
    return { "data-test-id": testId };
};

/** Prints the complete page HTML string to console. */
export const logPageHtml = (): void => {
    process.stdout.write(window.document.documentElement.outerHTML);
};

/** Returns a function that logs the page HTML and returns the error. */
export const logPageOnError = (err: Error) => {
    console.log(logPageHtml());
    return err;
};

/** Logs the wrapper HTML on error. */
export const logWrapperHtmlOnError = (wrapper: ReactWrapper<any, any>) => {
    wrapper.update();
    return (err: Error) => {
        console.log(wrapper.html());
        return err;
    };
};

/** Returns a name selector. */
export const byName = (name: string): EnzymePropSelector => {
    return { name: name };
};

/** Enzyme's find() method returns not always just the DOM elements, but also companion objects for each DOM element.
 * Filter out these companion objects and see if 1 element is left and return it. */
const extractValidElements = function (element: ReactWrapper<any, any>) {
    const validElementIdx: number[] = [];
    element.getElements().forEach((elem, idx) => {
        if (typeof elem.type === "string") {
            validElementIdx.push(idx);
        }
    });
    return validElementIdx.map((idx) => element.at(idx));
};
/** Finds all wrapper elements that are actual elements in the DOM */
export const findAll = (wrapper: ReactWrapper<any, any>, cssSelector: string | EnzymePropSelector): ReactWrapper[] => {
    wrapper.update();
    const element =
        typeof cssSelector === "string"
            ? wrapper.find(cssSelector as string)
            : wrapper.find(cssSelector as EnzymePropSelector);

    return extractValidElements(element);
};

interface IAxiosResponse {
    status?: number;
    data?: any;
}

/** Convenience method to create axios mock responses */
export const mockedAxiosResponse = ({ status = 200, data = "" }: IAxiosResponse = {}) => {
    return {
        status: status,
        data: data,
    };
};

/** Returns the Axios queue item based on the given criteria. */
const axiosMockItemByCriteria = (criteria: string | AxiosMockRequestCriteria): AxiosMockQueueItem => {
    if (typeof criteria === "string") {
        return mockAxios.getReqByUrl(criteria);
    } else {
        return mockAxios.getReqMatching(criteria);
    }
};

/** An Axios error mock that can be used with the mockAxiosResponse method. */
export const mockedAxiosError = (httpStatus?: number, errorData?: any): AxiosError => {
    return {
        name: "Mocked Axios error",
        message: "Mocked Axios error",
        config: {},
        response: {
            status: httpStatus,
            data: errorData,
            statusText: "error status",
            headers: {},
            config: {},
        },
        isAxiosError: true,
        toJSON: () => ({}),
    };
};

/** Mock an Axios request. Depending on the response object this is either a valid response or an error. */
export const mockAxiosResponse = (
    criteria: string | AxiosMockRequestCriteria,
    response?: HttpResponse | AxiosError,
    silentMode?: boolean
): void => {
    mockAxios.interceptors.response.use(responseInterceptorOnSuccess, responseInterceptorOnError);
    const requestQueueItem = axiosMockItemByCriteria(criteria);
    if (requestQueueItem) {
        if (response) {
            if ((response as AxiosError).isAxiosError) {
                mockAxios.mockError(response, requestQueueItem);
            } else {
                mockAxios.mockResponseFor(criteria, response as HttpResponse, silentMode);
            }
        } else {
            mockAxios.mockResponseFor(criteria, response as HttpResponse, silentMode);
        }
    }
};

// Returns an array with values 0 ... (nrItems - 1)
export const rangeArray = (nrItems: number): number[] => {
    const indexes = Array(nrItems).keys();
    // @ts-ignore
    return [...indexes];
};

/** Jest does not allow to set the window.location. In order to test changes on that object, we need to mock it.
 * This function mocks the window.location object and restores it afterwards. */
export const withWindowLocation = async (block: () => void, location: any = {}) => {
    const oldLocation = window.location;
    delete window.location;
    window.location = location;
    await block();
    window.location = oldLocation;
};

/** Returns the absolute path under the workspace path with the given path value appended. */
export const workspacePath = (path: string = ""): string => {
    return path ? SERVE_PATH + prependSlash(path) : SERVE_PATH;
};

/** Absolute URL of the legacy API. Basically all over the place. ;) */
export const legacyApiUrl = (path: string): string => {
    return host + CONTEXT_PATH + prependSlash(path);
};

// Prepend a "/" in front of the path if it is missing.
const prependSlash = function (path: string) {
    if (!path.startsWith("/")) {
        return "/" + path;
    } else {
        return path;
    }
};

/** Returns the absolute URL under the api path with the given path value appended. */
export const apiUrl = (path: string): string => {
    return host + CONTEXT_PATH + "/api" + prependSlash(path);
};

/** Checks if a request to a specific URL was made.
 *
 * @param url             The URL the request was made to.
 * @param method          The HTTP method of the request.
 * @param data            The expected data of the request. Either the request body or query parameters.
 * @param partialEquality Should the request data only be checked partially, i.e. only the values that are actually given in the parameter?
 */
export const checkRequestMade = (
    url: string,
    method: string = "GET",
    data: any = null,
    partialEquality: boolean = false
): void => {
    const reqInfo = mockAxios.getReqMatching({
        url: url,
    });
    if (!reqInfo) {
        throw new Error(`No request was made to URL ${url} with method '${method}'.`);
    }
    if (data !== null) {
        if (partialEquality && typeof data === "object") {
            Object.entries(data).forEach(([key, value]) => {
                expect(reqInfo.data[key]).toStrictEqual(value);
            });
        } else {
            expect(reqInfo.data).toStrictEqual(data);
        }
    }
};
