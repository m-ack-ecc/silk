import React, {useEffect, useState} from 'react';

import {Chip} from '@eccenca/gui-elements';
import ErrorView from '../../components/ErrorView';
import _ from 'lodash';

import {childExampleAsync, ruleExampleAsync} from '../../store';
import {InfoBox} from '../../components/InfoBox';
import {isDebugMode} from '../../utils/isDebugMode';
import {Notification} from "@gui-elements/index";

interface IProps {
    id: string
    rawRule?: object
    ruleType: string
    // An additional path in which context the examples should be generated, e.g. needed in the creation of an object rule when a source path is specified.
    objectSourcePathContext?: string
}
/** Shows example input and output values for a mapping rule. */
export const ExampleView = ({id, rawRule, ruleType, objectSourcePathContext}: IProps) => {
    const [example, setExample] = useState<any>(undefined)
    const [error, setError] = useState<any>(undefined)

    useEffect(() => {
        const ruleExampleFunc = rawRule ? childExampleAsync : ruleExampleAsync;
        ruleExampleFunc({
            id: id,
            rawRule: rawRule,
            ruleType: ruleType,
            objectPath: objectSourcePathContext
        }).subscribe(
            ({ example }) => {
                setExample(example);
            },
            error => {
                isDebugMode('err MappingRuleOverview: rule.example');
                setError(error);
            }
        );
    }, [id, objectSourcePathContext])

    if (error) {
        return <ErrorView {...error} titlePrefix={"There has been an error loading the examples: "}/>;
    }

    if (_.isUndefined(example)) {
        return <div/>;
    }

    const pathsCount = _.size(example.sourcePaths);
    const resultsCount = _.size(example.results);

    if (resultsCount === 0) {
        return <Notification>Preview has returned no results.</Notification>
    }

    const sourcePaths =
        pathsCount === 0 ? [''] : example.sourcePaths;

    return (
        <InfoBox>
            <table className="mdl-data-table ecc-silk-mapping__rulesviewer__examples-table">
                <thead>
                <tr>
                    <th className="ecc-silk-mapping__rulesviewer__examples-table__path">
                        Value path
                    </th>
                    <th className="ecc-silk-mapping__rulesviewer__examples-table__value">
                        Value
                    </th>
                    <th className="ecc-silk-mapping__rulesviewer__examples-table__result">
                        Transformed value
                    </th>
                </tr>
                </thead>
                {_.map(example.results, (result, index) => (
                    <tbody key={`tbody_${index}`}>
                    {sourcePaths.map((sourcePath, i) => (
                        <tr
                            key={`${index}_${sourcePath}_${i}`}
                            id={`${index}_${sourcePath}_${i}`}
                        >
                            <td
                                key="path"
                                className="ecc-silk-mapping__rulesviewer__examples-table__path"
                            >
                                {sourcePath ? (
                                    <Chip>&lrm;{sourcePath}</Chip>
                                ) : (
                                    false
                                )}
                            </td>
                            <td
                                key="value"
                                className="ecc-silk-mapping__rulesviewer__examples-table__value"
                            >
                                {_.map(
                                    result.sourceValues[i],
                                    (value, valueIndex) => (
                                        <Chip
                                            key={`${index}_${sourcePath}_${i}_${valueIndex}`}
                                        >
                                            {value}
                                        </Chip>
                                    )
                                )}
                            </td>
                            {i > 0 ? (
                                false
                            ) : (
                                <td
                                    key="result"
                                    className="ecc-silk-mapping__rulesviewer__examples-table__result"
                                    rowSpan={pathsCount}
                                >
                                    {_.map(
                                        example.results[
                                            index
                                            ].transformedValues,
                                        (transformedValue, row) => (
                                            <Chip
                                                key={`value_${index}_${i}_${row}`}
                                                id={`value_${index}_${i}_${row}`}
                                            >
                                                {transformedValue}
                                            </Chip>
                                        )
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                    </tbody>
                ))}
            </table>
        </InfoBox>
    );
}

export default ExampleView;
