import { ITaskParameter } from "@ducks/common/typings";
import { FieldItem, FieldSet, Icon, TitleSubsection } from "@wrappers/index";
import { Autocomplete } from "../../../Autocomplete/Autocomplete";
import { InputMapper } from "./InputMapper";
import { Intent } from "@wrappers/blueprint/constants";
import React from "react";
import { sharedOp } from "@ducks/shared";
import { AppToaster } from "../../../../../services/toaster";
import Spacing from "@wrappers/src/components/Separation/Spacing";
import { defaultValueAsJs } from "../../../../../utils/transformers";
import { ResponseError } from "../../../../../services/fetch";

const MAXLENGTH_TOOLTIP = 40;

interface IHookFormParam {
    errors: any;
}
interface IProps {
    projectId: string;
    // The ID of the parent object
    pluginId: string;
    // ID of the form parameter. For nested parameters this has the form of 'parentParam.param'.
    formParamId: string;
    // Marked as required parameter
    required: boolean;
    // The details of this parameter
    taskParameter: ITaskParameter;
    // from react-hook-form
    formHooks: IHookFormParam;
    // All change handlers
    changeHandlers: Record<string, (value) => void>;
    // Initial values in a flat form, e.g. "nestedParam.param1". This is either set for all parameters or not set for none.
    // The prefixed values can be addressed with help of the 'formParamId' parameter.
    initialValues: {
        [key: string]: string;
    };
    // Values that the auto-completion of other parameters depends on
    dependentValues: {
        [key: string]: string;
    };
}

/** Renders the errors message based on the error type. */
export const errorMessage = (title: string, errors: any) => {
    if (!errors) {
        return "";
    } else if (errors.type === "pattern") {
        return `${title} ${errors.message}.`;
    } else if (errors.type === "required") {
        return `${title} must be specified.`;
    } else {
        return "";
    }
};

/** Widget for a single parameter of a task. */
export const ParameterWidget = ({
    projectId,
    pluginId,
    formParamId,
    required,
    taskParameter,
    formHooks,
    changeHandlers,
    initialValues,
    dependentValues,
}: IProps) => {
    const errors = formHooks.errors[formParamId];
    const propertyDetails = taskParameter.param;
    const { title, description, autoCompletion } = propertyDetails;

    const selectDependentValues = (): string[] => {
        return autoCompletion.autoCompletionDependsOnParameters.flatMap((paramId) => {
            const prefixedParamId =
                formParamId.substring(0, formParamId.length - taskParameter.paramId.length) + paramId;
            if (dependentValues[prefixedParamId]) {
                return [dependentValues[prefixedParamId]];
            } else {
                return [];
            }
        });
    };

    const handleAutoCompleteInput = async (input: string = "") => {
        try {
            const { data } = await sharedOp.getAutocompleteResultsAsync({
                pluginId: pluginId,
                parameterId: taskParameter.paramId,
                projectId,
                dependsOnParameterValues: selectDependentValues(),
                textQuery: input,
                limit: 100, // The auto-completion is only showing the first n values TODO: Make auto-completion list scrollable?
            });
            return data;
        } catch (e) {
            if (e.errorType === "errorResponse") {
                const error = e as ResponseError;
                if (error.httpStatus() !== 400) {
                    // For now hide 400 errors from user, since they are not helpful.
                    AppToaster.show({
                        message: error.errorResponse().detail,
                        intent: Intent.DANGER,
                        timeout: 0,
                    });
                }
            } else {
                console.warn(e);
            }
            return [];
        }
    };

    if (propertyDetails.type === "object") {
        return (
            <FieldSet
                boxed
                title={
                    <TitleSubsection useHtmlElement="span">
                        {propertyDetails.title}
                        <Spacing size="tiny" vertical />
                        <Icon name="item-info" small tooltipText={propertyDetails.description} />
                    </TitleSubsection>
                }
            >
                {Object.entries(propertyDetails.properties).map(([nestedParamId, nestedParam]) => {
                    const nestedFormParamId = `${formParamId}.${nestedParamId}`;
                    return (
                        <ParameterWidget
                            key={formParamId}
                            projectId={projectId}
                            pluginId={propertyDetails.pluginId}
                            formParamId={nestedFormParamId}
                            required={false /* TODO: Get this information*/}
                            taskParameter={{ paramId: nestedParamId, param: nestedParam }}
                            formHooks={formHooks}
                            changeHandlers={changeHandlers}
                            initialValues={initialValues}
                            dependentValues={dependentValues}
                        />
                    );
                })}
            </FieldSet>
        );
    } else {
        return (
            <FieldItem
                labelAttributes={{
                    text: title,
                    info: required ? "required" : "",
                    htmlFor: formParamId,
                    tooltip: description && description.length <= MAXLENGTH_TOOLTIP ? description : "",
                }}
                helperText={description && description.length > MAXLENGTH_TOOLTIP ? description : ""}
                hasStateDanger={errorMessage(title, errors)}
                messageText={errorMessage(title, errors)}
            >
                {!!autoCompletion ? (
                    <Autocomplete
                        autoCompletion={autoCompletion}
                        onSearch={handleAutoCompleteInput}
                        onChange={changeHandlers[formParamId]}
                        initialValue={
                            initialValues[formParamId]
                                ? { value: initialValues[formParamId] }
                                : { value: defaultValueAsJs(propertyDetails) }
                        }
                        dependentValues={selectDependentValues()}
                    />
                ) : (
                    <InputMapper
                        projectId={projectId}
                        parameter={{ paramId: formParamId, param: propertyDetails }}
                        intent={errors ? Intent.DANGER : Intent.NONE}
                        onChange={changeHandlers[formParamId]}
                        initialValues={initialValues}
                    />
                )}
            </FieldItem>
        );
    }
};
