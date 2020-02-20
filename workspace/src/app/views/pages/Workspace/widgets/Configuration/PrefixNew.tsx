import React from 'react';
import Card from '@wrappers/blueprint/card';
import Button from '@wrappers/blueprint/button';
import InputGroup from '@wrappers/blueprint/input-group';
import { Intent } from "@wrappers/blueprint/constants";
import Row from "@wrappers/carbon/grid/Row";
import Col from "@wrappers/carbon/grid/Col";

const PrefixNew = ({onAdd, onChangePrefix, prefix}) => {
    return (
        <Card>
            <h4>Add Prefix</h4>
            <Row>
                <Col span={7}>
                    <InputGroup
                        value={prefix.prefixName}
                        onChange={(e) => onChangePrefix('prefixName', e.target.value)}
                        placeholder={'Prefix Name'}/>
                </Col>
                <Col span={8}>
                    <InputGroup
                        value={prefix.prefixUri}
                        onChange={(e) => onChangePrefix('prefixUri', e.target.value)}
                        placeholder={'Prefix URI'}
                    />
                </Col>
                <Col span={1}>
                    <Button intent={Intent.SUCCESS} onClick={onAdd}
                            disabled={!prefix.prefixName || !prefix.prefixUri}>
                        Add
                    </Button>
                </Col>
            </Row>
        </Card>
    );
};

export default PrefixNew;
