import React, { useEffect } from "react";
import { FieldItem, TextField, TextArea } from "@wrappers/index";
import FileUploader from "../../../FileUploader";
import { errorMessage } from "./ParameterWidget";
import { Intent } from "@wrappers/blueprint/constants";

export interface IProps {
    form: any;
    projectId: string;
}

const LABEL = "label";
const DESCRIPTION = "description";
/** The project create form */
export function ProjectForm({ form, projectId }: IProps) {
    const { register, errors, triggerValidation, setValue } = form;
    useEffect(() => {
        register({ name: LABEL }, { required: true });
        register({ name: DESCRIPTION });
    }, [register]);
    const onValueChange = (key) => {
        return (e) => {
            const value = e.target ? e.target.value : e;
            setValue(key, value);
            triggerValidation();
        };
    };
    return (
        <>
            <FieldItem
                key={LABEL}
                labelAttributes={{
                    text: "Title",
                    info: "required",
                    htmlFor: "title-input",
                }}
                hasStateDanger={errorMessage("Title", errors.label) ? true : false}
                messageText={errorMessage("Title", errors.label)}
            >
                <TextField
                    id={LABEL}
                    placeholder="Project title"
                    name={LABEL}
                    inputRef={form.register({ required: true })}
                    intent={errors.label ? Intent.DANGER : Intent.NONE}
                    onChange={onValueChange(LABEL)}
                />
            </FieldItem>
            <FieldItem
                labelAttributes={{
                    text: "Description",
                    htmlFor: "desc-input",
                }}
            >
                <TextArea
                    id={DESCRIPTION}
                    name={DESCRIPTION}
                    growVertically={true}
                    placeholder="Project description"
                    inputRef={form.register()}
                />
            </FieldItem>
            <FieldItem
                labelAttributes={{
                    text: "Import project",
                }}
                helperText={
                    "In case you want to restore project data you can attach the backup file that has been exported before."
                }
            >
                <FileUploader projectId={projectId} />
            </FieldItem>
        </>
    );
}
