import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router";
import { Intent } from "@gui-elements/blueprint/constants";
import { Section, Spacing, WorkspaceContent, WorkspaceMain, WorkspaceSide } from "@gui-elements/index";
import { datasetSel } from "@ducks/dataset";
import { AppToaster } from "../../../services/toaster";
import { DATA_TYPES } from "../../../constants";
import Metadata from "../../shared/Metadata";
import { RelatedItems } from "../../shared/RelatedItems/RelatedItems";
import { TaskConfig } from "../../shared/TaskConfig/TaskConfig";
import { usePageHeader } from "../../shared/PageHeader/PageHeader";
import { ArtefactManagementOptions } from "../../shared/ActionsMenu/ArtefactManagementOptions";
import NotFound from "../NotFound";

export default function () {
    const error = useSelector(datasetSel.errorSelector);
    const { taskId, projectId } = useParams();
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (error?.detail) {
            AppToaster.show({
                message: error.detail,
                intent: Intent.DANGER,
                timeout: 0,
            });
        }
    }, [error.detail]);

    const { pageHeader, updateActionsMenu } = usePageHeader({
        type: DATA_TYPES.TASK,
        autogenerateBreadcrumbs: true,
        autogeneratePageTitle: true,
    });

    return notFound ? (
        <NotFound />
    ) : (
        <WorkspaceContent className="eccapp-di__task">
            {pageHeader}
            <ArtefactManagementOptions
                projectId={projectId}
                taskId={taskId}
                itemType={DATA_TYPES.TASK}
                updateActionsMenu={updateActionsMenu}
                notFoundCallback={setNotFound}
            />
            <WorkspaceMain>
                <Section>
                    <Metadata />
                </Section>
            </WorkspaceMain>
            <WorkspaceSide>
                <Section>
                    <RelatedItems projectId={projectId} taskId={taskId} />
                    <Spacing />
                    <TaskConfig projectId={projectId} taskId={taskId} />
                </Section>
            </WorkspaceSide>
        </WorkspaceContent>
    );
}
