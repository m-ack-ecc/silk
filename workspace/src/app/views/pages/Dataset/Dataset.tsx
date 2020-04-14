import React, { useEffect } from "react";

import { useSelector } from "react-redux";
import { AppToaster } from "../../../services/toaster";
import { Intent } from "@wrappers/blueprint/constants";
import { useParams } from "react-router";
import Metadata from "../../shared/Metadata";
import { datasetSel } from "@ducks/dataset";

import {
    WorkspaceContent,
    WorkspaceMain,
    Section,
} from "@wrappers/index";

export function Dataset() {
    const error = useSelector(datasetSel.errorSelector);
    const {datasetId, projectId} = useParams();

    useEffect(() => {
        if (error.detail) {
            AppToaster.show({
                message: error.detail,
                intent: Intent.DANGER,
                timeout: 2000
            })
        }
    }, [error.detail]);

    return (
        <WorkspaceContent className="eccapp-di__dataset">
            <WorkspaceMain>
                <Section>
                    <Metadata projectId={projectId} taskId={datasetId}/>
                </Section>
            </WorkspaceMain>
        </WorkspaceContent>
    );
}
