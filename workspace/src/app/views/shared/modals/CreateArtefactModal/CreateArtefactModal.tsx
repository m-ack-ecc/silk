import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import {
    Button,
    Card,
    CardActionsAux,
    Grid,
    GridColumn,
    GridRow,
    HelperClasses,
    Icon,
    OverviewItem,
    OverviewItemDepiction,
    OverviewItemDescription,
    OverviewItemLine,
    OverviewItemList,
    SimpleDialog,
    Spacing,
} from "@wrappers/index";
import { commonOp, commonSel } from "@ducks/common";
import { IArtefactItem, IDetailedArtefactItem } from "@ducks/common/typings";
import Loading from "../../Loading";
import { SearchBar } from "../../SearchBar/SearchBar";
import { ProjectForm } from "./ArtefactForms/ProjectForm";
import { TaskForm } from "./ArtefactForms/TaskForm";
import ArtefactTypesList from "./ArtefactTypesList";
import { DATA_TYPES } from "../../../../constants";
import { Highlighter } from "../../Highlighter/Highlighter";
import { workspaceOp } from "@ducks/workspace";

export function CreateArtefactModal() {
    const dispatch = useDispatch();
    const form = useForm();

    const [searchValue, setSearchValue] = useState("");

    const modalStore = useSelector(commonSel.artefactModalSelector);
    const projectId = useSelector(commonSel.currentProjectIdSelector);

    const {
        selectedArtefact,
        isOpen,
        artefactsList,
        cachedArtefactProperties,
        loading,
        updateExistingTask,
    } = modalStore;

    // initially take from redux
    const [selected, setSelected] = useState<IArtefactItem>(selectedArtefact);
    const [lastSelectedClick, setLastSelectedClick] = useState<number>(0);
    const DOUBLE_CLICK_LIMIT_MS = 500;

    useEffect(() => {
        if (projectId) {
            dispatch(commonOp.fetchArtefactsListAsync());
        }
    }, [projectId]);

    useEffect(() => {
        if (artefactsList.length > 0) {
            defaultArtefactSelected(artefactsList);
        }
    }, [artefactsList]);

    const handleAdd = () => {
        if (selected.key === DATA_TYPES.PROJECT) {
            return dispatch(commonOp.selectArtefact(selected));
        }
        dispatch(commonOp.getArtefactPropertiesAsync(selected));
    };

    const handleSearch = (textQuery: string) => {
        setSearchValue(textQuery);
        dispatch(
            commonOp.fetchArtefactsListAsync({
                textQuery,
            })
        );
    };

    const defaultArtefactSelected = (artefactsList: any) => {
        setSelected(artefactsList[0]);
    };

    const handleArtefactSelect = (artefact: IArtefactItem) => {
        if (
            selected.key === artefact.key &&
            lastSelectedClick &&
            Date.now() - lastSelectedClick < DOUBLE_CLICK_LIMIT_MS
        ) {
            handleAdd();
        } else {
            setSelected(artefact);
        }
        setLastSelectedClick(Date.now);
    };

    const handleBack = () => {
        resetModal();
        dispatch(commonOp.selectArtefact(null));
    };

    const taskType = (artefactId) => {
        if (artefactId === "project") {
            return "Project";
        } else {
            return (cachedArtefactProperties[artefactId] as IDetailedArtefactItem).taskType;
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();

        const isValidFields = await form.triggerValidation();
        if (isValidFields) {
            if (updateExistingTask) {
                dispatch(
                    workspaceOp.fetchUpdateTaskAsync(
                        updateExistingTask.projectId,
                        updateExistingTask.taskId,
                        form.getValues()
                    )
                );
            } else {
                dispatch(commonOp.createArtefactAsync(form.getValues(), taskType(selectedArtefact.key)));
            }
        }
    };

    const closeModal = () => {
        dispatch(commonOp.closeArtefactModal());
        resetModal();
    };

    const isErrorPresented = () => !!Object.keys(form.errors).length;

    const handleSelectDType = (value: string) => {
        dispatch(commonOp.setSelectedArtefactDType(value));
    };

    const resetModal = () => {
        setSelected({} as IArtefactItem);
        form.clearError();
    };

    let artefactForm = null;
    if (updateExistingTask) {
        // Task update
        artefactForm = (
            <TaskForm
                form={form}
                artefact={updateExistingTask.taskPluginDetails}
                projectId={updateExistingTask.projectId}
                updateTask={{ parameterValues: updateExistingTask.currentParameterValues }}
            />
        );
    } else {
        // Project / task creation
        if (selectedArtefact.key) {
            if (selectedArtefact.key === DATA_TYPES.PROJECT) {
                artefactForm = <ProjectForm form={form} projectId={projectId} />;
            } else {
                const detailedArtefact = cachedArtefactProperties[selectedArtefact.key];
                if (detailedArtefact && projectId) {
                    artefactForm = <TaskForm form={form} artefact={detailedArtefact} projectId={projectId} />;
                }
            }
        }
    }

    const showProjectItem = searchValue
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .every((searchWord) => "project".includes(searchWord));

    let artefactListWithProject = artefactsList;
    if (showProjectItem) {
        artefactListWithProject = [
            {
                key: DATA_TYPES.PROJECT,
                title: "Project",
                description:
                    "Projects let you group related items. All items that " +
                    "depend on each other need to be in the same project.",
            },
            ...artefactsList,
        ];
    }

    const renderDepiction = (artefact) => {
        const iconNameStack = []
            .concat([(artefact.taskType ? artefact.taskType + "-" : "") + artefact.key])
            .concat(artefact.taskType ? [artefact.taskType] : [])
            .concat(artefact.categories ? artefact.categories : []);
        return (
            <Icon
                name={iconNameStack
                    .map((type) => {
                        return "artefact-" + type.toLowerCase();
                    })
                    .filter((x, i, a) => a.indexOf(x) === i)}
                large
            />
        );
    };

    return (
        <SimpleDialog
            size="large"
            preventSimpleClosing={true}
            canEscapeKeyClose={true}
            hasBorder
            title={
                updateExistingTask
                    ? `Update '${updateExistingTask.metaData.label}' (${updateExistingTask.taskPluginDetails.title})`
                    : `Create new item of type ${selectedArtefact.title || ""}`
            }
            onClose={closeModal}
            isOpen={isOpen}
            actions={
                selectedArtefact.key || updateExistingTask
                    ? [
                          <Button key="create" affirmative={true} onClick={handleCreate} disabled={isErrorPresented()}>
                              {updateExistingTask ? "Update" : "Create"}
                          </Button>,
                          <Button key="cancel" onClick={closeModal}>
                              Cancel
                          </Button>,
                          <CardActionsAux key="aux">
                              {!updateExistingTask && (
                                  <Button key="back" onClick={handleBack}>
                                      Back
                                  </Button>
                              )}
                          </CardActionsAux>,
                      ]
                    : [
                          <Button
                              key="add"
                              affirmative={true}
                              onClick={handleAdd}
                              disabled={!Object.keys(selected).length}
                          >
                              Add
                          </Button>,
                          <Button key="cancel" onClick={closeModal}>
                              Cancel
                          </Button>,
                      ]
            }
        >
            {
                <>
                    {artefactForm ? (
                        artefactForm
                    ) : (
                        <Grid>
                            <GridRow>
                                <GridColumn small>
                                    <ArtefactTypesList onSelect={handleSelectDType} />
                                </GridColumn>
                                <GridColumn>
                                    <SearchBar textQuery={searchValue} focusOnCreation={true} onSearch={handleSearch} />
                                    <Spacing />
                                    {loading ? (
                                        <Loading description="Loading artefact type list." />
                                    ) : (
                                        <OverviewItemList hasSpacing columns={2}>
                                            {artefactListWithProject.map((artefact) => (
                                                <Card
                                                    isOnlyLayout
                                                    key={artefact.key}
                                                    className={
                                                        selected.key === artefact.key ? HelperClasses.Intent.ACCENT : ""
                                                    }
                                                >
                                                    <OverviewItem
                                                        hasSpacing
                                                        onClick={() => handleArtefactSelect(artefact)}
                                                    >
                                                        <OverviewItemDepiction>
                                                            {renderDepiction(artefact)}
                                                        </OverviewItemDepiction>
                                                        <OverviewItemDescription>
                                                            <OverviewItemLine>
                                                                <strong>
                                                                    <Highlighter
                                                                        label={artefact.title}
                                                                        searchValue={searchValue}
                                                                    />
                                                                </strong>
                                                            </OverviewItemLine>
                                                            <OverviewItemLine small>
                                                                <p>
                                                                    <Highlighter
                                                                        label={artefact.description}
                                                                        searchValue={searchValue}
                                                                    />
                                                                </p>
                                                            </OverviewItemLine>
                                                        </OverviewItemDescription>
                                                    </OverviewItem>
                                                </Card>
                                            ))}
                                        </OverviewItemList>
                                    )}
                                </GridColumn>
                            </GridRow>
                        </Grid>
                    )}
                </>
            }
        </SimpleDialog>
    );
}
