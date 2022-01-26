import React from "react";
import { IRuleOperatorNode, IRuleOperator } from "../RuleEditor.typings";

/**
 * The rule editor context that contains objects and methods related to the original objects that are being edited and
 * the operators that can are available.
 *
 * @param ITEM_TYPE The interface of the rule based item that is being edited.
 * @param OPERATOR_TYPE The interface of the operators that can be placed in the editor.
 */
export interface RuleEditorContextProps {
    /** The item whose rules are being edited, e.g. linking or transformation. */
    editedItem?: object;
    /** The operators that can be dragged and dropped onto the rule editor. */
    operatorList?: IRuleOperator[];
    /** Loading states. */
    editedItemLoading: boolean;
    operatorListLoading: boolean;
    /** The initial rule nodes, e.g. when loading an existing rule. */
    initialRuleOperatorNodes?: IRuleOperatorNode[];
}

/** Creates a rule editor model context that contains the actual rule model and low-level update functions. */
export const RuleEditorContext = React.createContext<RuleEditorContextProps>({
    operatorList: [],
    editedItemLoading: false,
    operatorListLoading: false,
});
