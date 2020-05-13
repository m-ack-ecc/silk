import React from "react";
import { INPUT_TYPES } from "../../../../../constants";
import { NumericInput, Switch, TextField, TextArea } from "@wrappers/index";
import { QueryEditor } from "../../../QueryEditor/QueryEditor";
import { ITaskParameter } from "@ducks/common/typings";
import { Intent } from "@blueprintjs/core";
import { defaultValueAsJs } from "./TaskForm";

interface IInputMapper {
    parameter: ITaskParameter;
    // Blueprint intent
    intent: Intent;
    onChange: (value) => void;
}

interface IInputAttributes {
    id: string;
    name: string;
    intent: Intent;
    onChange: (value) => void;
    value?: any;
    defaultValue?: any;
    inputRef?: (e) => void;
}

export function InputMapper({ parameter, intent, onChange }: IInputMapper) {
    const { paramId, param } = parameter;
    const inputAttributes: IInputAttributes = {
        id: paramId,
        name: paramId,
        intent: intent,
        onChange: onChange,
    };
    if (param.parameterType === INPUT_TYPES.INTEGER) {
        inputAttributes.value = defaultValueAsJs(param);
        // NumericInput does not support onChange, see https://github.com/palantir/blueprint/issues/3943
        inputAttributes.inputRef = (inputElement) => {
            // FIXME: Change as soon as NumericInput supports onChange
            if (inputElement) {
                inputElement.onchange = onChange;
            }
        };
    } else {
        inputAttributes.defaultValue = defaultValueAsJs(param);
    }

    if (param.type === "object") {
        return <TextField {...inputAttributes} />;
    } else {
        switch (param.parameterType) {
            case INPUT_TYPES.BOOLEAN:
                return <Switch {...inputAttributes} />;
            case INPUT_TYPES.INTEGER:
                return <NumericInput {...inputAttributes} buttonPosition={"none"} />;
            case INPUT_TYPES.TEXTAREA:
                return <TextArea {...inputAttributes} />;
            case INPUT_TYPES.MULTILINE_STRING:
                return <QueryEditor {...inputAttributes} />;
            case INPUT_TYPES.PASSWORD:
                return <TextField {...inputAttributes} type={"password"} />;
            case INPUT_TYPES.RESOURCE:
                // File uploader handled in TaskForm
                return null;
            case INPUT_TYPES.ENUMERATION:
            case INPUT_TYPES.OPTION_INT:
            case INPUT_TYPES.STRING:
            default:
                return <TextField {...inputAttributes} />;
        }
    }
}
