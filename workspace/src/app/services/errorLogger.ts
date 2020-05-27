import { ErrorInfo } from "react";
import Dexie from "dexie";
import { AxiosError } from "axios";
import { isDevelopment } from "../constants/path";
import { HttpError } from "./fetch/responseInterceptor";

interface IClientInfo {
    language: string;
    platform: string;
    userAgent: string;
    vendor: string;
    url: string;
    screen: {
        height: number;
        width: number;
    };
}

interface IError {
    name: string;
    message: string;
    client: IClientInfo;
    stack?: string;
    network?: any;
}

const LOG_TABLE = "logs";
const REQUEST_INTERVAL = 5 * 60 * 1000;

const tableInstance: any = new Dexie(LOG_TABLE);
tableInstance.version(1).stores({
    [LOG_TABLE]: "++id, name, message, stack, client, react_stack, network",
});

const timerId = setTimeout(async function checkLogs() {
    const logs = await tableInstance[LOG_TABLE].toArray();
    if (logs.length) {
        try {
            sendError(logs);
        } catch (e) {
            console.log(e);
        } finally {
            clearTimeout(timerId);
            setTimeout(checkLogs, REQUEST_INTERVAL);
        }
    }
}, REQUEST_INTERVAL);

/**
 * Using in window.onerror => global.ts
 * @desc Override the default onerror listener
 * @param message
 * @param url
 * @param lineNumber
 * @param colNo
 * @param normalErrorObject
 */
const onErrorHandler = (
    message: string,
    url: string,
    lineNumber: number,
    colNo?: number,
    normalErrorObject?: Error
): boolean => {
    if (normalErrorObject) {
        logError(normalErrorObject);
    } else {
        logError({
            name: message.split(":")[0],
            message,
            stack: `${url}:${lineNumber}:${colNo}`,
        });
    }
    return true;
};

/**
 * Collect all client info from browser
 */
const getClientInfo = (): IClientInfo => {
    const { navigator, location, screen } = window;
    const { language, platform, userAgent, vendor } = navigator;
    return {
        language,
        platform,
        userAgent,
        vendor,
        url: location.href,
        screen: {
            height: screen.height,
            width: screen.width,
        },
    };
};

/**
 * Generate the network error object
 * @param error The Error request config.
 */
const generateNetworkError = (error: HttpError) => {
    const { config } = error.errorDetails;
    const { url, data, headers, baseURL, method } = config;
    return {
        url,
        data,
        headers,
        baseURL,
        method,
    };
};

/**
 * Generate the default js Error object
 * @param name
 * @param data
 * @param stack
 * @return IError
 */
const generateDefaultError = (name: string = "DEFAULT_ERROR", data: any, stack?: string): Error => {
    const err: Error = {
        name,
        message: data,
    };

    if (stack) {
        err.stack = stack;
    }

    return err;
};

/**
 * Send the error
 * @param error
 * @param reactErrorInfo
 */
const logError = (error: HttpError | Error, reactErrorInfo?: ErrorInfo): boolean => {
    let err;

    try {
        const client = getClientInfo();
        if ("errorType" in error && error.isHttpError) {
            const errorMessage = error.errorResponse ? error.errorResponse.title : "Could not connect to server.";
            err = {
                ...generateDefaultError("Network error", errorMessage),
                network: generateNetworkError(error),
            };
        } else if (error instanceof Error) {
            const { name, message, stack } = error;
            const newStack = reactErrorInfo ? reactErrorInfo.componentStack : stack;
            err = generateDefaultError(name, message, newStack);
        } else {
            err = generateDefaultError("Uncaught Error type received ", error);
        }

        tableInstance[LOG_TABLE].put({
            ...err,
            client,
        });

        return true;
    } catch (e) {
        if (isDevelopment) {
            console.log(`Can't store the error for logging:`, e);
        }
        return false;
    }
};

/**
 * Send the error via http or store in indexedDB
 */
const sendError = async (logs) => {
    // @TODO: prepare endpoint for logs
    if (isDevelopment) {
        console.log(`Send Logs: ${Date().toString()}`);
        console.log(logs);
    }

    tableInstance[LOG_TABLE].clear();
    return true;
};

export { logError, onErrorHandler, generateNetworkError };
