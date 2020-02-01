import React, { useEffect, useLayoutEffect } from "react";
import { globalOp } from "@ducks/global";
import { useDispatch, useSelector } from "react-redux";
import Main from "../../layout/Main";
import Filterbar from "./Filterbar";
import Metadata from "../../components/Metadata";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import SearchList from "./SearchResults/SearchList";
import TopBar from "./Topbar";
import ConfigurationWidget from "./widgets/Configuration";

const ProjectDetails = ({projectId}) => {
    const dispatch = useDispatch();
    const projectMetadata = useSelector(workspaceSel.projectMetadataSelector);

    useLayoutEffect(() => {
        dispatch(workspaceOp.setProjectId(projectId));
    }, [projectId]);

    useEffect(() => {
        dispatch(workspaceOp.fetchProjectMetadata());
        dispatch(globalOp.addBreadcrumb({
            href: `/projects/${projectId}`,
            text: projectId
        }));
    }, []);

    const {LeftPanel, RightPanel} = Main;

    return (
        <Main>
            <LeftPanel className='clearfix'>
                <Metadata metadata={projectMetadata}/>
                <div className='filter-bar-content'>
                    <Filterbar/>
                </div>
                <div className='preview-content'>
                    <TopBar/>
                    <SearchList/>
                </div>
            </LeftPanel>
            <RightPanel>
                <ConfigurationWidget projectId={projectId}/>
            </RightPanel>
        </Main>
    )
};

export default ProjectDetails;
