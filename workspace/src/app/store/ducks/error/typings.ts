/**** Error format for all registered failures withing DI ****/
export interface DIErrorFormat {
    /**** where in DI the error came from ****/
    origin: string;
    /**** unique Id generated by the developer *****/
    id: string;
    /**** Human readable error message registered with error handler hook ****/
    message: string;

    /**** time instance of error in milliseconds *****/
    timestamp: number;

    /**** Optional stack trace explaining the exception ****/
    cause?: Error;
}

/****** DI error state containing all errors ******/
export interface IErrorState {
    errors: Array<DIErrorFormat>;
}
