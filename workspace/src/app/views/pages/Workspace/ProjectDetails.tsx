import React, { useEffect, useLayoutEffect } from "react";
import { globalOp } from "@ducks/global";
import { useDispatch, useSelector } from "react-redux";
import Filterbar from "./Filterbar";
import Metadata from "../../components/Metadata";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import SearchList from "./SearchResults/SearchList";
import TopBar from "./AppliedFacets";
import ConfigurationWidget from "./widgets/Configuration";
import WarningWidget from "./widgets/Warning";
import FileWidget from "./widgets/File";
import Loading from "../../components/Loading";

import {
    WorkspaceContent,
    WorkspaceMain,
    WorkspaceSide,
    WorkspaceSection,
    WorkspaceGrid,
    WorkspaceRow,
    WorkspaceColumn,
} from "@wrappers/index";

const ProjectDetails = ({projectId}) => {
    const dispatch = useDispatch();
    const currentProjectId = useSelector(workspaceSel.currentProjectIdSelector);

    useEffect(() => {
        // Fetch the list of projects
        dispatch(workspaceOp.setProjectId(projectId));
        dispatch(workspaceOp.fetchListAsync());
        dispatch(globalOp.addBreadcrumb({
            href: `/projects/${projectId}`,
            text: projectId
        }));
    }, []);

    return (
        !currentProjectId ? <Loading /> :
        <WorkspaceContent className="eccapp-di__project">
            <WorkspaceMain>
                <WorkspaceSection>
                    <Metadata taskId={projectId}/>
                </WorkspaceSection>
                <WorkspaceSection>
                    <TopBar/>
                    <WorkspaceGrid>
                        <WorkspaceRow>
                            <WorkspaceColumn small>
                                <Filterbar/>
                            </WorkspaceColumn>
                            <WorkspaceColumn full>
                                <SearchList/>
                            </WorkspaceColumn>
                        </WorkspaceRow>
                    </WorkspaceGrid>
                </WorkspaceSection>
            </WorkspaceMain>
            <WorkspaceSide>
                <WorkspaceSection>
                    <FileWidget/>
                    <ConfigurationWidget/>
                    <WarningWidget/>
                </WorkspaceSection>
            </WorkspaceSide>
        </WorkspaceContent>
    )
};

export default ProjectDetails;
