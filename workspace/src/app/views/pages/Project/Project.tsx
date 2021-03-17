import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
    Button,
    Divider,
    Grid,
    GridColumn,
    GridRow,
    Notification,
    Section,
    SectionHeader,
    Spacing,
    TitleMainsection,
    WorkspaceContent,
    WorkspaceMain,
    WorkspaceSide,
} from "@gui-elements/index";
import { workspaceOp, workspaceSel } from "@ducks/workspace";
import { routerSel } from "@ducks/router";
import { commonOp, commonSel } from "@ducks/common";
import Metadata from "../../shared/Metadata";
import SearchList from "../../shared/SearchList";
import Loading from "../../shared/Loading";
import { SearchBar } from "../../shared/SearchBar/SearchBar";
import { DATA_TYPES } from "../../../constants";
import { usePageHeader } from "../../shared/PageHeader/PageHeader";
import { ArtefactManagementOptions } from "../../shared/ActionsMenu/ArtefactManagementOptions";
import Filterbar from "../Workspace/Filterbar";
import ConfigurationWidget from "./ConfigWidget";
import WarningWidget from "./WarningWidget";
import FileWidget from "./FileWidget";

const Project = () => {
    const dispatch = useDispatch();

    const { textQuery } = useSelector(workspaceSel.appliedFiltersSelector);
    const sorters = useSelector(workspaceSel.sortersSelector);
    const error = useSelector(workspaceSel.errorSelector);
    const data = useSelector(workspaceSel.resultsSelector);
    const projectId = useSelector(commonSel.currentProjectIdSelector);
    const qs = useSelector(routerSel.routerSearchSelector);
    const [t] = useTranslation();

    /**
     * Get available Datatypes
     */
    useEffect(() => {
        dispatch(commonOp.fetchAvailableDTypesAsync(projectId));
    }, []);

    useEffect(() => {
        // Reset the filters, due to redirecting
        dispatch(workspaceOp.resetFilters());

        // Setup the filters from query string
        dispatch(workspaceOp.setupFiltersFromQs(qs));

        // Fetch the list of projects
        dispatch(workspaceOp.fetchListAsync());
    }, [qs, projectId]);

    const handleSort = (sortBy: string) => {
        dispatch(workspaceOp.applySorterOp(sortBy));
    };

    const handleSearch = (textQuery: string) => {
        dispatch(workspaceOp.applyFiltersOp({ textQuery }));
    };

    const { pageHeader, updateActionsMenu } = usePageHeader({
        type: DATA_TYPES.PROJECT,
        autogenerateBreadcrumbs: true,
        autogeneratePageTitle: true,
    });

    return !projectId ? (
        <Loading posGlobal description={t("pages.project.loading", "Loading project data")} />
    ) : (
        <WorkspaceContent className="eccapp-di__project">
            {pageHeader}
            <ArtefactManagementOptions
                projectId={projectId}
                itemType={DATA_TYPES.PROJECT}
                updateActionsMenu={updateActionsMenu}
            />
            <WorkspaceMain>
                <Section>
                    <Metadata />
                    <Spacing />
                </Section>
                <Section>
                    <SectionHeader>
                        <Grid>
                            <GridRow>
                                <GridColumn small verticalAlign="center">
                                    <TitleMainsection>{t("pages.project.content", "Contents")}</TitleMainsection>
                                </GridColumn>
                                <GridColumn full>
                                    <SearchBar
                                        textQuery={textQuery}
                                        sorters={sorters}
                                        onSort={handleSort}
                                        onSearch={handleSearch}
                                    />
                                </GridColumn>
                            </GridRow>
                        </Grid>
                    </SectionHeader>
                    <Divider addSpacing="medium" />
                    <Grid>
                        <GridRow>
                            <GridColumn small>
                                <Filterbar />
                            </GridColumn>
                            <GridColumn full>
                                {!data.length && error.detail ? (
                                    <Notification
                                        danger={true}
                                        actions={
                                            <Button
                                                text={t("common.action.retry", "Retry")}
                                                onClick={() => {
                                                    window.location.reload();
                                                }}
                                            />
                                        }
                                    >
                                        <h3>{t("http.error.fetchNotResult", "Error, cannot fetch results.")}</h3>
                                        <p>{error.detail}</p>
                                    </Notification>
                                ) : (
                                    <SearchList />
                                )}
                            </GridColumn>
                        </GridRow>
                    </Grid>
                </Section>
            </WorkspaceMain>
            <WorkspaceSide>
                <Section>
                    <FileWidget />
                    <Spacing />
                    <ConfigurationWidget />
                    <Spacing />
                    <WarningWidget />
                </Section>
            </WorkspaceSide>
        </WorkspaceContent>
    );
};

export default Project;
