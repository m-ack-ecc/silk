import React from "react";
import { Button, Icon, IconButton, Spacing, Toolbar, ToolbarSection } from "gui-elements";
import { RuleEditorModelContext } from "../contexts/RuleEditorModelContext";
import { useTranslation } from "react-i18next";
import { NotificationsMenu } from "../../ApplicationNotifications/NotificationsMenu";
import { RuleEditorContext } from "../contexts/RuleEditorContext";

/** Toolbar of the rule editor. Contains global editor actions like save, redo/undo etc. */
export const RuleEditorToolbar = () => {
    const modelContext = React.useContext(RuleEditorModelContext);
    const ruleEditorContext = React.useContext(RuleEditorContext);
    const [savingWorkflow, setSavingWorkflow] = React.useState(false);
    const [t] = useTranslation();

    const saveLinkingRule = async (e) => {
        e.preventDefault();
        setSavingWorkflow(true);
        await modelContext.saveRule();
        setSavingWorkflow(false);
    };

    return (
        <Toolbar data-test-id={"workflow-editor-header"} noWrap>
            <ToolbarSection>
                <IconButton
                    data-test-id={"rule-editor-undo-btn"}
                    disabled={modelContext.isReadOnly() || !modelContext.canUndo}
                    name="operation-undo"
                    text="Undo"
                    onClick={modelContext.undo}
                />
                <IconButton
                    data-test-id={"rule-editor-redo-btn"}
                    disabled={modelContext.isReadOnly() || !modelContext.canRedo}
                    name="operation-redo"
                    text="Redo"
                    onClick={modelContext.redo}
                />
                <Spacing vertical hasDivider />
                <IconButton
                    data-test-id={"rule-editor-auto-layout-btn"}
                    disabled={modelContext.isReadOnly() || modelContext.elements.length === 0}
                    name="operation-auto-graph-layout"
                    text={t("RuleEditor.toolbar.autoLayout")}
                    onClick={modelContext.executeModelEditOperation.autoLayout}
                />
                <Spacing vertical />
            </ToolbarSection>
            <ToolbarSection canGrow>
                <Spacing vertical />
            </ToolbarSection>
            <ToolbarSection>
                {ruleEditorContext.viewActions?.integratedView && <NotificationsMenu />}
                <Button
                    data-test-id="ruleEditor-save-button"
                    affirmative={!modelContext.isReadOnly()}
                    tooltip={
                        modelContext.isReadOnly() ? t("RuleEditor.toolbar.readOnly") : t("RuleEditor.toolbar.save")
                    }
                    tooltipProperties={{ hoverCloseDelay: 0 }}
                    onClick={saveLinkingRule}
                    disabled={modelContext.isReadOnly() || !modelContext.unsavedChanges}
                    loading={savingWorkflow}
                >
                    {modelContext.isReadOnly() ? <Icon name={"write-protected"} /> : t("common.action.save", "Save")}
                </Button>
            </ToolbarSection>
        </Toolbar>
    );
};
