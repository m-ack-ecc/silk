import { IPathInput, ITransformOperator, IValueInput, RuleLayout } from "./rule.typings";
import {
    IParameterSpecification,
    IParameterValidationResult,
    IPortSpecification,
    IRuleOperator,
    IRuleOperatorNode,
    IRuleSideBarFilterTabConfig,
    IRuleSidebarPreConfiguredOperatorsTabConfig,
    RuleParameterType,
    RuleValidationError,
} from "../../../shared/RuleEditor/RuleEditor.typings";
import { RuleOperatorFetchFnType } from "../../../shared/RuleEditor/RuleEditor";
import { IPluginDetails } from "@ducks/common/typings";
import {
    RuleEditorNodeParameterValue,
    ruleEditorNodeParameterValue,
} from "../../../shared/RuleEditor/model/RuleEditorModel.typings";

/** Extracts the operator node from a path input. */
const extractOperatorNodeFromPathInput = (
    pathInput: IPathInput,
    result: IRuleOperatorNode[],
    isTarget: boolean | undefined
): string => {
    result.push({
        nodeId: pathInput.id,
        label: isTarget ? "Target path" : "Source path",
        pluginType: "PathInputOperator",
        pluginId: isTarget ? "targetPathInput" : "sourcePathInput", // We use the plugin ID to denote if this is a source or target path input.
        inputs: [],
        parameters: {
            path: pathInput.path,
        },
        portSpecification: {
            minInputPorts: 0,
            maxInputPorts: 0,
        },
    });
    return pathInput.id;
};

/** Extract the operator node from a transform input. */
const extractOperatorNodeFromTransformInput = (
    transformInput: ITransformOperator,
    result: IRuleOperatorNode[],
    isTarget: boolean | undefined,
    ruleOperator: RuleOperatorFetchFnType
): string => {
    const inputs = transformInput.inputs.map((input) =>
        extractOperatorNodeFromValueInput(input, result, isTarget, ruleOperator)
    );
    result.push({
        nodeId: transformInput.id,
        inputs: inputs,
        pluginType: "TransformOperator",
        pluginId: transformInput.function,
        label: ruleOperator(transformInput.function, "TransformOperator")?.label ?? transformInput.function,
        parameters: transformInput.parameters,
        portSpecification: {
            minInputPorts: 1,
        },
        tags: ["Transform"],
    });
    return transformInput.id;
};

/** Extract operator nodes from an value input node, i.e. path input or transform operator.
 *
 * @param operator The value input operator.
 * @param result   The result array this operator should be added to.
 * @param isTarget Only important in the context of comparisons where we have to distinguish between source and target paths.
 */
const extractOperatorNodeFromValueInput = (
    operator: IValueInput | undefined,
    result: IRuleOperatorNode[],
    isTarget: boolean | undefined,
    ruleOperator: (pluginId: string, pluginType?: string) => IRuleOperator | undefined
): string | undefined => {
    if (operator) {
        const nodeId =
            operator.type === "pathInput"
                ? extractOperatorNodeFromPathInput(operator as IPathInput, result, isTarget)
                : extractOperatorNodeFromTransformInput(operator as ITransformOperator, result, isTarget, ruleOperator);
        return nodeId;
    }
};

/** Input path operator used in the transform and linking operators. */
const inputPathOperator = (
    pluginId: string,
    label: string,
    description?: string,
    customValidation?: (value: RuleEditorNodeParameterValue) => IParameterValidationResult
): IRuleOperator => {
    return {
        pluginType: "PathInputOperator",
        pluginId: pluginId,
        portSpecification: {
            minInputPorts: 0,
            maxInputPorts: 0,
        },
        label: label,
        parameterSpecification: {
            path: parameterSpecification({
                label: "Path",
                type: "pathInput",
                description: "The source input path as Silk path expression.",
                defaultValue: "",
                customValidation,
            }),
        },
        categories: ["Input"],
        icon: undefined, // TODO: CMEM-3919: Icon for path input
        description: description,
        tags: [],
    };
};

type OptionalParameterAttributes = "defaultValue" | "type" | "advanced" | "required";
/** Parameter specification convenience function. */
const parameterSpecification = ({
    label,
    defaultValue = "",
    type = "textField",
    description,
    advanced = false,
    required = true,
    customValidation,
}: Omit<IParameterSpecification, OptionalParameterAttributes> &
    Partial<Pick<IParameterSpecification, OptionalParameterAttributes>>): IParameterSpecification => {
    return {
        label,
        defaultValue,
        type,
        description,
        advanced,
        required,
        customValidation,
    };
};

/** Converts plugin details from the backend to rule operators.
 *
 * @param pluginDetails                      The details of the operator plugin.
 * @param addAdditionParameterSpecifications Callback function to decide if additional parameters should be added to an operator.
 */
const convertRuleOperator = (
    pluginDetails: IPluginDetails,
    addAdditionParameterSpecifications: (pluginDetails: IPluginDetails) => [id: string, spec: IParameterSpecification][]
): IRuleOperator => {
    const required = (parameterId: string) => pluginDetails.required.includes(parameterId);
    const additionalParamSpecs = addAdditionParameterSpecifications(pluginDetails);
    return {
        pluginType: pluginDetails.pluginType ?? "unknown",
        pluginId: pluginDetails.pluginId,
        label: pluginDetails.title,
        description: pluginDetails.description,
        categories: pluginDetails.categories,
        icon: "artefact-task", // FIXME: Which icons? CMEM-3919
        parameterSpecification: Object.fromEntries([
            ...Object.entries(pluginDetails.properties).map(([parameterId, parameterSpec]) => {
                const spec: IParameterSpecification = {
                    label: parameterSpec.title,
                    description: parameterSpec.description,
                    advanced: parameterSpec.advanced,
                    required: required(parameterId),
                    type: convertPluginParameterType(parameterSpec.parameterType),
                    autoCompletion: parameterSpec.autoCompletion,
                    defaultValue: parameterSpec.value,
                };
                return [parameterId, spec];
            }),
            ...additionalParamSpecs,
        ]),
        portSpecification: portSpecification(pluginDetails),
        tags: pluginTags(pluginDetails),
    };
};

// Converts the parameter type of the plugin to any of the supported types of the parameter UI component
const convertPluginParameterType = (pluginParameterType: string): RuleParameterType => {
    switch (pluginParameterType) {
        case "multiline string":
            return "textArea";
        case "int":
        case "Long":
        case "option[int]":
            return "int";
        case "boolean":
            return "boolean";
        case "stringmap": // TODO: CMEM-3873 Investigate how common this type is
            return "textArea";
        case "double":
            return "float";
        case "traversable[string]": // TODO: CMEM-3873: Have some kind of list component here?
            return "textArea";
        case "restriction":
            return "code";
        case "password":
            return "password";
        case "resource":
            return "resource";
        case "duration":
        case "char": // TODO: CMEM-3873: We could further restrict its target type
        case "uri": // TODO: CMEM-3873: We could handle URIs with a special target type
        case "option[identifier]": // TODO: CMEM-3873: We could check identifiers
        case "identifier":
        case "enumeration": // TODO: CMEM-3873: Add auto-completion
        case "project": // TODO: CMEM-3873: Add auto-completion
        case "task": // TODO: CMEM-3873: Add auto-completion
        default:
            return "textField";
    }
};

/** Tags for a rule operator based on its plugin specification. */
const pluginTags = (pluginDetails: IPluginDetails): string[] => {
    switch (pluginDetails.pluginType) {
        case "TransformOperator":
            return ["Transform"]; // TODO: Discuss: CMEM-3919: i18n?
        case "ComparisonOperator":
            return ["Comparison"];
        case "AggregationOperator":
            return ["Aggregation"];
        default:
            return [];
    }
};

const portSpecification = (op: IPluginDetails): IPortSpecification => {
    switch (op.pluginType) {
        case "ComparisonOperator":
            return { minInputPorts: 2, maxInputPorts: 2 };
        default:
            return { minInputPorts: 1 };
    }
};

/** Converts a rule operator node to a value input. */
const convertRuleOperatorNodeToValueInput = (
    ruleOperatorNode: IRuleOperatorNode,
    ruleOperatorNodes: Map<string, IRuleOperatorNode>
): IValueInput => {
    if (ruleOperatorNode.pluginType === "TransformOperator") {
        const transformOperator: ITransformOperator = {
            id: ruleOperatorNode.nodeId,
            function: ruleOperatorNode.pluginId,
            inputs: ruleOperatorNode.inputs
                .filter((i) => i != null)
                .map((i) =>
                    convertRuleOperatorNodeToValueInput(
                        fetchRuleOperatorNode(i!!, ruleOperatorNodes, ruleOperatorNode),
                        ruleOperatorNodes
                    )
                ),
            parameters: Object.fromEntries(
                Object.entries(ruleOperatorNode.parameters).map(([parameterKey, parameterValue]) => [
                    parameterKey,
                    parameterValue ?? "",
                ])
            ),
            type: "transformInput",
        };
        return transformOperator;
    } else if (ruleOperatorNode.pluginType === "PathInputOperator") {
        const pathInput: IPathInput = {
            id: ruleOperatorNode.nodeId,
            path: ruleEditorNodeParameterValue(ruleOperatorNode.parameters["path"]) ?? "",
            type: "pathInput",
        };
        return pathInput;
    } else {
        throw Error(
            `Tried to convert ${ruleOperatorNode.pluginType} node '${ruleOperatorNode.label}' to incompatible value input!`
        );
    }
};

/** Fetches and operator node from the available nodes. */
const fetchRuleOperatorNode = (
    nodeId: string,
    ruleOperators: Map<string, IRuleOperatorNode>,
    parentNode?: IRuleOperatorNode
): IRuleOperatorNode => {
    const ruleOperatorNode = ruleOperators.get(nodeId);
    if (ruleOperatorNode) {
        return ruleOperatorNode;
    } else {
        throw new Error(
            `Rule operator node with ID '${nodeId}' does not exist${
                parentNode ? `, but is defined as input for node '${parentNode.label}'!` : "!"
            }`
        );
    }
};

/** Converts the editor rule operator nodes to a map from ID to node and also returns all root nodes, i.e. nodes without parent. */
const convertToRuleOperatorNodeMap = (
    ruleOperatorNodes: IRuleOperatorNode[],
    validate: boolean
): [Map<string, IRuleOperatorNode>, IRuleOperatorNode[]] => {
    const hasParent = new Set<string>();
    const nodeMap = new Map<string, IRuleOperatorNode>(
        ruleOperatorNodes.map((node) => {
            node.inputs.filter((i) => i != null).forEach((i) => hasParent.add(i!!));
            return [node.nodeId, node];
        })
    );
    const rootNodes = ruleOperatorNodes.filter((node) => !hasParent.has(node.nodeId));
    if (validate && rootNodes.length > 1) {
        throw new RuleValidationError(
            `More than one root node found, but at most one is allowed! Root nodes: ${rootNodes
                .map((n) => n.label)
                .join(", ")}`,
            rootNodes.map((node) => ({
                nodeId: node.nodeId,
                message: `Rule operator '${node.label}' is not the only root node.`,
            }))
        );
    } else if (validate && rootNodes.length === 0 && nodeMap.size > 0) {
        throw Error(`Rule tree cannot be saved, because it contains cycles!`);
    } else if (validate && rootNodes.length === 1) {
        const cycle = findCycles(rootNodes[0], nodeMap);
        if (cycle) {
            throw new RuleValidationError(
                "Illegal cycle found in rule. Path from root node to cycled node: " +
                    cycle.map((n) => n.label).join(", "),
                cycle
            );
        }
    }
    return [nodeMap, rootNodes];
};

/** Returns the first cycle found if any exist. */
const findCycles = (
    rootNode: IRuleOperatorNode,
    nodeMap: Map<string, IRuleOperatorNode>
): IRuleOperatorNode[] | undefined => {
    const visitedNodes = new Set<string>();
    const iterate = (operatorNode: IRuleOperatorNode): IRuleOperatorNode[] | undefined => {
        if (visitedNodes.has(operatorNode.nodeId)) {
            return [operatorNode];
        } else {
            visitedNodes.add(operatorNode.nodeId);
            operatorNode.inputs.forEach((child) => {
                if (child && nodeMap.has(child)) {
                    const result = iterate(nodeMap.get(child)!!);
                    if (result) {
                        result.push(operatorNode);
                        return result;
                    }
                }
            });
        }
    };
    const result = iterate(rootNode);
    if (visitedNodes.size !== nodeMap.size) {
        throw new RuleValidationError(
            `Root node '${rootNode.label}' is not connected to all nodes! There are overall ${nodeMap.size} nodes, but only ${visitedNodes.size} are part of the rule tree spanned by '${rootNode.label}'.`,
            [rootNode]
        );
    }
    return result ? result.reverse() : undefined;
};

/** Extract rule layout from rule operator nodes. */
const ruleLayout = (nodes: IRuleOperatorNode[]): RuleLayout => {
    const nodePositions: { [key: string]: [number, number] } = {};
    nodes.forEach((node) => {
        if (node.position) {
            nodePositions[node.nodeId] = [Math.round(node.position.x), Math.round(node.position.y)];
        }
    });
    return {
        nodePositions: nodePositions,
    };
};

/** Specifies the allowed connections. Only connections that return true are allowed. */
const validateConnection = (
    fromRuleOperatorNode: IRuleOperatorNode,
    toRuleOperatorNode: IRuleOperatorNode,
    targetPortIdx: number
): boolean => {
    switch (fromRuleOperatorNode.pluginType) {
        case "PathInputOperator":
            // Target must be either a comparison or a transform operator
            if (toRuleOperatorNode.pluginType === "ComparisonOperator") {
                return (
                    (fromRuleOperatorNode.pluginId === "targetPathInput" && targetPortIdx === 1) ||
                    (fromRuleOperatorNode.pluginId === "sourcePathInput" && targetPortIdx === 0)
                );
            } else if (toRuleOperatorNode.pluginType === "TransformOperator") {
                return true;
            } else {
                return false;
            }
        case "ComparisonOperator":
            return toRuleOperatorNode.pluginType === "AggregationOperator";
        case "AggregationOperator":
            return toRuleOperatorNode.pluginType === "AggregationOperator";
        case "TransformOperator":
            return (
                toRuleOperatorNode.pluginType === "ComparisonOperator" ||
                toRuleOperatorNode.pluginType === "TransformOperator"
            );
        default:
            return true;
    }
};

type TabIdType = "all" | "transform" | "comparison" | "aggregation";

const sortAlphabetically = (ruleOpA: IRuleOperator, ruleOpB: IRuleOperator) =>
    ruleOpA.label.toLowerCase() < ruleOpB.label.toLowerCase() ? -1 : 1;

const sidebarTabs: Record<TabIdType, IRuleSideBarFilterTabConfig | IRuleSidebarPreConfiguredOperatorsTabConfig> = {
    all: {
        id: "all",
        label: "All", // TODO: i18n and icon
        filterAndSort: (ops) => ops,
    },
    transform: {
        id: "transform",
        label: "Transform",
        filterAndSort: (ops) => ops.filter((op) => op.pluginType === "TransformOperator").sort(sortAlphabetically),
    },
    comparison: {
        id: "comparison",
        label: "Comparison",
        filterAndSort: (ops) => ops.filter((op) => op.pluginType === "ComparisonOperator").sort(sortAlphabetically),
    },
    aggregation: {
        id: "aggregation",
        label: "Aggregation",
        filterAndSort: (ops) => ops.filter((op) => op.pluginType === "AggregationOperator").sort(sortAlphabetically),
    },
};

const ruleUtils = {
    convertRuleOperator,
    convertRuleOperatorNodeToValueInput,
    convertToRuleOperatorNodeMap,
    extractOperatorNodeFromValueInput,
    fetchRuleOperatorNode,
    inputPathOperator,
    parameterSpecification,
    ruleLayout,
    validateConnection,
    sidebarTabs,
};

export default ruleUtils;
