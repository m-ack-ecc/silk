import React from "react";
import { DIErrorFormat, diErrorMessage, DIErrorTypes } from "@ducks/error/typings";
import { Notification } from "@eccenca/gui-elements";
import { useDispatch, useSelector } from "react-redux";
import errorSelector from "@ducks/error/selectors";
import { registerNewError, clearOneOrMoreErrors } from "@ducks/error/errorSlice";
import { ErrorResponse, FetchError } from "../services/fetch/responseInterceptor";
import { useTranslation } from "react-i18next";

/**
 * @param errorId      An application wide unique error ID. This will be uniquely represented in the error widget.
 * @param errorMessage A human readable error message that should be shown in the UI.
 * @param cause        The actual error that has happened.
 */
export type ErrorHandlerRegisterFuncType = (
    errorId: string,
    errorMessage: string,
    cause: DIErrorTypes | null
) => JSX.Element | null;

interface ErrorHandlerDict {
    registerError: ErrorHandlerRegisterFuncType;
    getAllErrors: () => Array<DIErrorFormat>;
    clearErrors: (errorIds?: Array<string> | undefined) => void;
}

export type RegisterErrorType = Pick<DIErrorFormat, "id" | "message" | "cause">;

/** Hook for registering errors in the centralized error handling component. */
const useErrorHandler = (): ErrorHandlerDict => {
    const error = useSelector(errorSelector);
    const dispatch = useDispatch();
    const [t] = useTranslation();

    /** register a new error to the error stack
     *
     * @param errorId A globally unique error ID that has to be set by the developer. Convention: "<ComponentName>_<ActionName>", e.g. "WorkflowEditor_LoadWorkflow".
     * @param errorMessage Human readable error message.
     * @param cause Optional Error object explaining the exception.
     */
    const registerError: ErrorHandlerRegisterFuncType = (
        errorId: string,
        errorMessage: string,
        cause: DIErrorTypes | null
    ) => {
        const error: RegisterErrorType = {
            id: errorId,
            message: errorMessage,
            cause,
        };
        if (canBeIgnored(cause)) {
            // Just ignore this error
            return null;
        } else if (isTemporarilyUnavailableError(cause)) {
            // Handle 503 errors differently
            const tempUnavailableMessage = t("common.messages.temporarilyUnavailableMessage", {
                detailMessage: diErrorMessage(cause),
            });
            dispatch(
                registerNewError({
                    newError: {
                        id: "temporarily-unavailable",
                        message: tempUnavailableMessage,
                        cause: null,
                        alternativeIntent: "warning",
                    },
                })
            );
            return <Notification message={tempUnavailableMessage} />;
        } else if (isNotFoundError(cause)) {
            // Do not log 404 errors at all. These are usually due to page 404. Only log to console.
            console.warn("Received 404 error.", cause);
            return null;
        } else {
            dispatch(registerNewError({ newError: error }));
            return <Notification message={errorMessage} warning />;
        }
    };

    const isTemporarilyUnavailableError = (error?: DIErrorTypes | null): boolean => {
        return (
            !!error &&
            (((error as FetchError).isFetchError && (error as FetchError).httpStatus === 503) ||
                (error as ErrorResponse).status === 503)
        );
    };

    const canBeIgnored = (error?: DIErrorTypes | null): boolean => {
        return !!error && (error as FetchError).isFetchError && (error as FetchError).errorResponse.canBeIgnored;
    };

    const isNotFoundError = (error?: DIErrorTypes | null): boolean => {
        return (
            !!error &&
            (((error as FetchError).isFetchError && (error as FetchError).httpStatus === 404) ||
                (error as ErrorResponse).status === 404)
        );
    };

    // get a list of all errors
    const getAllErrors = () => {
        return error.errors;
    };

    /***
     * deletes all errors corresponding to the ids passed in the parameter,
     * if no parameter is passed it clears all errors.
     *  ***/
    const clearErrors = (errorIds?: Array<string> | undefined) => {
        dispatch(clearOneOrMoreErrors({ errorIds }));
    };

    return {
        registerError,
        getAllErrors,
        clearErrors,
    };
};

export default useErrorHandler;
