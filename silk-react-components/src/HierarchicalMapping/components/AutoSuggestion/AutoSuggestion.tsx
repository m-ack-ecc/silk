import React from "react";
import CodeMirror from "codemirror";
import { Icon } from "@eccenca/gui-elements";

//custom components
import { CodeEditor } from "../CodeEditor";
import Dropdown from "./Dropdown";
import { replace } from "lodash";

//styles
require("./AutoSuggestion.scss");

const AutoSuggestion = ({
    onEditorParamsChange,
    data,
    checkPathValidity,
    pathIsValid,
}) => {
    const [value, setValue] = React.useState("");
    const [inputString, setInputString] = React.useState("");
    const [cursorPosition, setCursorPosition] = React.useState(0);
    const [coords, setCoords] = React.useState({ left: 0 });
    const [shouldShowDropdown, setShouldShowDropdown] = React.useState(false);
    const [
        replacementIndexesDict,
        setReplacementIndexesDict,
    ] = React.useState({});
    const [suggestions, setSuggestions] = React.useState<
        Array<{ value: string; description?: string; label?: string }>
    >([]);
    const [
        editorInstance,
        setEditorInstance,
    ] = React.useState<CodeMirror.Editor>();
    

    React.useEffect(() => {
        //perform linting
    },[pathIsValid])

    /** generate suggestions and also populate the replacement indexes dict */
    React.useEffect(() => {
        let newSuggestions = [];
        let newReplacementIndexesDict = {};
        if(data?.replacementResults?.length === 1 && !(data?.replacementResults?.replacements?.length)){
            setShouldShowDropdown(false)
        }
        if (data?.replacementResults?.length) {
            data.replacementResults.forEach(
                ({ replacements, replacementInterval: { from, length } }) => {
                    newSuggestions = [...newSuggestions, ...replacements];
                    replacements.forEach((replacement) => {
                        newReplacementIndexesDict = {
                            ...newReplacementIndexesDict,
                            [replacement.value]: {
                                from,
                                length,
                            },
                        };
                    });
                }
            );
            setSuggestions(() => newSuggestions)
            setReplacementIndexesDict(() => newReplacementIndexesDict)
        }
    }, [data]);

    React.useEffect(() => {
        setInputString(() => value);
        setShouldShowDropdown(true);
        checkPathValidity(inputString);
        onEditorParamsChange(inputString, cursorPosition);
    }, [cursorPosition, value, inputString]);

    const handleChange = (val) => {
        setValue(val);
    };

    const handleCursorChange = (pos, coords) => {
        setCursorPosition(pos.ch);
        setCoords(() => coords);
    };

    const handleTextHighlighting = (focusedSuggestion: string) => {
        editorInstance.refresh()
        const indexes = replacementIndexesDict[focusedSuggestion];
        if (indexes) {
            const { from, length } = indexes;
            const to = from + length;
            editorInstance.markText({ line: 1, ch: 0}, { line: 1, ch: 10 }, {css:"color: red"});
        }
    };

    const handleDropdownChange = (selectedSuggestion:string) => {
        const indexes = replacementIndexesDict[selectedSuggestion];
        if (indexes) {
            const { from, length } = indexes;
            const to = from + length;
            setValue(
                (value) =>
                    `${value.substring(0, from)}${selectedSuggestion}${value.substring(
                        to
                    )}`
            );
            setShouldShowDropdown(false);
            editorInstance.setCursor({ line: 1, ch: to });
        }
    };

    const handleInputEditorClear = () => {
        if (!pathIsValid) {
            setValue("");
        }
    };

    return (
        <div className="ecc-auto-suggestion-box">
            <div className="ecc-auto-suggestion-box__editor-box">
                <CodeEditor
                    setEditorInstance={setEditorInstance}
                    onChange={handleChange}
                    onCursorChange={handleCursorChange}
                    value={value}
                />
                <div onClick={handleInputEditorClear}>
                    <Icon
                        className={`editor__icon ${
                            pathIsValid ? "confirm" : "clear"
                        }`}
                        name={pathIsValid ? "confirm" : "clear"}
                    />
                </div>
            </div>
            {shouldShowDropdown ? (
                <div
                    className="ecc-auto-suggestion-box__dropdown"
                    style={{ left: coords.left }}
                >
                    <Dropdown
                        query={value}
                        options={suggestions}
                        isOpen={shouldShowDropdown}
                        onItemSelectionChange={handleDropdownChange}
                        onMouseOverItem={handleTextHighlighting}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default AutoSuggestion;
