import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Prompt, useLocation } from "react-router";
import { useTranslation, Trans } from "react-i18next";
import { ElapsedDateTimeDisplay, Markdown, TimeUnits } from "@eccenca/gui-elements";
import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    CardOptions,
    CardTitle,
    Divider,
    FieldItem,
    IconButton,
    Label,
    MultiSelect,
    PropertyName,
    PropertyValue,
    PropertyValueList,
    PropertyValuePair,
    Link,
    TextArea,
    TextField,
    HtmlContentBlock,
} from "@eccenca/gui-elements";
import { IMetadataUpdatePayload } from "@ducks/shared/typings";
import { commonSel } from "@ducks/common";
import { routerOp } from "@ducks/router";
import { sharedOp } from "@ducks/shared";
import { Loading } from "../Loading/Loading";
import { StringPreviewContentBlobToggler } from "@eccenca/gui-elements/src/cmem/ContentBlobToggler/StringPreviewContentBlobToggler";
import useErrorHandler from "../../../hooks/useErrorHandler";
import * as H from "history";
import utils from "./MetadataUtils";
import { IMetadataExpanded } from "./Metadatatypings";
import { Keyword, Keywords } from "@ducks/workspace/typings";
import { removeExtraSpaces } from "@eccenca/gui-elements/src/common/utils/stringUtils";
import { SelectedParamsType } from "@eccenca/gui-elements/src/components/MultiSelect/MultiSelect";

interface IProps {
    projectId?: string;
    taskId?: string;
    readOnly?: boolean;
}

export function Metadata(props: IProps) {
    const location = useLocation();
    const dispatch = useDispatch();
    const { registerError } = useErrorHandler();

    const _projectId = useSelector(commonSel.currentProjectIdSelector);
    const _taskId = useSelector(commonSel.currentTaskIdSelector);

    const projectId = props.projectId || _projectId;
    const taskId = props.taskId || _taskId;

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<IMetadataExpanded>({ label: "", description: "", tags: [] });
    const [formEditData, setFormEditData] = useState<IMetadataUpdatePayload | undefined>(undefined);
    const [isEditing, setIsEditing] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [createdTags, setCreatedTags] = React.useState<Partial<Keyword>[]>([]);
    const [selectedTags, setSelectedTags] = React.useState<Keywords>([...(data.tags ?? [])]);
    const [t] = useTranslation();

    // Form errors
    const [errors, setErrors] = useState({
        form: {
            label: false,
        },
        alerts: {},
    });

    const setDirtyState = React.useCallback(() => {
        setUnsavedChanges(true);
        window.onbeforeunload = () => true;
    }, []);

    const removeDirtyState = React.useCallback(() => {
        setUnsavedChanges(false);
        window.onbeforeunload = null;
    }, []);

    // On unmount remove dirty state behavior
    React.useEffect(() => {
        return removeDirtyState;
    }, []);

    const { label, description, lastModifiedByUser, createdByUser, created, modified } = data;

    useEffect(() => {
        if (projectId) {
            utils
                .getExpandedMetaData(projectId, taskId)
                .then((res) => setData({ ...(res?.data as IMetadataExpanded) } ?? {}))
                .catch((err) => registerError("metadata-getExpandedMetaData", "Could not fetch summary data.", err));
        }
    }, [taskId, projectId]);

    useEffect(() => {
        checkEditState();
    }, [selectedTags]);

    const letLoading = async (callback) => {
        setLoading(true);
        try {
            return await callback();
        } finally {
            setLoading(false);
        }
    };

    const toggleEdit = async () => {
        if (!isEditing) {
            setFormEditData({ label: data.label ?? "", description: data.description ?? "" });
        } else {
            removeDirtyState();
        }
        setIsEditing(!isEditing);
    };

    const onSubmit = async () => {
        if (!formEditData?.label) {
            return setErrors({
                ...errors,
                form: {
                    label: true,
                },
            });
        }

        setErrors({
            ...errors,
            form: {
                label: false,
            },
        });

        try {
            await letLoading(async () => {
                const path = location.pathname;
                //create new tags if exists
                if (createdTags.length) {
                    const createdTagsResponse = await utils.createNewTag(
                        createdTags.map((t) => ({ label: t.label })),
                        projectId
                    );
                    //defensive correction to ensure uris match
                    const metadataTags = selectedTags.map((tag) => {
                        const newlyCreatedTagMatch = (createdTagsResponse?.data ?? []).find(
                            (t) => t.label === tag.label
                        );
                        if (newlyCreatedTagMatch) {
                            return newlyCreatedTagMatch.uri;
                        }
                        return tag.uri;
                    });
                    formEditData.tags = metadataTags;
                } else {
                    formEditData.tags = selectedTags.map((tag) => tag.uri);
                }
                const metadata = await sharedOp.updateTaskMetadataAsync(formEditData!!, taskId, projectId);
                removeDirtyState();
                dispatch(routerOp.updateLocationState(path, projectId as string, metadata));
                return metadata;
            });
            //update metadata with expanded data
            utils
                .getExpandedMetaData(projectId, taskId)
                .then((res) => setData({ ...(res?.data as IMetadataExpanded) } ?? {}));

            toggleEdit();
        } catch (ex) {
            registerError("Metadata-submit", "Updating meta data has failed.", ex);
        }
    };

    const widgetHeader = (
        <>
            <CardHeader>
                <CardTitle>
                    <h2>{t("common.words.summary", "Summary")}</h2>
                </CardTitle>
                {!loading && !isEditing && !props.readOnly ? (
                    <CardOptions>
                        <IconButton
                            data-test-id="meta-data-edit-btn"
                            name="item-edit"
                            text="Edit"
                            onClick={toggleEdit}
                        />
                    </CardOptions>
                ) : null}
            </CardHeader>
            <Divider />
        </>
    );

    // Show 'unsaved changes' prompt when navigating away via React routing
    const routingPrompt: (newLocation: H.Location, action: H.Action) => string | boolean = (newLocation, action) => {
        // Only complain when navigating away from current page.
        return unsavedChanges && action !== "REPLACE" ? (t("Metadata.unsavedMetaDataWarning") as string) : true;
    };

    const onLabelChange = (e) => {
        if (formEditData && e.target !== undefined) {
            const hasToReRender = !formEditData.label || !e.target.value;
            formEditData.label = e.target.value;
            if (hasToReRender) {
                // Label has changed either from empty or was set to empty. Need to re-render.
                setFormEditData({ ...formEditData });
            }
            checkEditState();
        }
    };

    const onDescriptionChange = (e) => {
        if (formEditData && e.target !== undefined) {
            formEditData.description = e.target.value;
            checkEditState();
        }
    };

    const checkEditState = () => {
        const selectedTagsString = selectedTags.map((t) => t.uri).join("|");
        const originalTagsString = data.tags.map((t) => t.uri).join("|");
        const changedTags = selectedTagsString !== originalTagsString;
        const labelChanged = formEditData && formEditData.label !== data.label;
        const descriptionChanged = formEditData && (formEditData.description ?? "") !== (data.description ?? "");
        if (changedTags || labelChanged || descriptionChanged) {
            setDirtyState();
        } else {
            removeDirtyState();
        }
    };

    const handleTagSelectionChange = React.useCallback((params: SelectedParamsType<Keyword>) => {
        setCreatedTags(params.createdItems);
        setSelectedTags((oldSelectedTags) => {
            return params.selectedItems;
        });
    }, []);

    const handleTagQueryChange = React.useCallback(async (query: string) => {
        if (projectId) {
            try {
                const res = await utils.queryTags(projectId, query);
                return res?.data.tags ?? [];
            } catch (ex) {
                registerError("Metadata-handleTagQueryChange", "An error occurred while searching for tags.", ex);
                return [];
            }
        }
    }, []);

    const goToPage = (path: string) => {
        dispatch(routerOp.goToPage(path));
    };

    const translateUnits = (unit: TimeUnits) => t("common.units." + unit, unit);

    const getDeltaInDays = (dateTime: number | string) => {
        const now = Date.now();
        const then = new Date(dateTime).getTime();
        return (now - then) / 1000 / 60 / 60 / 24;
    };

    const getDateData = (dateTime: number | string) => {
        const then = new Date(dateTime);
        return {
            year: then.getFullYear(),
            month: ("0" + (then.getMonth() + 1)).slice(-2),
            day: ("0" + then.getDate()).slice(-2),
        };
    };

    const widgetContent = (
        <CardContent data-test-id={"metaDataWidget"}>
            {loading && <Loading description={t("Metadata.loading", "Loading summary data.")} />}
            {!loading && isEditing && (
                <PropertyValueList>
                    <PropertyValuePair key="label">
                        <PropertyName>
                            <Label
                                text={t("form.field.label", "Label")}
                                info={t("common.words.required")}
                                htmlFor="label"
                            />
                        </PropertyName>
                        <PropertyValue>
                            <FieldItem
                                messageText={
                                    errors.form.label ? t("form.validations.isRequired", { field: `Label` }) : ""
                                }
                                hasStateDanger={errors.form.label}
                            >
                                <TextField
                                    name="label"
                                    id="label"
                                    onChange={onLabelChange}
                                    defaultValue={formEditData?.label}
                                    hasStateDanger={errors.form.label ? true : false}
                                />
                            </FieldItem>
                        </PropertyValue>
                    </PropertyValuePair>
                    <PropertyValuePair hasSpacing key="description">
                        <PropertyName>
                            <Label text={t("form.field.description", "Description")} htmlFor="description" />
                        </PropertyName>
                        <PropertyValue>
                            <FieldItem>
                                <TextArea
                                    name="description"
                                    id="description"
                                    onChange={onDescriptionChange}
                                    defaultValue={formEditData?.description}
                                />
                            </FieldItem>
                        </PropertyValue>
                    </PropertyValuePair>
                    <PropertyValuePair hasSpacing key="tags">
                        <PropertyName>
                            <Label text={t("form.field.tags", "Tags")} />
                        </PropertyName>
                        <PropertyValue>
                            <FieldItem data-test-id={"meta-data-tag-selection"}>
                                <MultiSelect<Keyword>
                                    prePopulateWithItems
                                    openOnKeyDown
                                    itemId={(keyword) => keyword.uri}
                                    itemLabel={(keyword) => keyword.label}
                                    items={data.tags ?? []}
                                    onSelection={handleTagSelectionChange}
                                    runOnQueryChange={handleTagQueryChange}
                                    newItemCreationText={t("Metadata.addNewTag")}
                                    newItemPostfix={t("Metadata.newTagPostfix")}
                                    inputProps={{
                                        placeholder: `${t("form.field.searchOrEnterTags")}...`,
                                    }}
                                    tagInputProps={{
                                        placeholder: `${t("form.field.searchOrEnterTags")}...`,
                                    }}
                                    createNewItemFromQuery={(query) => ({
                                        uri: removeExtraSpaces(query),
                                        label: removeExtraSpaces(query),
                                    })}
                                />
                            </FieldItem>
                        </PropertyValue>
                    </PropertyValuePair>
                </PropertyValueList>
            )}
            {!loading && !isEditing && (
                <PropertyValueList>
                    {!!label && (
                        <PropertyValuePair hasDivider>
                            <PropertyName>{t("form.field.label", "Label")}</PropertyName>
                            <PropertyValue>{label}</PropertyValue>
                        </PropertyValuePair>
                    )}
                    {!!description && (
                        <PropertyValuePair hasSpacing hasDivider>
                            <PropertyName>{t("form.field.description", "Description")}</PropertyName>
                            <PropertyValue>
                                <StringPreviewContentBlobToggler
                                    className="di__dataset__metadata-description"
                                    content={description}
                                    fullviewContent={<Markdown>{description}</Markdown>}
                                    toggleExtendText={t("common.words.more", "more")}
                                    toggleReduceText={t("common.words.less", "less")}
                                    firstNonEmptyLineOnly={true}
                                    renderPreviewAsMarkdown={true}
                                    allowedHtmlElementsInPreview={["a"]}
                                />
                            </PropertyValue>
                        </PropertyValuePair>
                    )}
                    {!!data.tags?.length && (
                        <PropertyValuePair hasSpacing hasDivider>
                            <PropertyName>{t("form.field.tags", "Tags")}</PropertyName>
                            <PropertyValue>{utils.DisplayArtefactTags(data.tags, t, goToPage)}</PropertyValue>
                        </PropertyValuePair>
                    )}
                    <PropertyValuePair>
                        <PropertyValue>
                            <HtmlContentBlock small>
                                <Trans
                                    i18nKey={"Metadata.createdBy"}
                                    t={t}
                                    values={{
                                        timestamp: created
                                            ? t(
                                                  "Metadata.dateFormat",
                                                  "{{year}}/{{month}}/{{day}}",
                                                  getDateData(created)
                                              )
                                            : "",
                                        author: createdByUser?.label ?? t("Metadata.unknownuser", "unknown user"),
                                    }}
                                    components={{
                                        author: (
                                            <Link
                                                href={utils.generateFacetUrl("createdBy", createdByUser?.uri ?? "")}
                                            ></Link>
                                        ),
                                        timestamp: created ? (
                                            getDeltaInDays(created) < 7 ? (
                                                <ElapsedDateTimeDisplay
                                                    data-test-id={"metadata-creation-age"}
                                                    suffix={t("Metadata.suffixAgo")}
                                                    prefix={t("Metadata.prefixAgo")}
                                                    dateTime={created}
                                                    translateUnits={translateUnits}
                                                />
                                            ) : (
                                                <span title={new Date(created).toString()} />
                                            )
                                        ) : (
                                            <></>
                                        ),
                                    }}
                                />
                                {modified !== created && (
                                    <>
                                        {" "}
                                        <Trans
                                            i18nKey={"Metadata.lastModifiedBy"}
                                            t={t}
                                            values={{
                                                timestamp: modified
                                                    ? t(
                                                          "Metadata.dateFormat",
                                                          "{{year}}/{{month}}/{{day}}",
                                                          getDateData(modified)
                                                      )
                                                    : "",
                                                author:
                                                    lastModifiedByUser?.label ??
                                                    t("Metadata.unknownuser", "unknown user"),
                                            }}
                                            components={{
                                                author: (
                                                    <Link
                                                        href={utils.generateFacetUrl(
                                                            "lastModifiedBy",
                                                            lastModifiedByUser?.uri ?? ""
                                                        )}
                                                    ></Link>
                                                ),
                                                timestamp: modified ? (
                                                    getDeltaInDays(modified) < 7 ? (
                                                        <ElapsedDateTimeDisplay
                                                            data-test-id={"metadata-creation-age"}
                                                            suffix={t("Metadata.suffixAgo")}
                                                            prefix={t("Metadata.prefixAgo")}
                                                            dateTime={modified}
                                                            translateUnits={translateUnits}
                                                        />
                                                    ) : (
                                                        <span title={new Date(modified).toString()} />
                                                    )
                                                ) : (
                                                    <></>
                                                ),
                                            }}
                                        />
                                    </>
                                )}
                            </HtmlContentBlock>
                        </PropertyValue>
                    </PropertyValuePair>
                </PropertyValueList>
            )}
        </CardContent>
    );

    const widgetFooter =
        !loading && isEditing ? (
            <>
                <Prompt when={unsavedChanges} message={routingPrompt} />
                <Divider />
                <CardActions>
                    <Button
                        data-test-id={"submitBtn"}
                        disabled={!unsavedChanges || !formEditData?.label}
                        onClick={onSubmit}
                        affirmative
                        text={t("common.action.save", "Save")}
                        type={"submit"}
                    />
                    <Button text={t("common.action.cancel")} onClick={toggleEdit} />
                </CardActions>
            </>
        ) : null;

    return (
        <Card data-test-id={"meta-data-card"}>
            {widgetHeader}
            {widgetContent}
            {widgetFooter}
        </Card>
    );
}
