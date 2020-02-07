import React from 'react';
import Card from '@wrappers/card';
import Button from '@wrappers/button';
import InputGroup from '@wrappers/input-group';
import { Intent } from "@wrappers/constants";

const PrefixNew = ({onAdd, onChangePrefix, prefix}) => {
    return (
        <Card>
            <h4>Add Prefix</h4>
            <div className='row'>
                <div className="col-5">
                    <InputGroup
                        value={prefix.prefixName}
                        onChange={(e) => onChangePrefix('prefixName', e.target.value)}
                        placeholder={'Prefix Name'}/>
                </div>
                <div className="col-6">
                    <InputGroup
                        value={prefix.prefixUri}
                        onChange={(e) => onChangePrefix('prefixUri', e.target.value)}
                        placeholder={'Prefix URI'}
                    />
                </div>
                <div className="col-1">
                    <Button intent={Intent.SUCCESS} onClick={onAdd}>Add</Button>
                </div>
            </div>
        </Card>
    );
};

export default PrefixNew;
