import React, { useMemo, useState } from "react";
import { NodeTools, NodeToolsMenuFunctions } from "@eccenca/gui-elements/src/extensions/react-flow/nodes/NodeTools";
import { Markdown, Menu, MenuItem, SimpleDialog } from "@eccenca/gui-elements";

interface NodeMenuProps {
    nodeId: string;
    t: (translationKey: string, defaultValue?: string) => string;
    handleDeleteNode: (nodeId: string) => void;
    ruleOperatorDescription?: string;
}

/** The menu of a rule node. */
export const RuleNodeMenu = ({ nodeId, t, handleDeleteNode, ruleOperatorDescription }: NodeMenuProps) => {
    const [showDescription, setShowDescription] = useState(false);
    const [menuFns, setMenuFns] = useState<NodeToolsMenuFunctions | undefined>(undefined);

    const closeMenu = () => {
        menuFns?.closeMenu();
    };
    const menuFunctionsCallback = useMemo(() => (menuFunctions) => setMenuFns(menuFunctions), []);

    return (
        <NodeTools menuButtonDataTestId={"node-menu-btn"} menuFunctionsCallback={menuFunctionsCallback}>
            <Menu>
                <MenuItem
                    data-test-id="rule-node-delete-btn"
                    key="delete"
                    icon={"item-remove"}
                    onClick={(e) => {
                        e.preventDefault();
                        handleDeleteNode(nodeId);
                    }}
                    text={t("RuleEditor.node.menu.remove.label")}
                    intent="danger"
                />
                {ruleOperatorDescription ? (
                    <MenuItem
                        data-test-id="rule-node-info"
                        key="info"
                        icon={"item-info"}
                        onClick={(e) => {
                            closeMenu();
                            setShowDescription(true);
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        text={t("RuleEditor.node.menu.description.label")}
                        internalProps={{
                            htmlTitle: ruleOperatorDescription,
                        }}
                    />
                ) : null}
                {showDescription && ruleOperatorDescription ? (
                    <SimpleDialog
                        isOpen={true}
                        title={t("common.words.description")}
                        onClose={() => setShowDescription(false)}
                        hasBorder={true}
                        size={"small"}
                        data-test-id={"ruleEditorNode-description-modal"}
                    >
                        <Markdown>{ruleOperatorDescription}</Markdown>
                    </SimpleDialog>
                ) : null}
            </Menu>
        </NodeTools>
    );
};
