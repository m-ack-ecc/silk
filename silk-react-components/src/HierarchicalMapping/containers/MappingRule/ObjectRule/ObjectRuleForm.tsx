import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
    Card,
    CardTitle,
    CardContent,
    CardActions,
    RadioGroup,
    Spinner,
    ScrollingHOC,
} from '@eccenca/gui-elements';
import {
    FieldItem
} from '@gui-elements/index';
import {
    AffirmativeButton,
    DismissiveButton,
    Radio,
    TextField,
} from '@gui-elements/legacy-replacements';
import _ from 'lodash';
import ExampleView from '../ExampleView';
import { ParentElement } from '../../../components/ParentElement';
import {checkUriTemplateValidity, checkValuePathValidity, createMappingAsync, fetchSuggestions} from '../../../store';
import { convertToUri } from '../../../utils/convertToUri';
import ErrorView from '../../../components/ErrorView';
import AutoComplete from '../../../components/AutoComplete';
import {
    MAPPING_RULE_TYPE_ROOT,
    } from '../../../utils/constants';
import { MAPPING_RULE_TYPE_URI, MESSAGES } from '../../../utils/constants';
import EventEmitter from '../../../utils/EventEmitter';
import { trimValue } from '../../../utils/trimValue';
import { wasTouched } from '../../../utils/wasTouched';
import { newValueIsIRI } from '../../../utils/newValueIsIRI';
import TargetCardinality from "../../../components/TargetCardinality";
import MultiAutoComplete from "../../../components/MultiAutoComplete";
import AutoSuggestion, {IReplacementResult} from "../../../components/AutoSuggestion/AutoSuggestion";

interface IProps {
    id?: string
    parentId: string
    scrollIntoView: ({topOffset: number}) => any
    onAddNewRule: (callback: () => any) => any
    scrollElementIntoView: () => any
    ruleData: object
    parent: any
}

/**
 * Provides the editable form for object mappings.
 */
export class ObjectRuleForm extends Component<IProps, any> {
    // define property types
    static propTypes = {
        id: PropTypes.string,
        parentId: PropTypes.string.isRequired,
        scrollIntoView: PropTypes.func.isRequired,
        onAddNewRule: PropTypes.func.isRequired,
        scrollElementIntoView: PropTypes.func.isRequired,
        ruleData: PropTypes.object.isRequired,
    };

    /**
     * React's lifecycle method
     * @param props
     */
    constructor(props) {
        super(props);

        this.state = {
            loading: false,
            changed: false,
            create: !props.id,
            // get a deep copy of origin data for modification
            modifiedValues: _.cloneDeep(props.ruleData),
            saveObjectError: undefined,
        };

        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleChangeValue = this.handleChangeValue.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    /**
     * React's lifecycle method
     */
    componentDidMount() {
        const { id, scrollIntoView } = this.props;
        // set screen focus to this element
        scrollIntoView({ topOffset: 75 });
        if (!id) {
            EventEmitter.emit(MESSAGES.RULE_VIEW.CHANGE, { id: 0 });
        }
    }

    /**
     * Saves the modified data
     * @param event
     */
    handleConfirm(event) {
        event.stopPropagation();
        event.persist();
        this.setState({
            loading: true,
        });
        const { modifiedValues } = this.state;
        createMappingAsync({
            id: this.props.id,
            parentId: this.props.parentId,
            type: modifiedValues.type,
            comment: modifiedValues.comment,
            label: modifiedValues.label,
            sourceProperty: trimValue(modifiedValues.sourceProperty),
            targetProperty: trimValue(modifiedValues.targetProperty),
            targetEntityType: modifiedValues.targetEntityType,
            isAttribute: modifiedValues.isAttribute,
            pattern: trimValue(modifiedValues.pattern),
            entityConnection: modifiedValues.entityConnection === 'to',
        }, true)
            .subscribe(
                () => {
                    if (this.props.onAddNewRule) {
                        this.props.onAddNewRule(() => {
                            this.handleClose(event);
                        });
                    } else {
                        this.handleClose(event);
                    }
                },
                err => {
                    this.setState({
                        saveObjectError: err.response.body,
                        loading: false,
                    });
                }
            );
    }

    /**
     * Handle input changes from user
     * @param name
     * @param value
     */
    handleChangeValue(name, value) {
        const { id, ruleData } = this.props;
        const { create, modifiedValues } = this.state;

        const newModifiedValues = {
            ...modifiedValues,
            [name]: value
        };

        const changed = create || wasTouched(ruleData, newModifiedValues);

        if (id) {
            if (changed) {
                EventEmitter.emit(MESSAGES.RULE_VIEW.CHANGE, { id });
            } else {
                EventEmitter.emit(MESSAGES.RULE_VIEW.UNCHANGED, { id });
            }
        }
        this.setState({
            modifiedValues: newModifiedValues,
            changed,
        });
    }

    /**
     * handle form close event
     * @param event
     */
    handleClose(event) {
        event.stopPropagation();
        const { id = 0 } = this.props;
        EventEmitter.emit(MESSAGES.RULE_VIEW.UNCHANGED, { id });
        EventEmitter.emit(MESSAGES.RULE_VIEW.CLOSE, { id });
    }

    /**
     * React's lifecycle method
     * @returns {*}
     */
    render() {
        const { id, parentId, parent } = this.props;
        const {
            saveObjectError, loading, modifiedValues, changed,
        } = this.state;

        const autoCompleteRuleId = id || parentId;

        if (loading) {
            return <Spinner />;
        }

        // FIXME: also check if data really has changed before allow saving
        const allowConfirm =
            modifiedValues.type === MAPPING_RULE_TYPE_ROOT || !_.isEmpty(modifiedValues.targetProperty) || modifiedValues.sourceProperty && !_.isEmpty(modifiedValues.sourceProperty.trim());
        const errorMessage = saveObjectError && (
            <ErrorView {...saveObjectError} />
        );

        // TODO: add source path if: parent, not edit, not root element
        const title = !id && <CardTitle>Add object mapping</CardTitle>;

        let targetPropertyInput: JSX.Element | undefined = undefined
        let targetCardinality: JSX.Element | undefined = undefined
        let entityRelationInput: JSX.Element | undefined = undefined
        let sourcePropertyInput: JSX.Element | undefined = undefined

        targetCardinality = (
            <TargetCardinality
                className="ecc-silk-mapping__ruleseditor__isAttribute"
                isAttribute={modifiedValues.isAttribute}
                isObjectMapping={true}
                onChange={(value) => this.handleChangeValue('isAttribute', value)}
            />
        );

        if (modifiedValues.type !== MAPPING_RULE_TYPE_ROOT) {
            // TODO: where to get get list of target properties
            targetPropertyInput = (
                <AutoComplete
                    placeholder="Target property"
                    className="ecc-silk-mapping__ruleseditor__targetProperty"
                    entity="targetProperty"
                    newOptionCreator={convertToUri}
                    isValidNewOption={newValueIsIRI}
                    creatable
                    ruleId={autoCompleteRuleId}
                    data-id="autocomplete_target_prop"
                    value={modifiedValues.targetProperty}
                    onChange={value => { this.handleChangeValue('targetProperty', value); }}
                    resetQueryToValue={true}
                    itemDisplayLabel={(item) => item.label ? `${item.label} <${item.value}>` : item.value}
                />
            );
            entityRelationInput = (
                <FieldItem>
                    <RadioGroup
                        onChange={({ value }) => { this.handleChangeValue('entityConnection', value); }}
                        value={
                            !_.isEmpty(modifiedValues.entityConnection)
                                ? modifiedValues.entityConnection
                                : 'from'
                        }
                        name=""
                        disabled={false}
                        data-id="entity_radio_group"
                    >
                        <Radio
                            value="from"
                            label={
                                <span>
                                    Connect from{' '}
                                    <ParentElement parent={parent} />
                                </span>
                            }
                        />
                        <Radio
                            value="to"
                            label={
                                <span>
                                    Connect to{' '}
                                    <ParentElement parent={parent} />
                                </span>
                            }
                        />
                    </RadioGroup>
                </FieldItem>
            );
            const valuePath = modifiedValues.sourceProperty == null ? "" : typeof modifiedValues.sourceProperty === "string" ? modifiedValues.sourceProperty : modifiedValues.sourceProperty.value
            sourcePropertyInput = (
                <AutoSuggestion
                    id={"object-value-path-auto-suggestion"}
                    label="Value path"
                    initialValue={valuePath}
                    clearIconText={"Clear value path"}
                    validationErrorText={"The entered value path is invalid."}
                    onChange={value => {
                        this.handleChangeValue('sourceProperty', value);
                    }}
                    fetchSuggestions={(input, cursorPosition) => fetchSuggestions(autoCompleteRuleId, input, cursorPosition)}
                    checkInput={checkValuePathValidity}
                />
            );
        }

        let patternInput: JSX.Element | undefined = undefined

        if (id) {
            if (modifiedValues.uriRuleType === 'uri') {
                patternInput = (
                    <AutoSuggestion
                        id={"uri-pattern-auto-suggestion"}
                        label="URI pattern"
                        initialValue={modifiedValues.pattern}
                        clearIconText={"Clear URI template"}
                        validationErrorText={"The entered URI pattern is invalid."}
                        onChange={value => {
                            this.handleChangeValue('pattern', value);
                        }}
                        fetchSuggestions={(input, cursorPosition) => ({
                            inputString: input,
                            // Repeats the cursor position from the corresponding request
                            cursorPosition,
                            replacementResults: []
                        })}
                        checkInput={checkUriTemplateValidity}
                    />
                );
            } else {
                patternInput = (
                    <TextField
                        disabled
                        label="URI formula"
                        value="This URI cannot be edited in the edit form."
                    />
                );
            }
        }

        return (
            <div className="ecc-silk-mapping__ruleseditor">
                <Card shadow={!id ? 1 : 0}>
                    {title}
                    <CardContent>
                        {errorMessage}
                        {targetPropertyInput}
                        {entityRelationInput}
                        <MultiAutoComplete
                            placeholder="Target entity type"
                            className="ecc-silk-mapping__ruleseditor__targetEntityType"
                            entity="targetEntityType"
                            isValidNewOption={newValueIsIRI}
                            ruleId={autoCompleteRuleId}
                            value={modifiedValues.targetEntityType}
                            creatable
                            onChange={value => { this.handleChangeValue('targetEntityType', value); }}
                        />
                        {targetCardinality}
                        {patternInput}
                        {sourcePropertyInput}
                        {
                            // Data preview
                            (modifiedValues.pattern || modifiedValues.uriRule) && (
                                <ExampleView
                                    id={parentId || 'root'}
                                    rawRule={
                                        // when not "pattern" then it is "uriRule"
                                        modifiedValues.pattern ?
                                            {
                                                type: MAPPING_RULE_TYPE_URI,
                                                pattern: modifiedValues.pattern,
                                            }
                                            : modifiedValues.uriRule
                                    }
                                    ruleType={
                                        // when not "pattern" then it is "uriRule"
                                        modifiedValues.pattern ? MAPPING_RULE_TYPE_URI : modifiedValues.uriRule.type
                                    }
                                />
                            )
                        }
                        <TextField
                            label="Label"
                            className="ecc-silk-mapping__ruleseditor__label"
                            value={modifiedValues.label}
                            onChange={({ value }) => { this.handleChangeValue('label', value); }}
                        />
                        <TextField
                            multiline
                            label="Description"
                            className="ecc-silk-mapping__ruleseditor__comment"
                            value={modifiedValues.comment}
                            onChange={({ value }) => { this.handleChangeValue('comment', value); }}
                        />
                    </CardContent>
                    <CardActions className="ecc-silk-mapping__ruleseditor__actionrow">
                        <AffirmativeButton
                            className="ecc-silk-mapping__ruleseditor__actionrow-save"
                            raised
                            onClick={this.handleConfirm}
                            disabled={!allowConfirm || !changed}
                        >
                            Save
                        </AffirmativeButton>
                        <DismissiveButton
                            className="ecc-silk-mapping__ruleseditor__actionrow-cancel"
                            raised
                            onClick={this.handleClose}
                        >
                            Cancel
                        </DismissiveButton>
                    </CardActions>
                </Card>
            </div>
        );
    }
}

export default ScrollingHOC(ObjectRuleForm);
