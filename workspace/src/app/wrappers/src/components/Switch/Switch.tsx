import React, { memo } from 'react';
import { Switch as B_Switch } from "@blueprintjs/core";

function Switch(props) {
    const handleChange = (e) => {
        props.onChange(e.target.checked)
    };

    return <B_Switch
        {...props}
        onChange={handleChange}
    />
}

export default memo(Switch);
