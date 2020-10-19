import axios, { AxiosRequestConfig, Method } from "axios";
import { requestInterceptor } from "./requestInterceptor";
import { FetchResponse, responseInterceptorOnError, responseInterceptorOnSuccess } from "./responseInterceptor";
import i18n from "../../../language";
import { isTestEnv } from "../../constants/path";

interface IFetchOptions {
    url: string;
    method?: Method;
    body?: any;
    headers?: any;
}

/**
 * @private
 * Contain all pending requests Promises
 */
const _pendingRequests = [];

// Add a request interceptor
axios.interceptors.request.use(requestInterceptor);

// Add a response interceptor
axios.interceptors.response.use(responseInterceptorOnSuccess, responseInterceptorOnError);

/**
 * @public
 * @param url
 * @param body   The body of the request. In case of a GET request, these are the query parameters.
 * @param method
 * @param headers
 * @param params the URL parameters to be sent with the request
 */
export const fetch = async <T = any>({
    url,
    body,
    method = "GET",
    headers = {},
}: IFetchOptions): Promise<FetchResponse<T> | never> => {
    const curToken = axios.CancelToken.source();
    const cToken = curToken.token;

    let config: AxiosRequestConfig = {
        method,
        url,
        cancelToken: cToken,
        data: body,
    };

    config.headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
    };

    if (method === "GET") {
        config.params = body;
    }
    try {
        if (isTestEnv) {
            config = requestInterceptor(config);
            const response = await axios(config);
            return responseInterceptorOnSuccess(response);
        }
        //@ts-ignore
        return await axios(config);
    } catch (e) {
        if (isTestEnv) {
            return responseInterceptorOnError(e);
        }
        throw e;
    } finally {
        // Remove request
        const index = _pendingRequests.findIndex((item) => item.token === cToken);
        if (index > -1) {
            _pendingRequests.splice(index, 1);
        }
    }
};

/**
 * Abort pending all requests
 */
export const abortPendingRequest = (): boolean => {
    if (_pendingRequests.length) {
        _pendingRequests.map((req) => req.cancel(i18n.t("http.error.aborted", "Request Aborted")));
        return true;
    }
    return false;
};
